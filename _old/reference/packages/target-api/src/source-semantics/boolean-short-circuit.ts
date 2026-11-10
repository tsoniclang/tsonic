import type { AstReader, Node } from "@tsonic/tsts";
import { sourceExpressionSequence } from "./expression-sequence.js";

export type SourceBooleanShortCircuitBranch = "left" | "right" | "conditional";

export function sourceBooleanShortCircuitBranch(
  ast: AstReader,
  left: Node,
  operator: "&&" | "||",
): SourceBooleanShortCircuitBranch {
  let selected = left;
  for (let depth = 0; depth < 128; depth += 1) {
    const sequence = sourceExpressionSequence(ast, selected);
    const tail = sequence[sequence.length - 1];
    if (tail !== undefined && tail !== selected) { selected = tail; continue; }
    const kind = ast.kindName(selected);
    if (kind === "KindTrueKeyword" || kind === "KindFalseKeyword") {
      return (kind === "KindTrueKeyword") === (operator === "&&") ? "right" : "left";
    }
    const wrapped = ast.is.IsParenthesizedExpression(selected) ? ast.as.AsParenthesizedExpression(selected)?.Expression
      : ast.is.IsAsExpression(selected) ? ast.as.AsAsExpression(selected)?.Expression
      : ast.is.IsTypeAssertion(selected) ? ast.as.AsTypeAssertion(selected)?.Expression
      : ast.is.IsSatisfiesExpression(selected) ? ast.as.AsSatisfiesExpression(selected)?.Expression
      : ast.is.IsNonNullExpression(selected) ? ast.as.AsNonNullExpression(selected)?.Expression : undefined;
    if (wrapped === undefined) break;
    selected = wrapped;
  }
  return "conditional";
}
