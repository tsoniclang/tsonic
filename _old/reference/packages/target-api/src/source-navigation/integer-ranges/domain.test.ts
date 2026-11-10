import assert from "node:assert/strict";
import test from "node:test";
import { binaryIntegerRange, integerRange, integerSquareRoot, joinIntegerRanges, sourceIntegerScalar } from "./domain.js";

test("integer ranges exclude nonfinite, fractional, unsafe and negative-zero evidence", () => {
  for (const value of [NaN, Infinity, -Infinity, -0, 0.5, 9007199254740992]) {
    assert.equal(sourceIntegerScalar({ kind: "number", value: { kind: "checked-float64", value } }), undefined);
  }
  assert.equal(integerRange(4n, 3n), undefined);
  assert.deepEqual(integerRange(0n, 2147483647n), { minimum: 0n, maximum: 2147483647n });
  assert.equal(Object.isFrozen(integerRange(0n)), true);
});

test("range arithmetic checks exact intermediate endpoints rather than rounded JavaScript arithmetic", () => {
  const maximum = integerRange(9007199254740991n)!;
  assert.equal(binaryIntegerRange("KindPlusToken", maximum, integerRange(1n)!, "float64"), undefined);
  assert.equal(binaryIntegerRange("KindAsteriskToken", maximum, integerRange(2n)!, "float64"), undefined);
  assert.equal(binaryIntegerRange("KindAsteriskToken", integerRange(-3n)!, integerRange(0n)!, "float64"), undefined);
  assert.equal(binaryIntegerRange("KindPercentToken", integerRange(-6n)!, integerRange(3n)!, "float64"), undefined);
  assert.equal(binaryIntegerRange("KindPercentToken", integerRange(6n)!, integerRange(0n)!, "float64"), undefined);
  assert.equal(binaryIntegerRange("KindSlashToken", integerRange(6n)!, integerRange(3n)!, "float64"), undefined);
  assert.deepEqual(binaryIntegerRange("KindAsteriskToken", integerRange(2n, 4n)!, integerRange(3n, 7n)!, "float64"), integerRange(6n, 28n));
  assert.deepEqual(binaryIntegerRange("KindPercentToken", integerRange(0n, 20n)!, integerRange(3n, 7n)!, "float64"), integerRange(0n, 6n));
  assert.equal(joinIntegerRanges(integerRange(1n), undefined), undefined);
  assert.deepEqual(joinIntegerRanges(integerRange(1n), integerRange(3n)), integerRange(1n, 3n));
});

test("native integer proofs retain exact wide constants without a floating precision cap", () => {
  const wide = 9007199254740993n;
  const unit = { kind: "number" as const, value: { kind: "authored" as const,
    token: { coefficient: wide, exponent: 0n, negative: false, decimalText: wide.toString() } } };
  assert.equal(sourceIntegerScalar(unit), wide);
  assert.equal(sourceIntegerScalar({ kind: "bigint", value: (1n << 64n) - 1n }), (1n << 64n) - 1n);
  assert.deepEqual(binaryIntegerRange("KindPlusToken", integerRange(wide)!, integerRange(2n)!, "integer"), integerRange(wide + 2n));
  assert.deepEqual(binaryIntegerRange("KindAsteriskToken", integerRange(-3n)!, integerRange(0n)!, "integer"), integerRange(0n));
  assert.equal(binaryIntegerRange("KindPlusToken", integerRange(wide)!, integerRange(2n)!, "float64"), undefined);
});

test("canonical authored scalar and square-root proofs preserve fractions and signed zero", () => {
  const numeric = (coefficient: bigint, exponent: bigint, negative = false) => ({ kind: "number" as const,
    value: { kind: "authored" as const, token: { coefficient, exponent, negative, decimalText: `${coefficient}e${exponent}` } } });
  assert.equal(sourceIntegerScalar(numeric(5n, -1n)), undefined);
  assert.equal(sourceIntegerScalar(numeric(0n, 0n, true)), undefined);
  assert.equal(sourceIntegerScalar(numeric(1200n, -2n)), 12n);
  assert.equal(sourceIntegerScalar(numeric(1n, 1000000000n)), undefined);
  assert.equal(integerRange(1n << 4096n), undefined);
  for (const value of [0n, 1n, 2n, 99n, 100n, 101n, 2147483647n, (1n << 128n) - 1n]) {
    const root = integerSquareRoot(value);
    assert.equal(root * root <= value && (root + 1n) * (root + 1n) > value, true);
  }
});
