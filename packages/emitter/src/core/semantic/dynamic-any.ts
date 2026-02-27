import { IrType } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { resolveTypeAlias, stripNullish } from "./type-resolution.js";

export const DYNAMIC_ANY_TYPE_NAME = "__TSONIC_ANY";
export const DYNAMIC_OPS_FQN = "global::Tsonic.Internal.DynamicOps";

const typeContainsDynamicAnyInternal = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!type) return false;

  const resolved = resolveTypeAlias(stripNullish(type), context);

  if (resolved.kind === "referenceType") {
    return resolved.name === DYNAMIC_ANY_TYPE_NAME;
  }

  if (resolved.kind === "unionType" || resolved.kind === "intersectionType") {
    return resolved.types.some((member) =>
      typeContainsDynamicAnyInternal(member, context)
    );
  }

  return false;
};

export const typeContainsDynamicAny = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => typeContainsDynamicAnyInternal(type, context);
