import test from "node:test";
import assert from "node:assert/strict";
import * as maps from "./maps.js";
import { Clone, Copy, DeleteFunc, Equal, EqualFunc, Keys, Values } from "./maps.js";

test("maps.Clone returns a shallow copy", () => {
  const m = new globalThis.Map<string, number>([
    ["a", 1],
    ["b", 2],
  ]);
  const c = Clone(m)!;
  assert.notEqual(c, m);
  assert.equal(c.get("a"), 1);
  assert.equal(c.get("b"), 2);
  c.set("a", 99);
  assert.equal(m.get("a"), 1, "mutating clone must not affect original");
});

test("maps.Clone(undefined) returns undefined", () => {
  assert.equal(Clone<string, number>(undefined), undefined);
});

test("maps.Copy copies and overwrites entries", () => {
  const dst = new globalThis.Map<string, number>([["a", 1]]);
  const src = new globalThis.Map<string, number>([
    ["a", 10],
    ["b", 2],
  ]);
  Copy(dst, src);
  assert.equal(dst.get("a"), 10);
  assert.equal(dst.get("b"), 2);
});

test("maps.Equal compares key/value pairs", () => {
  const m1 = new globalThis.Map<string, number>([
    ["a", 1],
    ["b", 2],
  ]);
  const m2 = new globalThis.Map<string, number>([
    ["b", 2],
    ["a", 1],
  ]);
  const m3 = new globalThis.Map<string, number>([["a", 1]]);
  const m4 = new globalThis.Map<string, number>([
    ["a", 1],
    ["b", 3],
  ]);
  assert.equal(Equal(m1, m2), true);
  assert.equal(Equal(m1, m3), false);
  assert.equal(Equal(m1, m4), false);
});

test("maps.EqualFunc uses the provided comparator", () => {
  const m1 = new globalThis.Map<string, number>([["a", 1]]);
  const m2 = new globalThis.Map<string, string>([["a", "1"]]);
  assert.equal(
    EqualFunc(m1, m2, (v1, v2) => globalThis.String(v1) === v2),
    true,
  );
  assert.equal(
    EqualFunc(m1, m2, (v1, v2) => globalThis.String(v1) !== v2),
    false,
  );
});

test("maps.Keys yields all keys", () => {
  const m = new globalThis.Map<string, number>([
    ["a", 1],
    ["b", 2],
  ]);
  const collected: string[] = [];
  Keys(m)((k) => {
    collected.push(k);
    return true;
  });
  assert.deepEqual(collected.sort(), ["a", "b"]);
});

test("maps.Keys honors early termination", () => {
  const m = new globalThis.Map<string, number>([
    ["a", 1],
    ["b", 2],
    ["c", 3],
  ]);
  const collected: string[] = [];
  Keys(m)((k) => {
    collected.push(k);
    return false;
  });
  assert.equal(collected.length, 1);
});

test("maps.Values yields all values", () => {
  const m = new globalThis.Map<string, number>([
    ["a", 1],
    ["b", 2],
  ]);
  const collected: number[] = [];
  Values(m)((v) => {
    collected.push(v);
    return true;
  });
  assert.deepEqual(collected.sort(), [1, 2]);
});

test("maps.DeleteFunc deletes matching entries", () => {
  const m = new globalThis.Map<string, number>([
    ["a", 1],
    ["b", 2],
    ["c", 3],
  ]);
  DeleteFunc(m, (_key, value) => value % 2 === 1);
  assert.deepEqual([...m.entries()], [["b", 2]]);
});

test("maps package exposes only real stdlib helpers", () => {
  assert.equal("Set" in maps, false);
  assert.equal("GetOrZero" in maps, false);
  assert.equal("Delete" in maps, false);
});
