/**
 * Literal expression emitters
 *
 * NEW NUMERIC SPEC:
 * - Integer literals (42) have type int
 * - Floating literals (42.0, 3.14, 1e3) have type double
 * - The raw lexeme determines the C# type, NOT contextual typing
 * - No automatic widening from int to double based on expected type
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext, CSharpFragment } from "../types.js";
import {
  containsTypeParameter,
  isDefinitelyValueType,
} from "../core/type-resolution.js";

/**
 * Emit a literal value (string, number, boolean, null, undefined)
 *
 * @param expr - The literal expression
 * @param context - Emitter context
 * @param expectedType - Optional expected IR type (for null → default conversion in generic contexts)
 */
export const emitLiteral = (
  expr: Extract<IrExpression, { kind: "literal" }>,
  context: EmitterContext,
  expectedType?: IrType
): [CSharpFragment, EmitterContext] => {
  const { value } = expr;

  if (value === null) {
    // Emit "default" instead of "null" in two cases:
    // 1. Generic contexts where expected type contains type parameters (CS0403)
    //    Example: Result<T> { value: null } → { value = default }
    // 2. Value type contexts where null is invalid (CS0037)
    //    Example: Result<number, string> { value: null } → { value = default }
    if (expectedType) {
      const typeParams = context.typeParameters ?? new Set<string>();
      if (
        containsTypeParameter(expectedType, typeParams) ||
        isDefinitelyValueType(expectedType)
      ) {
        return [{ text: "default" }, context];
      }
    }
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
    // NEW NUMERIC SPEC: Use raw lexeme to preserve user's literal form.
    // - Integer literals (42) → type int in C#
    // - Floating literals (42.0, 3.14, 1e3) → type double in C#
    // The raw lexeme determines the C# type, NOT contextual typing.
    if (expr.raw !== undefined) {
      return [{ text: expr.raw }, context];
    }

    // Fallback if raw is not available (shouldn't happen for source literals)
    // Use String(value) which will produce integer form for whole numbers
    return [{ text: String(value) }, context];
  }

  if (typeof value === "boolean") {
    return [{ text: value ? "true" : "false" }, context];
  }

  return [{ text: String(value) }, context];
};
