import type { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { normalizeRuntimeStorageType } from "./storage-types.js";
import { resolveTypeAlias, stripNullish } from "./type-resolution.js";

export const SYSTEM_ARRAY_STORAGE_TYPE: IrType = {
  kind: "referenceType",
  name: "System.Array",
  resolvedClrType: "System.Array",
};

export const isSystemArrayStorageType = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!type) {
    return false;
  }

  const resolved = resolveTypeAlias(stripNullish(type), context);
  return (
    resolved.kind === "referenceType" &&
    (resolved.resolvedClrType === "System.Array" ||
      resolved.resolvedClrType === "global::System.Array" ||
      resolved.name === "Array" ||
      resolved.name === "System.Array" ||
      resolved.name === "global::System.Array")
  );
};

export const isBroadArrayStorageTarget = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!type) {
    return false;
  }

  const resolved = resolveTypeAlias(stripNullish(type), context);
  if (resolved.kind !== "arrayType") {
    return false;
  }

  const normalizedElementStorage =
    normalizeRuntimeStorageType(resolved.elementType, context) ??
    resolved.elementType;
  const resolvedElementStorage = resolveTypeAlias(
    stripNullish(normalizedElementStorage),
    context
  );

  return (
    resolvedElementStorage.kind === "referenceType" &&
    resolvedElementStorage.resolvedClrType === "System.Object"
  );
};

export const resolveBroadArrayAssertionStorageType = (
  targetType: IrType | undefined,
  sourceStorageType: IrType | undefined,
  context: EmitterContext
): IrType | undefined =>
  isBroadArrayStorageTarget(targetType, context) &&
  isSystemArrayStorageType(sourceStorageType, context)
    ? SYSTEM_ARRAY_STORAGE_TYPE
    : undefined;
