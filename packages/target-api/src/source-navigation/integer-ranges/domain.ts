export interface SourceIntegerRange {
  readonly minimum: number;
  readonly maximum: number;
}

export function integerRange(minimum: number, maximum = minimum): SourceIntegerRange | undefined {
  return Number.isSafeInteger(minimum) && Number.isSafeInteger(maximum) &&
      !Object.is(minimum, -0) && !Object.is(maximum, -0) && minimum <= maximum
    ? Object.freeze({ minimum, maximum })
    : undefined;
}

export function joinIntegerRanges(
  left: SourceIntegerRange | undefined,
  right: SourceIntegerRange | undefined,
): SourceIntegerRange | undefined {
  return left === undefined || right === undefined ? undefined
    : integerRange(Math.min(left.minimum, right.minimum), Math.max(left.maximum, right.maximum));
}

export function binaryIntegerRange(
  operator: string,
  left: SourceIntegerRange,
  right: SourceIntegerRange,
): SourceIntegerRange | undefined {
  const leftMinimum = BigInt(left.minimum);
  const leftMaximum = BigInt(left.maximum);
  const rightMinimum = BigInt(right.minimum);
  const rightMaximum = BigInt(right.maximum);
  let endpoints: readonly bigint[];
  switch (operator) {
    case "KindPlusToken":
      endpoints = [leftMinimum + rightMinimum, leftMaximum + rightMaximum];
      break;
    case "KindMinusToken":
      endpoints = [leftMinimum - rightMaximum, leftMaximum - rightMinimum];
      break;
    case "KindAsteriskToken":
      if ((left.minimum < 0 && right.minimum <= 0 && right.maximum >= 0) ||
        (right.minimum < 0 && left.minimum <= 0 && left.maximum >= 0)) return undefined;
      endpoints = [leftMinimum * rightMinimum, leftMinimum * rightMaximum,
        leftMaximum * rightMinimum, leftMaximum * rightMaximum];
      break;
    case "KindPercentToken":
      return left.minimum >= 0 && right.minimum > 0
        ? integerRange(0, Math.min(left.maximum, right.maximum - 1)) : undefined;
    default:
      return undefined;
  }
  const limit = BigInt(Number.MAX_SAFE_INTEGER);
  if (endpoints.some(value => value < -limit || value > limit)) return undefined;
  return integerRange(Math.min(...endpoints.map(Number)), Math.max(...endpoints.map(Number)));
}
