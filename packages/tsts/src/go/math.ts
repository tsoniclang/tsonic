import type { int, double, ulong } from "@tsonic/core/types.js";

// Go: package math
//
// Faithful port of Go's math package surface used by typescript-go.
// Go float64 -> double (number), Go int -> int (number).
// Bit-level helpers (Float64bits / Float64frombits) operate on the IEEE-754
// representation; Go returns uint64 which we model as ulong (number-typed).

// Mathematical constants (Go: math.E, math.Pi).
export const E: double = 2.71828182845904523536028747135266249775724709369995957496696763 as double;
export const Pi: double = 3.14159265358979323846264338327950288419716939937510582097494459 as double;

// Floating-point limit values (Go: math.MaxFloat64, math.SmallestNonzeroFloat64).
export const MaxFloat64: double = 1.7976931348623157e308 as double;
export const SmallestNonzeroFloat64: double = 5e-324 as double;

// Integer limit values.
// Go's int is platform-sized (64-bit on the targets we care about); MaxInt/MinInt
// therefore match the int64 limits. These exceed JS safe-integer range, but Go uses
// them as sentinels (e.g. math.MaxInt as "unlimited depth"), and comparisons against
// realistic values still behave correctly.
export const MaxInt: int = 9223372036854775807 as int;
export const MinInt: int = -9223372036854775808 as int;
export const MaxInt32: int = 2147483647 as int;
export const MinInt32: int = -2147483648 as int;
export const MaxInt64: int = 9223372036854775807 as int;
export const MinInt64: int = -9223372036854775808 as int;

// Abs returns the absolute value of x.
//
//	Abs(±Inf) = +Inf
//	Abs(NaN) = NaN
export function Abs(x: double): double {
  return globalThis.Math.abs(x) as double;
}

// Ceil returns the least integer value greater than or equal to x.
//
//	Ceil(±0) = ±0
//	Ceil(±Inf) = ±Inf
//	Ceil(NaN) = NaN
export function Ceil(x: double): double {
  return globalThis.Math.ceil(x) as double;
}

// Floor returns the greatest integer value less than or equal to x.
//
//	Floor(±0) = ±0
//	Floor(±Inf) = ±Inf
//	Floor(NaN) = NaN
export function Floor(x: double): double {
  return globalThis.Math.floor(x) as double;
}

// Trunc returns the integer value of x.
//
//	Trunc(±0) = ±0
//	Trunc(±Inf) = ±Inf
//	Trunc(NaN) = NaN
export function Trunc(x: double): double {
  return globalThis.Math.trunc(x) as double;
}

// Copysign returns a value with the magnitude of f and the sign of sign.
export function Copysign(f: double, sign: double): double {
  const mag = globalThis.Math.abs(f);
  // Signbit of sign: negative numbers and negative zero are "negative".
  const negative = sign < 0 || globalThis.Object.is(sign, -0);
  return (negative ? -mag : mag) as double;
}

// Inf returns positive infinity if sign >= 0, negative infinity if sign < 0.
export function Inf(sign: int): double {
  return (sign >= 0
    ? globalThis.Number.POSITIVE_INFINITY
    : globalThis.Number.NEGATIVE_INFINITY) as double;
}

// NaN returns an IEEE 754 "not-a-number" value.
export function NaN(): double {
  return globalThis.Number.NaN as double;
}

// IsNaN reports whether f is an IEEE 754 "not-a-number" value.
export function IsNaN(f: double): boolean {
  return globalThis.Number.isNaN(f);
}

// IsInf reports whether f is an infinity, according to sign.
// If sign > 0, IsInf reports whether f is positive infinity.
// If sign < 0, IsInf reports whether f is negative infinity.
// If sign == 0, IsInf reports whether f is either infinity.
export function IsInf(f: double, sign: int): boolean {
  if (sign > 0) {
    return f === globalThis.Number.POSITIVE_INFINITY;
  }
  if (sign < 0) {
    return f === globalThis.Number.NEGATIVE_INFINITY;
  }
  return f === globalThis.Number.POSITIVE_INFINITY || f === globalThis.Number.NEGATIVE_INFINITY;
}

// Log2 returns the binary logarithm of x.
//
//	Log2(0) = -Inf
//	Log2(x < 0) = NaN
//	Log2(NaN) = NaN
export function Log2(x: double): double {
  return globalThis.Math.log2(x) as double;
}

// Pow returns x**y, the base-x exponential of y.
export function Pow(x: double, y: double): double {
  return globalThis.Math.pow(x, y) as double;
}

// Mod returns the floating-point remainder of x/y.
// The magnitude of the result is less than y's and its sign agrees with x's.
// (Equivalent to the JS `%` operator on doubles.)
//
//	Mod(±Inf, y) = NaN
//	Mod(NaN, y) = NaN
//	Mod(x, 0) = NaN
//	Mod(x, ±Inf) = x
//	Mod(x, NaN) = NaN
export function Mod(x: double, y: double): double {
  if (
    globalThis.Number.isNaN(x) ||
    globalThis.Number.isNaN(y) ||
    x === globalThis.Number.POSITIVE_INFINITY ||
    x === globalThis.Number.NEGATIVE_INFINITY ||
    y === 0
  ) {
    return globalThis.Number.NaN as double;
  }
  if (y === globalThis.Number.POSITIVE_INFINITY || y === globalThis.Number.NEGATIVE_INFINITY) {
    return x;
  }
  return (x % y) as double;
}

// Min returns the smaller of x or y.
//
//	Min(x, -Inf) = Min(-Inf, x) = -Inf
//	Min(x, NaN) = Min(NaN, x) = NaN
//	Min(-0.0, 0.0) = Min(0.0, -0.0) = -0.0
//
// Note: this is Go's math.Min (NaN-propagating, -0.0 < +0.0), which differs
// from the builtin min(); typescript-go uses it for distance calculations.
export function Min(x: double, y: double): double {
  if (globalThis.Number.isNaN(x) || globalThis.Number.isNaN(y)) {
    return globalThis.Number.NaN as double;
  }
  if (x < y) {
    return x;
  }
  if (y < x) {
    return y;
  }
  // Equal (including 0.0 == -0.0): prefer the negative zero.
  if (x === 0 && y === 0) {
    return (globalThis.Object.is(x, -0) || globalThis.Object.is(y, -0) ? -0 : 0) as double;
  }
  return x;
}

// Shared 8-byte buffer for IEEE-754 bit reinterpretation. A BigUint64Array view
// extracts the full 64-bit pattern exactly (as a bigint) before it is narrowed to
// the ulong (number) boundary.
const float64Buffer = new globalThis.ArrayBuffer(8);
const float64View = new globalThis.Float64Array(float64Buffer);
const bigUint64View = new globalThis.BigUint64Array(float64Buffer);

// Float64bits returns the IEEE 754 binary representation of f, with the sign bit of
// f and the result in the same bit position (Go returns uint64). The 64-bit pattern
// is computed exactly via BigInt; the ulong return type maps to number, so the low
// mantissa bits of patterns above 2^53 are rounded at the boundary (the inherent
// limit of representing uint64 as a JS number). The high-order exponent/sign bits
// that callers test (e.g. jsnum.isNonFinite's exponent mask) are preserved.
export function Float64bits(f: double): ulong {
  float64View[0] = f;
  return globalThis.Number(bigUint64View[0]) as ulong;
}

// Float64frombits returns the floating-point number corresponding to the IEEE 754
// binary representation b, with the sign bit of b and the result in the same bit
// position.
export function Float64frombits(b: ulong): double {
  bigUint64View[0] = globalThis.BigInt(b as number);
  return float64View[0] as double;
}
