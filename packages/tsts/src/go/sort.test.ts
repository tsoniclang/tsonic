import test from "node:test";
import assert from "node:assert/strict";
import { Search, Strings } from "./sort.js";

test("sort.Search finds the smallest index where f is true", () => {
  const data = [1, 3, 5, 7, 9, 11];
  // smallest i with data[i] >= 6
  const i = Search(data.length, (k) => data[k]! >= 6);
  assert.equal(i, 3);
  assert.equal(data[i], 7);
});

test("sort.Search returns n when f is never true", () => {
  const data = [1, 2, 3];
  const i = Search(data.length, (k) => data[k]! >= 100);
  assert.equal(i, 3);
});

test("sort.Search returns 0 when f is always true", () => {
  const data = [10, 20, 30];
  const i = Search(data.length, (k) => data[k]! >= 0);
  assert.equal(i, 0);
});

test("sort.Search on empty range returns 0", () => {
  assert.equal(
    Search(0, () => true),
    0,
  );
});

test("sort.Strings sorts in place ascending", () => {
  const x = ["banana", "apple", "cherry", "apple"];
  Strings(x);
  assert.deepEqual(x, ["apple", "apple", "banana", "cherry"]);
});

test("sort.Strings uses byte-wise ordering (uppercase before lowercase)", () => {
  const x = ["b", "A", "a", "B"];
  Strings(x);
  assert.deepEqual(x, ["A", "B", "a", "b"]);
});
