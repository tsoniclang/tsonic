import type { AstReader, Node } from "@tsonic/tsts";

export function sourceExpressionSequence(ast: AstReader, node: Node): readonly Node[] {
  const sequence: Node[] = [];
  const pending: Node[] = [node];
  while (pending.length !== 0) {
    const current = pending.pop()!;
    if (ast.is.IsParenthesizedExpression(current)) {
      const expression = ast.as.AsParenthesizedExpression(current)?.Expression;
      if (expression !== undefined) {
        pending.push(expression);
        continue;
      }
    }
    if (ast.is.IsBinaryExpression(current) && ast.operatorKindName(current) === "KindCommaToken") {
      const expression = ast.as.AsBinaryExpression(current);
      if (expression?.Left !== undefined && expression.Right !== undefined) {
        pending.push(expression.Right, expression.Left);
        continue;
      }
    }
    sequence.push(current);
  }
  return Object.freeze(sequence);
}
