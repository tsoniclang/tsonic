/**
 * Helper utilities for statement conversion
 */

import * as ts from "typescript";
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
import { withVariableDeclaratorTypeEnv } from "../type-env.js";

/**
 * Optional class fields (`foo?: T`) are semantically `T | undefined` in TS.
 *
 * For value types, this is the only correct way to emit nullable C# (`T?`).
 * We encode this deterministically in IR so the existing union emitter can
 * map it to C# nullability correctly.
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

/**
 * Convert TypeScript type parameters to IR, detecting structural constraints
 */
export const convertTypeParameters = (
  typeParameters: readonly ts.TypeParameterDeclaration[] | undefined,
  ctx: ProgramContext
): readonly IrTypeParameter[] | undefined => {
  if (!typeParameters || typeParameters.length === 0) {
    return undefined;
  }

  // PHASE 4 (Alice's spec): Use captureTypeSyntax + typeFromSyntax
  const typeSystem = ctx.typeSystem;

  return typeParameters.map((tp) => {
    const name = tp.name.text;
    const constraint = tp.constraint
      ? typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(tp.constraint))
      : undefined;
    const defaultType = tp.default
      ? typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(tp.default))
      : undefined;

    // Check if constraint is structural (object literal type)
    const isStructural = tp.constraint && ts.isTypeLiteralNode(tp.constraint);

    // Extract structural members if it's a structural constraint
    const structuralMembers =
      isStructural && tp.constraint && ts.isTypeLiteralNode(tp.constraint)
        ? tp.constraint.members
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

/**
 * Convert parameters for functions and methods
 */
export const convertParameters = (
  parameters: ts.NodeArray<ts.ParameterDeclaration>,
  ctx: ProgramContext
): readonly IrParameter[] => {
  return parameters.map((param) => {
    let passing: "value" | "ref" | "out" | "in" = "value";
    let actualType: ts.TypeNode | undefined = param.type;
    let isExtensionReceiver = false;

    // Detect wrapper types:
    // - thisarg<T> marks an extension-method receiver parameter (emits C# `this`)
    // - ref<T>/out<T>/in<T>/inref<T> marks passing mode (unwraps to T)
    //
    // Wrappers may be nested; unwrap repeatedly.
    while (
      actualType &&
      ts.isTypeReferenceNode(actualType) &&
      ts.isIdentifier(actualType.typeName) &&
      actualType.typeArguments &&
      actualType.typeArguments.length > 0
    ) {
      const typeName = actualType.typeName.text;

      if (typeName === "thisarg") {
        isExtensionReceiver = true;
        actualType = actualType.typeArguments[0];
        continue;
      }

      if (typeName === "ref" || typeName === "out" || typeName === "in" || typeName === "inref") {
        passing =
          typeName === "in" || typeName === "inref"
            ? "in"
            : (typeName as "ref" | "out");
        actualType = actualType.typeArguments[0];
        continue;
      }

      break;
    }

    // Get parameter type for contextual typing of default value
    // PHASE 4 (Alice's spec): Use captureTypeSyntax + typeFromSyntax
    const typeSystem = ctx.typeSystem;
    const paramType = actualType
      ? typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(actualType))
      : undefined;

    return {
      kind: "parameter",
      pattern: convertBindingName(param.name),
      type: paramType,
      // Pass parameter type for contextual typing of default value
      initializer: param.initializer
        ? convertExpression(param.initializer, ctx, paramType)
        : undefined,
      isOptional: !!param.questionToken,
      isRest: !!param.dotDotDotToken,
      passing,
      isExtensionReceiver: isExtensionReceiver || undefined,
    };
  });
};

/**
 * Convert variable declaration list (used in for loops)
 */
export const convertVariableDeclarationList = (
  node: ts.VariableDeclarationList,
  ctx: ProgramContext
): IrVariableDeclaration => {
  const isConst = !!(node.flags & ts.NodeFlags.Const);
  const isLet = !!(node.flags & ts.NodeFlags.Let);
  const declarationKind = isConst ? "const" : isLet ? "let" : "var";

  // PHASE 4 (Alice's spec): Use captureTypeSyntax + typeFromSyntax
  const typeSystem = ctx.typeSystem;

  let currentCtx = ctx;
  const declarations: IrVariableDeclarator[] = [];

  // Convert sequentially so later declarators can refer to earlier ones.
  for (const decl of node.declarations) {
    const declType = decl.type
      ? typeSystem.typeFromSyntax(currentCtx.binding.captureTypeSyntax(decl.type))
      : undefined;

    const initializer = decl.initializer
      ? convertExpression(decl.initializer, currentCtx, declType)
      : undefined;

    const irDecl = {
      kind: "variableDeclarator" as const,
      name: convertBindingName(decl.name),
      type: declType,
      initializer,
    };

    declarations.push(irDecl);
    currentCtx = withVariableDeclaratorTypeEnv(currentCtx, decl.name, irDecl);
  }

  return { kind: "variableDeclaration", declarationKind, declarations, isExported: false };
};

/**
 * Check if node has export modifier
 */
export const hasExportModifier = (node: ts.Node): boolean => {
  if (!ts.canHaveModifiers(node)) return false;
  const modifiers = ts.getModifiers(node);
  return (
    modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false
  );
};

/**
 * Check if node has static modifier
 */
export const hasStaticModifier = (node: ts.Node): boolean => {
  if (!ts.canHaveModifiers(node)) return false;
  const modifiers = ts.getModifiers(node);
  return (
    modifiers?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword) ?? false
  );
};

/**
 * Check if node has declare modifier.
 *
 * `declare` class members are type-only in TypeScript and should not emit runtime code.
 * Tsonic mirrors this by skipping them during IR conversion.
 */
export const hasDeclareModifier = (node: ts.Node): boolean => {
  if (!ts.canHaveModifiers(node)) return false;
  const modifiers = ts.getModifiers(node);
  return (
    modifiers?.some((m) => m.kind === ts.SyntaxKind.DeclareKeyword) ?? false
  );
};

/**
 * Check if node has readonly modifier
 */
export const hasReadonlyModifier = (node: ts.Node): boolean => {
  if (!ts.canHaveModifiers(node)) return false;
  const modifiers = ts.getModifiers(node);
  return (
    modifiers?.some((m) => m.kind === ts.SyntaxKind.ReadonlyKeyword) ?? false
  );
};

/**
 * Get accessibility modifier
 */
export const getAccessibility = (node: ts.Node): IrAccessibility => {
  if (!ts.canHaveModifiers(node)) return "public";
  const modifiers = ts.getModifiers(node);
  if (modifiers?.some((m) => m.kind === ts.SyntaxKind.PrivateKeyword))
    return "private";
  if (modifiers?.some((m) => m.kind === ts.SyntaxKind.ProtectedKeyword))
    return "protected";
  return "public";
};
