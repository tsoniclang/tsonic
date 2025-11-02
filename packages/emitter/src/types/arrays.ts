/**
 * Array type emission
 */

import { IrType } from "@tsonic/frontend";
import { EmitterContext, addUsing } from "../types.js";
import { emitType } from "./emitter.js";

/**
 * Emit array types as Tsonic.Runtime.Array<T>
 */
export const emitArrayType = (
  type: Extract<IrType, { kind: "arrayType" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const [elementType, newContext] = emitType(type.elementType, context);
  const updatedContext = addUsing(newContext, "Tsonic.Runtime");
  return [`Tsonic.Runtime.Array<${elementType}>`, updatedContext];
};
