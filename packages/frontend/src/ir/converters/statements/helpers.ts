/**
 * Helper utilities for statement conversion
 */

import {
  getTstsIdentifierText,
  getTstsInitializerNode,
  getTstsTypeArguments,
  hasTstsAbstractModifier,
  hasTstsAmbientModifier,
  hasTstsExportModifier,
  hasTstsPrivateModifier,
  hasTstsProtectedModifier,
  hasTstsReadonlyModifier,
  hasTstsStaticModifier,
  isTstsOptionalParameter,
  isTstsRestParameter,
  TstsSyntax,
  type TstsNode,
} from "@tsonic/tsts";
import {
  IrParameter,
  IrAccessibility,
  IrTypeParameter,
  IrInterfaceMember,
  IrVariableDeclaration,
  IrVariableDeclarator,
  IrType,
} from "../../types.js";
import { convertBindingName } from "../../syntax/binding-patterns.js";
import { convertExpression } from "../../expression-converter.js";
import { convertInterfaceMember } from "./declarations.js";
import type { ProgramContext } from "../../program-context.js";
import {
  resolveMutableNumericLiteralDeclarationType,
  withVariableDeclaratorTypeEnv,
} from "../type-env.js";
import {
  extensionReceiverSemanticsFactKey,
  fieldSemanticsFactKey,
  isExtensionReceiverFact,
  isFieldStorageFact,
  parameterPassingFactKey,
  parameterPassingModeFromFact,
  type IrParameterPassingMode,
  type SourceSemanticFactKey,
} from "../../../source-frontend/index.js";

/**
 * Optional class fields (`foo?: T`) are semantically `T | undefined` in TS.
 *
 * For value types, this is the only correct way to emit nullable target (`T?`).
 * We encode this deterministically in IR so the existing union emitter can
 * map it to target nullability correctly.
 */
export const makeOptionalType = (t: IrType): IrType => {
  if (t.kind === "unionType") {
    const hasUndefined = t.types.some(
      (x) => x.kind === "primitiveType" && x.name === "undefined"
    );
    if (hasUndefined) return t;
    return {
      kind: "unionType",
      types: [...t.types, { kind: "primitiveType", name: "undefined" }],
    };
  }

  // Avoid double-wrapping `undefined`.
  if (t.kind === "primitiveType" && t.name === "undefined") return t;

  return {
    kind: "unionType",
    types: [t, { kind: "primitiveType", name: "undefined" }],
  };
};

export const definedTstsNodes = (
  nodes: readonly (TstsNode | undefined)[] | undefined
): readonly TstsNode[] =>
  (nodes ?? []).filter((node): node is TstsNode => node !== undefined);

/**
 * Convert TypeScript type parameters to IR, detecting structural constraints
 */
export const convertTypeParameters = (
  typeParameters: readonly TstsNode[] | undefined,
  ctx: ProgramContext
): readonly IrTypeParameter[] | undefined => {
  if (!typeParameters || typeParameters.length === 0) {
    return undefined;
  }

  // Convert type parameter syntax through the TypeSystem.
  const typeSystem = ctx.typeSystem;

  return typeParameters.map((tp) => {
    const declaration = TstsSyntax.AsTypeParameterDeclaration(tp);
    const name = getTstsIdentifierText(TstsSyntax.Node_Name(tp)) ?? "_";
    const constraint = declaration?.Constraint
      ? typeSystem.typeFromSyntax(
          ctx.binding.captureTypeSyntax(declaration.Constraint)
        )
      : undefined;
    const defaultType = declaration?.DefaultType
      ? typeSystem.typeFromSyntax(
          ctx.binding.captureTypeSyntax(declaration.DefaultType)
        )
      : undefined;

    // Check if constraint is structural (object literal type)
    const isStructural =
      declaration?.Constraint?.Kind === TstsSyntax.KindTypeLiteral;

    // Extract structural members if it's a structural constraint
    const structuralMembers =
      isStructural && declaration?.Constraint
        ? definedTstsNodes(TstsSyntax.Node_Members(declaration.Constraint))
            .map((member) => convertInterfaceMember(member, ctx))
            .filter((m): m is IrInterfaceMember => m !== null)
        : undefined;

    return {
      kind: "typeParameter" as const,
      name,
      constraint,
      default: defaultType,
      variance: undefined, // TypeScript doesn't expose variance directly
      isStructuralConstraint: isStructural,
      structuralMembers,
    };
  });
};

type SourceFactReader = <T>(
  node: TstsNode,
  key: SourceSemanticFactKey<T>
) => T | undefined;

type SourceParameterTypeUnwrap = {
  readonly typeNode: TstsNode | undefined;
  readonly passing: IrParameterPassingMode;
  readonly isExtensionReceiver: boolean;
};

const unwrapSourceParameterType = (
  typeNode: TstsNode | undefined,
  readFact: SourceFactReader
): SourceParameterTypeUnwrap => {
  let current = typeNode;
  let passing: IrParameterPassingMode = "value";
  let isExtensionReceiver = false;

  while (current) {
    if (current.Kind === TstsSyntax.KindParenthesizedType) {
      current = TstsSyntax.Node_Type(current);
      continue;
    }

    if (current.Kind !== TstsSyntax.KindTypeReference) {
      break;
    }

    const typeArguments = getTstsTypeArguments(current);
    if (typeArguments.length !== 1) break;
    const innerType = typeArguments[0];
    if (!innerType) break;

    if (isExtensionReceiverFact(readFact(current, extensionReceiverSemanticsFactKey))) {
      isExtensionReceiver = true;
      current = innerType;
      continue;
    }

    if (isFieldStorageFact(readFact(current, fieldSemanticsFactKey))) {
      break;
    }

    const factPassing = parameterPassingModeFromFact(
      readFact(current, parameterPassingFactKey)
    );
    if (factPassing && factPassing !== "value") {
      passing = factPassing;
      current = innerType;
      continue;
    }

    break;
  }

  return { typeNode: current, passing, isExtensionReceiver };
};

/**
 * Convert parameters for functions and methods
 */
export const convertParameters = (
  parameters: readonly TstsNode[],
  ctx: ProgramContext
): readonly IrParameter[] => {
  return parameters.map((param) => {
    const parameter = TstsSyntax.AsParameterDeclaration(param);
    const initializerNode = getTstsInitializerNode(param);
    const nameNode = TstsSyntax.Node_Name(param) ?? param;
    const unwrapped = unwrapSourceParameterType(parameter?.Type, (node, key) =>
      ctx.sourceSemantics.getFact(node, key)
    );

    // Get parameter type for contextual typing of default value.
    const typeSystem = ctx.typeSystem;
    const paramType = unwrapped.typeNode
      ? typeSystem.typeFromSyntax(
          ctx.binding.captureTypeSyntax(unwrapped.typeNode)
        )
      : undefined;

    return {
      kind: "parameter",
      pattern: convertBindingName(nameNode, ctx),
      type: paramType,
      // Pass parameter type for contextual typing of default value
      initializer: initializerNode
        ? convertExpression(initializerNode, ctx, paramType)
        : undefined,
      isOptional: isTstsOptionalParameter(param),
      isRest: isTstsRestParameter(param),
      passing: unwrapped.passing,
      isExtensionReceiver: unwrapped.isExtensionReceiver || undefined,
    };
  });
};

/**
 * Convert variable declaration list (used in for loops)
 */
export const convertVariableDeclarationList = (
  node: TstsNode,
  ctx: ProgramContext
): IrVariableDeclaration => {
  const declarationList = TstsSyntax.AsVariableDeclarationList(node);
  const flags = declarationList?.Flags ?? 0;
  const isConst = (flags & TstsSyntax.NodeFlagsConst) !== 0;
  const isLet = (flags & TstsSyntax.NodeFlagsLet) !== 0;
  const declarationKind = isConst ? "const" : isLet ? "let" : "var";

  // Convert declaration syntax through the TypeSystem.
  const typeSystem = ctx.typeSystem;

  let currentCtx = ctx;
  const declarations: IrVariableDeclarator[] = [];

  // Convert sequentially so later declarators can refer to earlier ones.
  for (const decl of definedTstsNodes(declarationList?.Declarations?.Nodes)) {
    const explicitTypeNode = TstsSyntax.Node_Type(decl);
    const initializerNode = getTstsInitializerNode(decl);
    const explicitDeclType = explicitTypeNode
      ? typeSystem.typeFromSyntax(
          currentCtx.binding.captureTypeSyntax(explicitTypeNode)
        )
      : undefined;

    const initializer = initializerNode
      ? convertExpression(initializerNode, currentCtx, explicitDeclType)
      : undefined;
    const declType =
      explicitDeclType ??
      resolveMutableNumericLiteralDeclarationType(
        declarationKind,
        explicitDeclType,
        initializer,
        false
      );

    const irDecl = {
      kind: "variableDeclarator" as const,
      name: convertBindingName(TstsSyntax.Node_Name(decl) ?? decl, currentCtx),
      type: declType,
      initializer,
    };

    declarations.push(irDecl);
    currentCtx = withVariableDeclaratorTypeEnv(
      currentCtx,
      TstsSyntax.Node_Name(decl) ?? decl,
      irDecl
    );
  }

  return {
    kind: "variableDeclaration",
    declarationKind,
    declarations,
    isExported: false,
  };
};

/**
 * Check if node has export modifier
 */
export const hasExportModifier = (node: TstsNode): boolean => {
  return hasTstsExportModifier(node);
};

/**
 * Check if node has static modifier
 */
export const hasStaticModifier = (node: TstsNode): boolean =>
  hasTstsStaticModifier(node);

/**
 * Check if node has declare modifier.
 *
 * `declare` class members are type-only in TypeScript and should not emit runtime code.
 * Tsonic mirrors this by skipping them during IR conversion.
 */
export const hasDeclareModifier = (node: TstsNode): boolean =>
  hasTstsAmbientModifier(node);

/**
 * Check if node has abstract modifier.
 */
export const hasAbstractModifier = (node: TstsNode): boolean =>
  hasTstsAbstractModifier(node);

/**
 * Check if node has readonly modifier
 */
export const hasReadonlyModifier = (node: TstsNode): boolean =>
  hasTstsReadonlyModifier(node);

export const hasAsyncModifier = (node: TstsNode): boolean =>
  (TstsSyntax.Node_ModifierNodes(node) ?? []).some(
    (modifier) => modifier?.Kind === TstsSyntax.KindAsyncKeyword
  );

export const getAccessibility = (node: TstsNode): IrAccessibility => {
  if (hasTstsPrivateModifier(node)) return "private";
  if (hasTstsProtectedModifier(node)) return "protected";
  return "public";
};
