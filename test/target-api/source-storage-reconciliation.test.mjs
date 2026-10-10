import assert from "node:assert/strict";
import test from "node:test";
import { createSourceStorageGraphQueries } from "../../packages/target-api/dist/target-analysis/source-storage/graph-queries.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/resource-budget.js";

const input = (node = {}, kind = "value") => ({ node, kind });

test("reconciliation replays exact changed dependencies without rescanning unrelated operations", () => {
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const graph = createSourceStorageGraphQueries(budget);
  const changed = input();
  const unrelated = input();
  const runs = [0, 0];
  let revision = 0;
  let observed;
  graph.reconcile([
    () => { graph.read(changed); runs[0] += 1; observed = revision; },
    () => { graph.read(unrelated); runs[1] += 1; },
    () => { revision = 1; graph.invalidate(changed); },
  ]);
  assert.equal(runs[0], 2);
  assert.equal(runs[1], 1, "an unrelated input is never rescanned");
  assert.equal(observed, 1, "the changed input is selected to convergence");
  revision = 2;
  graph.invalidate(changed);
  assert.equal(runs[0], 2, "construction observers do not outlive their owner");
  assert.equal(budget.failure() === undefined, true);
});

test("reconciliation inherits cached child dependencies and keeps independent input channels", () => {
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const graph = createSourceStorageGraphQueries(budget);
  const node = {};
  const channel = {};
  const selected = input(node, channel);
  const query = graph.query(key => { graph.read(key); return new Set([revision]); });
  let revision = 0;
  const original = query(selected);
  let runs = 0;
  let observed;
  graph.reconcile([
    () => { runs += 1; observed = query(selected); },
    () => { revision = 1; graph.invalidate(input(node, {})); graph.invalidate(selected); },
  ]);
  assert.equal(runs, 2);
  assert.equal(observed !== original && observed?.has(1), true, "an actual cached-child hit observes its exact changed channel");
  assert.equal(budget.failure() === undefined, true);
});

test("once-selected immutable recipes retain new candidates while self-invalidating operations converge", () => {
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const graph = createSourceStorageGraphQueries(budget);
  const selected = input();
  const first = {};
  const second = {};
  const candidates = new Set([first]);
  const applied = [];
  let runs = 0;
  graph.reconcile([
    once => {
      runs += 1;
      graph.read(selected);
      for (const candidate of candidates) if (once(candidate)) {
        applied.push(candidate);
        if (candidate === first) { candidates.add(second); graph.invalidate(selected); }
      }
    },
  ]);
  assert.equal(runs, 2, "the self-write schedules one exact follow-up");
  assert.equal(applied.length === 2 && applied[0] === first && applied[1] === second, true,
    "new candidates are admitted and completed recipes are not reapplied");
  assert.equal(budget.failure() === undefined, true);
});

test("dynamic cyclic propagation reobserves every new value without an immutable-recipe gate", () => {
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const graph = createSourceStorageGraphQueries(budget);
  const left = input();
  const right = input();
  const values = new Map([[left, new Set([0])], [right, new Set()]]);
  graph.reconcile([
    () => {
      graph.read(left);
      for (const value of values.get(left)) if (value < 3 && !values.get(right).has(value + 1)) {
        values.get(right).add(value + 1);
        graph.invalidate(right);
      }
    },
    () => {
      graph.read(right);
      for (const value of values.get(right)) if (!values.get(left).has(value)) {
        values.get(left).add(value);
        graph.invalidate(left);
      }
    },
  ]);
  assert.deepEqual([...values.get(left)], [0, 1, 2, 3]);
  assert.deepEqual([...values.get(right)], [1, 2, 3]);
  assert.equal(budget.failure() === undefined, true);
});

test("reconciliation releases all scoped rows on normal completion and exact thrown failure", () => {
  for (const throwing of [false, true]) {
    const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 32 });
    const graph = createSourceStorageGraphQueries(budget);
    const failure = new Error("exact reconciliation failure");
    const run = () => graph.reconcile([once => {
      graph.read(input());
      assert.equal(once({}), true);
      if (throwing) throw failure;
    }]);
    if (throwing) assert.throws(run, error => error === failure);
    else run();
    assert.equal(budget.failure() === undefined, true);
    let remaining = 0;
    while (budget.row()) remaining += 1;
    assert.equal(remaining, 31, "only the actual single retained input-channel identity survives");
  }
});

test("reconciliation reserves its full scheduled frontier before running an oversized operation bank", () => {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 5 });
  const graph = createSourceStorageGraphQueries(budget);
  let ran = false;
  graph.reconcile([() => { ran = true; }, () => { ran = true; }]);
  assert.equal(ran, false);
  assert.match(budget.failure(), /transport-row/u);
  graph.reconcile([() => { ran = true; }]);
  assert.equal(ran, false, "exhaustion remains permanent after releasing failed construction rows");
});

test("reconciliation retains finite work and immutable-recipe storage guards", () => {
  for (const limits of [{ maximumSteps: 1 }, { maximumTransportRows: 4 }]) {
    const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, ...limits });
    const graph = createSourceStorageGraphQueries(budget);
    let completed = false;
    graph.reconcile([once => { if (once({})) completed = true; }]);
    assert.equal(completed, false);
    assert.equal(budget.failure() !== undefined, true);
  }
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumSteps: 12 });
  const graph = createSourceStorageGraphQueries(budget);
  const selected = input();
  graph.reconcile([() => { graph.read(selected); graph.invalidate(selected); }]);
  assert.match(budget.failure(), /analysis-work/u);
});

test("reconciliation cannot nest in query selection or run after final graph sealing", () => {
  for (const sealed of [false, true]) {
    const budget = createSourceStorageBudget(defaultSourceStorageLimits);
    const graph = createSourceStorageGraphQueries(budget);
    let ran = false;
    if (sealed) { graph.seal(); graph.reconcile([() => { ran = true; }]); }
    else {
      const query = graph.query(() => { graph.reconcile([() => { ran = true; }]); return new Set([1]); });
      assert.equal(query("selected") === undefined, true);
    }
    assert.equal(ran, false);
    assert.match(budget.failure(), /idle mutable graph/u);
  }
});
