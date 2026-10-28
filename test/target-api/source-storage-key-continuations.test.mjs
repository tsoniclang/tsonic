import assert from "node:assert/strict";
import test from "node:test";
import { createSourceStorageScopedKeys } from "../../packages/target-api/dist/target-analysis/source-storage/scoped/scoped-keys.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";

function fixture(limits = {}) {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, ...limits });
  const empty = {};
  const subject = { kind: "value", node: {}, projection: [] };
  const identities = new Map();
  const source = { ast: { is: { IsParameterDeclaration: () => false } },
    semantics: { forNode: () => ({ operations: { call: () => undefined, propertyAccess: () => undefined } }) } };
  const transport = { subject: () => subject, subjectFor: () => undefined };
  const scopes = { empty, activation: () => ({ key: "empty", closed: true }), identity: value => {
    if (!identities.has(value)) identities.set(value, identities.size);
    return identities.get(value);
  } };
  const creation = { footprints: { select: () => ({ ports: new Set(), locations: new Set() }) }, ownerFor: () => undefined };
  const keys = createSourceStorageScopedKeys(source, budget, transport, scopes, creation);
  const wrap = (kind, value) => kind === "instantiation"
    ? { kind, value, parameter: subject.node, scope: empty }
    : kind === "member" ? { kind, mode: "value", receiver: value, scope: empty, projection: [],
      selection: { kind: "physical", subject, declaration: subject.node, receiverType: {} } }
    : { kind: "application", mode: "value", callee: value, scope: empty, projection: [], invocation: subject.node,
      activation: { kind: "invoke" } };
  return { budget, keys, wrap };
}

for (const kind of ["instantiation", "member", "application"]) {
  test(`deep ${kind} keys finish through bounded continuations rather than the native stack`, () => {
    const current = fixture();
    let term = { kind: "empty", absence: undefined };
    for (let index = 0; index < 4096; index += 1) term = current.wrap(kind, term);
    const key = current.keys.encode(term);
    assert.equal(typeof key, "string", "every exact nested component has a completed encoding");
    assert.equal(current.keys.encode(term), key, "the cohort memo retains the exact same completed key");
    assert.equal(current.keys.closed(term), true, "finite nested syntax does not invent an outside input");
    assert.equal(current.budget.failure(), undefined, "unchanged finite source guards remain authoritative");
  });
}

test("deep key continuations preserve active-cycle rejection without publishing partial work", () => {
  const current = fixture();
  const cyclic = { kind: "store", destination: { kind: "empty" }, receiver: undefined, value: { kind: "empty" } };
  cyclic.receiver = cyclic;
  let term = cyclic;
  for (let index = 0; index < 2048; index += 1) term = current.wrap("member", term);
  assert.equal(current.keys.encode(term), undefined, "a deep cycle cannot become a completed key");
  assert.equal(current.budget.failure(), "Source storage key terms require an acyclic exact value.",
    "the existing exact-cycle diagnostic survives explicit suspension");
  current.keys.releaseReferenceMemo();
  assert.equal(current.keys.encode({ kind: "empty" }), undefined, "release cannot clear the sticky source failure");
});

test("key continuation rows remain subject to the existing finite budget", () => {
  const current = fixture({ maximumTransportRows: 64 });
  let term = { kind: "empty" };
  for (let index = 0; index < 128; index += 1) term = current.wrap("instantiation", term);
  assert.equal(current.keys.encode(term), undefined, "uncompleted continuation frames are never free");
  assert.equal(current.budget.failure(), "Source storage transport exceeds its finite transport-row budget.");
  current.keys.releaseReferenceMemo();
  assert.equal(current.budget.usage().rows, 0, "failure releases every active continuation and unpublished memo row");
});
