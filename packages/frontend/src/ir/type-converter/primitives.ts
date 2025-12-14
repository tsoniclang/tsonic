/**
 * Primitive type conversion
 *
 * INVARIANT A: "number" always emits as C# "double". No exceptions.
 * INVARIANT B: "int" always emits as C# "int". No exceptions.
 *
 * These are distinct types, not decorated versions of each other.
 */

import * as ts from "typescript";
import { IrType, IrPrimitiveType } from "../types.js";

/**
 * CLR numeric type names from @tsonic/types.
 * When user writes `: int`, it becomes primitiveType(name="int"), NOT referenceType.
 *
 * Note: Only "int" is currently supported as a distinct primitive.
 * Other CLR numerics remain as referenceType for now and are handled by the emitter.
 */
const CLR_PRIMITIVE_TYPES = new Set(["int"]);

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
      return { kind: "anyType" };
    case ts.SyntaxKind.UnknownKeyword:
      return { kind: "unknownType" };
    case ts.SyntaxKind.NeverKeyword:
      return { kind: "neverType" };
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
 * These come from @tsonic/types and are compiler-known primitives.
 */
export const isClrPrimitiveTypeName = (
  typeName: string
): typeName is "int" => {
  return CLR_PRIMITIVE_TYPES.has(typeName);
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
export const getClrPrimitiveType = (typeName: "int"): IrPrimitiveType => {
  return {
    kind: "primitiveType",
    name: typeName,
  };
};
