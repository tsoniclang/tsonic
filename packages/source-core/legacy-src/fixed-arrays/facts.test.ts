import assert from "node:assert/strict";
import { test } from "node:test";
import type { Node, Type } from "@tsonic/tsts";
import { fixedArrayFactsEqual, snapshotFixedArrayFact, tsonicFixedArrayFactKey } from "./facts.js";
import type { TsonicFixedArrayFact } from "./facts.js";

function fact(): TsonicFixedArrayFact {
  return {
    sourceType: {} as Type,
    elementSourceType: {} as Type,
    elementType: {} as Node,
    length: 9007199254740993n,
    lengthRuntimeBase: "bigint",
  };
}

test("fixed-array snapshots own exact immutable counts without freezing compiler evidence", () => {
  const input = { ...fact() };
  const captured = tsonicFixedArrayFactKey.snapshot(input);
  input.length = 9007199254740992n;
  input.elementType = {} as Node;
  assert.equal(captured.length, 9007199254740993n);
  assert.notEqual(captured.elementType, input.elementType);
  assert.notEqual(captured, input);
  assert.ok(Object.isFrozen(captured));
  assert.equal(Object.isFrozen(captured.sourceType), false);
  assert.equal(Object.isFrozen(captured.elementSourceType), false);
  assert.equal(Object.isFrozen(captured.elementType), false);
  assert.throws(() => Object.assign(captured, { length: 0n }), TypeError);
  assert.ok(tsonicFixedArrayFactKey.equals(captured, snapshotFixedArrayFact(captured)));
});

test("fixed-array equality retains every selected field and adjacent huge counts", () => {
  const original = snapshotFixedArrayFact(fact());
  for (const changed of [
    { sourceType: {} as Type },
    { elementSourceType: {} as Type },
    { elementType: {} as Node },
    { elementType: undefined },
    { length: 9007199254740992n },
  ]) {
    assert.equal(fixedArrayFactsEqual(original, snapshotFixedArrayFact({ ...original, ...changed })), false);
  }
  const numeric = snapshotFixedArrayFact({ ...original, length: 2n, lengthRuntimeBase: "number" });
  const bigint = snapshotFixedArrayFact({ ...original, length: 2n });
  assert.equal(fixedArrayFactsEqual(numeric, bigint), false);
  assert.equal(fixedArrayFactsEqual(numeric, snapshotFixedArrayFact(numeric)), true);
});

test("fixed-array snapshots omit absent optional syntax and reject open data shapes", () => {
  const { elementType: _elementType, ...resolved } = fact();
  const absent = snapshotFixedArrayFact(resolved);
  const explicitUndefined = snapshotFixedArrayFact({ ...resolved, elementType: undefined });
  assert.equal(Object.prototype.hasOwnProperty.call(absent, "elementType"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(explicitUndefined, "elementType"), false);
  assert.ok(fixedArrayFactsEqual(absent, explicitUndefined));
  const invalid = [
    null,
    [],
    { ...resolved, extra: true },
    { ...resolved, [Symbol("extra")]: true },
    { ...resolved, sourceType: undefined },
    { ...resolved, elementSourceType: null },
    { ...resolved, elementType: [] },
    { ...resolved, length: 2 },
    { ...resolved, length: -1n },
    { ...resolved, lengthRuntimeBase: "number" },
    { ...resolved, lengthRuntimeBase: "string" },
  ];
  for (const value of invalid) {
    assert.throws(() => snapshotFixedArrayFact(value as TsonicFixedArrayFact), /Fixed-array evidence/);
  }
  let reads = 0;
  const accessor = Object.defineProperty({ ...resolved }, "length", {
    get() { reads += 1; return 2n; },
  });
  assert.throws(() => snapshotFixedArrayFact(accessor), /accessor/);
  assert.equal(reads, 0);
});
