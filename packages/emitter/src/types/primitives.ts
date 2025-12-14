/**
 * Primitive type emission
 *
 * For numeric types, uses numericIntent to determine int vs double:
 * - numericIntent: "Int32" → "int"
 * - numericIntent: "Double" or undefined → "double"
 */

import { IrType, NUMERIC_KIND_TO_CSHARP } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";

/**
 * Emit primitive types (number, string, boolean, null, undefined)
 *
 * For number types, checks numericIntent to emit the correct C# type.
 */
export const emitPrimitiveType = (
  type: Extract<IrType, { kind: "primitiveType" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  // For number type, check for specific numeric intent
  if (type.name === "number" && type.numericIntent) {
    const csharpType = NUMERIC_KIND_TO_CSHARP.get(type.numericIntent);
    if (csharpType) {
      return [csharpType, context];
    }
  }

  const typeMap: Record<string, string> = {
    number: "double",
    string: "string",
    boolean: "bool",
    null: "object",
    undefined: "object",
  };

  return [typeMap[type.name] ?? "object", context];
};
