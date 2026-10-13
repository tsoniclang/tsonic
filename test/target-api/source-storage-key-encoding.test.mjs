import assert from "node:assert/strict";
import test from "node:test";
import { encodeSourceStorageKey } from "../../packages/target-api/dist/target-analysis/source-storage/graph/key-encoding.js";
import { createSourceStorageScopedKeys } from "../../packages/target-api/dist/target-analysis/source-storage/scoped/scoped-keys.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";

const set = (...values) => ({ kind: "set", values });
const budget = limits => createSourceStorageBudget({ ...defaultSourceStorageLimits, ...limits });
const key = value => encodeSourceStorageKey(value, budget());

test("canonical key encoding preserves atom, sequence, empty and unordered identities", () => {
  const values = [null, 0, 1, "0", "null", "[]", [], [0], [1], [null], [""], set(), set(0), set([0])];
  const keys = values.map(key);
  assert.equal(keys.every(value => typeof value === "string"), true);
  assert.equal(new Set(keys).size, values.length, "distinct constructors and atom types never collide");
  assert.equal(key([1, 2]) === key([2, 1]), false, "sequence order remains exact");
  assert.equal(key([1, 1]) === key([1]), false, "sequence repetition remains exact");
  assert.equal(key(set(1, 2, 1)) === key(set(2, 1)), true, "only unordered sets deduplicate");
  assert.equal(key(["a,b", "c"]) === key(["a", "b,c"]), false);
});

test("shared and independently allocated equal key structures have one canonical encoding", () => {
  const shared = ["value", [1, 2, null]];
  const copied = () => ["value", [1, 2, null]];
  assert.equal(key([shared, shared]) === key([copied(), copied()]), true);
  assert.equal(key(set(shared, ["other", shared], shared)) === key(set(["other", copied()], copied())), true);
  assert.equal(key(set(set(1, 2), set(3, 4))) === key(set(set(4, 3), set(2, 1))), true);
  assert.equal(key([set([1, 2], [2, 1]), [3]]) === key([set([2, 1], [1, 2]), [3]]), true);
  assert.equal(key([copied(), ["value", [1, 3, null]]]) === key([shared, shared]), false);
});

test("deep shared key DAGs retain linear encoded size without recursive stack traversal", () => {
  const current = budget({ maximumSteps: 4096, maximumTransportRows: 4096 });
  let value = ["leaf"];
  for (let depth = 0; depth < 512; depth += 1) value = ["pair", value, value];
  const encoded = encodeSourceStorageKey(value, current);
  assert.equal(typeof encoded === "string" && encoded.length < 40_000, true);
  assert.equal(current.failure() === undefined, true);
});

test("actual scoped binding keys never expand a compact substitution DAG into exponential text", () => {
  const current = budget({ maximumSteps: 512, maximumTransportRows: 1024 });
  const empty = {}; const scope = {};
  const identities = new Map(); const bindings = new Map();
  let term = { kind: "leaf", subject: { kind: "value", node: {} }, scope: empty };
  for (let depth = 0; depth < 20; depth += 1) {
    const subject = { kind: "input", node: {} };
    bindings.set(subject, { kind: "replace", terms: [term, term] });
    term = { kind: "reference", subject, scope };
  }
  const scopes = { empty, lookup: subject => bindings.get(subject), activation: () => ({ key: "empty" }),
    identity: value => {
      if (!identities.has(value)) identities.set(value, identities.size);
      return identities.get(value);
    } };
  const keys = createSourceStorageScopedKeys({}, current, {
    contextualInputs: () => new Set(),
    bindingInputFor: () => assert.fail("This key DAG contains only formal input references and original leaves."),
  }, scopes);
  const selected = keys.encode(term);
  assert.equal(typeof selected === "string" && selected.length < 4096, true, "the exact 20-level binding DAG is a bounded key");
  assert.equal(current.failure() === undefined, true);
});

test("nested unordered conditions preserve structure without recursively escaped key strings", () => {
  const current = budget({ maximumSteps: 4096, maximumTransportRows: 4096 });
  let first = ["leaf"];
  let second = ["leaf"];
  for (let depth = 0; depth < 64; depth += 1) {
    first = ["transition", set([depth, first], [depth + 1, first]), first];
    second = ["transition", set([depth + 1, second], [depth, second]), second];
  }
  const encoded = encodeSourceStorageKey(first, current);
  assert.equal(typeof encoded === "string" && encoded.length < 30_000, true);
  assert.equal(encodeSourceStorageKey(second, current) === encoded, true);
  assert.equal(current.failure() === undefined, true);
});

for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
  test(`nonfinite key numbers cannot collapse into null (${value})`, () => {
    for (const input of [value, [value], set(value)]) {
      const current = budget();
      assert.equal(encodeSourceStorageKey(input, current) === undefined, true);
      assert.match(current.failure(), /numbers must be finite/u);
    }
  });
}

test("key cycles reject without mistaking a completed shared child for a cycle", () => {
  for (const kind of ["sequence", "set"]) {
    const children = [];
    const value = kind === "sequence" ? children : { kind: "set", values: children };
    children.push(value);
    const current = budget();
    assert.equal(encodeSourceStorageKey(value, current) === undefined, true);
    assert.match(current.failure(), /acyclic/u);
    assert.equal(encodeSourceStorageKey(["later"], current) === undefined, true);
  }
  const child = [1];
  assert.equal(typeof key([child, child]) === "string", true);
});

test("key work, nodes, broad child lists and text retain independent finite guards", () => {
  for (const [limits, value, reason] of [
    [{ maximumSteps: 1 }, ["value"], /analysis-work/u],
    [{ maximumTransportRows: 1 }, ["value"], /finite positive reservation/u],
    [{ maximumSteps: 8 }, Array(1024).fill(0), /analysis-work/u],
    [{ maximumTransportRows: 8 }, ["x".repeat(8192)], /reservation|transport-row/u],
    [{ maximumTransportRows: 8 }, "x".repeat(8192), /reservation|transport-row/u],
  ]) {
    const current = budget(limits);
    assert.equal(encodeSourceStorageKey(value, current) === undefined, true, JSON.stringify(limits));
    assert.match(current.failure(), reason);
    assert.equal(encodeSourceStorageKey([], current) === undefined, true, "no cached or atomic bypass");
  }
});

test("completed and throwing key encodes release their temporary representation without retained history", () => {
  const current = budget({ maximumTransportRows: 64 });
  const value = ["stable", [1, 2, 3]];
  const expected = encodeSourceStorageKey(value, current);
  for (let repeat = 0; repeat < 64; repeat += 1) assert.equal(encodeSourceStorageKey(value, current) === expected, true);
  const failure = new Error("child unavailable");
  const throwing = ["before", "after"];
  Object.defineProperty(throwing, 1, { get() { throw failure; } });
  assert.throws(() => encodeSourceStorageKey(throwing, current), error => error === failure);
  assert.equal(encodeSourceStorageKey(value, current) === expected, true);
  const remaining = current.createRows();
  assert.equal(remaining.add(64), true, "no completed or failed request retains an encoding/index row");
  remaining.release();
  assert.equal(current.failure() === undefined, true);
});
