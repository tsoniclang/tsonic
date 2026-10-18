import assert from "node:assert/strict";
import test from "node:test";
import { createSourceStorageUnresolvedQueries } from "../../packages/target-api/dist/target-analysis/source-storage/graph/unresolved.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";
import { createSourceStorageSubjects } from "../../packages/target-api/dist/target-analysis/source-storage/model/subjects.js";

const fixture = (limits = defaultSourceStorageLimits) => {
  const budget = createSourceStorageBudget(limits);
  const subject = createSourceStorageSubjects(budget.subject, budget.reject);
  const selected = () => subject({});
  return { budget, subject, selected };
};

const relation = (...subjects) => ({ subjects: subjects.map(subject => ({ subject })) });

test("sealed graphs without unresolved witnesses need no second ancestry traversal", () => {
  const { budget, subject, selected } = fixture();
  const owner = selected();
  const { ancestryFor: unresolved } = createSourceStorageUnresolvedQueries(budget, subject,
    () => assert.fail("no unresolved witness exists to propagate"), new Map());
  assert.equal(unresolved(owner), undefined);
  assert.equal(unresolved(owner), undefined);
  assert.equal(budget.failure() === undefined, true);
});

test("unresolved queries cache exact roots without certifying scoped witnesses as standalone roots", () => {
  const { budget, subject, selected } = fixture();
  const safe = selected();
  const broken = selected();
  const intermediate = selected();
  const start = selected();
  let reads = 0;
  const { ancestryFor: unresolved } = createSourceStorageUnresolvedQueries(budget, subject, owner => {
    reads += 1;
    return owner === start ? relation(intermediate, safe)
      : owner === intermediate ? relation(broken, safe) : relation(owner);
  }, new Map([[broken, "exact unproved boundary"]]));
  assert.equal(unresolved(start), undefined, "this invocation binds the intermediate to its safe producer");
  assert.equal(unresolved(start), undefined);
  assert.equal(reads, 1, "the same completed root is cached");
  assert.equal(unresolved(intermediate), "exact unproved boundary", "an unbound witness requires its own complete query");
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
  const { ancestryFor: unresolved } = createSourceStorageUnresolvedQueries(budget, subject,
    owner => owner === left || owner === right ? relation(left, right) : relation(owner),
    new Map([[root, "exact backing failure"]]));
  assert.equal(unresolved(projected), "exact backing failure");
  assert.equal(unresolved(left), undefined, "absence of an unresolved witness is not a closed-origin claim");
  assert.equal(unresolved(right), undefined);
  assert.equal(budget.failure() === undefined, true);
});

test("unresolved ancestry preserves incomplete and failed scoped selections", () => {
  const { budget, subject, selected } = fixture();
  const owner = selected();
  const boundary = selected();
  const failures = new Map([[boundary, "unproved boundary"]]);
  assert.match(createSourceStorageUnresolvedQueries(budget, subject, () => undefined, failures).ancestryFor(owner), /completed scoped ancestry/u);
  assert.equal(createSourceStorageUnresolvedQueries(budget, subject,
    () => ({ subjects: [], reason: "incomplete invocation" }), failures).ancestryFor(owner), "incomplete invocation");
});

test("sealed unresolved caching remains fail-closed under independent row and work ceilings", () => {
  for (const limits of [{ maximumTransportRows: 1 }, { maximumSteps: 1 }]) {
    const { budget, subject, selected } = fixture({ ...defaultSourceStorageLimits, ...limits });
    const first = selected();
    const second = selected();
    const { ancestryFor: unresolved } = createSourceStorageUnresolvedQueries(budget, subject, owner => relation(owner), new Map());
    assert.equal(unresolved(first), undefined, "the first bounded selection fits exactly");
    assert.equal(typeof unresolved(second), "string", "the next selection cannot exceed its independent ceiling");
    assert.equal(typeof unresolved(first), "string", "cached entries do not bypass the poisoned budget");
  }
  const { budget, subject, selected } = fixture({ ...defaultSourceStorageLimits, maximumSteps: 1 });
  const value = selected();
  const { ancestryFor: unresolved } = createSourceStorageUnresolvedQueries(budget, subject, owner => relation(owner), new Map());
  assert.equal(unresolved(value), undefined);
  assert.match(unresolved(value), /analysis-work/u, "cache hits remain work bounded");
});

test("direct evidence preserves local projected failures without executing ancestry", () => {
  const { budget, subject, selected } = fixture();
  const owner = selected();
  const broken = selected();
  const projected = subject(broken.node, broken.kind, [{ kind: "array-element" }]);
  const queries = createSourceStorageUnresolvedQueries(budget, subject,
    () => assert.fail("an immediate edge query must not execute its transitive producers"),
    new Map([[broken, "exact local failure"]]));
  assert.equal(queries.directFor(owner), undefined);
  assert.equal(queries.directFor(projected), "exact local failure");
  assert.equal(budget.failure() === undefined, true);
});

test("an already rejected root preserves its exact evidence without executing an unrelated producer context", () => {
  const { budget, subject, selected } = fixture();
  const owner = selected();
  const queries = createSourceStorageUnresolvedQueries(budget, subject,
    () => assert.fail("a direct rejection does not require unbound invocation or creation evaluation"),
    new Map([[owner, "exact original rejected transport"]]));
  assert.equal(queries.ancestryFor(owner), "exact original rejected transport");
  assert.equal(queries.ancestryFor(owner), "exact original rejected transport", "the completed exact root is reused");
  assert.equal(budget.failure() === undefined, true, "a local rejection does not poison independent source queries");
});
