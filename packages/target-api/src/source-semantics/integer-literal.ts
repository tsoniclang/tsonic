import type { AstReader, Node } from "@tsonic/tsts";

export function sourceIntegerLiteralValue(ast: AstReader, node: Node): bigint | undefined {
  const kind = ast.kindName(node);
  if (kind === "KindParenthesizedExpression") {
    const inner = ast.as.AsParenthesizedExpression(node)?.Expression;
    return inner === undefined ? undefined : sourceIntegerLiteralValue(ast, inner);
  }
  if (kind === "KindPrefixUnaryExpression") {
    const operand = ast.as.AsPrefixUnaryExpression(node)?.Operand;
    const operator = ast.operatorKindName(node);
    if (operand === undefined || (operator !== "KindPlusToken" && operator !== "KindMinusToken")) return undefined;
    const value = sourceIntegerLiteralValue(ast, operand);
    return value === undefined ? undefined : operator === "KindMinusToken" ? -value : value;
  }
  if (kind !== "KindNumericLiteral" && kind !== "KindBigIntLiteral") return undefined;
  const range = ast.authoredRange(node);
  if (range.kind === "authored") {
    const file = ast.getSourceFile(node);
    if (file === undefined) return undefined;
    const source = ast.getSourceText(file);
    if (range.start < 0 || range.end > source.length || range.start >= range.end) return undefined;
    return parseNativeIntegerLiteral(source.slice(range.start, range.end));
  }
  const text = ast.text(node);
  if (kind === "KindNumericLiteral" && !Number.isSafeInteger(Number(text))) return undefined;
  return parseNativeIntegerLiteral(text);
}

export function parseNativeIntegerLiteral(text: string): bigint | undefined {
  const normalized = text.replaceAll("_", "").replace(/n$/u, "");
  const radix = /^0(?:[xX]([0-9a-fA-F]+)|[oO]([0-7]+)|[bB]([01]+))$/u.exec(normalized);
  if (radix !== null) {
    const digits = (radix[1] ?? radix[2] ?? radix[3]!).replace(/^0+/u, "");
    const bitsPerDigit = radix[1] !== undefined ? 4 : radix[2] !== undefined ? 3 : 1;
    if (digits.length * bitsPerDigit > 132) return undefined;
    return digits.length === 0 ? 0n : BigInt(normalized.slice(0, 2) + digits);
  }
  const decimal = /^(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/u.exec(normalized);
  if (decimal === null) return undefined;
  const fraction = decimal[2] ?? "";
  const digits = (decimal[1]! + fraction).replace(/^0+/u, "");
  if (digits.length === 0) return 0n;
  const exponent = Number(decimal[3] ?? "0") - fraction.length;
  if (!Number.isInteger(exponent)) return undefined;
  const size = digits.length + exponent;
  if (size < 1 || size > 40) return undefined;
  if (exponent < 0 && /[1-9]/u.test(digits.slice(size))) return undefined;
  return BigInt(exponent < 0 ? digits.slice(0, size) : digits + "0".repeat(exponent));
}
