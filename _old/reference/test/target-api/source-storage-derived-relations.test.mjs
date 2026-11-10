import assert from "node:assert/strict";
import test from "node:test";
import { createSourceStorageGraphQueries } from "../../packages/target-api/dist/target-analysis/source-storage/graph/graph-queries.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";

function fixture(limits = {}) {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, ...limits });
  const graph = createSourceStorageGraphQueries(budget);
  graph.seal();
  return { budget, graph };
}

for (const completed of [false, true]) {
  test(`derived relation keys and terminal values share one exact incremental family (${completed})`, () => {
    const { graph, budget } = fixture({ maximumSteps: 8192 });
    const count = 64;
    let projections = 0;
    const calls = new Map();
    const select = graph.fixedPoint((key, _read, emit, forward) => {
      calls.set(key, (calls.get(key) ?? 0) + 1);
      if (key === "seeds") {
        for (let value = 0; value < count; value += 1) if (!emit(value)) return false;
        return true;
      }
      if (key === "root") return forward("seeds", value => {
        projections += 1;
        return [{ kind: "value", value }, { kind: "relation", key: value }, { kind: "relation", key: value }];
      });
      return emit(key + count);
    });
    if (completed) for (let value = 0; value < count; value += 1) assert.equal(select(value)?.has(value + count), true);
    const selected = select("root");
    assert.equal(selected?.size === count * 2 && Array.from({ length: count * 2 }, (_, value) => value).every(value => selected.has(value)), true);
    assert.equal(projections, count);
    assert.equal(calls.size === count + 2 && [...calls.values()].every(count => count === 1), true);
    assert.equal(select("root") === selected && select("seeds")?.size === count, true);
    assert.equal(budget.failure() === undefined, true);
  });
}

test("recursive derived keys and nonlinear readers converge without widening their source values", () => {
  const { graph, budget } = fixture({ maximumSteps: 8192 });
  const calls = new Map();
  const select = graph.fixedPoint((key, read, emit, forward) => {
    calls.set(key, (calls.get(key) ?? 0) + 1);
    if (key === "root") {
      const values = read(0);
      if (values === undefined) return false;
      for (let count = 0; count <= values.size; count += 1) if (!emit(count)) return false;
      return forward("seed");
    }
    if (key === "seed") return emit(0);
    return emit(key) && forward("seed", () => [{ kind: "relation", key: (key + 1) % 16 }]);
  });
  const selected = select("root");
  assert.equal(selected?.has(16), true);
  assert.equal(select(0)?.size, 16);
  assert.equal(select("seed")?.size, 1);
  assert.equal([...calls].filter(([key]) => typeof key === "number").every(([, count]) => count === 1), true);
  assert.equal(budget.failure() === undefined, true);
});

test("derived empty cycles remain empty rather than publishing relation keys as values", () => {
  const { graph, budget } = fixture();
  const select = graph.fixedPoint((key, _read, emit, forward) => key === "selector" ? emit("selected")
    : forward("selector", () => [{ kind: "relation", key: key === "first" ? "second" : "first" }]));
  assert.equal(select("first")?.size, 0);
  assert.equal(select("second")?.size, 0);
  assert.deepEqual([...select("selector")], ["selected"]);
  assert.equal(budget.failure() === undefined, true);
});

test("reevaluation retires previously derived edges before their delayed results arrive", () => {
  const { graph, budget } = fixture();
  const select = graph.fixedPoint((key, read, emit, forward) => {
    if (key === "selector") return emit("selected");
    if (key === "ready") return forward("trigger");
    if (key === "trigger") return emit("ready");
    if (key === "old") return forward("delay");
    if (key === "delay") return emit("unrelated");
    if (key === "new") return emit("current");
    const ready = read("ready");
    if (ready === undefined) return false;
    const selected = ready.size === 0 ? "old" : "new";
    return forward("selector", () => [{ kind: "relation", key: selected }]);
  });
  assert.deepEqual([...select("root")], ["current"]);
  assert.deepEqual([...select("old")], ["unrelated"]);
  assert.equal(budget.failure() === undefined, true);
});

test("replacing a derived edge cannot retract a proved value", () => {
  const { graph, budget } = fixture();
  const select = graph.fixedPoint((key, read, emit, forward) => {
    if (key === "selector") return emit("selected");
    if (key === "old") return emit("original");
    if (key === "new") return emit("different");
    const previous = read(key);
    if (previous === undefined) return false;
    const selected = previous.size === 0 ? "old" : "new";
    return forward("selector", () => [{ kind: "relation", key: selected }]);
  });
  assert.equal(select("root") === undefined, true);
  assert.match(budget.failure(), /cannot retract/u);
  assert.equal(select("old") === undefined, true);
});

test("failed derived relations release scratch edges to completed inputs before retry", () => {
  const remaining = shouldFail => {
    const { graph, budget } = fixture({ maximumTransportRows: 128 });
    const failure = new Error("derived child failed");
    let throwing = shouldFail;
    const select = graph.fixedPoint((key, _read, emit, forward) => {
      if (key === "stable") return emit("stable");
      if (key === "root") return forward("stable", () => [{ kind: "relation", key: "child" }]);
      if (!forward("stable")) return false;
      if (throwing) throw failure;
      return emit("child");
    });
    const original = select("stable");
    if (throwing) assert.throws(() => select("root"), error => error === failure);
    throwing = false;
    assert.deepEqual([...select("root")].sort(), ["child", "stable"]);
    assert.equal(select("stable") === original && budget.failure() === undefined, true);
    let rows = 0;
    while (budget.row()) rows += 1;
    return rows;
  };
  assert.equal(remaining(true), remaining(false));
});

for (const limits of [{ maximumSteps: 64 }, { maximumTransportRows: 32 }]) {
  test(`unbounded derived keys preserve finite rejection ${JSON.stringify(limits)}`, () => {
    const { graph, budget } = fixture(limits);
    const select = graph.fixedPoint((key, _read, emit, forward) => key === "selector" ? emit(0)
      : forward("selector", () => [{ kind: "relation", key: key + 1 }]));
    assert.equal(select(0) === undefined, true);
    assert.match(budget.failure(), limits.maximumSteps === undefined ? /transport-row/u : /analysis-work/u);
    assert.equal(select(1) === undefined, true);
  });
}
