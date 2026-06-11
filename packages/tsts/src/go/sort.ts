import type { bool, int } from "@tsonic/core/types.js";
import type { GoSlice } from "./compat.js";

// Go: package sort
//
// Only the symbols typescript-go uses are implemented: Search and Strings.

// Search uses binary search to find and return the smallest index i in [0, n)
// at which f(i) is true, assuming that on the range [0, n), f(i) == true
// implies f(i+1) == true. That is, Search requires that f is false for some
// (possibly empty) prefix of the input range [0, n) and then true for the
// (possibly empty) remainder; Search returns the first true index. If there is
// no such index, Search returns n. (Note that the "not found" return value is
// not -1 as in, for instance, strings.Index.)
export function Search(n: int, f: (i: int) => bool): int {
  // Define f(-1) == false and f(n) == true.
  // Invariant: f(i-1) == false, f(j) == true.
  let i = 0;
  let j = n;
  while (i < j) {
    const h = (i + ((j - i) >> 1)) | 0; // avoid overflow when computing midpoint
    // i <= h < j
    if (!f(h)) {
      i = h + 1; // preserves f(i-1) == false
    } else {
      j = h; // preserves f(j) == true
    }
  }
  // i == j, f(i-1) == false, and f(j) (= f(i)) == true => answer is i.
  return i;
}

// goCompareStrings compares two strings the way Go compares strings: by the
// lexicographic ordering of their raw UTF-8 bytes. This differs from JS `<`,
// which orders by UTF-16 code units, for characters outside the BMP. We encode
// to UTF-8 to remain faithful to Go's `<` on string.
function goCompareStrings(a: string, b: string): int {
  if (a === b) {
    return 0;
  }
  const ua = goUtf8Bytes(a);
  const ub = goUtf8Bytes(b);
  const n = ua.length < ub.length ? ua.length : ub.length;
  for (let k = 0; k < n; k++) {
    const ca = ua[k]!;
    const cb = ub[k]!;
    if (ca !== cb) {
      return ca < cb ? -1 : 1;
    }
  }
  if (ua.length === ub.length) {
    return 0;
  }
  return ua.length < ub.length ? -1 : 1;
}

function goUtf8Bytes(s: string): Uint8Array {
  return new globalThis.TextEncoder().encode(s);
}

// Strings sorts a slice of strings in increasing order, in place, using Go's
// string ordering (byte-wise lexicographic).
export function Strings(x: GoSlice<string>): void {
  x.sort(goCompareStrings);
}
