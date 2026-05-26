/**
 * Primitive type conversion
 *
 * INVARIANT A: "number" is a distinct source numeric primitive.
 * INVARIANT B: "int" is a distinct source numeric primitive.
 *
 * These are distinct types, not decorated versions of each other.
 */

import * as ts from "typescript";
import { IrType, IrPrimitiveType } from "../../../types.js";
import { explicitUnknownType } from "../../types.js";

/**
 * Source primitive aliases from @tsonic/core.
 * When user writes `: int`, it becomes primitiveType(name="int"), NOT referenceType.
 *
 * Note: `int` and `char` are supported as distinct primitives.
 * Other sized numeric aliases remain referenceType at this layer.
 */
export const CORE_PRIMITIVE_TYPE_SET = new Set(["int", "char"]);

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
    case ts.SyntaxKind.BigIntKeyword:
      return { kind: "primitiveType", name: "bigint" };
    case ts.SyntaxKind.SymbolKeyword:
      // TypeScript `symbol` is lowered as an opaque object identity handle.
      // This keeps AOT semantics deterministic without introducing JS runtime symbol
      // mechanics into the IR type lattice.
      return { kind: "referenceType", name: "object", typeArguments: [] };
    case ts.SyntaxKind.NullKeyword:
      return { kind: "primitiveType", name: "null" };
    case ts.SyntaxKind.UndefinedKeyword:
      return { kind: "primitiveType", name: "undefined" };
    case ts.SyntaxKind.VoidKeyword:
      return { kind: "voidType" };
    case ts.SyntaxKind.AnyKeyword:
      return { kind: "anyType" };
    case ts.SyntaxKind.UnknownKeyword:
      return explicitUnknownType;
    case ts.SyntaxKind.NeverKeyword:
      return { kind: "neverType" };
    case ts.SyntaxKind.ObjectKeyword:
      // TypeScript `object` keyword as a constraint: T extends object
      // This maps to target `class` constraint (reference type)
      // We emit it as a referenceType so the emitter can handle it
      return { kind: "referenceType", name: "object", typeArguments: [] };
    default:
      return null;
  }
};

/**
 * Check if a type name is a TS primitive type.
 */
export const isPrimitiveTypeName = (
  typeName: string
): typeName is
  | "string"
  | "number"
  | "boolean"
  | "bigint"
  | "null"
  | "undefined" => {
  return [
    "string",
    "number",
    "boolean",
    "bigint",
    "null",
    "undefined",
  ].includes(typeName);
};

/**
 * Check if a type name is a core source primitive alias.
 */
export const isCorePrimitiveTypeName = (
  typeName: string
): typeName is "int" | "char" => {
  return CORE_PRIMITIVE_TYPE_SET.has(typeName);
};

/**
 * Get primitive type IR representation for a TS primitive type name
 */
export const getPrimitiveType = (
  typeName: "string" | "number" | "boolean" | "bigint" | "null" | "undefined"
): IrPrimitiveType => {
  return {
    kind: "primitiveType",
    name: typeName,
  };
};

/**
 * Get primitive type IR representation for a core source primitive alias.
 */
export const getCorePrimitiveType = (
  typeName: "int" | "char"
): IrPrimitiveType => {
  return {
    kind: "primitiveType",
    name: typeName,
  };
};
