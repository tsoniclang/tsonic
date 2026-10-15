import type { AstReader, Node } from "@tsonic/tsts";
import { sourceIntegerLiteralValue } from "./integer-literal.js";

interface SourceIntegerConstantSummary {
  readonly value: bigint;
  readonly work: number;
  readonly height: number;
}

type SourceIntegerConstantStep =
  | { readonly kind: "visit"; readonly node: Node; readonly depth: number }
  | { readonly kind: "finish"; readonly node: Node; readonly depth: number;
      readonly operator: string | undefined; readonly children: readonly Node[] };

export function createSourceIntegerConstantReader(
  ast: AstReader,
  integerLiteralValue: (literal: Node) => bigint | undefined = literal => sourceIntegerLiteralValue(ast, literal),
): (expression: Node) => bigint | undefined {
  const completed = new WeakMap<Node, SourceIntegerConstantSummary>();
  const failedRoots = new WeakSet<Node>();
  const maximumMagnitude = (1n << 132n) - 1n;
  const refuse = (expression: Node): undefined => {
    failedRoots.add(expression);
    return undefined;
  };
  return expression => {
    if (failedRoots.has(expression)) return undefined;
    const ready = completed.get(expression);
    if (ready !== undefined) return ready.value;
    const active = new Set<Node>();
    const pending: SourceIntegerConstantStep[] = [{ kind: "visit", node: expression, depth: 0 }];
    let remaining = 4096;
    while (pending.length > 0) {
      const entry = pending.pop()!;
      const { node } = entry;
      if (entry.depth > 128) return refuse(expression);
      if (entry.kind === "visit") {
        if (active.has(node)) return refuse(expression);
        const prior = completed.get(node);
        if (prior !== undefined) {
          remaining -= prior.work;
          if (remaining < 0 || entry.depth + prior.height > 128) return refuse(expression);
          continue;
        }
        if (--remaining < 0) return refuse(expression);
        const kind = ast.kindName(node);
        if (kind === "KindNumericLiteral" || kind === "KindBigIntLiteral") {
          const value = integerLiteralValue(node);
          if (value === undefined || value < -maximumMagnitude || value > maximumMagnitude) return refuse(expression);
          completed.set(node, { value, work: 1, height: 0 });
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
        if (children === undefined) return refuse(expression);
        active.add(node);
        pending.push({ kind: "finish", node, depth: entry.depth, operator, children });
        for (const child of children) pending.push({ kind: "visit", node: child, depth: entry.depth + 1 });
        continue;
      }
      if (--remaining < 0) return refuse(expression);
      active.delete(node);
      const left = completed.get(entry.children[0]!);
      const right = entry.children.length === 1 ? undefined : completed.get(entry.children[1]!);
      if (left === undefined || entry.children.length === 2 && right === undefined) return refuse(expression);
      const { operator } = entry;
      if ((operator === "KindSlashToken" || operator === "KindPercentToken") && right?.value === 0n) return refuse(expression);
      const value = entry.children.length === 1 ? operator === "KindMinusToken" ? -left.value : left.value
        : operator === "KindPlusToken" ? left.value + right!.value
        : operator === "KindMinusToken" ? left.value - right!.value
        : operator === "KindAsteriskToken" ? left.value * right!.value
        : operator === "KindSlashToken" ? left.value / right!.value : left.value % right!.value;
      if (value < -maximumMagnitude || value > maximumMagnitude) return refuse(expression);
      completed.set(node, { value, work: 2 + left.work + (right?.work ?? 0),
        height: 1 + Math.max(left.height, right?.height ?? 0) });
    }
    return completed.get(expression)?.value;
  };
}

export function sourceIntegerConstantValue(ast: AstReader, expression: Node): bigint | undefined {
  return createSourceIntegerConstantReader(ast)(expression);
}
