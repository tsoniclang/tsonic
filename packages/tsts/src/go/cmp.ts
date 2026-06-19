import type { int, bool } from "./scalars.js";
import type { GoOrdered } from "./compat.js";

// Go: package cmp
//
// cmp.Ordered is the set of ordered types (integers, floats, strings).
// Compare returns:
//   -1 if x is less than y,
//    0 if x equals y,
//   +1 if x is greater than y.
// For floating-point types, a NaN is considered less than any non-NaN,
// a NaN is considered equal to a NaN, and -0.0 is equal to 0.0.

function isNaNValue(v: GoOrdered): bool {
  return typeof v === "number" && globalThis.Number.isNaN(v);
}

// Compare returns
//
//	-1 if x is less than y,
//	 0 if x equals y,
//	+1 if x is greater than y.
export function Compare(x: GoOrdered, y: GoOrdered): int {
  const xNaN = isNaNValue(x);
  const yNaN = isNaNValue(y);
  if (xNaN) {
    return yNaN ? 0 : -1;
  }
  if (yNaN) {
    return 1;
  }
  if ((x as never) < (y as never)) {
    return -1;
  }
  if ((x as never) > (y as never)) {
    return 1;
  }
  return 0;
}
