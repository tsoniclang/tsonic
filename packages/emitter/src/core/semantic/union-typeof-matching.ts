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
      return { kind: "referenceType", name: "object" };
    default:
      return undefined;
  }
};

export const narrowTypeByNotTypeofTag = (
  currentType: IrType | undefined,
  tag: string,
  context: EmitterContext
): IrType | undefined => {
  if (!currentType) return undefined;

  if (currentType.kind === "unionType") {
    const kept = currentType.types.filter(
      (member): member is IrType =>
        !!member && !matchesTypeofTag(member, tag, context)
    );
    if (kept.length === 0) return undefined;
    if (kept.length === 1) return kept[0];
    return normalizedUnionType(kept);
  }

  return matchesTypeofTag(currentType, tag, context) ? undefined : currentType;
};

export const narrowTypeByTypeofTag = (
  currentType: IrType | undefined,
  tag: string,
  context: EmitterContext
): IrType | undefined => {
  if (!currentType) return genericTypeofTarget(tag);

  if (currentType.kind === "unionType") {
    const kept = currentType.types.filter(
      (member): member is IrType =>
        !!member && matchesTypeofTag(member, tag, context)
    );
    if (kept.length === 0) return genericTypeofTarget(tag);
    if (kept.length === 1) return kept[0];
    return normalizedUnionType(kept);
  }

  return matchesTypeofTag(currentType, tag, context)
    ? currentType
    : genericTypeofTarget(tag);
};
