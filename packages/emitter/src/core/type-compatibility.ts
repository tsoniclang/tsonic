/**
 * Type compatibility helpers for integer type emission
 *
 * Provides:
 * - isAssignable: Check if a source type is assignable to a target type
 * - isIntegerType: Check if a type represents an integer
 *
 * INVARIANT A: "number" always means C# "double". No exceptions.
 * INVARIANT B: "int" always means C# "int". No exceptions.
 *
 * These are distinct primitive types in the IR, not decorated versions of each other.
 */

import type { IrType } from "@tsonic/frontend";

/**
 * Integer type names that map to C# integer types
 * Includes both primitiveType names and referenceType names from .NET interop
 */
const INTEGER_TYPE_NAMES = new Set([
  "int",
  "Int32",
  "System.Int32",
  "long",
  "Int64",
  "System.Int64",
  "short",
  "Int16",
  "System.Int16",
  "byte",
  "Byte",
  "System.Byte",
  "sbyte",
  "SByte",
  "System.SByte",
  "uint",
  "UInt32",
  "System.UInt32",
  "ulong",
  "UInt64",
  "System.UInt64",
  "ushort",
  "UInt16",
  "System.UInt16",
]);

/**
 * Check if an IR type represents an integer type
 *
 * INVARIANT: `int` is a distinct primitive type, NOT `number` with numericIntent.
 */
export const isIntegerType = (type: IrType | undefined): boolean => {
  if (!type) return false;

  // primitiveType(name="int") - distinct integer primitive
  if (type.kind === "primitiveType" && type.name === "int") {
    return true;
  }

  // Reference type with integer name (e.g., "Int32" from .NET interop)
  if (type.kind === "referenceType") {
    return INTEGER_TYPE_NAMES.has(type.name);
  }

  return false;
};

/**
 * Check if a source type is assignable to a target type without requiring a cast.
 *
 * This implements Alice's invariant: "No cosmetic casts" - we only emit casts
 * when the types are genuinely incompatible, not when they happen to match.
 *
 * @param fromType - The source type (what we have)
 * @param toType - The target type (what we need)
 * @returns true if fromType can be assigned to toType without a cast
 */
export const isAssignable = (
  fromType: IrType | undefined,
  toType: IrType | undefined
): boolean => {
  if (!fromType || !toType) return false;

  // Exact kind and name match
  if (fromType.kind === toType.kind) {
    if (fromType.kind === "primitiveType" && toType.kind === "primitiveType") {
      return fromType.name === toType.name;
    }

    if (fromType.kind === "referenceType" && toType.kind === "referenceType") {
      // Exact name match
      if (fromType.name === toType.name) {
        return true;
      }
      // Check resolved CLR type match
      if (
        fromType.resolvedClrType &&
        fromType.resolvedClrType === toType.resolvedClrType
      ) {
        return true;
      }
    }
  }

  // int → number (widening is allowed)
  if (isIntegerType(fromType) && toType.kind === "primitiveType") {
    if (toType.name === "number") {
      return true;
    }
  }

  return false;
};
