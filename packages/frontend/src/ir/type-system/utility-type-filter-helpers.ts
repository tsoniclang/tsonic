/**
 * Utility Type Filter Helpers — Exclude/Extract/NonNullable/ReturnType/Parameters/Awaited/Record
 *
 * Implements utility types that filter, extract, or transform types without
 * modifying object members:
 * - NonNullable: Filter null/undefined from union
 * - Exclude/Extract: Filter union members by type matching
 * - ReturnType/Parameters: Extract from function types
 * - Awaited: Recursive unwrap of async wrappers
 * - Record: Create dictionary or object type from keys + value
 *
 * DAG position: depends on type-system-state + type-system-relations
 */

import type { IrType, IrPropertySignature } from "../types/index.js";
import { unknownType, neverType, voidType } from "./types.js";
import type { TypeSystemState, Site } from "./type-system-state.js";
import { emitDiagnostic, isNullishPrimitive } from "./type-system-state.js";
import { typesEqual } from "./type-system-relations.js";
import { getAwaitedIrType } from "../types/type-ops.js";
import { expandReferenceAlias } from "./type-alias-expansion.js";

import { extractLiteralKeys } from "./utility-type-mapped-helpers.js";

/**
 * Expand ReturnType<F>: Extract return type from function type
 */
export const expandReturnTypeUtility = (
  state: TypeSystemState,
  type: IrType,
  site?: Site
): IrType => {
  if (type.kind === "functionType") {
    return type.returnType ?? voidType;
  }
  emitDiagnostic(
    state,
    "TSN7414",
    `ReturnType requires a function type argument`,
    site
  );
  return unknownType;
};

/**
 * Expand Parameters<F>: Extract parameters as tuple from function type
 */
export const expandParametersUtility = (
  state: TypeSystemState,
  type: IrType,
  site?: Site
): IrType => {
  if (type.kind === "functionType") {
    const elementTypes = type.parameters.map(
      (p) => p.type ?? { kind: "anyType" as const }
    );
    return { kind: "tupleType", elementTypes };
  }
  emitDiagnostic(
    state,
    "TSN7414",
    `Parameters requires a function type argument`,
    site
  );
  return unknownType;
};

/**
 * Expand Exclude<T, U> or Extract<T, U>
 */
export const expandExcludeExtractUtility = (
  tType: IrType,
  uType: IrType,
  isExtract: boolean
): IrType => {
  // If T is not a union, check if it matches U
  if (tType.kind !== "unionType") {
    const matches =
      typesEqual(tType, uType) ||
      (uType.kind === "unionType" &&
        uType.types.some((u) => typesEqual(tType, u)));
    if (isExtract) {
      return matches ? tType : neverType;
    } else {
      return matches ? neverType : tType;
    }
  }

  // T is a union - filter its constituents
  const uTypes = uType.kind === "unionType" ? uType.types : [uType];
  const filtered = tType.types.filter((t) => {
    const matches = uTypes.some((u) => typesEqual(t, u));
    return isExtract ? matches : !matches;
  });

  if (filtered.length === 0) return neverType;
  if (filtered.length === 1 && filtered[0]) return filtered[0];
  return { kind: "unionType", types: filtered };
};

/**
 * Expand NonNullable<T>: Filter out null and undefined from union
 */
export const expandNonNullableUtility = (type: IrType): IrType => {
  // Direct null/undefined
  if (isNullishPrimitive(type)) {
    return neverType;
  }

  // Not a union - return as-is
  if (type.kind !== "unionType") {
    return type;
  }

  // Filter out null and undefined from union
  const filtered = type.types.filter((t) => !isNullishPrimitive(t));

  if (filtered.length === 0) {
    return neverType;
  }
  if (filtered.length === 1 && filtered[0]) {
    return filtered[0];
  }
  return { kind: "unionType", types: filtered };
};

/**
 * Expand Awaited<T>: Recursively unwrap Promise/Task/ValueTask.
 */
export const expandAwaitedUtility = (
  state: TypeSystemState,
  type: IrType
): IrType => {
  if (type.kind === "referenceType") {
    const expandedAlias = expandReferenceAlias(state, type);
    if (expandedAlias) {
      return expandAwaitedUtility(state, expandedAlias);
    }
  }

  const awaited = getAwaitedIrType(type);
  if (awaited) {
    return awaited.kind === "voidType"
      ? awaited
      : expandAwaitedUtility(state, awaited);
  }

  // Union: Awaited each member
  if (type.kind === "unionType") {
    const expanded = type.types.map((member) =>
      expandAwaitedUtility(state, member)
    );
    return { kind: "unionType", types: expanded };
  }

  return type;
};

/**
 * Expand Record<K, V>: Create dictionary or object type.
 */
export const expandRecordUtility = (
  state: TypeSystemState,
  keyArg: IrType,
  valueArg: IrType,
  site?: Site
): IrType => {
  // string or number → dictionary type
  if (
    keyArg.kind === "primitiveType" &&
    (keyArg.name === "string" || keyArg.name === "number")
  ) {
    return {
      kind: "dictionaryType",
      keyType: keyArg,
      valueType: valueArg,
    };
  }

  // Finite literal union → object type
  const keys = extractLiteralKeys(keyArg);
  if (!keys) {
    emitDiagnostic(
      state,
      "TSN7414",
      "Record key type must be string, number, or string literal union",
      site
    );
    return unknownType;
  }

  const members: IrPropertySignature[] = Array.from(keys).map((key) => ({
    kind: "propertySignature" as const,
    name: key,
    type: valueArg,
    isOptional: false,
    isReadonly: false,
  }));

  return { kind: "objectType", members };
};
