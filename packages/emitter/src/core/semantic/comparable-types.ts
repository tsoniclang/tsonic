import type { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { unwrapParameterModifierType } from "./parameter-modifier-types.js";
import { resolveTypeAlias, stripNullish } from "./type-resolution.js";

export const unwrapComparableType = (type: IrType): IrType =>
  stripNullish(unwrapParameterModifierType(type) ?? type);

export const resolveComparableType = (
  type: IrType,
  context: EmitterContext
): IrType => resolveTypeAlias(unwrapComparableType(type), context);
