import type { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { isBroadObjectSlotType } from "./js-value-types.js";
import { normalizeRuntimeStorageType } from "./storage-types.js";
import {
  getArrayLikeElementType,
  resolveTypeAlias,
  stripNullish,
} from "./type-resolution.js";

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

  const normalizedArrayStorage =
    normalizeRuntimeStorageType(resolved, context) ?? resolved;
  const resolvedArrayStorage = resolveTypeAlias(
    stripNullish(normalizedArrayStorage),
    context
  );
  if (resolvedArrayStorage.kind !== "arrayType") {
    return false;
  }
  const normalizedElementStorage = resolvedArrayStorage.elementType;
  const resolvedElementStorage = resolveTypeAlias(
    stripNullish(normalizedElementStorage),
    context
  );

  return (
    resolvedElementStorage.kind === "referenceType" &&
    resolvedElementStorage.resolvedClrType === "System.Object"
  );
};

export const isBroadValueCarrierType = (
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
    isBroadObjectSlotType(resolved, context)
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

const isRuntimeUnionElementArrayTarget = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  const elementType = getArrayLikeElementType(type, context);
  if (!elementType) {
    return false;
  }

  const resolvedElement = resolveTypeAlias(stripNullish(elementType), context);
  return (
    resolvedElement.kind === "unionType" && resolvedElement.types.length > 1
  );
};

export const resolveBroadArrayAssertionStorageType = (
  targetType: IrType | undefined,
  sourceStorageType: IrType | undefined,
  context: EmitterContext,
  sourceSemanticType?: IrType
): IrType | undefined => {
  const targetStoresBroadArray = isBroadArrayStorageTarget(targetType, context);
  const normalizedSourceSemanticStorage = sourceSemanticType
    ? normalizeRuntimeStorageType(sourceSemanticType, context)
    : undefined;

  if (targetStoresBroadArray) {
    if (isSystemArrayStorageType(sourceStorageType, context)) {
      return SYSTEM_ARRAY_STORAGE_TYPE;
    }

    if (isBroadArrayStorageTarget(sourceStorageType, context)) {
      return (
        normalizeRuntimeStorageType(sourceStorageType, context) ??
        sourceStorageType
      );
    }
  }

  if (
    isSystemArrayStorageType(sourceStorageType, context) &&
    isRuntimeUnionElementArrayTarget(targetType, context) &&
    isBroadArrayStorageTarget(normalizedSourceSemanticStorage, context)
  ) {
    return normalizedSourceSemanticStorage;
  }

  return undefined;
};

export const resolveRuntimeArrayMemberStorageType = (
  memberType: IrType,
  context: EmitterContext
): IrType => {
  const normalizedMemberStorage =
    normalizeRuntimeStorageType(memberType, context) ?? memberType;
  const resolved = resolveTypeAlias(
    stripNullish(normalizedMemberStorage),
    context
  );

  return resolved.kind === "arrayType"
    ? normalizedMemberStorage
    : SYSTEM_ARRAY_STORAGE_TYPE;
};

export const resolveBroadArrayReceiverAssertionStorageType = (
  targetType: IrType | undefined,
  sourceStorageType: IrType | undefined,
  context: EmitterContext
): IrType | undefined =>
  isBroadArrayReceiverAssertionTarget(targetType, context) &&
  isSystemArrayStorageType(sourceStorageType, context)
    ? SYSTEM_ARRAY_STORAGE_TYPE
    : undefined;
