/**
 * Union member matching by typeof tags.
 *
 * Matches IR types against JavaScript typeof tags ("string", "number",
 * "boolean", "undefined", "object", "function") and narrows union types
 * by including or excluding members that match a given tag.
 */

import type { IrType } from "@tsonic/frontend";
import { normalizedUnionType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { resolveTypeAlias } from "./nullish-value-helpers.js";
import { areIrTypesEquivalent } from "./type-equivalence.js";
import { getContextualTypeVisitKey } from "./deterministic-type-keys.js";

const genericTypeofTarget = (tag: string): IrType | undefined => {
  switch (tag) {
    case "string":
      return { kind: "primitiveType", name: "string" };
    case "number":
      return { kind: "primitiveType", name: "number" };
    case "boolean":
      return { kind: "primitiveType", name: "boolean" };
    case "undefined":
      return { kind: "primitiveType", name: "undefined" };
    case "object":
      return {
        kind: "referenceType",
        name: "object",
        resolvedClrType: "global::System.Object",
      };
    case "function":
      return {
        kind: "functionType",
        parameters: [],
        returnType: { kind: "unknownType" },
      };
    default:
      return undefined;
  }
};

const containsBroadTypeofBoundary = (
  type: IrType,
  context: EmitterContext,
  seen = new Set<string>()
): boolean => {
  const key = getContextualTypeVisitKey(type, context);
  if (seen.has(key)) {
    return false;
  }

  const nextSeen = new Set(seen);
  nextSeen.add(key);
  const resolved = resolveTypeAlias(type, context);
  if (resolved.kind === "unknownType" || resolved.kind === "anyType") {
    return true;
  }
  if (resolved.kind === "unionType") {
    return resolved.types.some((member) =>
      containsBroadTypeofBoundary(member, context, nextSeen)
    );
  }
  return false;
};

export const matchesTypeofTag = (
  type: IrType,
  tag: string,
  context: EmitterContext
): boolean => {
  const resolved = resolveTypeAlias(type, context);

  if (resolved.kind === "literalType") {
    switch (tag) {
      case "string":
        return typeof resolved.value === "string";
      case "number":
        return typeof resolved.value === "number";
      case "boolean":
        return typeof resolved.value === "boolean";
      case "object":
        return resolved.value === null;
      default:
        return false;
    }
  }

  if (resolved.kind === "functionType") {
    return tag === "function";
  }

  if (resolved.kind === "arrayType" || resolved.kind === "tupleType") {
    return tag === "object";
  }

  if (resolved.kind === "objectType" || resolved.kind === "dictionaryType") {
    return tag === "object";
  }

  if (resolved.kind === "referenceType") {
    if (tag === "function") {
      return false;
    }

    if (tag === "object") {
      return resolved.name !== "Function";
    }

    return false;
  }

  if (resolved.kind !== "primitiveType") {
    return false;
  }

  switch (tag) {
    case "string":
      return resolved.name === "string";
    case "number":
      return resolved.name === "number" || resolved.name === "int";
    case "boolean":
      return resolved.name === "boolean";
    case "undefined":
      return resolved.name === "undefined";
    case "object":
      return resolved.name === "null";
    default:
      return false;
  }
};

const collectTypeofCandidateLeaves = (
  type: IrType,
  context: EmitterContext,
  seen = new Set<string>()
): readonly IrType[] => {
  const key = getContextualTypeVisitKey(type, context);
  if (seen.has(key)) {
    return [];
  }

  const nextSeen = new Set(seen);
  nextSeen.add(key);

  if (type.kind === "unionType") {
    return type.types.flatMap((member) =>
      collectTypeofCandidateLeaves(member, context, nextSeen)
    );
  }

  const resolved = resolveTypeAlias(type, context);

  if (resolved.kind === "unionType") {
    return resolved.types.flatMap((member) =>
      collectTypeofCandidateLeaves(member, context, nextSeen)
    );
  }

  if (type.kind === "referenceType" && resolved.kind === "objectType") {
    return [type];
  }

  if (!areIrTypesEquivalent(resolved, type, context)) {
    return collectTypeofCandidateLeaves(resolved, context, nextSeen);
  }

  return [resolved];
};

const filterTypeofCandidateLeaves = (
  currentType: IrType,
  tag: string,
  context: EmitterContext,
  wantMatch: boolean
): IrType | undefined => {
  const kept = collectTypeofCandidateLeaves(currentType, context).filter(
    (member): member is IrType =>
      !!member &&
      (wantMatch
        ? matchesTypeofTag(member, tag, context)
        : !matchesTypeofTag(member, tag, context))
  );

  if (kept.length === 0) return undefined;
  if (kept.length === 1) return kept[0];
  return normalizedUnionType(kept);
};

export const narrowTypeByNotTypeofTag = (
  currentType: IrType | undefined,
  tag: string,
  context: EmitterContext
): IrType | undefined => {
  if (!currentType) return undefined;

  return filterTypeofCandidateLeaves(currentType, tag, context, false);
};

export const narrowTypeByTypeofTag = (
  currentType: IrType | undefined,
  tag: string,
  context: EmitterContext
): IrType | undefined => {
  if (!currentType) return undefined;

  return (
    filterTypeofCandidateLeaves(currentType, tag, context, true) ??
    (containsBroadTypeofBoundary(currentType, context)
      ? genericTypeofTarget(tag)
      : undefined)
  );
};
