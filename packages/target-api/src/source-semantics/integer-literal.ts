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
  // A literal TSTS synthesized has no authored token. Its checked text is the exact value of a bigint literal, and of a
  // numeric literal only within the safe integer range.
  const text = ast.text(node);
  if (kind === "KindNumericLiteral" && !Number.isSafeInteger(Number(text))) return undefined;
  return parseNativeIntegerLiteral(kind === "KindBigIntLiteral" && !text.endsWith("n") ? `${text}n` : text);
}

// A bigint literal has only integer digits, so its exact value is no larger than its token and needs no bound. A numeric
// literal can spell a huge value through an exponent; its integer fact stays bounded by the shared numeric reader.
export function parseNativeIntegerLiteral(text: string): bigint | undefined {
  if (!text.endsWith("n")) return parseSourceNumericLiteral(text)?.integer;
  const digits = text.slice(0, -1).replace(/_/gu, "");
  return /^(?:0|[1-9]\d*|0[xX][0-9a-fA-F]+|0[oO][0-7]+|0[bB][01]+)$/u.test(digits) ? BigInt(digits) : undefined;
}
