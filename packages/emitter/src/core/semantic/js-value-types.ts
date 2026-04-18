import type { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { resolveComparableType } from "./comparable-types.js";
import { resolveTypeAlias, stripNullish } from "./type-resolution.js";
import { willCarryAsRuntimeUnion } from "./union-semantics.js";

const SYSTEM_OBJECT_REFERENCE_TYPE: IrType = {
  kind: "referenceType",
  name: "object",
  resolvedClrType: "global::System.Object",
};

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
          resolved.types.every(
            (member) =>
              member.kind === "functionType" ||
              member.kind === "primitiveType" ||
              member.kind === "literalType" ||
              isJsValueReferenceType(member) ||
              isSystemObjectReferenceType(member)
          ))))
  );
};

export const isBroadObjectPassThroughType = (
  type: IrType | undefined,
  context: EmitterContext,
  seen = new Set<IrType>()
): boolean => {
  if (!type || seen.has(type)) {
    return false;
  }
  seen.add(type);

  if (
    willCarryAsRuntimeUnion(
      resolveTypeAlias(stripNullish(type), context),
      context
    )
  ) {
    return false;
  }

  const resolved = resolveComparableType(type, context);
  switch (resolved.kind) {
    case "referenceType":
    case "functionType":
    case "objectType":
    case "arrayType":
    case "tupleType":
    case "dictionaryType":
      return true;
    case "literalType":
      return (
        typeof resolved.value === "string" ||
        typeof resolved.value === "boolean"
      );
    case "primitiveType":
      return (
        resolved.name === "string" ||
        resolved.name === "boolean" ||
        resolved.name === "null" ||
        resolved.name === "undefined"
      );
    case "unionType":
      return resolved.types.every((member) => {
        const comparableMember = resolveComparableType(member, context);
        return (
          (comparableMember.kind === "primitiveType" &&
            (comparableMember.name === "null" ||
              comparableMember.name === "undefined")) ||
          isBroadObjectPassThroughType(member, context, seen)
        );
      });
    default:
      return false;
  }
};
