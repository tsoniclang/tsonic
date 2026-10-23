import assert from "node:assert/strict";
import test from "node:test";
import { createSourceStorageKeyEncoder } from "../../packages/target-api/dist/target-analysis/source-storage/graph/key-encoding.js";
import { createSourceStorageScopedKeys } from "../../packages/target-api/dist/target-analysis/source-storage/scoped/scoped-keys.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";
import { createSourceStorageContextFootprints } from "../../packages/target-api/dist/target-analysis/source-storage/graph/context-footprints.js";

const set = (...values) => ({ kind: "set", values });
const budget = limits => createSourceStorageBudget({ ...defaultSourceStorageLimits, ...limits });

test("canonical key encoding preserves atom, sequence, empty and unordered identities", () => {
  const key = createSourceStorageKeyEncoder(budget()).encode;
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
  const key = createSourceStorageKeyEncoder(budget()).encode;
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
  const encoded = createSourceStorageKeyEncoder(current).encode(value);
  assert.equal(typeof encoded === "string" && encoded.length < 40_000, true);
  assert.equal(current.failure() === undefined, true);
});

test("actual scoped binding keys never expand a compact substitution DAG into exponential text", () => {
  const current = budget({ maximumSteps: 512, maximumTransportRows: 1024 });
  const empty = {}; const scope = {};
  const identities = new Map(); const bindings = new Map();
  const parameters = new Set();
  let term = { kind: "leaf", subject: { kind: "value", node: {} }, scope: empty };
  for (let depth = 0; depth < 20; depth += 1) {
    const subject = { kind: "input", node: {} };
    parameters.add(subject.node);
    bindings.set(subject, { kind: "replace", terms: [term, term], initialization: "actual" });
    term = { kind: "reference", subject, scope };
  }
  const scopes = { empty, lookup: subject => bindings.get(subject), activation: () => ({ key: "empty", closed: true }),
    identity: value => {
      if (!identities.has(value)) identities.set(value, identities.size);
      return identities.get(value);
    } };
  const owner = { parameters: [...parameters] };
  const file = {};
  const signature = { parameters: owner.parameters.map(declaration => ({ declaration })) };
  const semantics = { declarations: {
    declarationSignature: declaration => declaration === owner ? signature : undefined,
    signatureParameters: selected => selected.parameters,
    primarySymbolDeclaration: symbol => symbol.declaration,
  } };
  const source = { ast: { parent: node => parameters.has(node) ? owner : undefined,
    getSourceFile: node => node === owner || parameters.has(node) ? file : undefined,
    is: { IsVariableDeclaration: () => false, IsParameterDeclaration: node => parameters.has(node) },
    as: { AsParameterDeclaration: node => parameters.has(node) ? { Initializer: undefined } : undefined } },
    semantics: { includes: selected => selected === file, forFile: selected => {
      assert.equal(selected === file, true, "the key DAG retains its exact checked callable file");
      return semantics;
    } } };
  const keys = createSourceStorageScopedKeys(source, current, {
    contextualInputs: () => new Set(),
    bindingInputFor: () => assert.fail("This key DAG contains only formal input references and original leaves."),
  }, scopes, { footprints: createSourceStorageContextFootprints(current, () => new Set(), () => undefined),
    ownerFor: () => undefined });
  const selected = keys.encode(term);
  assert.equal(typeof selected === "string" && selected.length < 4096, true, "the exact 20-level binding DAG is a bounded key");
  assert.equal(current.failure() === undefined, true);
});

test("nested unordered conditions preserve structure without recursively escaped key strings", () => {
  const current = budget({ maximumSteps: 4096, maximumTransportRows: 4096 });
  const encoder = createSourceStorageKeyEncoder(current);
  let first = ["leaf"];
  let second = ["leaf"];
  for (let depth = 0; depth < 64; depth += 1) {
    first = ["transition", set([depth, first], [depth + 1, first]), first];
    second = ["transition", set([depth + 1, second], [depth, second]), second];
  }
  const encoded = encoder.encode(first);
  assert.equal(typeof encoded === "string" && encoded.length < 30_000, true);
  assert.equal(encoder.encode(second) === encoded, true);
  assert.equal(current.failure() === undefined, true);
});

for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
  test(`nonfinite key numbers cannot collapse into null (${value})`, () => {
    for (const input of [value, [value], set(value)]) {
      const current = budget();
      assert.equal(createSourceStorageKeyEncoder(current).encode(input) === undefined, true);
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
    const encoder = createSourceStorageKeyEncoder(current);
    assert.equal(encoder.encode(value) === undefined, true);
    assert.match(current.failure(), /acyclic/u);
    assert.equal(encoder.encode(["later"]) === undefined, true);
  }
  const child = [1];
  const key = createSourceStorageKeyEncoder(budget()).encode;
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
    const encoder = createSourceStorageKeyEncoder(current);
    assert.equal(encoder.encode(value) === undefined, true, JSON.stringify(limits));
    assert.match(current.failure(), reason);
    assert.equal(encoder.encode([]) === undefined, true, "no cached or atomic bypass");
  }
});

test("canonical keys retain only accounted identities and throwing encodes roll back unpublished rows", () => {
  const current = budget({ maximumTransportRows: 64 });
  const encoder = createSourceStorageKeyEncoder(current);
  const value = ["stable", [1, 2, 3]];
  const expected = encoder.encode(value);
  const retained = current.usage().rows;
  assert.equal(retained > 0, true, "the canonical index is not an unaccounted cache");
  for (let repeat = 0; repeat < 64; repeat += 1) assert.equal(encoder.encode(value) === expected, true);
  assert.equal(current.usage().rows === retained, true, "equivalent requests retain no duplicate identity or history rows");
  const failure = new Error("child unavailable");
  const throwing = ["before", "after"];
  Object.defineProperty(throwing, 1, { get() { throw failure; } });
  assert.throws(() => encoder.encode(throwing), error => error === failure);
  assert.equal(current.usage().rows === retained, true, "failed encodes publish no child or temporary rows");
  assert.equal(encoder.encode(value) === expected, true);
  const remaining = current.createRows();
  assert.equal(remaining.add(64 - retained), true, "every unused row remains available after the bounded canonical index");
  remaining.release();
  assert.equal(current.failure() === undefined, true);
});

test("canonical handles belong to exactly one encoder and foreign or forged handles reject", () => {
  const first = createSourceStorageKeyEncoder(budget());
  const owned = first.intern(["shared", 1]);
  assert.equal(first.encode([owned]) === first.encode([["shared", 1]]), true, "owned handles preserve exact structural equality");
  for (const foreign of [owned, Object.freeze({ kind: "key", identity: 0 })]) {
    const current = budget();
    const second = createSourceStorageKeyEncoder(current);
    assert.equal(second.encode([foreign]) === undefined, true);
    assert.match(current.failure(), /different exact query owner/u);
    assert.equal(second.encode([]) === undefined, true, "foreign-key rejection is sticky");
  }
});

test("mutable input containers never masquerade as completed immutable canonical keys", () => {
  const encoder = createSourceStorageKeyEncoder(budget());
  const child = [1];
  const value = [child];
  const original = encoder.encode(value);
  child[0] = 2;
  assert.equal(encoder.encode(value) === original, false, "object identity cannot substitute for structural dependency evidence");
  child[0] = 1;
  assert.equal(encoder.encode(value) === original, true, "restored structure recovers the same exact identity");
});

test("atomic handles and inline atoms have identical structural meaning without redundant atom indexes", () => {
  const current = budget();
  const encoder = createSourceStorageKeyEncoder(current);
  const original = encoder.encode(["leaf", 1, null]);
  assert.equal(current.usage().rows, 1, "one canonical compound row contains its inline atomic payload");
  const atoms = ["leaf", 1, null].map(value => encoder.intern(value));
  assert.equal(encoder.encode(atoms) === original, true, "requesting a root atom never changes its nested structural meaning");
  const unordered = values => ({ kind: "set", values });
  assert.equal(encoder.encode(unordered(atoms)) === encoder.encode(unordered([null, 1, "leaf"])), true);
  assert.equal(encoder.encode([1]) === encoder.encode(["1"]), false, "numeric identities never alias serialized string payloads");
  const copied = Object.freeze({ ...atoms[0] });
  assert.equal(encoder.encode(copied) === undefined, true, "matching all fields cannot forge the owning canonical object");
  assert.match(current.failure(), /different exact query owner/u);
});
