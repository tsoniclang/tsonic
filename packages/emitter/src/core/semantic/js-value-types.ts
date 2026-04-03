import type { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { resolveTypeAlias, stripNullish } from "./type-resolution.js";

export const isJsValueReferenceType = (type: IrType): boolean =>
  type.kind === "referenceType" &&
  (type.name === "JsValue" ||
    type.typeId?.tsName === "JsValue" ||
    type.resolvedClrType === "Tsonic.Runtime.JsValue" ||
    type.resolvedClrType === "global::Tsonic.Runtime.JsValue");

const isSystemObjectReferenceType = (type: IrType): boolean =>
  type.kind === "referenceType" &&
  (type.name === "object" ||
    type.resolvedClrType === "System.Object" ||
    type.resolvedClrType === "global::System.Object");

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
    resolved.kind === "objectType" ||
    isSystemObjectReferenceType(resolved) ||
    (resolved.kind === "unionType" &&
      resolved.types.some(
        (member) =>
          member.kind === "objectType" ||
          isJsValueReferenceType(member) ||
          isSystemObjectReferenceType(member)
      ) &&
      resolved.types.every(
        (member) =>
          member.kind === "objectType" ||
          member.kind === "primitiveType" ||
          member.kind === "literalType" ||
          isJsValueReferenceType(member) ||
          isSystemObjectReferenceType(member)
      ))
  );
};
