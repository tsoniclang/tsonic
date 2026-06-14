// Go: package cmp
//
// cmp.Ordered is the set of ordered types (integers, floats, strings).
// Compare returns:
//   -1 if x is less than y,
//    0 if x equals y,
//   +1 if x is greater than y.
// For floating-point types, a NaN is considered less than any non-NaN,
// a NaN is considered equal to a NaN, and -0.0 is equal to 0.0.
function isNaNValue(v) {
    return typeof v === "number" && globalThis.Number.isNaN(v);
}
// Compare returns
//
//	-1 if x is less than y,
//	 0 if x equals y,
//	+1 if x is greater than y.
export function Compare(x, y) {
    const xNaN = isNaNValue(x);
    const yNaN = isNaNValue(y);
    if (xNaN) {
        return yNaN ? 0 : -1;
    }
    if (yNaN) {
        return 1;
    }
    if (x < y) {
        return -1;
    }
    if (x > y) {
        return 1;
    }
    return 0;
}
//# sourceMappingURL=cmp.js.map