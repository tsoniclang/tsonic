/**
 * Primitive type conversion
 */

import * as ts from "typescript";
import { IrType } from "../types.js";

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
 * Check if a type name is a primitive type
 */
export const isPrimitiveTypeName = (
  typeName: string
): typeName is "string" | "number" | "boolean" | "null" | "undefined" => {
  return ["string", "number", "boolean", "null", "undefined"].includes(
    typeName
  );
};

/**
 * Get primitive type IR representation for a type name
 */
export const getPrimitiveType = (
  typeName: "string" | "number" | "boolean" | "null" | "undefined"
): IrType => {
  return {
    kind: "primitiveType",
    name: typeName,
  };
};
