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
    // All numbers are doubles in JavaScript, but array indices should be integers
    const isInteger = Number.isInteger(value);
    const text =
      isInteger && !context.isArrayIndex ? `${value}.0` : String(value);
    return [{ text }, context];
  }

  if (typeof value === "boolean") {
    return [{ text: value ? "true" : "false" }, context];
  }

  return [{ text: String(value) }, context];
};
