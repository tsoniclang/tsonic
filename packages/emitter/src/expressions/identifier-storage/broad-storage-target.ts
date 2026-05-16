import { IrType } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { referenceTypeHasClrIdentity } from "../../core/semantic/clr-type-identity.js";
import {
  resolveTypeAlias,
  stripNullish,
} from "../../core/semantic/type-resolution.js";

const SYSTEM_OBJECT_CLR_NAMES = new Set([
  "System.Object",
  "global::System.Object",
]);

const isSystemObjectReferenceType = (type: IrType): boolean =>
  type.kind === "referenceType" &&
  (type.name === "object" ||
    referenceTypeHasClrIdentity(type, SYSTEM_OBJECT_CLR_NAMES));

export const isBroadStorageTarget = (
  expectedType: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!expectedType) {
    return false;
  }

  const resolved = resolveTypeAlias(stripNullish(expectedType), context);
  return (
    resolved.kind === "unknownType" ||
    resolved.kind === "anyType" ||
    resolved.kind === "objectType" ||
    (resolved.kind === "unionType" &&
      resolved.types.some(
        (member) =>
          member.kind === "objectType" || isSystemObjectReferenceType(member)
      ) &&
      resolved.types.every(
        (member) =>
          member.kind === "objectType" ||
          member.kind === "primitiveType" ||
          member.kind === "literalType" ||
          isSystemObjectReferenceType(member)
      )) ||
    isSystemObjectReferenceType(resolved)
  );
};
