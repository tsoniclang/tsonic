import type { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { referenceTypeHasClrIdentity } from "./clr-type-identity.js";
import { resolveTypeAlias, stripNullish } from "./type-resolution.js";

const JS_VALUE_CLR_NAMES = new Set([
  "Tsonic.Runtime.JsValue",
  "global::Tsonic.Runtime.JsValue",
]);

const SYSTEM_OBJECT_CLR_NAMES = new Set([
  "System.Object",
  "global::System.Object",
]);

const SYSTEM_NUMERICS_BIG_INTEGER_CLR_NAMES = new Set([
  "System.Numerics.BigInteger",
  "global::System.Numerics.BigInteger",
]);

export const SYSTEM_OBJECT_REFERENCE_TYPE: IrType = {
  kind: "referenceType",
  name: "object",
  resolvedClrType: "global::System.Object",
};

export const isJsValueReferenceType = (type: IrType): boolean =>
  type.kind === "referenceType" &&
  (type.name === "JsValue" ||
    type.typeId?.tsName === "JsValue" ||
    referenceTypeHasClrIdentity(type, JS_VALUE_CLR_NAMES));

const isSystemObjectReferenceType = (type: IrType): boolean =>
  type.kind === "referenceType" &&
  (type.name === "object" ||
    referenceTypeHasClrIdentity(type, SYSTEM_OBJECT_CLR_NAMES));

const isBroadObjectUnionMemberType = (type: IrType): boolean =>
  type.kind === "functionType" ||
  type.kind === "primitiveType" ||
  type.kind === "literalType" ||
  isJsValueReferenceType(type) ||
  isSystemObjectReferenceType(type) ||
  (type.kind === "referenceType" &&
    referenceTypeHasClrIdentity(type, SYSTEM_NUMERICS_BIG_INTEGER_CLR_NAMES));

export const normalizeBroadObjectSinkType = (
  type: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  if (!type) {
    return undefined;
  }

  const resolved = resolveTypeAlias(stripNullish(type), context);
  return resolved.kind === "unknownType" || resolved.kind === "anyType"
    ? SYSTEM_OBJECT_REFERENCE_TYPE
    : type;
};

export const isBroadObjectSlotType = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!type) {
    return false;
  }

  if (isJsValueReferenceType(type)) {
    return true;
  }

  const resolved = resolveTypeAlias(stripNullish(type), context);
  if (isJsValueReferenceType(resolved)) {
    return true;
  }

  return (
    isSystemObjectReferenceType(resolved) ||
    (resolved.kind === "unionType" &&
      (resolved.types.some(isJsValueReferenceType) ||
        (resolved.types.some((member) => isSystemObjectReferenceType(member)) &&
          resolved.types.every(isBroadObjectUnionMemberType))))
  );
};
