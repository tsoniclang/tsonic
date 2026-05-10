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
import type { EmitterContext } from "../../types.js";
import {
  getReferenceDeterministicIdentityKey,
  referenceTypeHasClrIdentity,
  typesShareDirectClrIdentity,
} from "./clr-type-identity.js";
import { referenceTypesShareNominalIdentity } from "./reference-type-identity.js";
import { resolveLocalTypeInfo, substituteTypeArgs } from "./type-resolution.js";

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
 * Casts are emitted only when the source and target are genuinely
 * incompatible, not when their emitted surfaces already match.
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

const buildAssignablePairKey = (
  fromType: IrType,
  toType: IrType,
  context: EmitterContext
): string => {
  const typeKey = (type: IrType): string => {
    if (type.kind === "referenceType") {
      return (
        getReferenceDeterministicIdentityKey(type) ??
        `${type.name}/${type.typeArguments?.length ?? 0}`
      );
    }
    return type.kind;
  };

  return `${typeKey(fromType)}=>${typeKey(toType)}@${context.moduleNamespace ?? context.options.rootNamespace}`;
};

const substituteHeritageType = (
  heritageType: IrType,
  ownerType: Extract<IrType, { kind: "referenceType" }>,
  ownerTypeParameters: readonly string[]
): IrType => {
  const typeArguments = ownerType.typeArguments ?? [];
  return ownerTypeParameters.length > 0 && typeArguments.length > 0
    ? substituteTypeArgs(heritageType, ownerTypeParameters, typeArguments)
    : heritageType;
};

const isReferenceAssignableThroughHeritage = (
  fromType: Extract<IrType, { kind: "referenceType" }>,
  toType: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext,
  visited: Set<string>
): boolean => {
  if (referenceTypesShareNominalIdentity(fromType, toType, context)) {
    return true;
  }

  const localInfo = resolveLocalTypeInfo(fromType, context)?.info;
  if (!localInfo) {
    return false;
  }

  const heritageTypes =
    localInfo.kind === "class"
      ? [
          ...(localInfo.superClass ? [localInfo.superClass] : []),
          ...localInfo.implements,
        ]
      : localInfo.kind === "interface"
        ? localInfo.extends
        : [];

  return heritageTypes.some((heritageType) =>
    isAssignableToType(
      substituteHeritageType(
        heritageType,
        fromType,
        localInfo.kind === "class" || localInfo.kind === "interface"
          ? localInfo.typeParameters
          : []
      ),
      toType,
      context,
      visited
    )
  );
};

export const isAssignableToType = (
  fromType: IrType | undefined,
  toType: IrType | undefined,
  context: EmitterContext,
  visited: Set<string> = new Set<string>()
): boolean => {
  if (!fromType || !toType) return false;

  if (isAssignable(fromType, toType)) {
    return true;
  }

  const pairKey = buildAssignablePairKey(fromType, toType, context);
  if (visited.has(pairKey)) {
    return false;
  }
  visited.add(pairKey);

  if (toType.kind === "unionType") {
    return toType.types.some((member) =>
      isAssignableToType(fromType, member, context, visited)
    );
  }

  if (fromType.kind === "unionType") {
    return fromType.types.every((member) =>
      isAssignableToType(member, toType, context, visited)
    );
  }

  if (fromType.kind === "referenceType" && toType.kind === "referenceType") {
    return isReferenceAssignableThroughHeritage(
      fromType,
      toType,
      context,
      visited
    );
  }

  return false;
};
