import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Abs,
  Ceil,
  Floor,
  Trunc,
  Copysign,
  Inf,
  NaN,
  IsNaN,
  IsInf,
  Log2,
  Pow,
  Mod,
  Min,
  Float64bits,
  Float64frombits,
  E,
  Pi,
  MaxFloat64,
  SmallestNonzeroFloat64,
  MaxInt32,
  MinInt32,
  MaxInt64,
} from "./math.js";

test("math constants", () => {
  assert.ok(globalThis.Math.abs(E - globalThis.Math.E) < 1e-15);
  assert.ok(globalThis.Math.abs(Pi - globalThis.Math.PI) < 1e-15);
  assert.equal(MaxFloat64, globalThis.Number.MAX_VALUE);
  assert.equal(SmallestNonzeroFloat64, globalThis.Number.MIN_VALUE);
  assert.equal(MaxInt32, 2147483647);
  assert.equal(MinInt32, -2147483648);
  assert.equal(MaxInt64, 9223372036854775807);
});

test("math.Abs", () => {
  assert.equal(Abs(-3.5), 3.5);
  assert.equal(Abs(3.5), 3.5);
  assert.equal(Abs(0), 0);
  assert.equal(Abs(Inf(-1)), globalThis.Number.POSITIVE_INFINITY);
  assert.ok(IsNaN(Abs(NaN())));
});

test("math.Ceil/Floor/Trunc", () => {
  assert.equal(Ceil(1.1), 2);
  assert.equal(Ceil(-1.1), -1);
  assert.equal(Floor(1.9), 1);
  assert.equal(Floor(-1.1), -2);
  assert.equal(Trunc(1.9), 1);
  assert.equal(Trunc(-1.9), -1);
});

test("math.Copysign", () => {
  assert.equal(Copysign(3, -1), -3);
  assert.equal(Copysign(-3, 1), 3);
  assert.equal(Copysign(3, 1), 3);
  // sign of -0 produces a negative magnitude.
  assert.ok(globalThis.Object.is(Copysign(0, -0), -0));
});

test("math.Inf/IsInf", () => {
  assert.equal(Inf(1), globalThis.Number.POSITIVE_INFINITY);
  assert.equal(Inf(0), globalThis.Number.POSITIVE_INFINITY);
  assert.equal(Inf(-1), globalThis.Number.NEGATIVE_INFINITY);
  assert.equal(IsInf(Inf(1), 1), true);
  assert.equal(IsInf(Inf(1), -1), false);
  assert.equal(IsInf(Inf(-1), -1), true);
  assert.equal(IsInf(Inf(1), 0), true);
  assert.equal(IsInf(Inf(-1), 0), true);
  assert.equal(IsInf(1.0, 0), false);
});

test("math.NaN/IsNaN", () => {
  assert.ok(IsNaN(NaN()));
  assert.equal(IsNaN(1.0), false);
  assert.equal(IsNaN(Inf(1)), false);
});

test("math.Log2/Pow", () => {
  assert.equal(Log2(8), 3);
  assert.equal(Log2(1), 0);
  assert.equal(Pow(2, 10), 1024);
  assert.equal(Pow(2, 0), 1);
  assert.equal(Pow(9, 0.5), 3);
});

test("math.Mod", () => {
  assert.equal(Mod(5, 3), 2);
  assert.equal(Mod(-5, 3), -2);
  assert.equal(Mod(5, -3), 2);
  assert.ok(IsNaN(Mod(5, 0)));
  assert.ok(IsNaN(Mod(Inf(1), 3)));
  assert.equal(Mod(5, Inf(1)), 5);
});

test("math.Min (Go semantics: NaN-propagating, -0 < +0)", () => {
  assert.equal(Min(1, 2), 1);
  assert.equal(Min(2, 1), 1);
  assert.equal(Min(-3, Inf(-1)), globalThis.Number.NEGATIVE_INFINITY);
  assert.ok(IsNaN(Min(1, NaN())));
  assert.ok(IsNaN(Min(NaN(), 1)));
  assert.ok(globalThis.Object.is(Min(-0, 0), -0));
  assert.ok(globalThis.Object.is(Min(0, -0), -0));
});

test("math.Float64bits known IEEE-754 patterns", () => {
  // Bit patterns whose high bits matter and whose value is exactly representable.
  assert.equal(Float64bits(1.0), 0x3ff0000000000000);
  assert.equal(Float64bits(0), 0);
  assert.equal(Float64bits(2.0), 0x4000000000000000);
  // +Inf is all exponent bits set, zero mantissa.
  assert.equal(Float64bits(Inf(1)), 0x7ff0000000000000);
});

test("math.Float64frombits reconstructs values from exact patterns", () => {
  assert.equal(Float64frombits(0x3ff0000000000000), 1.0);
  assert.equal(Float64frombits(0x4000000000000000), 2.0);
  assert.equal(Float64frombits(0), 0);
  assert.equal(Float64frombits(0x7ff0000000000000), globalThis.Number.POSITIVE_INFINITY);
});

test("math.Float64bits supports jsnum.isNonFinite exponent-mask test", () => {
  // jsnum.isNonFinite checks: Float64bits(x) & 0x7FF0000000000000 == mask.
  // The mask isolates the high exponent bits, which survive the number boundary.
  const mask = 0x7ff0000000000000;
  // Inf and NaN have all exponent bits set; finite numbers do not.
  assert.equal(globalThis.Number(globalThis.BigInt(Float64bits(Inf(1))) & globalThis.BigInt(mask)), mask);
  assert.equal(globalThis.Number(globalThis.BigInt(Float64bits(Inf(-1))) & globalThis.BigInt(mask)), mask);
  assert.equal(globalThis.Number(globalThis.BigInt(Float64bits(NaN())) & globalThis.BigInt(mask)), mask);
  assert.notEqual(globalThis.Number(globalThis.BigInt(Float64bits(1.5)) & globalThis.BigInt(mask)), mask);
});
