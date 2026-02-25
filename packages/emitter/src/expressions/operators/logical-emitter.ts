/**
 * Logical operator expression emitter (&&, ||, ??)
 */

import { IrExpression } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import { isDefinitelyValueType } from "../../core/semantic/type-resolution.js";
import { printExpression } from "../../core/format/backend-ast/printer.js";
import { isBooleanType } from "./helpers.js";
import type { CSharpExpressionAst } from "../../core/format/backend-ast/types.js";

/**
 * Emit a logical operator expression as CSharpExpressionAst
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
): [CSharpExpressionAst, EmitterContext] => {
  const [leftAst, leftContext] = emitExpressionAst(expr.left, context);

  // If || is used with non-boolean left operand, use ?? instead for nullish coalescing
  const operator =
    expr.operator === "||" && !isBooleanType(expr.left.inferredType)
      ? "??"
      : expr.operator;

  // If the left operand is a non-nullable value type, `??` is invalid in C# and the
  // fallback is unreachable. Emit only the left operand.
  if (
    operator === "??" &&
    expr.left.inferredType &&
    expr.left.inferredType.kind !== "unionType" &&
    isDefinitelyValueType(expr.left.inferredType)
  ) {
    // Conditional access (`?.` / `?[`) produces nullable value types in C# even when the
    // underlying member type is non-nullable (e.g., `string?.Length` → `int?`).
    // In that case the fallback is still meaningful and must be preserved.
    const leftText = printExpression(leftAst);
    if (!leftText.includes("?.") && !leftText.includes("?[")) {
      return [leftAst, leftContext];
    }
  }

  const [rightAst, rightContext] = emitExpressionAst(expr.right, leftContext);

  return [
    {
      kind: "binaryExpression",
      operatorToken: operator,
      left: leftAst,
      right: rightAst,
    },
    rightContext,
  ];
};
