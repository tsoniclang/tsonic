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

test("sealing retires construction dependencies while preserving exact cached results and finite retained rows", () => {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 5 });
  const graph = createSourceStorageGraphQueries(budget);
  let collected = 0;
  const query = graph.query(key => { graph.read(key); collected += 1; return new Set([key]); });
  const selected = subject({});
  const original = query(selected);
  assert.equal(original?.has(selected), true);
  graph.seal();
  graph.seal();
  assert.equal(query(selected) === original && collected === 1, true, "completed result identity is retained");
  const other = subject({});
  assert.equal(query(other)?.has(other), true, "sealed selections need no mutation dependency index");
  assert.equal(budget.failure() === undefined, true, "released dependencies do not occupy retained storage");
  assert.equal(query(subject({})) === undefined, true, "actual retained results still exceed the same row ceiling");
  assert.match(budget.failure(), /transport-row/u);
  graph.seal();
  assert.equal(query(selected) === undefined, true, "sealing cannot clear failed result admission");
});

test("sealing retires nested parent and readless dependencies without copying cached values", () => {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 9 });
  const graph = createSourceStorageGraphQueries(budget);
  const selected = subject({});
  const child = graph.query(key => { graph.read(key); return new Set([key]); });
  const parent = graph.query(key => new Set(child(key)));
  const original = parent(selected);
  assert.equal(original?.has(selected), true);
  graph.seal();
  assert.equal(parent(selected) === original, true, "sealed native selection remains the same object");
  const separate = subject({});
  assert.equal(parent(separate)?.has(separate), true, "parent/child results alone fit the unchanged peak");
  assert.equal(budget.failure() === undefined, true);

  const readlessBudget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 6 });
  const readlessGraph = createSourceStorageGraphQueries(readlessBudget);
  const readlessChild = readlessGraph.query(key => new Set([key]));
  const readlessParent = readlessGraph.query(key => new Set(readlessChild(key)));
  const result = readlessParent("selected");
  assert.equal(result?.has("selected"), true);
  readlessGraph.seal();
  assert.equal(readlessParent("selected") === result, true);
  assert.equal(readlessChild("other")?.has("other"), true, "readless construction links are also retired");
  assert.equal(readlessBudget.failure() === undefined, true);
});

test("sealed graph queries reject mutation and unfinished sealing and preserve independent work exhaustion", () => {
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const graph = createSourceStorageGraphQueries(budget);
  const selected = subject({});
  const query = graph.query(key => { graph.read(key); return new Set([key]); });
  assert.equal(query(selected)?.has(selected), true);
  graph.seal();
  graph.invalidate(selected);
  assert.match(budget.failure(), /invalidate sealed inputs/u);
  assert.equal(query(selected) === undefined, true, "no evidence after illegal mutation");

  const unfinishedBudget = createSourceStorageBudget(defaultSourceStorageLimits);
  const unfinishedGraph = createSourceStorageGraphQueries(unfinishedBudget);
  const unfinished = unfinishedGraph.query(key => { unfinishedGraph.seal(); return new Set([key]); });
  assert.equal(unfinished("selected") === undefined, true);
  assert.match(unfinishedBudget.failure(), /seal an unfinished selection/u);
  unfinishedGraph.seal();
  assert.equal(unfinished("selected") === undefined, true);

  const workBudget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumSteps: 4 });
  const workGraph = createSourceStorageGraphQueries(workBudget);
  const workQuery = workGraph.query(key => { workGraph.read(selected); return new Set([key]); });
  const result = workQuery("selected");
  assert.equal(result?.has("selected"), true);
  workGraph.seal();
  assert.equal(workQuery("selected") === result, true);
  assert.equal(workQuery("selected") === undefined, true, "cache hits still consume finite cumulative work");
  assert.match(workBudget.failure(), /analysis-work/u);
});
