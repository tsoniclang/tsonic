/**
 * Array type emission
 *
 * All array types emit as native CLR arrays (T[]).
 * List<T> is only used when explicitly requested via new List<T>().
 */

import { IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitType } from "./emitter.js";

/**
 * Emit array types as native CLR arrays
 */
export const emitArrayType = (
  type: Extract<IrType, { kind: "arrayType" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const [elementType, newContext] = emitType(type.elementType, context);

  // Always emit native CLR array
  return [`${elementType}[]`, newContext];
};
