import assert from "node:assert/strict";
import test from "node:test";
import { createSourceStorageGraphQueries } from "../../packages/target-api/dist/target-analysis/source-storage/graph-queries.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/resource-budget.js";

const subject = (node, kind = "value", projection = []) => ({ node, kind, projection });

test("graph queries retain unaffected selections and invalidate exact nested dependencies", () => {
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const graph = createSourceStorageGraphQueries(budget);
  const selected = subject({});
  const unrelated = subject({});
  let reads = 0;
  let parents = 0;
  const child = graph.query(key => { graph.read(key); reads += 1; return new Set([reads]); });
  const parent = graph.query(key => { parents += 1; return new Set(child(key)); });
  const original = parent(selected);
  const separate = parent(unrelated);
  assert.equal(parent(selected) === original, true, "same completed selection identity");
  graph.invalidate(subject(selected.node, "return"));
  assert.equal(parent(selected) === original, true, "independent subject kind");
  graph.invalidate(selected);
  const updated = parent(selected);
  assert.equal(updated !== original && updated.has(3), true, "affected parent and child recomputed");
  assert.equal(parent(unrelated) === separate, true, "unrelated graph selection remains valid");
  assert.equal(reads, 3);
  assert.equal(parents, 3);
  assert.equal(budget.failure() === undefined, true);
});

test("cached child hits register new parents and projected reads observe backing writes", () => {
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const graph = createSourceStorageGraphQueries(budget);
  const backing = {};
  const component = subject(backing, "value", [{ kind: "array-element" }]);
  let revision = 0;
  const child = graph.query(() => { graph.read(component); return new Set([revision]); });
  const parent = graph.query(() => new Set(child("selected")));
  const first = parent("first");
  const second = parent("second");
  assert.equal(first.has(0) && second.has(0), true);
  revision = 1;
  graph.invalidate(subject(backing));
  assert.equal(parent("first").has(1) && parent("second").has(1), true,
    "both actual parents invalidate even when the second originally hit the child cache");
  assert.equal(budget.failure() === undefined, true);
});

test("graph invalidation releases evicted query rows while keeping peak storage and total work finite", () => {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 5 });
  const graph = createSourceStorageGraphQueries(budget);
  const selected = subject({});
  let version = 0;
  const query = graph.query(key => { graph.read(key); return new Set([version]); });
  for (; version < 20; version += 1) {
    assert.equal(query(selected)?.has(version), true, "current exact graph selection");
    graph.invalidate(selected);
  }
  assert.equal(budget.failure() === undefined, true, "only live cache rows count toward peak storage");
  assert.equal(query(selected)?.has(version), true);
  assert.equal(query(subject({})) === undefined, true, "a second live selection still exceeds the finite ceiling");
  assert.equal(budget.failure() !== undefined, true);
});

test("dependent graph cache preserves finite row and work exhaustion on cold and cached queries", () => {
  for (const limits of [
    { maximumTransportRows: 1 },
    { maximumTransportRows: 2 },
    { maximumSteps: 1 },
  ]) {
    const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, ...limits });
    const graph = createSourceStorageGraphQueries(budget);
    const selected = subject({});
    const query = graph.query(key => { graph.read(key); return new Set([key]); });
    assert.equal(query(selected) === undefined, true, "no incomplete evidence after exhaustion");
    assert.equal(budget.failure() !== undefined, true);
    assert.equal(query(selected) === undefined, true, "cached evidence cannot bypass exhaustion");
  }
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumSteps: 2 });
  const graph = createSourceStorageGraphQueries(budget);
  const query = graph.query(() => new Set([1]));
  const original = query("selected");
  assert.equal(original.has(1), true);
  assert.equal(query("selected") === original, true);
  assert.equal(query("selected") === undefined && budget.failure() !== undefined, true);
});

test("graph queries reject recursive or changing unfinished selections", () => {
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const graph = createSourceStorageGraphQueries(budget);
  const recursive = graph.query(key => recursive(key));
  assert.equal(recursive("cycle") === undefined, true);
  assert.match(budget.failure(), /unfinished result/u);
  const changingBudget = createSourceStorageBudget(defaultSourceStorageLimits);
  const changingGraph = createSourceStorageGraphQueries(changingBudget);
  const selected = subject({});
  const changing = changingGraph.query(key => {
    changingGraph.read(key);
    changingGraph.invalidate(key);
    return new Set([key]);
  });
  assert.equal(changing(selected) === undefined, true);
  assert.match(changingBudget.failure(), /inputs changed/u);
});

test("parent reads inherit exact completed child dependencies within the unchanged finite peak", () => {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 9 });
  const graph = createSourceStorageGraphQueries(budget);
  const selected = subject({});
  let revision = 0;
  const child = graph.query(key => { graph.read(key); return new Set([revision]); });
  const parent = graph.query(key => { const values = child(key); graph.read(key); return new Set(values); });
  const original = parent(selected);
  assert.equal(original?.has(0), true, "parent read adds no duplicate copy of the child's exact dependency");
  assert.equal(parent(selected) === original, true, "exact completed selection identity");
  revision = 1;
  graph.invalidate(selected);
  const updated = parent(selected);
  assert.equal(updated !== original && updated?.has(1), true, "child invalidation still reaches its parent");
  assert.equal(budget.failure() === undefined, true, "no lost dependency or raised ceiling");
});

test("inherited read dependencies remain transitive and preserve independent kinds and readless children", () => {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 13 });
  const graph = createSourceStorageGraphQueries(budget);
  const selected = subject({});
  let revision = 0;
  const child = graph.query(key => { graph.read(key); return new Set([revision]); });
  const middle = graph.query(key => { const values = child(key); graph.read(key); return new Set(values); });
  const parent = graph.query(key => { const values = middle(key); graph.read(key); return new Set(values); });
  const original = parent(selected);
  assert.equal(original?.has(0), true, "grandchild read is already an exact transitive dependency");
  revision = 1;
  graph.invalidate(subject(selected.node, "return"));
  assert.equal(parent(selected) === original, true, "different subject kinds remain independent");
  graph.invalidate(subject(selected.node, "value", [{ kind: "array-element" }]));
  const updated = parent(selected);
  assert.equal(updated !== original && updated?.has(1), true, "projected backing writes still invalidate all parents");
  assert.equal(budget.failure() === undefined, true);

  const readlessBudget = createSourceStorageBudget(defaultSourceStorageLimits);
  const readlessGraph = createSourceStorageGraphQueries(readlessBudget);
  const readlessChild = readlessGraph.query(key => new Set([key]));
  const readlessParent = readlessGraph.query(key => { readlessChild(key); readlessGraph.read(selected); return new Set([revision]); });
  const before = readlessParent("selected");
  revision = 2;
  readlessGraph.invalidate(selected);
  assert.equal(readlessParent("selected") !== before, true, "a child that never read the subject cannot replace the parent's dependency");
  assert.equal(readlessBudget.failure() === undefined, true);
});

test("inherited dependencies preserve each distinct reader and reject work exhaustion without partial evidence", () => {
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const graph = createSourceStorageGraphQueries(budget);
  const first = subject({});
  const second = subject({});
  let revision = 0;
  const child = graph.query(key => { graph.read(key); return new Set([revision]); });
  const parent = graph.query(key => { child(first); graph.read(second); return new Set([revision]); });
  const before = parent("selected");
  revision = 1;
  graph.invalidate(second);
  const after = parent("selected");
  assert.equal(after !== before && after?.has(1), true, "unrelated direct read is retained");
  revision = 2;
  graph.invalidate(first);
  assert.equal(parent("selected")?.has(2), true, "inherited first read remains live after an independent invalidation");
  assert.equal(budget.failure() === undefined, true);

  const workBudget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumSteps: 3 });
  const workGraph = createSourceStorageGraphQueries(workBudget);
  const workChild = workGraph.query(key => { workGraph.read(key); return new Set([key]); });
  const workParent = workGraph.query(key => { const values = workChild(key); workGraph.read(key); return new Set(values); });
  assert.equal(workParent(first) === undefined, true, "finite dependency traversal never publishes an incomplete proof");
  assert.match(workBudget.failure(), /analysis-work/u);
  assert.equal(workParent(first) === undefined, true, "failed budget stays failed");
});
