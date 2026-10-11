import assert from "node:assert/strict";
import test from "node:test";
import { createSourceStorageGraphQueries } from "../../packages/target-api/dist/target-analysis/source-storage/graph-queries.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/resource-budget.js";

function fixture(limits = {}) {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, ...limits });
  const graph = createSourceStorageGraphQueries(budget);
  graph.seal();
  return { budget, graph };
}

test("projected recursive forwarding transforms each new immutable value once rather than rereading prefixes", () => {
  const current = fixture({ maximumSteps: 65_536 });
  const count = 128;
  let collections = 0;
  let projections = 0;
  const selected = current.graph.fixedPoint((key, _read, emit, forward) => {
    collections += 1;
    if (key === "even") return forward(0, value => { projections += 1; return value % 2 === 0 ? [value] : []; });
    return emit(key) && forward((key + 1) % count);
  });
  const result = selected("even");
  assert.equal(result?.size === count / 2 && [...result].every(value => value % 2 === 0), true);
  assert.equal(projections, count, "one exact unary projection per newly admitted operand");
  assert.equal(collections, count + 1, "no prefix reevaluation for identity or projected edges");
  assert.equal(selected("even") === result, true);
  assert.equal(selected(0)?.size, count, "the filter never truncates its source relation");
  assert.equal(current.budget.failure() === undefined, true);
});

for (const reverse of [false, true]) {
  test(`one child retains independent identity, transforming and filtering edges (${reverse})`, () => {
    const current = fixture();
    let maps = 0;
    let filters = 0;
    const map = value => { maps += 1; return [value + 10]; };
    const filter = value => { filters += 1; return value === 2 ? [20] : []; };
    const selected = current.graph.fixedPoint((key, _read, emit, forward) => {
      if (key === "input") return emit(1) && emit(2);
      const projections = [undefined, map, filter, map];
      for (const projection of reverse ? projections.reverse() : projections)
        if (!forward("input", projection)) return false;
      return true;
    });
    assert.deepEqual([...selected("output")].sort((left, right) => left - right), [1, 2, 11, 12, 20]);
    assert.equal(maps, 2, "the identical projection is not duplicated");
    assert.equal(filters, 2);
    assert.deepEqual([...selected("input")].sort(), [1, 2]);
    assert.equal(current.budget.failure() === undefined, true);
  });
}

test("a positive recursive value transformation reaches its exact fixed point", () => {
  const current = fixture({ maximumSteps: 4096 });
  let collections = 0;
  const selected = current.graph.fixedPoint((key, _read, emit, forward) => {
    collections += 1;
    return emit(0) && forward(key, value => value < 63 ? [value + 1] : []);
  });
  const result = selected("cycle");
  assert.equal(result?.size === 64 && Array.from({ length: 64 }, (_, value) => value).every(value => result.has(value)), true);
  assert.equal(collections, 1);
  assert.equal(current.budget.failure() === undefined, true);
});

test("projected forwarding of completed operands preserves independent parents and exact empty results", () => {
  const current = fixture();
  const selected = current.graph.fixedPoint((key, _read, emit, forward) => key === "input" ? emit(7)
    : forward("input", value => key === "empty" ? [] : [value + key]));
  const original = selected("input");
  assert.equal(selected("empty")?.size, 0);
  assert.deepEqual([...selected(1)], [8]);
  assert.deepEqual([...selected(2)], [9]);
  assert.equal(selected("input") === original, true);
  assert.equal(current.budget.failure() === undefined, true);
});

test("a reevaluated projected collector cannot retract an already proved value", () => {
  const current = fixture();
  const selected = current.graph.fixedPoint((key, read, emit, forward) => {
    if (key === "input") return emit(1);
    if (key === "trigger") return forward("parent");
    const trigger = read("trigger");
    if (trigger === undefined) return false;
    const initial = trigger.size === 0;
    return forward("input", value => initial ? [value] : []);
  });
  assert.equal(selected("parent") === undefined, true);
  assert.match(current.budget.failure(), /cannot retract/u);
  assert.equal(selected("input") === undefined, true, "no failed-family cache bypasses rejection");
});

test("a monotonic collector replaces projected edges before a delayed child publishes", () => {
  const current = fixture();
  let staleProjections = 0;
  let currentProjections = 0;
  const selected = current.graph.fixedPoint((key, read, emit, forward) => {
    if (key === "trigger") return emit("ready");
    if (key === "input") return forward("delayed");
    if (key === "delayed") return emit(7);
    const trigger = read("trigger");
    if (trigger === undefined) return false;
    const ready = trigger.size !== 0;
    return forward("input", value => {
      if (ready) { currentProjections += 1; return [value]; }
      staleProjections += 1;
      return [value + 100];
    });
  });
  assert.deepEqual([...selected("parent")], [7]);
  assert.equal(staleProjections, 0, "retired projections never transform a later delta");
  assert.equal(currentProjections, 1);
  assert.equal(current.budget.failure() === undefined, true);
});

test("projection reevaluation can add an exact alternative without losing previously forwarded values", () => {
  const current = fixture();
  const selected = current.graph.fixedPoint((key, read, emit, forward) => {
    if (key === "input") return emit(3);
    if (key === "trigger") return forward("parent");
    const trigger = read("trigger");
    if (trigger === undefined) return false;
    const ready = trigger.size !== 0;
    return forward("input", value => ready ? [value, value + 1] : [value]);
  });
  assert.deepEqual([...selected("parent")].sort(), [3, 4]);
  assert.deepEqual([...selected("input")], [3]);
  assert.equal(current.budget.failure() === undefined, true);
});

test("an unavailable projection fails closed instead of publishing a partial identity edge", () => {
  const current = fixture();
  const selected = current.graph.fixedPoint((key, _read, emit, forward) => key === "input" ? emit(1)
    : forward("input") && forward("input", () => undefined));
  assert.equal(selected("parent") === undefined, true);
  assert.match(current.budget.failure(), /projections require an exact positive result/u);
  assert.equal(selected("parent") === undefined, true);
});

test("a deferred projection cannot keep its collector's write capability alive", () => {
  const current = fixture();
  const selected = current.graph.fixedPoint((key, _read, emit, forward) => key === "input" ? emit(1)
    : forward("input", value => emit(value) ? [value] : undefined));
  assert.equal(selected("parent") === undefined, true);
  assert.match(current.budget.failure(), /writes require their active collector/u);
});

test("a deferred projection cannot use an expired borrowed relation view", () => {
  const current = fixture();
  const selected = current.graph.fixedPoint((key, read, emit, forward) => {
    if (key === "input") return emit(1);
    if (key === "borrowed") return forward("parent");
    const borrowed = read("borrowed");
    return borrowed !== undefined && forward("input", value => borrowed.has(value) ? [value] : []);
  });
  assert.throws(() => selected("parent"), /active collector/u);
  assert.match(current.budget.failure(), /active collector/u);
});

test("throwing projections unwind every unpublished edge before an exact retry", () => {
  const remaining = fail => {
    const current = fixture({ maximumTransportRows: 128 });
    const failure = new Error("projection failed");
    let throwing = fail;
    const selected = current.graph.fixedPoint((key, _read, emit, forward) => key === "input" ? emit(1)
      : forward("input", value => { if (throwing) throw failure; return [value + 1]; }));
    if (throwing) assert.throws(() => selected("parent"), error => error === failure);
    throwing = false;
    assert.deepEqual([...selected("parent")], [2]);
    assert.equal(current.budget.failure() === undefined, true);
    let rows = 0;
    while (current.budget.row()) rows += 1;
    return rows;
  };
  assert.equal(remaining(true), remaining(false), "a failed projection retains no partial wave or transfer history");
});

for (const limits of [{ maximumSteps: 64 }, { maximumTransportRows: 32 }]) {
  test(`recursive projected growth preserves independent finite rejection ${JSON.stringify(limits)}`, () => {
    const current = fixture(limits);
    const selected = current.graph.fixedPoint((key, _read, emit, forward) =>
      emit(0) && forward(key, value => [value + 1]));
    assert.equal(selected("unbounded") === undefined, true);
    assert.match(current.budget.failure(), limits.maximumSteps === undefined ? /transport-row/u : /analysis-work/u);
    assert.equal(selected("unbounded") === undefined, true);
  });
}
