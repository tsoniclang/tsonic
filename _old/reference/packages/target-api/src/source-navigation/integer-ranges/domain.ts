import type { SourceIntegerRange } from "../../public/source/contracts.js";
import type { SourceLiteralUnit } from "../../source-model/literals/domain.js";
import { compareSourceNumericLiteralMagnitude } from "../../source-model/literals/token.js";

export type SourceIntegerArithmetic = "integer" | "float64";

const proofMagnitude = (1n << 4096n) - 1n;
const float64ExactMagnitude = 9007199254740991n;

export function integerRange(minimum: bigint, maximum = minimum): SourceIntegerRange | undefined {
  return minimum <= maximum && minimum >= -proofMagnitude && maximum <= proofMagnitude
    ? Object.freeze({ minimum, maximum }) : undefined;
}

export function sourceIntegerScalar(unit: SourceLiteralUnit): bigint | undefined {
  if (unit.kind === "bigint") return integerRange(unit.value)?.minimum;
  if (unit.kind !== "number") return undefined;
  const numeric = unit.value;
  if (numeric.kind === "integer") return integerRange(numeric.value)?.minimum;
  if (numeric.kind === "checked-float64") {
    return Number.isSafeInteger(numeric.value) && !Object.is(numeric.value, -0) ? BigInt(numeric.value) : undefined;
  }
  const token = numeric.token;
  if (token.coefficient === 0n) return token.negative ? undefined : 0n;
  if (token.coefficient > proofMagnitude) return undefined;
  if (compareSourceNumericLiteralMagnitude(token, proofMagnitude) > 0) return undefined;
  let magnitude: bigint;
  if (token.exponent >= 0n) magnitude = token.coefficient * 10n ** token.exponent;
  else {
    const scale = -token.exponent;
    if (scale > BigInt(token.coefficient.toString().length)) return undefined;
    const divisor = 10n ** scale;
    if (token.coefficient % divisor !== 0n) return undefined;
    magnitude = token.coefficient / divisor;
  }
  return token.negative ? -magnitude : magnitude;
}

export function exactIntegerRange(range: SourceIntegerRange, arithmetic: SourceIntegerArithmetic): SourceIntegerRange | undefined {
  return arithmetic === "integer" || range.minimum >= -float64ExactMagnitude && range.maximum <= float64ExactMagnitude
    ? range : undefined;
}

export function joinIntegerRanges(
  left: SourceIntegerRange | undefined,
  right: SourceIntegerRange | undefined,
): SourceIntegerRange | undefined {
  return left === undefined || right === undefined ? undefined
    : integerRange(left.minimum < right.minimum ? left.minimum : right.minimum,
      left.maximum > right.maximum ? left.maximum : right.maximum);
}

export function binaryIntegerRange(
  operator: string,
  left: SourceIntegerRange,
  right: SourceIntegerRange,
  arithmetic: SourceIntegerArithmetic,
): SourceIntegerRange | undefined {
  if (exactIntegerRange(left, arithmetic) === undefined || exactIntegerRange(right, arithmetic) === undefined) return undefined;
  const leftMinimum = left.minimum;
  const leftMaximum = left.maximum;
  const rightMinimum = right.minimum;
  const rightMaximum = right.maximum;
  let endpoints: readonly bigint[];
  switch (operator) {
    case "KindPlusToken":
      endpoints = [leftMinimum + rightMinimum, leftMaximum + rightMaximum];
      break;
    case "KindMinusToken":
      endpoints = [leftMinimum - rightMaximum, leftMaximum - rightMinimum];
      break;
    case "KindAsteriskToken":
      if (arithmetic === "float64" && ((left.minimum < 0n && right.minimum <= 0n && right.maximum >= 0n) ||
        (right.minimum < 0n && left.minimum <= 0n && left.maximum >= 0n))) return undefined;
      endpoints = [leftMinimum * rightMinimum, leftMinimum * rightMaximum,
        leftMaximum * rightMinimum, leftMaximum * rightMaximum];
      break;
    case "KindPercentToken":
      return left.minimum >= 0n && right.minimum > 0n
        ? integerRange(0n, left.maximum < right.maximum ? left.maximum : right.maximum - 1n) : undefined;
    default:
      return undefined;
  }
  let minimum = endpoints[0]!;
  let maximum = minimum;
  for (const endpoint of endpoints) {
    if (endpoint < minimum) minimum = endpoint;
    if (endpoint > maximum) maximum = endpoint;
  }
  const result = integerRange(minimum, maximum);
  return result === undefined ? undefined : exactIntegerRange(result, arithmetic);
}

export function integerSquareRoot(value: bigint): bigint {
  if (value < 0n) throw new Error("An integer square-root bound must be nonnegative.");
  if (value < 2n) return value;
  let upper = value;
  let next = (value + 1n) / 2n;
  while (next < upper) {
    upper = next;
    next = (upper + value / upper) / 2n;
  }
  return upper;
}
