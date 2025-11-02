/**
 * Intersection type emission
 */

import { IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";

/**
 * Emit intersection types as object (C# doesn't have intersection types)
 */
export const emitIntersectionType = (
  _type: Extract<IrType, { kind: "intersectionType" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  // C# doesn't have intersection types
  // For MVP, we'll use object
  // In a more complete implementation, we might generate an interface
  return ["object", context];
};
