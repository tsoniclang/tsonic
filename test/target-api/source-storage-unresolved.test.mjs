import assert from "node:assert/strict";
import test from "node:test";
import { createSourceStorageUnresolvedQuery } from "../../packages/target-api/dist/target-analysis/source-storage/unresolved.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/resource-budget.js";
import { createSourceStorageSubjects } from "../../packages/target-api/dist/target-analysis/source-storage/subjects.js";

const fixture = (limits = defaultSourceStorageLimits) => {
  const budget = createSourceStorageBudget(limits);
  const subject = createSourceStorageSubjects(budget.subject, budget.reject);
  const selected = () => subject({});
  return { budget, subject, selected };
};

test("sealed unresolved queries reuse complete shared ancestry rather than traversing each alias again", () => {
  const { budget, subject, selected } = fixture();
  const root = selected();
  const left = selected();
  const right = selected();
  const diamond = selected();
  const edges = new Map([[diamond, new Set([left, right])], [left, new Set([root])], [right, new Set([root])]]);
  let reads = 0;
  const unresolved = createSourceStorageUnresolvedQuery(budget, subject,
    owner => { reads += 1; return edges.get(owner) ?? new Set(); }, new Map());
  assert.equal(unresolved(diamond), undefined);
  assert.equal(reads, 4);
  for (const owner of [left, right, root, diamond]) assert.equal(unresolved(owner), undefined);
  assert.equal(reads, 4, "complete sealed ancestors are already proven");
  assert.equal(budget.failure() === undefined, true);
});

test("a failed ancestry search never certifies an unfinished branch or poisons unrelated ancestors", () => {
  const { budget, subject, selected } = fixture();
  const safe = selected();
  const broken = selected();
  const intermediate = selected();
  const start = selected();
  const edges = new Map([[start, new Set([intermediate])], [intermediate, new Set([broken, safe])]]);
  const unresolved = createSourceStorageUnresolvedQuery(budget, subject,
    owner => edges.get(owner) ?? new Set(), new Map([[broken, "exact unproved boundary"]]));
  assert.equal(unresolved(start), "exact unproved boundary");
  assert.equal(unresolved(intermediate), "exact unproved boundary", "visited but unfinished branch is not cached as safe");
  assert.equal(unresolved(safe), undefined, "unrelated completed leaf stays safe");
  assert.equal(budget.failure() === undefined, true);
});

test("sealed unresolved queries preserve projected prefix failures and cyclic ancestry", () => {
  const { budget, subject, selected } = fixture();
  const backing = {};
  const root = subject(backing);
  const projected = subject(backing, "value", [{ kind: "array-element" }]);
  const left = selected();
  const right = selected();
  const edges = new Map([[left, new Set([right])], [right, new Set([left])]]);
  const unresolved = createSourceStorageUnresolvedQuery(budget, subject,
    owner => edges.get(owner) ?? new Set(), new Map([[root, "exact backing failure"]]));
  assert.equal(unresolved(projected), "exact backing failure");
  assert.equal(unresolved(left), undefined, "absence of an unresolved witness is not a closed-origin claim");
  assert.equal(unresolved(right), undefined);
  assert.equal(budget.failure() === undefined, true);
});

test("sealed unresolved caching remains fail-closed under independent row and work ceilings", () => {
  for (const limits of [{ maximumTransportRows: 1 }, { maximumSteps: 1 }]) {
    const { budget, subject, selected } = fixture({ ...defaultSourceStorageLimits, ...limits });
    const first = selected();
    const second = selected();
    const unresolved = createSourceStorageUnresolvedQuery(budget, subject,
      owner => owner === first ? new Set([second]) : new Set(), new Map());
    assert.equal(typeof unresolved(first), "string", "no incomplete successful query after exhaustion");
    assert.equal(typeof unresolved(second), "string", "cached entries do not bypass the poisoned budget");
  }
  const { budget, subject, selected } = fixture({ ...defaultSourceStorageLimits, maximumSteps: 3 });
  const value = selected();
  const unresolved = createSourceStorageUnresolvedQuery(budget, subject, () => new Set(), new Map());
  assert.equal(unresolved(value), undefined);
  assert.match(unresolved(value), /analysis-work/u, "cache hits remain work bounded");
});
