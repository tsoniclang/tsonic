/**
 * Literal type emission
 */

import { IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";

/**
 * Emit literal types (string, number, boolean literals)
 */
export const emitLiteralType = (
  type: Extract<IrType, { kind: "literalType" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  // For literal types, we emit the base type
  if (typeof type.value === "string") {
    return ["string", context];
  }
  if (typeof type.value === "number") {
    return ["double", context];
  }
  if (typeof type.value === "boolean") {
    return ["bool", context];
  }
  return ["object", context];
};
