import type { AstReader, Node } from "@tsonic/tsts";
import { sourceIntegerLiteralValue } from "./integer-literal.js";

export function sourceIntegerConstantValue(ast: AstReader, expression: Node): bigint | undefined {
  const values = new Map<Node, bigint>();
  const active = new Set<Node>();
  const pending: { readonly node: Node; readonly finish: boolean; readonly depth: number }[] =
    [{ node: expression, finish: false, depth: 0 }];
  const maximumMagnitude = (1n << 132n) - 1n;
  let remaining = 4096;
  while (pending.length > 0) {
    const entry = pending.pop()!;
    if (--remaining < 0 || entry.depth > 128) return undefined;
    const { node } = entry;
    const kind = ast.kindName(node);
    if (kind === "KindNumericLiteral" || kind === "KindBigIntLiteral") {
      const value = sourceIntegerLiteralValue(ast, node);
      if (value === undefined || value < -maximumMagnitude || value > maximumMagnitude) return undefined;
      values.set(node, value);
      continue;
    }
    const operator = ast.operatorKindName(node);
    const operand = ast.is.IsParenthesizedExpression(node)
      ? ast.as.AsParenthesizedExpression(node)?.Expression
      : ast.is.IsPrefixUnaryExpression(node) && (operator === "KindPlusToken" || operator === "KindMinusToken")
        ? ast.as.AsPrefixUnaryExpression(node)?.Operand : undefined;
    const binary = ast.is.IsBinaryExpression(node) ? ast.as.AsBinaryExpression(node) : undefined;
    const children = operand !== undefined ? [operand]
      : binary?.Left !== undefined && binary.Right !== undefined && operator !== undefined &&
        ["KindPlusToken", "KindMinusToken", "KindAsteriskToken", "KindSlashToken", "KindPercentToken"].includes(operator)
        ? [binary.Left, binary.Right] : undefined;
    if (children === undefined) return undefined;
    if (!entry.finish) {
      if (active.has(node)) return undefined;
      active.add(node);
      pending.push({ ...entry, finish: true });
      for (const child of children) pending.push({ node: child, finish: false, depth: entry.depth + 1 });
      continue;
    }
    active.delete(node);
    const left = values.get(children[0]!);
    const right = children.length === 1 ? undefined : values.get(children[1]!);
    if (left === undefined || children.length === 2 && right === undefined) return undefined;
    if ((operator === "KindSlashToken" || operator === "KindPercentToken") && right === 0n) return undefined;
    const value = children.length === 1 ? operator === "KindMinusToken" ? -left : left
      : operator === "KindPlusToken" ? left + right!
      : operator === "KindMinusToken" ? left - right!
      : operator === "KindAsteriskToken" ? left * right!
      : operator === "KindSlashToken" ? left / right! : left % right!;
    if (value < -maximumMagnitude || value > maximumMagnitude) return undefined;
    values.set(node, value);
  }
  return values.get(expression);
}
