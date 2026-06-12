/**
 * Intrinsic call expression converters
 *
 * Handles compile-time intrinsic calls: asinterface, istype, defaultof,
 * nameof, sizeof, trycast, and stackalloc.
 */

import * as ts from "typescript";
import {
  IrCallExpression,
  IrAsInterfaceExpression,
  IrTryCastExpression,
  IrStackAllocExpression,
  IrDefaultOfExpression,
  IrNameOfExpression,
  IrSizeOfExpression,
} from "../../../types.js";
import { getSourceSpan } from "../helpers.js";
import { convertExpression } from "../../../expression-converter.js";
import { IrType, primitiveTypeFactFromName } from "../../../types.js";
import type { ProgramContext } from "../../../program-context.js";
import { createDiagnostic } from "../../../../types/diagnostic.js";
import {
  isIdentifierFromCore,
  isIdentifierFromGlobals,
} from "../../../../core-intrinsics/provenance.js";

/**
 * Try to convert a call expression as an intrinsic.
 * Returns undefined if the call is not an intrinsic.
 */
export const tryConvertIntrinsicCall = (
  node: ts.CallExpression,
  ctx: ProgramContext,
  _expectedType?: IrType
):
  | IrCallExpression
  | IrAsInterfaceExpression
  | IrTryCastExpression
  | IrStackAllocExpression
  | IrDefaultOfExpression
  | IrNameOfExpression
  | IrSizeOfExpression
  | undefined => {
  const isCoreLangIntrinsicCall = (name: string): boolean =>
    ts.isIdentifier(node.expression) &&
    node.expression.text === name &&
    isIdentifierFromCore(
      ctx.checker,
      ctx.sourceSemantics,
      node.expression,
      "lang"
    );
  const isGlobalIntrinsicCall = (name: string): boolean =>
    ts.isIdentifier(node.expression) &&
    node.expression.text === name &&
    isIdentifierFromGlobals(ctx.checker, ctx.sourceSemantics, node.expression);

  const extractNameofTarget = (expr: ts.Expression): string | undefined => {
    if (ts.isIdentifier(expr)) return expr.text;
    if (expr.kind === ts.SyntaxKind.ThisKeyword) return "this";
    if (ts.isPropertyAccessExpression(expr)) return expr.name.text;
    return undefined;
  };

  const isSupportedSizeofTarget = (type: IrType): boolean => {
    if (type.kind === "primitiveType") {
      return (
        type.name === "number" ||
        type.name === "int" ||
        type.name === "boolean" ||
        type.name === "char"
      );
    }

    if (type.kind !== "referenceType") return false;

    return (
      primitiveTypeFactFromName(type.name) !== undefined || type.name === "char"
    );
  };

  // asinterface<T>(x) - compile-time-only interface view (no runtime casts).
  if (
    isCoreLangIntrinsicCall("asinterface") &&
    node.typeArguments &&
    node.typeArguments.length === 1 &&
    node.arguments.length === 1
  ) {
    const targetTypeNode = node.typeArguments[0];
    const argNode = node.arguments[0];
    if (!targetTypeNode || !argNode) {
      throw new Error(
        "ICE: asinterface requires exactly 1 type argument and 1 argument"
      );
    }

    const typeSystem = ctx.typeSystem;
    const targetType = typeSystem.typeFromSyntax(
      ctx.binding.captureTypeSyntax(targetTypeNode)
    );
    const argExpr = convertExpression(argNode, ctx, targetType);

    return {
      kind: "asinterface",
      expression: argExpr,
      targetType,
      inferredType: targetType,
      sourceSpan: getSourceSpan(node),
    };
  }

  // istype<T>(x) - compiler-only type guard for overload specialization.
  // Erased at compile time; converted to IR call for narrowing/specialization.
  if (
    ts.isIdentifier(node.expression) &&
    node.expression.text === "istype" &&
    node.typeArguments &&
    node.typeArguments.length === 1 &&
    node.arguments.length === 1
  ) {
    const targetTypeNode = node.typeArguments[0];
    const argNode = node.arguments[0];
    if (!targetTypeNode || !argNode) {
      throw new Error(
        "ICE: istype requires exactly 1 type argument and 1 argument"
      );
    }

    const typeSystem = ctx.typeSystem;
    const targetType = typeSystem.typeFromSyntax(
      ctx.binding.captureTypeSyntax(targetTypeNode)
    );
    const argExpr = convertExpression(argNode, ctx, undefined);
    const callee = convertExpression(node.expression, ctx, undefined);

    return {
      kind: "call",
      callee,
      arguments: [argExpr],
      isOptional: false,
      inferredType: { kind: "primitiveType", name: "boolean" },
      typeArguments: [targetType],
      sourceSpan: getSourceSpan(node),
    };
  }

  // Check for defaultof<T>() - language intrinsic for default value.
  // defaultof<T>() compiles to target: default(T)
  if (
    isCoreLangIntrinsicCall("defaultof") &&
    node.typeArguments &&
    node.typeArguments.length === 1 &&
    node.arguments.length === 0
  ) {
    const targetTypeNode = node.typeArguments[0];
    if (!targetTypeNode) {
      throw new Error("ICE: defaultof requires exactly 1 type argument");
    }

    const typeSystem = ctx.typeSystem;
    const targetType = typeSystem.typeFromSyntax(
      ctx.binding.captureTypeSyntax(targetTypeNode)
    );

    return {
      kind: "defaultof",
      targetType,
      inferredType: targetType,
      sourceSpan: getSourceSpan(node),
    };
  }

  if (
    isCoreLangIntrinsicCall("nameof") &&
    (!node.typeArguments || node.typeArguments.length === 0) &&
    node.arguments.length === 1
  ) {
    const argNode = node.arguments[0];
    if (!argNode) {
      throw new Error("ICE: nameof requires exactly 1 argument");
    }

    const targetName = extractNameofTarget(argNode);
    if (!targetName) {
      ctx.diagnostics.push(
        createDiagnostic(
          "TSN7443",
          "error",
          "'nameof(...)' currently supports identifiers, 'this', and dotted member access only.",
          getSourceSpan(node)
        )
      );
      return {
        kind: "nameof",
        name: "",
        inferredType: { kind: "primitiveType", name: "string" },
        sourceSpan: getSourceSpan(node),
      };
    }

    return {
      kind: "nameof",
      name: targetName,
      inferredType: { kind: "primitiveType", name: "string" },
      sourceSpan: getSourceSpan(node),
    };
  }

  if (
    isCoreLangIntrinsicCall("sizeof") &&
    node.typeArguments &&
    node.typeArguments.length === 1 &&
    node.arguments.length === 0
  ) {
    const targetTypeNode = node.typeArguments[0];
    if (!targetTypeNode) {
      throw new Error("ICE: sizeof requires exactly 1 type argument");
    }

    const typeSystem = ctx.typeSystem;
    const targetType = typeSystem.typeFromSyntax(
      ctx.binding.captureTypeSyntax(targetTypeNode)
    );

    if (!isSupportedSizeofTarget(targetType)) {
      ctx.diagnostics.push(
        createDiagnostic(
          "TSN7443",
          "error",
          "'sizeof<T>()' requires a known source value type (numeric/bool/char).",
          getSourceSpan(node)
        )
      );
    }

    return {
      kind: "sizeof",
      targetType,
      inferredType: { kind: "primitiveType", name: "int" },
      sourceSpan: getSourceSpan(node),
    };
  }

  if (
    isGlobalIntrinsicCall("Symbol") &&
    (!node.typeArguments || node.typeArguments.length === 0) &&
    node.arguments.length <= 1
  ) {
    const callee = convertExpression(node.expression, ctx, undefined);
    const argExpr = node.arguments[0]
      ? convertExpression(node.arguments[0], ctx, undefined)
      : undefined;

    return {
      kind: "call",
      callee,
      arguments: argExpr ? [argExpr] : [],
      isOptional: false,
      intrinsicKind: "globalSymbol",
      inferredType: {
        kind: "referenceType",
        name: "object",
        typeArguments: [],
      },
      sourceSpan: getSourceSpan(node),
    };
  }

  // Check for trycast<T>(x) - special intrinsic for safe casting
  // trycast<T>(x) compiles to target: x as T (safe cast, returns null on failure)
  if (
    isCoreLangIntrinsicCall("trycast") &&
    node.typeArguments &&
    node.typeArguments.length === 1 &&
    node.arguments.length === 1
  ) {
    // We've verified length === 1 above, so these are guaranteed to exist
    const targetTypeNode = node.typeArguments[0];
    const argNode = node.arguments[0];
    if (!targetTypeNode || !argNode) {
      throw new Error(
        "ICE: trycast requires exactly 1 type argument and 1 argument"
      );
    }
    // Convert explicit intrinsic type syntax through the TypeSystem.
    const typeSystem = ctx.typeSystem;
    const targetType = typeSystem.typeFromSyntax(
      ctx.binding.captureTypeSyntax(targetTypeNode)
    );
    const argExpr = convertExpression(argNode, ctx, undefined);

    // Build union type T | null for inferredType
    const nullType: IrType = { kind: "primitiveType", name: "null" };
    const unionType: IrType = {
      kind: "unionType",
      types: [targetType, nullType],
    };

    return {
      kind: "trycast",
      expression: argExpr,
      targetType,
      inferredType: unionType,
      sourceSpan: getSourceSpan(node),
    };
  }

  // Check for stackalloc<T>(size) - language intrinsic for stack allocation.
  // stackalloc<T>(size) compiles to target: stackalloc T[size]
  if (
    isCoreLangIntrinsicCall("stackalloc") &&
    node.typeArguments &&
    node.typeArguments.length === 1 &&
    node.arguments.length === 1
  ) {
    const elementTypeNode = node.typeArguments[0];
    const sizeNode = node.arguments[0];
    if (!elementTypeNode || !sizeNode) {
      throw new Error(
        "ICE: stackalloc requires exactly 1 type argument and 1 argument"
      );
    }

    const typeSystem = ctx.typeSystem;
    const elementType = typeSystem.typeFromSyntax(
      ctx.binding.captureTypeSyntax(elementTypeNode)
    );
    const sizeExpr = convertExpression(sizeNode, ctx, {
      kind: "primitiveType",
      name: "int",
    });

    return {
      kind: "stackalloc",
      elementType,
      size: sizeExpr,
      inferredType: {
        kind: "referenceType",
        name: "Span",
        typeArguments: [elementType],
      },
      sourceSpan: getSourceSpan(node),
    };
  }

  return undefined;
};
