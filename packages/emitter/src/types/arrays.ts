/**
 * Array type emission
 */

import { IrType } from "@tsonic/frontend";
import { EmitterContext, addUsing } from "../types.js";
import { emitType } from "./emitter.js";

/**
 * Emit array types as List<T>
 */
export const emitArrayType = (
  type: Extract<IrType, { kind: "arrayType" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const [elementType, newContext] = emitType(type.elementType, context);
  const updatedContext = addUsing(newContext, "System.Collections.Generic");
  return [`List<${elementType}>`, updatedContext];
};
