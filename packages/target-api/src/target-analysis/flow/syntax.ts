import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceFlowConstruction } from "./construction.js";

export function sourceFlowWrappedOperand(ast: AstReader, node: Node): Node | undefined {
  if (ast.is.IsParenthesizedExpression(node)) return ast.as.AsParenthesizedExpression(node)?.Expression;
  if (ast.is.IsAsExpression(node)) return ast.as.AsAsExpression(node)?.Expression;
  if (ast.is.IsTypeAssertion(node)) return ast.as.AsTypeAssertion(node)?.Expression;
  if (ast.is.IsSatisfiesExpression(node)) return ast.as.AsSatisfiesExpression(node)?.Expression;
  if (ast.is.IsNonNullExpression(node)) return ast.as.AsNonNullExpression(node)?.Expression;
  return undefined;
}

export function sourceFlowUnwrap(build: SourceFlowConstruction, node: Node): Node {
  let selected = node;
  while (true) {
    build.step(selected);
    const inner = sourceFlowWrappedOperand(build.source.ast, selected);
    if (inner === undefined) return selected;
    selected = inner;
  }
}
