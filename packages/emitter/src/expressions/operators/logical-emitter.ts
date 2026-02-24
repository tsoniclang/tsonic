/**
 * Logical operator expression emitter (&&, ||, ??)
 */

import { IrExpression } from "@tsonic/frontend";
import { EmitterContext, CSharpFragment } from "../../types.js";
import { emitExpression } from "../../expression-emitter.js";
import { isDefinitelyValueType } from "../../core/semantic/type-resolution.js";
import { isBooleanType, getPrecedence } from "./helpers.js";

/**
 * Emit a logical operator expression (&&, ||, ??)
 *
 * In TypeScript, || is used both for:
 * 1. Boolean OR (when operands are booleans)
 * 2. Nullish coalescing fallback (when left operand is nullable)
 *
 * In C#:
 * - || only works with booleans
 * - ?? is used for nullish coalescing
 *
 * We check if || is used with non-boolean operands and emit ?? instead.
 */
export const emitLogical = (
  expr: Extract<IrExpression, { kind: "logical" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  const [leftFrag, leftContext] = emitExpression(expr.left, context);

  // If || is used with non-boolean left operand, use ?? instead for nullish coalescing
  const operator =
    expr.operator === "||" && !isBooleanType(expr.left.inferredType)
      ? "??"
      : expr.operator;

  const parentPrecedence = getPrecedence(operator);

  // If the left operand is a non-nullable value type, `??` is invalid in C# and the
  // fallback is unreachable. Emit only the left operand.
  if (
    operator === "??" &&
    expr.left.inferredType &&
    expr.left.inferredType.kind !== "unionType" &&
    isDefinitelyValueType(expr.left.inferredType) &&
    // Conditional access (`?.` / `?[`) produces nullable value types in C# even when the
    // underlying member type is non-nullable (e.g., `string?.Length` → `int?`).
    // In that case the fallback is still meaningful and must be preserved.
    !leftFrag.text.includes("?.") &&
    !leftFrag.text.includes("?[")
  ) {
    return [leftFrag, leftContext];
  }

  const [rightFrag, rightContext] = emitExpression(expr.right, leftContext);

  const leftText =
    leftFrag.precedence !== undefined && leftFrag.precedence < parentPrecedence
      ? `(${leftFrag.text})`
      : leftFrag.text;

  const rightText =
    rightFrag.precedence !== undefined &&
    rightFrag.precedence <= parentPrecedence
      ? `(${rightFrag.text})`
      : rightFrag.text;

  const text = `${leftText} ${operator} ${rightText}`;
  return [{ text, precedence: getPrecedence(operator) }, rightContext];
};
