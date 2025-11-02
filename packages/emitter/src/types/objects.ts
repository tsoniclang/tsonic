/**
 * Object type emission
 */

import { IrType } from "@tsonic/frontend";
import { EmitterContext, addUsing } from "../types.js";

/**
 * Emit object types as dynamic
 */
export const emitObjectType = (
  _type: Extract<IrType, { kind: "objectType" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  // For anonymous object types, we use dynamic or object
  // In a more complete implementation, we might generate anonymous types
  return ["dynamic", addUsing(context, "System")];
};
