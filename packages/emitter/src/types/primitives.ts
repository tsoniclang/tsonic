/**
 * Primitive type emission
 */

import { IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";

/**
 * Emit primitive types (number, string, boolean, null, undefined)
 */
export const emitPrimitiveType = (
  type: Extract<IrType, { kind: "primitiveType" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const typeMap: Record<string, string> = {
    number: "double",
    string: "string",
    boolean: "bool",
    null: "object",
    undefined: "object",
  };

  return [typeMap[type.name] ?? "object", context];
};
