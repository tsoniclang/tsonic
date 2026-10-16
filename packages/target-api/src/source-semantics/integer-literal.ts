import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceNumericLiteralToken } from "./literal-values-model.js";
import { parseSourceNumericLiteralToken, sourceLiteralToken } from "./literal-token.js";

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
  const token = parseSourceNumericLiteralToken(normalized);
  return token === undefined ? undefined : sourceIntegerLiteralTokenValue(token, normalized);
}

export function sourceIntegerLiteralTokenValue(token: SourceNumericLiteralToken, text: string): bigint | undefined {
  const normalized = text.replace(/_/gu, "");
  const radix = normalized.slice(0, 2).toLowerCase();
  const bitsPerDigit = radix === "0x" ? 4 : radix === "0o" ? 3 : radix === "0b" ? 1 : undefined;
  if (bitsPerDigit !== undefined && normalized.slice(2).replace(/^0+/u, "").length * bitsPerDigit > 132) return undefined;
  if (token.coefficient === 0n) return 0n;
  if (token.exponent < 0n || BigInt(token.coefficient.toString().length) + token.exponent > 40n) return undefined;
  const value = token.coefficient * 10n ** token.exponent;
  return token.negative ? -value : value;
}
