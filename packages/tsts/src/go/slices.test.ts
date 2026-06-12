import test from "node:test";
import assert from "node:assert/strict";
import {
  Index,
  IndexFunc,
  Contains,
  ContainsFunc,
  Equal,
  EqualFunc,
  Compare,
  CompareFunc,
  Clone,
  Concat,
  Repeat,
  Grow,
  Clip,
  Delete,
  DeleteFunc,
  Insert,
  Replace,
  Reverse,
  Compact,
  CompactFunc,
  Sort,
  SortFunc,
  SortStableFunc,
  Sorted,
  SortedFunc,
  IsSorted,
  BinarySearch,
  BinarySearchFunc,
  Values,
  Collect,
  AppendSeq,
} from "./slices.js";
import type { GoSeq } from "./compat.js";

test("slices.Index / Contains", () => {
  const s = ["a", "b", "c"];
  assert.equal(Index(s, "b"), 1);
  assert.equal(Index(s, "z"), -1);
  assert.equal(Contains(s, "c"), true);
  assert.equal(Contains(s, "z"), false);
});

test("slices.IndexFunc / ContainsFunc", () => {
  const s = [1, 2, 3, 4];
  assert.equal(
    IndexFunc(s, (e) => e > 2),
    2,
  );
  assert.equal(
    IndexFunc(s, (e) => e > 100),
    -1,
  );
  assert.equal(
    ContainsFunc(s, (e) => e === 3),
    true,
  );
  assert.equal(
    ContainsFunc(s, (e) => e === 99),
    false,
  );
});

test("slices.Equal / EqualFunc", () => {
  assert.equal(Equal([1, 2, 3], [1, 2, 3]), true);
  assert.equal(Equal([1, 2], [1, 2, 3]), false);
  assert.equal(Equal([], []), true);
  assert.equal(
    EqualFunc([1, 2], ["1", "2"], (a, b) => globalThis.String(a) === b),
    true,
  );
});

test("slices.Compare / CompareFunc", () => {
  assert.equal(Compare([1, 2, 3], [1, 2, 3]), 0);
  assert.equal(Compare([1, 2], [1, 3]), -1);
  assert.equal(Compare([1, 3], [1, 2]), 1);
  assert.equal(Compare([1, 2], [1, 2, 3]), -1);
  assert.equal(Compare([1, 2, 3], [1, 2]), 1);
  assert.equal(
    CompareFunc([1, 2], [1, 2], (a, b) => a - b),
    0,
  );
});

test("slices.Clone is shallow and independent; Clone(undefined) is undefined", () => {
  const s = [1, 2, 3];
  const c = Clone(s)!;
  assert.notEqual(c, s);
  assert.deepEqual(c, [1, 2, 3]);
  c[0] = 99;
  assert.equal(s[0], 1);
  assert.equal(Clone<number>(undefined), undefined);
});

test("slices.Concat / Repeat", () => {
  assert.deepEqual(Concat([1, 2], [3], [4, 5]), [1, 2, 3, 4, 5]);
  assert.deepEqual(Repeat([1, 2], 3), [1, 2, 1, 2, 1, 2]);
  assert.throws(() => Repeat([1], -1), /negative Repeat count/);
});

test("slices.Grow / Clip are identity no-ops", () => {
  const s = [1, 2, 3];
  assert.equal(Grow(s, 5), s);
  assert.equal(Clip(s), s);
  assert.throws(() => Grow(s, -1), /negative/);
});

test("slices.Delete mutates in place and returns the slice", () => {
  const s = [1, 2, 3, 4, 5];
  const r = Delete(s, 1, 3);
  assert.deepEqual(r, [1, 4, 5]);
  assert.equal(r, s);
  assert.throws(() => Delete([1, 2], 0, 5), /invalid range/);
});

test("slices.DeleteFunc removes matching elements", () => {
  const s = [1, 2, 3, 4, 5, 6];
  const r = DeleteFunc(s, (e) => e % 2 === 0);
  assert.deepEqual(r, [1, 3, 5]);
});

test("slices.Insert inserts at index", () => {
  const s = [1, 4, 5];
  const r = Insert(s, 1, 2, 3);
  assert.deepEqual(r, [1, 2, 3, 4, 5]);
  assert.throws(() => Insert([1], 5, 9), /out of range/);
});

test("slices.Replace replaces a range", () => {
  const s = [1, 2, 3, 4];
  const r = Replace(s, 1, 3, 9, 9, 9);
  assert.deepEqual(r, [1, 9, 9, 9, 4]);
});

test("slices.Reverse reverses in place", () => {
  const s = [1, 2, 3];
  Reverse(s);
  assert.deepEqual(s, [3, 2, 1]);
});

test("slices.Compact / CompactFunc collapse consecutive equals", () => {
  assert.deepEqual(Compact([1, 1, 2, 2, 2, 3, 1, 1]), [1, 2, 3, 1]);
  assert.deepEqual(
    CompactFunc([1, 3, 2, 4, 6], (a, b) => a % 2 === b % 2),
    [1, 2],
  );
});

test("slices.Sort sorts ascending in place with NaN first", () => {
  const s = [3, 1, 2];
  Sort(s);
  assert.deepEqual(s, [1, 2, 3]);
  const f = [3, globalThis.Number.NaN, 1];
  Sort(f);
  assert.ok(globalThis.Number.isNaN(f[0]!));
  assert.deepEqual(f.slice(1), [1, 3]);
});

test("slices.SortFunc / SortStableFunc use tri-state comparator", () => {
  const s = [{ k: 3 }, { k: 1 }, { k: 2 }];
  SortFunc(s, (a, b) => a.k - b.k);
  assert.deepEqual(
    s.map((e) => e.k),
    [1, 2, 3],
  );
  const stable = [
    { k: 1, id: "a" },
    { k: 1, id: "b" },
    { k: 0, id: "c" },
  ];
  SortStableFunc(stable, (a, b) => a.k - b.k);
  assert.deepEqual(
    stable.map((e) => e.id),
    ["c", "a", "b"],
  );
});

test("slices.IsSorted", () => {
  assert.equal(IsSorted([1, 2, 3]), true);
  assert.equal(IsSorted([1, 3, 2]), false);
  assert.equal(IsSorted([]), true);
});

test("slices.Sorted / SortedFunc collect-and-sort from a seq", () => {
  const seq: GoSeq<number> = (yieldValue) => {
    for (const v of [3, 1, 2]) {
      if (!yieldValue(v)) {
        return;
      }
    }
  };
  assert.deepEqual(Sorted(seq), [1, 2, 3]);
  assert.deepEqual(
    SortedFunc(seq, (a, b) => b - a),
    [3, 2, 1],
  );
});

test("slices.BinarySearch / BinarySearchFunc", () => {
  const s = [1, 3, 5, 7, 9];
  assert.deepEqual(BinarySearch(s, 5), [2, true]);
  assert.deepEqual(BinarySearch(s, 6), [3, false]);
  assert.deepEqual(BinarySearch(s, 0), [0, false]);
  assert.deepEqual(BinarySearch(s, 100), [5, false]);
  assert.deepEqual(
    BinarySearchFunc(s, 7, (e, t) => e - t),
    [3, true],
  );
});

test("slices.Values / Collect / AppendSeq round-trip", () => {
  const s = [1, 2, 3];
  const collected = Collect(Values(s));
  assert.deepEqual(collected, [1, 2, 3]);
  assert.notEqual(collected, s);
  const appended = AppendSeq([0], Values(s));
  assert.deepEqual(appended, [0, 1, 2, 3]);
});

test("slices.Values honors early termination", () => {
  const s = [1, 2, 3];
  const got: number[] = [];
  Values(s)((v) => {
    got.push(v);
    return v < 2;
  });
  assert.deepEqual(got, [1, 2]);
});
