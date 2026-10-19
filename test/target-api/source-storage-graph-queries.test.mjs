import assert from "node:assert/strict";
import test from "node:test";
import { createSourceStorageGraphQueries } from "../../packages/target-api/dist/target-analysis/source-storage/graph/graph-queries.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";

const subject = (node, kind = "value", projection = []) => ({ node, kind, projection });

test("origin closure owns overlapping cyclic dependencies once and invalidates only actual readers", () => {
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const graph = createSourceStorageGraphQueries(budget);
  const root = subject({});
  const left = subject({});
  const right = subject({});
  const first = subject({});
  const second = subject({});
  const unrelated = subject({});
  const inputs = new Map([[root, new Set([left, right])], [left, new Set([right])],
    [right, new Set([left, first])]]);
  const visits = new Map();
  const select = graph.closure((key, emit, follow) => {
    graph.read(key);
    visits.set(key, (visits.get(key) ?? 0) + 1);
    const parents = inputs.get(key);
    if (parents === undefined || parents.size === 0) return emit(key);
    for (const parent of parents) if (!follow(parent)) return false;
    return true;
  });
  const original = select(root);
  assert.equal(original?.size === 1 && original.has(first), true, "exact original component origin");
  for (let repeat = 0; repeat < 32; repeat += 1) {
    assert.equal(select(root) === original, true, "completed root result identity");
    assert.equal(select(left)?.has(first) === true && select(right)?.has(first) === true, true,
      "both cyclic suffixes already complete");
  }
  assert.equal([root, left, right, first].every(key => visits.get(key) === 1), true,
    "one direct collector per unchanged origin dependency, not per root");
  const separate = select(unrelated);
  inputs.set(right, new Set([left, second]));
  graph.invalidate(right);
  const updated = select(root);
  assert.equal(updated !== original && updated?.size === 1 && updated.has(second), true,
    "current pre-seal dependency replaces the old immutable answer");
  assert.equal(updated?.has(first) === false, true, "no stale origin remains after invalidation");
  assert.equal(select(unrelated) === separate, true, "unrelated completed owner stays valid");
  graph.seal();
  assert.equal(select(root) === updated, true, "same completed result after the existing seal");
  assert.equal(budget.failure() === undefined, true, "no failure or unfinished answer");
});

test("origin closure retires a throwing wave without caching partial or stopping evidence", () => {
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const graph = createSourceStorageGraphQueries(budget);
  const root = subject({});
  const expected = new Error("original origin collector failure");
  const warmRead = graph.query(key => { graph.read(key); return new Set(); });
  warmRead(root);
  graph.invalidate(root);
  const before = budget.usage().rows;
  let throwing = true;
  const select = graph.closure((key, emit) => {
    graph.read(key);
    if (throwing) throw expected;
    return emit(key);
  });
  for (let repeat = 0; repeat < 16; repeat += 1) {
    assert.throws(() => select(root), error => error === expected);
    assert.equal(budget.usage().rows === before, true, "failed wave retains no owned rows");
  }
  throwing = false;
  const completed = select(root);
  assert.equal(completed?.size === 1 && completed.has(root), true, "later real completed result");
  assert.equal(select(root) === completed, true, "only the completed result is reused");
  assert.equal(budget.failure() === undefined, true, "throw did not manufacture sticky budget failure");
});

test("origin closure never publishes through independent row or work exhaustion", () => {
  for (const limits of [{ maximumTransportRows: 1 }, { maximumSteps: 1 }]) {
    const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, ...limits });
    const graph = createSourceStorageGraphQueries(budget);
    const root = subject({});
    const select = graph.closure((key, emit) => { graph.read(key); return emit(key); });
    assert.equal(select(root) === undefined, true, "exhausted owner returns no evidence");
    assert.equal(budget.failure() !== undefined, true, "original finite failure remains visible");
    assert.equal(select(root) === undefined, true, "failed wave cannot become a cached success");
  }
});

test("completed origin components replace former leaf seeds and merge new cycles in either query order", () => {
  for (const reverse of [false, true]) {
    const budget = createSourceStorageBudget(defaultSourceStorageLimits);
    const graph = createSourceStorageGraphQueries(budget);
    const left = subject({});
    const right = subject({});
    const first = subject({});
    const second = subject({});
    const inputs = new Map([[left, new Set([first])], [right, new Set([second])]]);
    const select = graph.closure((key, emit, follow) => {
      graph.read(key);
      const parents = inputs.get(key);
      if (parents === undefined || parents.size === 0) return emit(key);
      for (const parent of parents) if (!follow(parent)) return false;
      return true;
    });
    for (const key of reverse ? [right, left] : [left, right]) assert.equal(select(key)?.size === 1, true,
      "both original components complete before a real new edge");
    const before = select(left);
    const independent = select(right);
    inputs.set(first, new Set([right]));
    graph.invalidate(first);
    const after = select(left);
    assert.equal(after !== before && after?.size === 1 && after.has(second) && !after.has(first), true,
      "a formerly closed leaf loses its obsolete seed after the new edge");
    assert.equal(before?.has(first) === true, true, "the retired result stays immutable");
    assert.equal(select(right) === independent, true, "an unrelated suffix retains its exact result");
    inputs.set(second, new Set([left]));
    graph.invalidate(second);
    for (const key of reverse ? [right, left] : [left, right]) assert.equal(select(key)?.size === 0, true,
      "the new fully closed rootless cycle never manufactures an origin");
    assert.equal(select(left) === select(right), true, "all keys in the new component share its completed union");
    assert.equal(budget.failure() === undefined, true, "both query orders preserve finite ownership");
  }
});

test("a failed origin wave retires already folded suffixes and all of its own state", () => {
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const graph = createSourceStorageGraphQueries(budget);
  const root = subject({});
  const left = subject({});
  const right = subject({});
  const warmRead = graph.query(key => { graph.read(key); return new Set(); });
  for (const key of [root, left, right]) { warmRead(key); graph.invalidate(key); }
  const before = budget.usage().rows;
  const expected = new Error("later origin dependency failed");
  let throwing = true;
  let leftVisits = 0;
  const select = graph.closure((key, emit, follow) => {
    graph.read(key);
    if (key === root) return follow(left) && follow(right);
    if (key === left) leftVisits += 1;
    if (key === right && throwing) throw expected;
    return emit(key);
  });
  for (let repeat = 0; repeat < 16; repeat += 1) {
    assert.throws(() => select(root), error => error === expected);
    assert.equal(budget.usage().rows === before, true, "no unfinished member, result, dependency or temporary row survives");
    assert.equal(leftVisits === repeat + 1, true, "the unpublished folded child was retired with the failed wave");
  }
  throwing = false;
  const result = select(root);
  assert.equal(result?.size === 2 && result.has(left) && result.has(right), true, "later complete wave publishes both real seeds");
  assert.equal(select(root) === result, true, "only the complete wave remains cached");
  assert.equal(budget.failure() === undefined, true, "the identical original exception did not become an unrelated refusal");
});

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

test("single leaf-child membership stays constant-time while every repeated read and cache hit consumes work", () => {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumSteps: 48, maximumTransportRows: 9 });
  const graph = createSourceStorageGraphQueries(budget);
  const selected = subject({});
  const child = graph.query(key => { graph.read(key); return new Set([key]); });
  const parent = graph.query(key => {
    const values = child(key);
    for (let index = 0; index < 32; index += 1) graph.read(key);
    return new Set(values);
  });
  const original = parent(selected);
  assert.equal(original?.has(selected), true, "one exact child lookup needs no duplicate graph walk or temporary queue");
  assert.equal(budget.failure() === undefined, true, "both original finite peak and finite work remain enforced");
  let result = original;
  for (let index = 0; index < 48 && result !== undefined; index += 1) result = parent(selected);
  assert.equal(result === undefined, true, "cached parent hits still exhaust the finite work ceiling");
  assert.match(budget.failure(), /analysis-work/u);
  assert.equal(parent(selected) === undefined, true, "failed owner never recovers through the fast lookup");
});
