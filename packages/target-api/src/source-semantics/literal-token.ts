import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceNumericLiteralToken } from "./literal-values-model.js";

export function sourceLiteralToken(ast: AstReader, node: Node):
  { readonly kind: "authored"; readonly text: string } | { readonly kind: "synthetic" } {
  const range = ast.authoredRange(node);
  if (range.kind === "synthetic") return Object.freeze({ kind: "synthetic" });
  const file = ast.getSourceFile(node);
  if (file === undefined) throw new Error("Authored literal requires a source file.");
  const source = ast.getSourceText(file);
  if (range.start < 0 || range.end > source.length || range.start >= range.end) {
    throw new Error("Authored literal range must identify its exact source token.");
  }
  return Object.freeze({ kind: "authored", text: source.slice(range.start, range.end) });
}

interface ParsedSourceNumericLiteral {
  readonly token: SourceNumericLiteralToken;
  readonly integer: bigint | undefined;
}

export function parseSourceNumericLiteral(text: string): ParsedSourceNumericLiteral | undefined {
  const normalized = text.replace(/_/gu, "");
  const radix = /^0(?:[xX][0-9a-fA-F]+|[oO][0-7]+|[bB][01]+)$/u.test(normalized);
  if (radix) {
    const coefficient = BigInt(normalized);
    const prefix = normalized.slice(0, 2).toLowerCase();
    const bitsPerDigit = prefix === "0x" ? 4 : prefix === "0o" ? 3 : 1;
    const integer = normalized.slice(2).replace(/^0+/u, "").length * bitsPerDigit <= 132 ? coefficient : undefined;
    return Object.freeze({ token: Object.freeze({ coefficient, exponent: 0n, negative: false, decimalText: coefficient.toString() }), integer });
  }
  const decimal = /^(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/u.exec(normalized);
  if (decimal === null) return undefined;
  const fraction = decimal[2] ?? decimal[3] ?? "";
  const digits = ((decimal[1] ?? "0") + fraction).replace(/^0+/u, "");
  const sourceExponent = BigInt(decimal[4] ?? "0");
  const whole = (decimal[1] ?? "0").replace(/^0+(?=\d)/u, "");
  const mantissa = decimal[2] === undefined && decimal[3] === undefined ? whole : `${whole}.${fraction}`;
  const suffix = decimal[4] === undefined ? "" : `e${sourceExponent < 0n ? "" : "+"}${sourceExponent}`;
  const decimalText = mantissa + suffix;
  if (digits.length === 0) {
    return Object.freeze({ token: Object.freeze({ coefficient: 0n, exponent: 0n, negative: false, decimalText }), integer: 0n });
  }
  const significant = digits.replace(/0+$/u, "");
  const exponent = sourceExponent - BigInt(fraction.length) + BigInt(digits.length - significant.length);
  const coefficient = BigInt(significant);
  const integer = exponent >= 0n && BigInt(significant.length) + exponent <= 40n ? coefficient * 10n ** exponent : undefined;
  return Object.freeze({ token: Object.freeze({ coefficient, exponent, negative: false, decimalText }), integer });
}

export function compareSourceNumericLiteralMagnitude(
  token: Pick<SourceNumericLiteralToken, "coefficient" | "exponent">,
  limit: bigint,
): -1 | 0 | 1 {
  if (limit < 0n) throw new Error("Numeric literal magnitude comparison requires a nonnegative limit.");
  if (token.coefficient === 0n) return limit === 0n ? 0 : -1;
  if (limit === 0n) return 1;
  const digits = token.coefficient.toString();
  const limitDigits = limit.toString();
  const size = BigInt(digits.length) + token.exponent;
  if (size < BigInt(limitDigits.length)) return -1;
  if (size > BigInt(limitDigits.length)) return 1;
  const left = token.exponent < 0n ? digits : digits.padEnd(limitDigits.length, "0");
  const right = token.exponent < 0n ? limitDigits.padEnd(digits.length, "0") : limitDigits;
  return left < right ? -1 : left > right ? 1 : 0;
}

export function sourceNumericLiteralIsExactlyRepresentableAsBinaryFloat(
  token: SourceNumericLiteralToken,
  target: "float32" | "float64",
): boolean {
  if (token.coefficient < 0n) return false;
  if (token.coefficient === 0n) return true;
  const precision = target === "float32" ? 24n : 53n;
  const highestExponent = target === "float32" ? 127n : 1023n;
  const lowestExponent = target === "float32" ? -149n : -1074n;
  const maximum = ((1n << precision) - 1n) << (highestExponent - precision + 1n);
  if (compareSourceNumericLiteralMagnitude(token, maximum) > 0) return false;
  let coefficient = token.coefficient;
  let exponent = token.exponent;
  if (exponent < 0n) {
    const denominatorExponent = -exponent;
    if (denominatorExponent > BigInt(coefficient.toString(2).length)) return false;
    const denominator = 5n ** denominatorExponent;
    if (coefficient % denominator !== 0n) return false;
    coefficient /= denominator;
  } else {
    coefficient *= 5n ** exponent;
  }
  while ((coefficient & 1n) === 0n) {
    coefficient >>= 1n;
    exponent++;
  }
  const bits = BigInt(coefficient.toString(2).length);
  return bits <= precision && exponent >= lowestExponent && exponent + bits - 1n <= highestExponent;
}
