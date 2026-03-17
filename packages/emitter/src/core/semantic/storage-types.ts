import { IrType, stableIrTypeKey } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { shouldEraseRecursiveRuntimeUnionArrayElement } from "./runtime-unions.js";
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

const getBareUnconstrainedTypeParameter = (
  type: IrType,
  context: EmitterContext
): string | undefined => {
  if (type.kind !== "typeParameterType") {
    return undefined;
  }

  const constraintKind =
    context.typeParamConstraints?.get(type.name) ?? "unconstrained";
  return constraintKind === "unconstrained" ? type.name : undefined;
};

const shouldEraseRuntimeUnionArrayElementStorage = (
  arrayType: Extract<IrType, { kind: "arrayType" }>,
  context: EmitterContext
): boolean => {
  return shouldEraseRecursiveRuntimeUnionArrayElement(
    arrayType.elementType,
    context
  );
};

export const normalizeRuntimeStorageType = (
  type: IrType | undefined,
  context: EmitterContext,
  activeArrayKeys: ReadonlySet<string> = new Set<string>()
): IrType | undefined => {
  if (!type) {
    return undefined;
  }

  const resolved = resolveTypeAlias(type, context);

  if (
    resolved.kind === "unknownType" ||
    resolved.kind === "anyType" ||
    resolved.kind === "objectType" ||
    (resolved.kind === "referenceType" && resolved.name === "object")
  ) {
    return OBJECT_STORAGE_TYPE;
  }

  if (resolved.kind === "arrayType") {
    const arrayKey = stableIrTypeKey(resolved);
    if (activeArrayKeys.has(arrayKey)) {
      return resolved;
    }

    if (shouldEraseRuntimeUnionArrayElementStorage(resolved, context)) {
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
    if (getBareUnconstrainedTypeParameter(nonNullishMember, context)) {
      return {
        kind: "unionType",
        types: resolved.types.map((member) =>
          isRuntimeNullishMember(member) ? member : OBJECT_STORAGE_TYPE
        ),
      };
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
