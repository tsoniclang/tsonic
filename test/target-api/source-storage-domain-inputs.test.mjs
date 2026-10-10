import assert from "node:assert/strict";
import test from "node:test";
import { createSourceStorageDomainInputs } from "../../packages/target-api/dist/target-analysis/source-storage/domain-inputs.js";
import { createSourceStorageDomainWitnesses } from "../../packages/target-api/dist/target-analysis/source-storage/domain-witnesses.js";
import { createSourceStorageDomainPublications } from "../../packages/target-api/dist/target-analysis/source-storage/domain-publications.js";
import { createSourceStorageSubjects } from "../../packages/target-api/dist/target-analysis/source-storage/subjects.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/resource-budget.js";

function fixture(limits = {}) {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, ...limits });
  const subject = createSourceStorageSubjects(budget.subject, budget.reject);
  const witnesses = createSourceStorageDomainWitnesses(budget);
  const inputs = createSourceStorageDomainInputs({ subject }, witnesses, budget);
  return { budget, subject, witnesses, inputs };
}

test("domain input relationships preserve every exposure while reusing duplicate-owner adjacency", () => {
  const { budget, subject, witnesses, inputs } = fixture();
  const selected = subject({});
  const owner = subject({});
  const firstExposure = {};
  const secondExposure = {};
  const query = inputs.query(key => { inputs.read(key); return new Set(inputs.owners(key)); });
  const empty = query(selected);
  inputs.add(selected, "external-write", firstExposure, owner);
  assert.equal(query(selected) === empty, true, "a writer is not an input relationship");
  inputs.add(selected, "external-input", firstExposure, owner);
  const admitted = query(selected);
  assert.equal(admitted !== empty && admitted?.has(owner), true, "the first actual input changes presence");
  inputs.add(selected, "external-input", secondExposure, owner);
  assert.equal(query(selected) === admitted, true, "a new exposure does not change the existing input relationship");
  const values = witnesses.forSubject(selected);
  assert.equal(values.length, 3);
  assert.equal(values[1].exposure === firstExposure && values[2].exposure === secondExposure && values[1].owner === owner && values[2].owner === owner,
    true, "all exact ordered exposure witnesses remain independently visible");
  assert.equal(witnesses.inputOwners(selected).size, 1);
  assert.equal(budget.failure() === undefined, true);
});

test("domain input dependencies distinguish exact binding owners and source subject kinds", () => {
  const { budget, subject, inputs } = fixture();
  const node = {};
  const selected = subject(node);
  const returned = subject(node, "return");
  const first = subject({});
  const second = subject({});
  const query = inputs.query(key => { inputs.read(key, first); return new Set([...inputs.owners(key)].filter(owner => owner === first)); });
  const empty = query(selected);
  inputs.add(selected, "external-input", {}, second);
  assert.equal(query(selected) === empty, true, "another binding owner cannot invalidate the selected owner's relationship");
  inputs.add(returned, "external-input", {}, first);
  assert.equal(query(selected) === empty, true, "return and value roles stay separate at the same checked node");
  inputs.add(selected, "external-input", {}, first);
  assert.equal(query(selected) !== empty && query(selected)?.has(first), true);
  assert.equal(budget.failure() === undefined, true);
});

test("projected input owners observe their canonical binding root without losing exact projection witnesses", () => {
  const { budget, subject, witnesses, inputs } = fixture();
  const selected = subject({});
  const owner = subject({});
  const projected = subject(owner.node, owner.kind, [{ kind: "tuple-element", index: 1 }]);
  const query = inputs.query(key => { inputs.read(key, owner); return new Set(inputs.owners(key)); });
  const original = query(selected);
  inputs.add(selected, "external-input", {}, projected);
  assert.equal(query(selected) !== original && query(selected)?.has(projected) && !query(selected).has(owner), true,
    "the original projection stays exact while its root binding dependency changes");
  assert.equal(witnesses.forSubject(selected)[0].owner === projected, true);
  assert.equal(budget.failure() === undefined, true);
});

test("domain input presence inherits only actual projection prefixes including absent owners", () => {
  const { budget, subject, inputs } = fixture();
  const root = subject({});
  const selected = subject(root.node, root.kind, [{ kind: "array-element" }, { kind: "tuple-element", index: 1 }]);
  const sibling = subject(root.node, root.kind, [{ kind: "array-element" }, { kind: "tuple-element", index: 0 }]);
  const owner = subject({});
  const query = inputs.query(key => { inputs.read(key); return new Set(inputs.owners(key)); });
  assert.equal(query(selected)?.size, 0);
  inputs.add(sibling, "external-input", {}, owner);
  assert.equal(query(selected)?.size, 0, "a sibling component is not a prefix and cannot invent an input");
  inputs.add(root, "external-input", {});
  assert.equal(inputs.has(selected), true, "an absent owner still represents an actual external input");
  assert.equal(query(selected)?.has(undefined), true);
  assert.equal(query(selected)?.has(owner), false);
  assert.equal(budget.failure() === undefined, true);
});

test("domain finalization retires only query dependencies and preserves actual witnesses and cached results", () => {
  const { budget, subject, witnesses, inputs } = fixture({ maximumTransportRows: 32 });
  const selected = subject({});
  const owner = subject({});
  inputs.add(selected, "external-input", {}, owner);
  const query = inputs.query(key => { inputs.read(key); return new Set(inputs.owners(key)); });
  const original = query(selected);
  inputs.seal();
  assert.equal(query(selected) === original && original?.has(owner), true);
  assert.equal(witnesses.forSubject(selected).length, 1);
  assert.equal(budget.failure() === undefined, true);
  let remaining = 0;
  while (budget.row()) remaining += 1;
  assert.equal(remaining, 23, "all seven witness/index cells and two completed-result cells remain charged");
});

test("input-owner admission and sealed mutation reject atomically under the existing bounded owner", () => {
  const { budget, subject, witnesses, inputs } = fixture({ maximumTransportRows: 6 });
  const selected = subject({});
  inputs.add(selected, "external-input", {}, subject({}));
  assert.equal(witnesses.forSubject(selected).length, 0);
  assert.equal(witnesses.inputOwners(selected).size, 0);
  assert.equal(budget.failure() !== undefined, true);
  const sealed = fixture();
  const key = sealed.subject({});
  sealed.inputs.seal();
  sealed.inputs.add(key, "external-input", {}, sealed.subject({}));
  assert.equal(sealed.witnesses.forSubject(key).length, 0, "the rejected write changes no immutable witness");
  assert.match(sealed.budget.failure(), /live construction owner/u);
});

test("callable publication admission retains every distinct declaration and exposure with one scoped owner", () => {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 6 });
  assert.equal(budget.row(), true);
  const publications = createSourceStorageDomainPublications(budget);
  const first = {};
  const second = {};
  const exposure = {};
  const another = {};
  assert.equal(publications.callable(first, exposure), true);
  assert.equal(publications.callable(first, exposure), false, "identical immutable callable recipe is not repeated");
  assert.equal(publications.callable(first, another), true, "another exposure is independently admitted");
  assert.equal(publications.callable(second, exposure), true, "another exact declaration is independently admitted");
  assert.equal(budget.failure() === undefined, true);
  publications.finish();
  const rows = budget.createRows();
  assert.equal(rows.add(5), true, "all five recipe cells are released, not the independent retained cell");
  assert.equal(publications.callable(first, exposure), false);
  assert.match(budget.failure(), /live construction owner/u);
});

test("callable publication admission preserves finite storage and charged repeat-work rejection", () => {
  for (const limits of [{ maximumTransportRows: 1 }, { maximumSteps: 1 }]) {
    const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, ...limits });
    const publications = createSourceStorageDomainPublications(budget);
    const owner = {};
    const exposure = {};
    const first = publications.callable(owner, exposure);
    if (limits.maximumSteps !== undefined) assert.equal(first, true);
    else assert.equal(first, false);
    assert.equal(publications.callable(owner, exposure), false);
    assert.equal(budget.failure() !== undefined, true);
    publications.finish();
    assert.equal(publications.callable(owner, exposure), false);
    assert.equal(budget.failure() !== undefined, true);
  }
});
