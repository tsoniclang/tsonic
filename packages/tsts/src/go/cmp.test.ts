import test from "node:test";
import assert from "node:assert/strict";
import { Compare } from "./cmp.js";

test("cmp.Compare orders integers", () => {
  assert.equal(Compare(1, 2), -1);
  assert.equal(Compare(2, 2), 0);
  assert.equal(Compare(3, 2), 1);
});

test("cmp.Compare orders strings lexicographically", () => {
  assert.equal(Compare("a", "b"), -1);
  assert.equal(Compare("b", "b"), 0);
  assert.equal(Compare("c", "b"), 1);
  assert.equal(Compare("abc", "abd"), -1);
});

test("cmp.Compare treats NaN as less than any non-NaN and equal to NaN", () => {
  const nan = globalThis.Number.NaN;
  assert.equal(Compare(nan, 1), -1);
  assert.equal(Compare(1, nan), 1);
  assert.equal(Compare(nan, nan), 0);
});

test("cmp.Compare treats -0 and 0 as equal", () => {
  assert.equal(Compare(-0, 0), 0);
  assert.equal(Compare(0, -0), 0);
});
