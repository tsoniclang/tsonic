/**
 * Primitive type emission
 *
 * INVARIANT A: "number" always emits as C# "double". No exceptions.
 * INVARIANT B: "int" always emits as C# "int". No exceptions.
 *
 * These are distinct types in the IR, not decorated versions of each other.
 * The numericIntent field on literals is for expression-level classification,
 * NOT for type-level emission decisions.
 */

import { IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";

/**
 * Emit primitive types (number, int, string, boolean, null, undefined)
 *
 * For numeric types:
 * - primitiveType(name="number") → "double"
 * - primitiveType(name="int") → "int"
 */
export const emitPrimitiveType = (
  type: Extract<IrType, { kind: "primitiveType" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const typeMap: Record<string, string> = {
    number: "double",
    int: "int",
    string: "string",
    boolean: "bool",
    null: "object",
    undefined: "object",
  };

  return [typeMap[type.name] ?? "object", context];
};
