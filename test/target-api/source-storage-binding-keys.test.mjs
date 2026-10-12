import assert from "node:assert/strict";
import test from "node:test";
import { createSourceStorageScopedKeys } from "../../packages/target-api/dist/target-analysis/source-storage/scoped-keys.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/resource-budget.js";

function fixture(limits = {}) {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, ...limits });
  const empty = {};
  const identities = new Map();
  const inputs = new Map();
  const guards = new Set();
  const subject = (kind, syntax, extra = {}) => ({ kind, node: { syntax, ...extra }, projection: [] });
  const formal = subject("input", "parameter");
  const destination = subject("value", "return");
  const ast = { is: {
    IsIdentifier: node => node.syntax === "identifier",
    IsVariableDeclaration: node => node.syntax === "variable",
    IsParameterDeclaration: node => node.syntax === "parameter",
  }, variableDeclarationKind: node => node.declarationKind, kindName: node => node.syntax };
  const transport = { incomingFor: value => inputs.get(value) ?? new Set(),
    contextualInputs: value => value === destination ? new Set([formal]) : new Set(),
    contextLocation: () => undefined, regions: { enclosing: () => undefined },
    guardedValues: { appliesTo: node => guards.has(node) } };
  const scopes = { empty,
    lookup: (value, scope) => value === formal && scope.input !== undefined
      ? { kind: "replace", terms: [{ kind: "reference", subject: scope.input, scope: empty }] } : undefined,
    activation: () => ({ key: "empty" }),
    identity: value => {
      if (!identities.has(value)) identities.set(value, identities.size);
      return identities.get(value);
    },
  };
  const keys = createSourceStorageScopedKeys({ ast }, budget, transport, scopes);
  const key = (value, scope = empty) => keys.encode({ kind: "reference", subject: value, scope });
  const binding = value => key(destination, { input: value });
  const read = value => {
    const selected = subject("value", "identifier");
    inputs.set(selected, new Set([value]));
    return selected;
  };
  return { budget, inputs, guards, subject, key, binding, read };
}

test("binding aliases share exact input identity without merging ordered read occurrences", () => {
  const current = fixture();
  const producer = current.subject("input", "parameter");
  const first = current.read(producer);
  const second = current.read(first);
  assert.equal(current.key(first) !== current.key(second), true, "each read keeps its own value-frontier identity");
  assert.equal(current.binding(first) === current.binding(second), true,
    "formal binding identity does not accumulate an alias-read history");
  assert.equal(current.key(first) !== current.key(second), true, "binding queries cannot poison later read keys");
  assert.equal(current.budget.failure() === undefined, true);
});

test("separately authored actual reads remain distinct even when their original value is equal", () => {
  const current = fixture();
  const producer = current.subject("value", "allocation");
  const first = current.read(producer);
  const second = current.read(producer);
  assert.equal(current.binding(first) !== current.binding(second), true,
    "formal-forwarding normalization cannot replace the selected caller's actual expression identity");
  assert.equal(current.budget.failure() === undefined, true);
});

test("binding identity retains guarded reads, mutable locations and independent allocations", () => {
  const current = fixture();
  const first = current.subject("value", "allocation");
  const second = current.subject("value", "allocation");
  const read = current.read(first);
  const guarded = current.read(first);
  current.guards.add(guarded.node);
  const mutable = current.subject("value", "variable", { declarationKind: "let" });
  current.inputs.set(mutable, new Set([first]));
  const keys = [current.binding(read), current.binding(current.read(second)), current.binding(guarded),
    current.binding(current.read(mutable))];
  assert.equal(keys.every(key => typeof key === "string") && new Set(keys).size === 4, true,
    "a shared initial producer cannot erase a guard, writable location or independent allocation");
  assert.equal(current.budget.failure() === undefined, true);
});

test("malformed cyclic binding aliases reject without publishing partial key evidence", () => {
  const current = fixture();
  const first = current.subject("value", "identifier");
  const second = current.read(first);
  current.inputs.set(first, new Set([second]));
  assert.equal(current.binding(first) === undefined, true);
  assert.match(current.budget.failure(), /binding aliases require an acyclic exact input/u);
  assert.equal(current.key(current.subject("value", "allocation")) === undefined, true,
    "a failed owner cannot resume with partial or guessed evidence");
});

for (const limit of ["maximumSteps", "maximumTransportRows"]) {
  test(`binding alias normalization retains its independent ${limit} guard`, () => {
    const current = fixture({ [limit]: 1 });
    const input = current.read(current.subject("value", "allocation"));
    assert.equal(current.binding(input) === undefined, true);
    assert.equal(typeof current.budget.failure() === "string", true);
  });
}
