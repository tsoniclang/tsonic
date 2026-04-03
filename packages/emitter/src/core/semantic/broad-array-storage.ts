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

const isBroadValueCarrierType = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!type) {
    return false;
  }

  if (
    type.kind === "referenceType" &&
    (type.name === "JsValue" ||
      type.typeId?.tsName === "JsValue" ||
      type.resolvedClrType === "Tsonic.Runtime.JsValue" ||
      type.resolvedClrType === "global::Tsonic.Runtime.JsValue")
  ) {
    return true;
  }

  const resolved = resolveTypeAlias(stripNullish(type), context);
  return (
    resolved.kind === "unknownType" ||
    resolved.kind === "anyType" ||
    resolved.kind === "objectType" ||
    (resolved.kind === "referenceType" &&
      (resolved.name === "object" ||
        resolved.resolvedClrType === "System.Object" ||
        resolved.resolvedClrType === "global::System.Object")) ||
    (resolved.kind === "unionType" &&
      resolved.types.some(
        (member) =>
          member.kind === "objectType" ||
          (member.kind === "referenceType" &&
            (member.name === "object" ||
              member.resolvedClrType === "System.Object" ||
              member.resolvedClrType === "global::System.Object"))
      ) &&
      resolved.types.every(
        (member) =>
          member.kind === "objectType" ||
          member.kind === "primitiveType" ||
          member.kind === "literalType" ||
          (member.kind === "referenceType" &&
            (member.name === "object" ||
              member.resolvedClrType === "System.Object" ||
              member.resolvedClrType === "global::System.Object"))
      ))
  );
};

export const isBroadArrayReceiverAssertionTarget = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!type) {
    return false;
  }

  const resolved = resolveTypeAlias(stripNullish(type), context);
  return (
    resolved.kind === "arrayType" &&
    isBroadValueCarrierType(resolved.elementType, context)
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

export const resolveBroadArrayReceiverAssertionStorageType = (
  targetType: IrType | undefined,
  sourceStorageType: IrType | undefined,
  context: EmitterContext
): IrType | undefined =>
  isBroadArrayReceiverAssertionTarget(targetType, context) &&
  isSystemArrayStorageType(sourceStorageType, context)
    ? SYSTEM_ARRAY_STORAGE_TYPE
    : undefined;
