/**
 * Literal expression emitters
 */

import { IrExpression } from "@tsonic/frontend";
import { EmitterContext, CSharpFragment } from "../types.js";

/**
 * Emit a literal value (string, number, boolean, null, undefined)
 */
export const emitLiteral = (
  expr: Extract<IrExpression, { kind: "literal" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  const { value } = expr;

  if (value === null) {
    return [{ text: "null" }, context];
  }

  if (value === undefined) {
    return [{ text: "default" }, context];
  }

  if (typeof value === "string") {
    // Escape the string for C#
    const escaped = value
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t");
    return [{ text: `"${escaped}"` }, context];
  }

  if (typeof value === "number") {
    // TypeScript `number` is always `double` in C#
    // For array indices, keep as integer (handled by isArrayIndex flag)
    if (context.isArrayIndex) {
      // Array indices need to be integers
      const text = Number.isInteger(value)
        ? String(value)
        : String(Math.floor(value));
      return [{ text }, context];
    }

    // Emit as double: ensure decimal point for integer values
    // This matches TypeScript semantics where `number` is always double
    if (Number.isInteger(value) && !String(value).includes(".")) {
      return [{ text: `${value}.0` }, context];
    }
    return [{ text: String(value) }, context];
  }

  if (typeof value === "boolean") {
    return [{ text: value ? "true" : "false" }, context];
  }

  return [{ text: String(value) }, context];
};
