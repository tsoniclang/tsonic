import assert from "node:assert/strict";
import test from "node:test";
import { createSourceStorageGraphQueries } from "../../packages/target-api/dist/target-analysis/source-storage/graph-queries.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/resource-budget.js";

const subject = (node = {}) => ({ node, kind: "value", projection: [] });

test("final sealing retains completed values and releases only mutable graph dependency rows", () => {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 13 });
  const graph = createSourceStorageGraphQueries(budget);
  const input = subject();
  let collections = 0;
  const child = graph.query(key => { graph.read(key); collections += 1; return new Set([key]); });
  const middle = graph.query(key => new Set(child(key)));
  const parent = graph.query(key => new Set(middle(key)));
  const original = parent(input);
  assert.equal(original?.has(input), true, "original transitive checked evidence");
  graph.seal();
  graph.seal();
  assert.equal(parent(input) === original && collections === 1, true, "identical completed evidence without recollection");
  assert.equal(budget.failure() === undefined, true, "sealing fits the original unchanged finite peak");
  let remaining = 0;
  while (budget.row()) remaining += 1;
  assert.equal(remaining, 7, "the six retained query/value cells remain charged; only seven construction cells were released");
  assert.equal(parent(input) === undefined, true, "released dependencies never clear an exhausted owner");
});

test("sealed cold queries retain finite value and work accounting without rebuilding invalidation metadata", () => {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 5 });
  const graph = createSourceStorageGraphQueries(budget);
  const query = graph.query(key => { graph.read(key); return new Set([key]); });
  const first = subject();
  const original = query(first);
  assert.equal(original?.has(first), true, "initial construction uses the complete original five-row peak");
  graph.seal();
  assert.equal(query(first) === original, true);
  const second = subject();
  assert.equal(query(second)?.has(second), true, "cold immutable selection still retains its exact subject");
  assert.equal(budget.failure() === undefined, true);
  assert.equal(query(subject()) === undefined, true, "third retained value exceeds the original finite ceiling");
  assert.match(budget.failure(), /transport-row/u);
  assert.equal(query(first) === undefined, true, "a previous hit cannot bypass permanent failure");
});

test("readless completed children need no invalidation edge before or after final sealing", () => {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 4 });
  const graph = createSourceStorageGraphQueries(budget);
  const child = graph.query(key => new Set([key]));
  const parent = graph.query(key => new Set(child(key)));
  const original = parent("exact");
  assert.equal(original?.has("exact"), true, "the four exact query/value rows fit without unowned invalidation links");
  graph.invalidate(subject());
  assert.equal(parent("exact") === original, true, "unread inputs cannot change the selected result");
  graph.seal();
  assert.equal(parent("exact") === original && budget.failure() === undefined, true);
  assert.equal(budget.row(), false, "all four retained evidence cells remain charged");
});

test("sealing drains wide readers within their original finite peak rather than copying the entire read index", () => {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 81 });
  const graph = createSourceStorageGraphQueries(budget);
  const input = subject();
  const query = graph.query(key => { graph.read(input); return new Set([key]); });
  const results = Array.from({ length: 20 }, (_, index) => query(index));
  assert.equal(results.every((values, index) => values?.has(index)), true);
  graph.seal();
  assert.equal(budget.failure() === undefined, true, "unchanged full eighty-one-row peak");
  assert.equal(results.every((values, index) => query(index) === values), true, "every independent complete selection survives");
  let remaining = 0;
  while (budget.row()) remaining += 1;
  assert.equal(remaining, 41, "forty retained cells survive; every construction-only row is released");
});

test("wide cached-child parents seal without materializing their fanout or dropping completed identities", () => {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 165 });
  const graph = createSourceStorageGraphQueries(budget);
  const input = subject();
  const child = graph.query(key => { graph.read(key); return new Set([key]); });
  const parent = graph.query(() => new Set(child(input)));
  const results = Array.from({ length: 40 }, (_, index) => parent(index));
  assert.equal(results.every(values => values?.has(input)), true, "every parent retains its original completed child");
  graph.seal();
  assert.equal(budget.failure() === undefined, true, "parent traversal stays inside the unchanged full construction peak");
  assert.equal(results.every((values, index) => parent(index) === values), true);
  let remaining = 0;
  while (budget.row()) remaining += 1;
  assert.equal(remaining, 83, "all eighty-two retained cells survive without any fanout dependency charge");
});

test("sealing shared diamonds removes all input and parent links without removing cached values", () => {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 22 });
  const graph = createSourceStorageGraphQueries(budget);
  const left = subject();
  const right = subject();
  const child = graph.query(key => { graph.read(key); return new Set([key]); });
  const first = graph.query(key => { const values = child(key); graph.read(right); return new Set(values); });
  const second = graph.query(key => { const values = first(key); graph.read(left); return new Set(values); });
  const diamond = graph.query(key => new Set([...child(key), ...first(key)]));
  const before = [child(left), first(left), second(left), diamond(left)];
  assert.equal(before.every(values => values?.has(left)), true);
  graph.seal();
  const after = [child(left), first(left), second(left), diamond(left)];
  assert.equal(after.every((values, index) => values === before[index]), true, "all four exact shared selections survive");
  assert.equal(budget.failure() === undefined, true);
  let remaining = 0;
  while (budget.row()) remaining += 1;
  assert.equal(remaining, 14, "all fourteen construction-only cells are released; eight value cells remain charged");
});

test("unfinished sealing, sealed input mutation and exhausted sealing each reject persistently", () => {
  const unfinishedBudget = createSourceStorageBudget(defaultSourceStorageLimits);
  const unfinished = createSourceStorageGraphQueries(unfinishedBudget);
  const collect = unfinished.query(key => { unfinished.seal(); return new Set([key]); });
  assert.equal(collect("pending") === undefined, true);
  assert.match(unfinishedBudget.failure(), /unfinished selection/u);
  assert.equal(collect("pending") === undefined, true);

  const immutableBudget = createSourceStorageBudget(defaultSourceStorageLimits);
  const immutable = createSourceStorageGraphQueries(immutableBudget);
  const select = immutable.query(key => new Set([key]));
  assert.equal(select("retained")?.has("retained"), true);
  immutable.seal();
  immutable.invalidate(subject());
  assert.match(immutableBudget.failure(), /sealed inputs/u);
  assert.equal(select("retained") === undefined, true);

  const workBudget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumSteps: 2 });
  const exhausted = createSourceStorageGraphQueries(workBudget);
  const value = exhausted.query(key => { exhausted.read(key); return new Set([key]); });
  assert.equal(value(subject()) !== undefined, true, "both original work reservations succeed");
  exhausted.seal();
  assert.match(workBudget.failure(), /analysis-work/u);
  assert.equal(value(subject()) === undefined, true);
});
