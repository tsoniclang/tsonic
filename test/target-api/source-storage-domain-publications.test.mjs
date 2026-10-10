import assert from "node:assert/strict";
import test from "node:test";
import { createSourceStorageDomainPublications } from "../../packages/target-api/dist/target-analysis/source-storage/domain-publications.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/resource-budget.js";

const subject = (node = {}, kind = "value", projection = []) => ({ node, kind, projection });

test("publication admission preserves all exact demand flags and their first ordered evidence", () => {
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const publications = createSourceStorageDomainPublications(budget);
  const selected = subject();
  const type = {};
  const sourceFile = {};
  const expected = [];
  for (const kind of ["external-write", "opaque-write", "unclassified-exposure"]) {
    for (const externalEntry of [false, true]) for (const writes of [false, true]) {
      const exposure = {};
      publications.add(selected, type, sourceFile, exposure, writes, kind, externalEntry);
      expected.push({ exposure, writes, kind, externalEntry });
      publications.add(selected, type, {}, {}, writes, kind, externalEntry);
    }
  }
  assert.equal(publications.size(), 12, "all independent kind/entry/write combinations, with no duplicate record");
  for (let index = 0; index < expected.length; index += 1) {
    const actual = publications.at(index);
    const value = expected[index];
    assert.equal(actual.subject === selected && actual.type === type && actual.sourceFile === sourceFile &&
      actual.exposure === value.exposure && actual.writes === value.writes && actual.kind === value.kind &&
      actual.externalEntry === value.externalEntry, true, `exact ordered publication ${index}`);
    assert.equal(Object.isFrozen(actual) && !Object.hasOwn(actual, "inputOwner"), true);
  }
  assert.equal(budget.failure() === undefined, true);
});

test("publication keys keep subjects, native type identities and every exact input owner independent", () => {
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const publications = createSourceStorageDomainPublications(budget);
  const selected = subject();
  const returned = subject(selected.node, "return");
  const projected = subject(selected.node, "value", [{ kind: "array-element" }]);
  const type = {};
  const otherType = {};
  const owner = subject();
  const projectedOwner = subject(owner.node, "value", [{ kind: "tuple-element", index: 0 }]);
  const keys = [[selected, type, undefined], [returned, type, undefined], [projected, type, undefined],
    [selected, otherType, undefined], [selected, type, owner], [selected, type, projectedOwner]];
  for (const [current, currentType, inputOwner] of keys)
    publications.add(current, currentType, {}, {}, true, "external-write", false, inputOwner);
  assert.equal(publications.size(), keys.length);
  for (let index = 0; index < keys.length; index += 1) {
    const actual = publications.at(index);
    const [current, currentType, inputOwner] = keys[index];
    assert.equal(actual.subject === current && actual.type === currentType && actual.inputOwner === inputOwner, true,
      `exact independent publication ${index}`);
  }
});

test("repeat publication admission remains bounded without allocating another queued or indexed cell", () => {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 5, maximumSteps: 128 });
  const publications = createSourceStorageDomainPublications(budget);
  const selected = subject();
  const type = {};
  const args = [selected, type, {}, {}, true, "external-write", false];
  for (let index = 0; index < 128; index += 1) publications.add(...args);
  const original = publications.at(0);
  assert.equal(publications.size() === 1 && budget.failure() === undefined, true);
  publications.add(...args);
  assert.match(budget.failure(), /analysis-work/u);
  assert.equal(publications.size() === 1 && publications.at(0) === original, true);
  publications.finish();
  assert.equal(publications.size() === 0 && publications.at(0) === undefined, true);
  assert.match(budget.failure(), /analysis-work/u, "completion never revives exhausted work");
});

test("publication admission is atomic, and completion releases only its own construction rows", () => {
  for (const maximumTransportRows of [1, 2, 3, 4]) {
    const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows });
    const publications = createSourceStorageDomainPublications(budget);
    publications.add(subject(), {}, {}, {}, true, "external-write", false);
    assert.equal(publications.size() === 0 && budget.failure() !== undefined, true, "no incomplete admission");
    publications.finish();
    assert.equal(budget.failure() !== undefined, true, "release retains the shared failure");
  }
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 8 });
  assert.equal(budget.row(), true, "independent retained evidence");
  const publications = createSourceStorageDomainPublications(budget);
  const args = [subject(), {}, {}, {}, true, "external-write", false];
  publications.add(...args);
  publications.finish();
  publications.finish();
  const rows = budget.createRows();
  assert.equal(rows.add(7), true, "all seven unused rows are available, not the independently retained eighth");
  assert.equal(budget.failure() === undefined, true);
  publications.add(...args);
  assert.match(budget.failure(), /live construction owner/u, "completed construction cannot start a second path");
  assert.equal(publications.size(), 0);
});
