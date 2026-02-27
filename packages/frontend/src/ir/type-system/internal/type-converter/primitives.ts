/**
 * Primitive type conversion
 *
 * INVARIANT A: "number" always emits as C# "double". No exceptions.
 * INVARIANT B: "int" always emits as C# "int". No exceptions.
 *
 * These are distinct types, not decorated versions of each other.
 */

import * as ts from "typescript";
import { IrType, IrPrimitiveType } from "../../../types.js";

/**
 * Synthetic IR reference type name used for explicit TypeScript `any`.
 *
 * This is intentionally distinct from `IrAnyType`:
 * - `IrAnyType` remains a poison/fallback marker for unsupported conversions
 *   and is rejected by the soundness gate.
 * - Explicit user-authored `any` lowers to this nominal runtime-dynamic marker,
 *   which the emitter lowers deterministically.
 */
export const DYNAMIC_ANY_TYPE_NAME = "__TSONIC_ANY";

/**
 * CLR numeric type names from @tsonic/core.
 * When user writes `: int`, it becomes primitiveType(name="int"), NOT referenceType.
 *
 * Note: `int` and `char` are supported as distinct primitives.
 * Other CLR numerics remain as referenceType for now and are handled by the emitter.
 */
export const CLR_PRIMITIVE_TYPE_SET = new Set(["int", "char"]);

/**
 * Convert TypeScript primitive keyword to IR type
 */
export const convertPrimitiveKeyword = (kind: ts.SyntaxKind): IrType | null => {
  switch (kind) {
    case ts.SyntaxKind.StringKeyword:
      return { kind: "primitiveType", name: "string" };
    case ts.SyntaxKind.NumberKeyword:
      return { kind: "primitiveType", name: "number" };
    case ts.SyntaxKind.BooleanKeyword:
      return { kind: "primitiveType", name: "boolean" };
    case ts.SyntaxKind.NullKeyword:
      return { kind: "primitiveType", name: "null" };
    case ts.SyntaxKind.UndefinedKeyword:
      return { kind: "primitiveType", name: "undefined" };
    case ts.SyntaxKind.VoidKeyword:
      return { kind: "voidType" };
    case ts.SyntaxKind.AnyKeyword:
      return { kind: "referenceType", name: DYNAMIC_ANY_TYPE_NAME };
    case ts.SyntaxKind.UnknownKeyword:
      return { kind: "unknownType" };
    case ts.SyntaxKind.NeverKeyword:
      return { kind: "neverType" };
    case ts.SyntaxKind.ObjectKeyword:
      // TypeScript `object` keyword as a constraint: T extends object
      // This maps to C# `class` constraint (reference type)
      // We emit it as a referenceType so the emitter can handle it
      return { kind: "referenceType", name: "object", typeArguments: [] };
    default:
      return null;
  }
};

/**
 * Check if a type name is a TS primitive type (string, number, boolean, null, undefined)
 */
export const isPrimitiveTypeName = (
  typeName: string
): typeName is "string" | "number" | "boolean" | "null" | "undefined" => {
  return ["string", "number", "boolean", "null", "undefined"].includes(
    typeName
  );
};

/**
 * Check if a type name is a CLR primitive type (int)
 * These come from @tsonic/core and are compiler-known primitives.
 */
export const isClrPrimitiveTypeName = (
  typeName: string
): typeName is "int" | "char" => {
  return CLR_PRIMITIVE_TYPE_SET.has(typeName);
};

/**
 * Get primitive type IR representation for a TS primitive type name
 */
export const getPrimitiveType = (
  typeName: "string" | "number" | "boolean" | "null" | "undefined"
): IrPrimitiveType => {
  return {
    kind: "primitiveType",
    name: typeName,
  };
};

/**
 * Get primitive type IR representation for a CLR primitive type name
 */
export const getClrPrimitiveType = (
  typeName: "int" | "char"
): IrPrimitiveType => {
  return {
    kind: "primitiveType",
    name: typeName,
  };
};
