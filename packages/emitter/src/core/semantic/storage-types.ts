import { IrType, stableIrTypeKey } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { buildRuntimeUnionFrame } from "./runtime-unions.js";
import {
  resolveTypeAlias,
  splitRuntimeNullishUnionMembers,
} from "./type-resolution.js";

const OBJECT_STORAGE_TYPE: IrType = {
  kind: "referenceType",
  name: "object",
  resolvedClrType: "System.Object",
};

const isRuntimeNullishMember = (type: IrType): boolean =>
  type.kind === "primitiveType" &&
  (type.name === "null" || type.name === "undefined");

export const normalizeRuntimeStorageType = (
  type: IrType | undefined,
  context: EmitterContext,
  activeArrayKeys: ReadonlySet<string> = new Set<string>()
): IrType | undefined => {
  if (!type) {
    return undefined;
  }

  const resolved = resolveTypeAlias(type, context);

  if (resolved.kind === "arrayType") {
    const arrayKey = stableIrTypeKey(resolved);
    if (activeArrayKeys.has(arrayKey)) {
      return resolved;
    }

    if (buildRuntimeUnionFrame(resolved.elementType, context)) {
      return {
        kind: "arrayType",
        elementType: OBJECT_STORAGE_TYPE,
        origin: resolved.origin,
      };
    }

    const nextActive = new Set(activeArrayKeys);
    nextActive.add(arrayKey);
    const normalizedElementType =
      normalizeRuntimeStorageType(resolved.elementType, context, nextActive) ??
      resolved.elementType;

    return stableIrTypeKey(normalizedElementType) ===
      stableIrTypeKey(resolved.elementType)
      ? resolved
      : {
          ...resolved,
          elementType: normalizedElementType,
        };
  }

  if (resolved.kind === "unionType") {
    const split = splitRuntimeNullishUnionMembers(resolved);
    if (!split || split.nonNullishMembers.length !== 1) {
      return resolved;
    }

    const nonNullishMember = split.nonNullishMembers[0];
    if (!nonNullishMember) {
      return resolved;
    }
    const normalizedNonNullishMember =
      normalizeRuntimeStorageType(nonNullishMember, context, activeArrayKeys) ??
      nonNullishMember;

    if (
      stableIrTypeKey(normalizedNonNullishMember) ===
      stableIrTypeKey(nonNullishMember)
    ) {
      return resolved;
    }

    return {
      kind: "unionType",
      types: resolved.types.map((member) =>
        isRuntimeNullishMember(member) ? member : normalizedNonNullishMember
      ),
    };
  }

  return resolved;
};
