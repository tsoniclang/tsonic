import type { AstReader, Node } from "@tsonic/tsts";
import { parseSourceNumericLiteral, sourceLiteralToken } from "./literal-token.js";

export function sourceIntegerLiteralValue(ast: AstReader, node: Node): bigint | undefined {
  const kind = ast.kindName(node);
  if (ast.is.IsParenthesizedExpression(node)) {
    const inner = ast.as.AsParenthesizedExpression(node)?.Expression;
    return inner === undefined ? undefined : sourceIntegerLiteralValue(ast, inner);
  }
  if (ast.is.IsPrefixUnaryExpression(node)) {
    const operand = ast.as.AsPrefixUnaryExpression(node)?.Operand;
    const operator = ast.operatorKindName(node);
    if (operand === undefined || (operator !== "KindPlusToken" && operator !== "KindMinusToken")) return undefined;
    const value = sourceIntegerLiteralValue(ast, operand);
    return value === undefined ? undefined : operator === "KindMinusToken" ? -value : value;
  }
  if (kind !== "KindNumericLiteral" && kind !== "KindBigIntLiteral") return undefined;
  const token = sourceLiteralToken(ast, node);
  if (token.kind === "authored") return parseNativeIntegerLiteral(token.text);
  const text = ast.text(node);
  if (kind === "KindNumericLiteral" && !Number.isSafeInteger(Number(text))) return undefined;
  return parseNativeIntegerLiteral(text);
}

export function parseNativeIntegerLiteral(text: string): bigint | undefined {
  const normalized = text.replace(/n$/u, "");
  return parseSourceNumericLiteral(normalized)?.integer;
}
