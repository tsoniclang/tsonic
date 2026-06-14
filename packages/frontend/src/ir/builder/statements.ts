/**
 * Statement extraction from TypeScript source
 *
 * Uses ProgramContext for statement conversion.
 */

import type { TstsNode, TstsSourceFile } from "@tsonic/tsts";
import {
  getTstsIdentifierText,
  getTstsNodeText,
  getTstsStatementNodes,
  isTstsModuleBoundaryStatement,
  TstsSyntax,
} from "@tsonic/tsts";
import { IrStatement, IrType, IrVariableDeclaration } from "../types.js";
import {
  convertStatement,
  flattenStatementResult,
} from "../statement-converter.js";
import {
  resetSyntheticRegistry,
  getSyntheticDeclarations,
} from "../converters/anonymous-synthesis.js";
import type { ProgramContext } from "../program-context.js";
import { deriveTypeFromExpression } from "../converters/type-env.js";

export type ExtractStatementsResult = {
  readonly body: readonly IrStatement[];
  readonly topLevelStatementGroups: ReadonlyMap<number, readonly IrStatement[]>;
};

const normalizeEnvType = (type: IrType | undefined): IrType | undefined => {
  if (!type) return undefined;
  if (type.kind === "unknownType" && type.explicit !== true) return undefined;
  if (type.kind === "anyType") return undefined;
  return type;
};

const getTupleElementType = (
  type: IrType | undefined,
  index: number
): IrType | undefined => {
  if (!type) return undefined;
  if (type.kind === "tupleType") {
    return type.elementTypes[index];
  }
  return undefined;
};

const getArrayElementType = (
  type: IrType | undefined,
  index: number
): IrType | undefined => {
  if (!type) return undefined;
  if (type.kind === "arrayType") return type.elementType;
  const tuple = getTupleElementType(type, index);
  if (tuple) return tuple;
  return undefined;
};

const getObjectPropertyType = (
  ctx: ProgramContext,
  type: IrType | undefined,
  propName: string
): IrType | undefined => {
  if (!type) return undefined;

  if (type.kind === "objectType") {
    const member = type.members.find(
      (m) => m.kind === "propertySignature" && m.name === propName
    );
    if (member && member.kind === "propertySignature") {
      return member.type;
    }
    return undefined;
  }

  if (type.kind === "referenceType") {
    const memberType = ctx.typeSystem.typeOfMember(type, {
      kind: "byName",
      name: propName,
    });
    return memberType.kind === "unknownType" ? undefined : memberType;
  }

  return undefined;
};

const getPropertyNameText = (name: TstsNode | undefined): string | undefined =>
  getTstsIdentifierText(name) ?? getTstsNodeText(name);

const extendEnvForBindingName = (
  ctx: ProgramContext,
  name: TstsNode | undefined,
  sourceType: IrType | undefined,
  ensureEnv: () => Map<number, IrType>
): void => {
  const normalizedSource = normalizeEnvType(sourceType);
  if (!name || !normalizedSource) return;

  if (TstsSyntax.IsIdentifier(name)) {
    const declId = ctx.binding.resolveIdentifier(name);
    if (declId) {
      ensureEnv().set(declId.id, normalizedSource);
    }
    return;
  }

  if (TstsSyntax.IsArrayBindingPattern(name)) {
    const elements = TstsSyntax.AsBindingPattern(name)?.Elements?.Nodes ?? [];
    for (let index = 0; index < elements.length; index++) {
      const elementNode = elements[index];
      if (!elementNode || !TstsSyntax.IsBindingElement(elementNode)) continue;
      const element = TstsSyntax.AsBindingElement(elementNode);
      const elementType = getArrayElementType(normalizedSource, index);
      const boundType =
        element?.DotDotDotToken && elementType
          ? ({ kind: "arrayType", elementType } as const)
          : elementType;

      extendEnvForBindingName(ctx, element?.name, boundType, ensureEnv);
    }
    return;
  }

  if (TstsSyntax.IsObjectBindingPattern(name)) {
    const elements = TstsSyntax.AsBindingPattern(name)?.Elements?.Nodes ?? [];
    for (const elementNode of elements) {
      if (!elementNode || !TstsSyntax.IsBindingElement(elementNode)) continue;
      const element = TstsSyntax.AsBindingElement(elementNode);
      if (element?.DotDotDotToken) {
        continue;
      }

      const key =
        element?.PropertyName !== undefined
          ? getPropertyNameText(element.PropertyName)
          : getTstsIdentifierText(element?.name);
      if (!key) continue;

      const propType = getObjectPropertyType(ctx, normalizedSource, key);
      extendEnvForBindingName(ctx, element?.name, propType, ensureEnv);
    }
  }
};

const deriveDeclaratorType = (
  decl: IrVariableDeclaration["declarations"][number]
): IrType | undefined => {
  const explicitType = normalizeEnvType(decl.type);
  if (explicitType) return explicitType;
  return decl.initializer
    ? normalizeEnvType(deriveTypeFromExpression(decl.initializer))
    : undefined;
};

const withTstsVariableTypeEnv = (
  ctx: ProgramContext,
  declarationNodes: readonly TstsNode[],
  ir: IrVariableDeclaration
): ProgramContext => {
  let nextEnv: Map<number, IrType> | undefined;
  const ensureEnv = (): Map<number, IrType> => {
    if (!nextEnv) nextEnv = new Map<number, IrType>(ctx.typeEnv ?? []);
    return nextEnv;
  };

  for (let index = 0; index < declarationNodes.length; index++) {
    const declarationNode = declarationNodes[index];
    const declaration = declarationNode
      ? TstsSyntax.AsVariableDeclaration(declarationNode)
      : undefined;
    const irDecl = ir.declarations[index];
    if (!declaration?.name || !irDecl) continue;

    extendEnvForBindingName(
      ctx,
      declaration.name,
      deriveDeclaratorType(irDecl),
      ensureEnv
    );
  }

  return nextEnv ? { ...ctx, typeEnv: nextEnv } : ctx;
};

/**
 * Extract statements from source file.
 *
 * Handles converters that return multiple statements (e.g., type aliases
 * with synthetic interface generation).
 *
 * Also collects synthetic type declarations generated during conversion
 * (from anonymous object literal synthesis) and prepends them.
 *
 * @param sourceFile - The TypeScript source file to extract from
 * @param ctx - ProgramContext for TypeSystem and binding access
 */
export const extractStatements = (
  sourceFile: TstsSourceFile,
  ctx: ProgramContext
): readonly IrStatement[] => extractStatementsWithGroups(sourceFile, ctx).body;

export const extractStatementsWithGroups = (
  sourceFile: TstsSourceFile,
  ctx: ProgramContext
): ExtractStatementsResult => {
  // Reset synthetic registry for this file
  resetSyntheticRegistry();

  const statements: IrStatement[] = [];
  const topLevelStatementGroups = new Map<number, readonly IrStatement[]>();
  let currentCtx = ctx;
  const sourceStatements = getTstsStatementNodes(sourceFile).filter(
    (statement): statement is TstsNode => statement !== undefined
  );

  for (let index = 0; index < sourceStatements.length; index++) {
    const stmt = sourceStatements[index];
    if (!stmt) {
      continue;
    }
    // Skip imports and exports (handled separately)
    if (!isTstsModuleBoundaryStatement(stmt)) {
      const converted = convertStatement(stmt, currentCtx, undefined);
      // Flatten result (handles both single statements and arrays)
      const flattened = flattenStatementResult(converted);
      topLevelStatementGroups.set(index, flattened);
      statements.push(...flattened);

      if (
        TstsSyntax.IsVariableStatement(stmt) &&
        converted !== null &&
        !Array.isArray(converted)
      ) {
        const single = converted as IrStatement;
        if (single.kind !== "variableDeclaration") continue;
        const variableStatement = TstsSyntax.AsVariableStatement(stmt);
        const variableDeclarations = (
          TstsSyntax.AsVariableDeclarationList(
            variableStatement?.DeclarationList
          )?.Declarations?.Nodes ?? []
        ).filter(
          (declaration): declaration is TstsNode => declaration !== undefined
        );
        currentCtx = withTstsVariableTypeEnv(
          currentCtx,
          variableDeclarations,
          single as IrVariableDeclaration
        );
      }
    }
  }

  // Collect synthetic declarations and prepend them
  const syntheticDecls = getSyntheticDeclarations();
  if (syntheticDecls.length > 0) {
    return {
      body: [...syntheticDecls, ...statements],
      topLevelStatementGroups,
    };
  }

  return {
    body: statements,
    topLevelStatementGroups,
  };
};

/**
 * Check if a statement is executable (not a declaration)
 */
export const isExecutableStatement = (stmt: IrStatement): boolean => {
  // Declarations are not executable - they become static members in the container
  const declarationKinds = [
    "functionDeclaration",
    "classDeclaration",
    "interfaceDeclaration",
    "typeAliasDeclaration",
    "enumDeclaration",
    "variableDeclaration", // Added: variable declarations become static fields
  ];

  // Empty statements are not executable
  if (stmt.kind === "emptyStatement") {
    return false;
  }

  return !declarationKinds.includes(stmt.kind);
};
