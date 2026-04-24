import type { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { resolveComparableType } from "./comparable-types.js";
import { resolveTypeAlias, stripNullish } from "./type-resolution.js";
import { willCarryAsRuntimeUnion } from "./union-semantics.js";
export {
  isBroadObjectSlotType,
  isJsValueReferenceType,
  normalizeBroadObjectSinkType,
} from "./broad-object-types.js";

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
