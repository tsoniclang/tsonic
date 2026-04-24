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

import { type IrType } from "@tsonic/frontend";
import {
  getReferenceDeterministicIdentityKey,
  referenceTypeHasClrIdentity,
  typesShareDirectClrIdentity,
} from "./clr-type-identity.js";

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

const JS_NUMBER_CLR_TYPE_NAMES = new Set([
  "double",
  "Double",
  "System.Double",
  "global::System.Double",
]);

const SYSTEM_OBJECT_CLR_TYPE_NAMES = new Set([
  "System.Object",
  "global::System.Object",
]);

const isJsNumberLikeType = (type: IrType | undefined): boolean => {
  if (!type) return false;

  if (type.kind === "primitiveType") {
    return type.name === "number";
  }

  if (type.kind !== "referenceType") {
    return false;
  }

  return (
    JS_NUMBER_CLR_TYPE_NAMES.has(type.name) ||
    referenceTypeHasClrIdentity(type, JS_NUMBER_CLR_TYPE_NAMES)
  );
};

const getContextFreeReferenceIdentityKey = (
  type: Extract<IrType, { kind: "referenceType" }>
): string | undefined => getReferenceDeterministicIdentityKey(type);

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
    return (
      INTEGER_TYPE_NAMES.has(type.name) ||
      referenceTypeHasClrIdentity(type, INTEGER_TYPE_NAMES)
    );
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

  if (toType.kind === "unionType") {
    return toType.types.some((member) => isAssignable(fromType, member));
  }

  if (fromType.kind === "unionType") {
    return fromType.types.every((member) => isAssignable(member, toType));
  }

  const fromIsObjectLike =
    fromType.kind === "objectType" ||
    fromType.kind === "dictionaryType" ||
    fromType.kind === "arrayType" ||
    fromType.kind === "tupleType" ||
    fromType.kind === "functionType" ||
    fromType.kind === "referenceType";

  if (toType.kind === "objectType" && fromIsObjectLike) {
    return true;
  }

  if (
    toType.kind === "referenceType" &&
    (toType.name === "object" ||
      referenceTypeHasClrIdentity(toType, SYSTEM_OBJECT_CLR_TYPE_NAMES)) &&
    fromIsObjectLike
  ) {
    return true;
  }

  if (typesShareDirectClrIdentity(fromType, toType)) {
    return true;
  }

  // int → number (widening is allowed)
  if (isIntegerType(fromType) && toType.kind === "primitiveType") {
    if (toType.name === "number") {
      return true;
    }
  }

  // CLR integral carriers can flow into JS-number emission surfaces (double).
  if (isIntegerType(fromType) && isJsNumberLikeType(toType)) {
    return true;
  }

  if (isJsNumberLikeType(fromType) && isJsNumberLikeType(toType)) {
    return true;
  }

  // Exact kind and name match
  if (fromType.kind === toType.kind) {
    if (fromType.kind === "primitiveType" && toType.kind === "primitiveType") {
      return fromType.name === toType.name;
    }

    if (fromType.kind === "referenceType" && toType.kind === "referenceType") {
      const fromIdentity = getContextFreeReferenceIdentityKey(fromType);
      const toIdentity = getContextFreeReferenceIdentityKey(toType);
      const sameBaseType =
        fromIdentity !== undefined &&
        toIdentity !== undefined &&
        fromIdentity === toIdentity;

      if (sameBaseType) {
        const fromTypeArguments = fromType.typeArguments ?? [];
        const toTypeArguments = toType.typeArguments ?? [];
        if (fromTypeArguments.length !== toTypeArguments.length) {
          return false;
        }

        return fromTypeArguments.every((fromTypeArgument, index) =>
          isAssignable(fromTypeArgument, toTypeArguments[index])
        );
      }
    }
  }

  return false;
};
