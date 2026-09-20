import assert from "node:assert/strict";
import test from "node:test";
import { binaryIntegerRange, integerRange, joinIntegerRanges } from "./domain.js";

test("integer ranges exclude nonfinite, fractional, unsafe and negative-zero evidence", () => {
  for (const value of [NaN, Infinity, -Infinity, -0, 0.5, 9007199254740992]) assert.equal(integerRange(value), undefined);
  assert.equal(integerRange(4, 3), undefined);
  assert.deepEqual(integerRange(0, 2147483647), { minimum: 0, maximum: 2147483647 });
  assert.equal(Object.isFrozen(integerRange(0)), true);
});

test("range arithmetic checks exact intermediate endpoints rather than rounded JavaScript arithmetic", () => {
  const maximum = integerRange(Number.MAX_SAFE_INTEGER)!;
  assert.equal(binaryIntegerRange("KindPlusToken", maximum, integerRange(1)!), undefined);
  assert.equal(binaryIntegerRange("KindAsteriskToken", maximum, integerRange(2)!), undefined);
  assert.equal(binaryIntegerRange("KindAsteriskToken", integerRange(-3)!, integerRange(0)!), undefined);
  assert.equal(binaryIntegerRange("KindPercentToken", integerRange(-6)!, integerRange(3)!), undefined);
  assert.equal(binaryIntegerRange("KindPercentToken", integerRange(6)!, integerRange(0)!), undefined);
  assert.equal(binaryIntegerRange("KindSlashToken", integerRange(6)!, integerRange(3)!), undefined);
  assert.deepEqual(binaryIntegerRange("KindAsteriskToken", integerRange(2, 4)!, integerRange(3, 7)!), integerRange(6, 28));
  assert.deepEqual(binaryIntegerRange("KindPercentToken", integerRange(0, 20)!, integerRange(3, 7)!), integerRange(0, 6));
  assert.equal(joinIntegerRanges(integerRange(1), undefined), undefined);
  assert.deepEqual(joinIntegerRanges(integerRange(1), integerRange(3)), integerRange(1, 3));
});
