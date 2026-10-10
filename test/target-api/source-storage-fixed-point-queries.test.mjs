import assert from "node:assert/strict";
import test from "node:test";
import { createSourceStorageGraphQueries } from "../../packages/target-api/dist/target-analysis/source-storage/graph-queries.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/resource-budget.js";

function fixture(limits = {}) {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumSteps: 16_384,
    maximumTransportRows: 2048, ...limits });
  return { budget, graph: createSourceStorageGraphQueries(budget) };
}

function copy(values, add) {
  if (values === undefined) return false;
  for (const value of values) if (!add(value)) return false;
  return true;
}

test("sealed fixed-point families complete cyclic storage dependencies before publishing stable cached identities", () => {
  const { budget, graph } = fixture();
  const first = {}; const second = {};
  let calls = 0;
  const select = graph.fixedPoint((key, read, add) => {
    calls += 1;
    return add(key === "first" ? first : second) && copy(read(key === "first" ? "second" : "first"), add);
  });
  graph.seal();
  const selected = select("first");
  assert.equal(selected?.size === 2 && selected.has(first) && selected.has(second), true, "both exact cyclic producers complete");
  const completedCalls = calls;
  assert.equal(select("first") === selected, true, "cache retains the exact completed evidence");
  const peer = select("second");
  assert.equal(peer?.size === 2 && peer.has(first) && peer.has(second), true, "the entire family completes");
  assert.equal(calls === completedCalls && budget.failure() === undefined, true);
});

test("fixed-point cells stay isolated by canonical key and propagate deep dependencies without recursive stack growth", () => {
  const { budget, graph } = fixture();
  const left = {}; const right = {};
  const select = graph.fixedPoint((key, read, add) => key === left || key === right ? add(key) : copy(read(key.parent), add));
  graph.seal();
  const selected = select(Array.from({ length: 80 }).reduce(parent => ({ parent }), left));
  const independent = select({ parent: right });
  assert.equal(selected?.size === 1 && selected.has(left) && !selected.has(right), true);
  assert.equal(independent?.size === 1 && independent.has(right) && !independent.has(left), true);
  assert.equal(budget.failure() === undefined, true);
});

test("completed empty fixed points are actual empty evidence, not unfinished or broad fallback selections", () => {
  const { budget, graph } = fixture();
  const select = graph.fixedPoint((key, read, add) => copy(read(key), add));
  graph.seal();
  const selected = select("empty-cycle");
  assert.equal(selected?.size === 0, true);
  assert.equal(select("empty-cycle") === selected && budget.failure() === undefined, true);
});

test("fixed-point query rejects unsealed graphs and keeps ordinary unfinished-query protection unchanged", () => {
  const { budget, graph } = fixture();
  const select = graph.fixedPoint((key, _read, add) => add(key));
  assert.equal(select("unsealed") === undefined, true);
  assert.match(budget.failure(), /sealed graph/u);
  assert.equal(select("unsealed") === undefined, true);
  const original = fixture();
  const recursive = original.graph.query(key => recursive(key));
  assert.equal(recursive("unfinished") === undefined, true);
  assert.match(original.budget.failure(), /unfinished result/u);
});

test("public reentry and escaped internal readers cannot expose a provisional fixed-point result", () => {
  const current = fixture();
  const select = current.graph.fixedPoint(key => select(key) !== undefined);
  current.graph.seal();
  assert.equal(select("reentrant") === undefined, true);
  assert.match(current.budget.failure(), /unfinished family/u);
  const borrowed = fixture();
  let escaped;
  const checked = borrowed.graph.fixedPoint((key, read, add) => { escaped = read; return add(key); });
  borrowed.graph.seal();
  assert.equal(checked("complete")?.has("complete"), true);
  assert.equal(escaped("foreign") === undefined, true);
  assert.match(borrowed.budget.failure(), /active collector/u);
  assert.equal(checked("complete") === undefined, true);
});

test("fixed-point family rejects missing and retracting transfers rather than certifying partial closure", () => {
  const missing = fixture();
  const absent = missing.graph.fixedPoint(() => false);
  missing.graph.seal();
  assert.equal(absent("missing") === undefined, true);
  assert.match(missing.budget.failure(), /positive result/u);
  const retracting = fixture();
  const selected = retracting.graph.fixedPoint((key, read, add) => read(key).size === 0 ? add("first") : true);
  retracting.graph.seal();
  assert.equal(selected("retracting") === undefined, true);
  assert.match(retracting.budget.failure(), /retract/u);
  assert.equal(selected("retracting") === undefined, true);
});

for (const operation of ["read", "add"]) {
  test(`a ${operation} from an earlier evaluation cannot become valid when the same cell is evaluated again`, () => {
    const { budget, graph } = fixture();
    let earlier;
    const select = graph.fixedPoint((key, read, add) => {
      if (earlier !== undefined) {
        assert.equal(operation === "read" ? earlier(key) === undefined : earlier(key) === false, true);
        return true;
      }
      earlier = operation === "read" ? read : add;
      return copy(read(key), add) && add(key);
    });
    graph.seal();
    assert.equal(select("replayed") === undefined, true);
    assert.match(budget.failure(), /active collector/u);
  });
}

for (const [name, limits, recursive] of [
  ["cells and dependency rows", { maximumTransportRows: 4 }, true],
  ["temporary result rows", { maximumTransportRows: 4 }, false],
  ["work", { maximumSteps: 1 }, true],
]) {
  test(`fixed-point ${name} exhaustion cannot publish or replay a completed family`, () => {
    const { budget, graph } = fixture(limits);
    const select = graph.fixedPoint((key, read, add) => add(key) && (!recursive || copy(read(key), add)));
    graph.seal();
    assert.equal(select("bounded") === undefined, true);
    assert.equal(budget.failure() !== undefined, true);
    assert.equal(select("bounded") === undefined, true);
  });
}

test("fixed-point finalization releases scratch dependencies but retains charged completed cells and values", () => {
  const { budget, graph } = fixture({ maximumTransportRows: 16 });
  const select = graph.fixedPoint((key, read, add) => add(key) && copy(read(key), add));
  graph.seal();
  assert.equal(select("original")?.has("original"), true);
  let remaining = 0;
  while (budget.row()) remaining += 1;
  assert.equal(remaining === 13, true, "one cell, one completed read-only view and one value remain");
});

test("collector exceptions discard unfinished cells and restore the idle query owner", () => {
  const { budget, graph } = fixture({ maximumTransportRows: 16 });
  let rejected = true;
  const failure = new Error("expected collector failure");
  const select = graph.fixedPoint((key, read, add) => {
    read(key);
    if (rejected) throw failure;
    return add(key);
  });
  graph.seal();
  assert.throws(() => select("original"), error => error === failure);
  rejected = false;
  assert.equal(select("original")?.has("original") && budget.failure() === undefined, true);
});

test("private values are immutable collector-scoped borrows, including retained iterators and forEach views", () => {
  for (const access of ["size", "has", "entries", "keys", "values", "iterate", "forEach", "next"]) {
    const { budget, graph } = fixture();
    let borrowed; let iterator;
    const sizes = [];
    const select = graph.fixedPoint((key, read, add) => {
      borrowed = read(key);
      sizes.push(borrowed.size);
      assert.equal(Object.isFrozen(borrowed) && borrowed.add === undefined, true);
      borrowed.forEach((_value, _key, view) => assert.equal(view === borrowed, true));
      iterator = borrowed.values();
      return copy(borrowed, add) && add(key);
    });
    graph.seal();
    const selected = select("original");
    assert.equal(sizes.length === 2 && sizes[0] === 0 && sizes[1] === 1, true);
    assert.equal(Object.isFrozen(selected) && selected.add === undefined, true);
    assert.throws(() => Set.prototype.add.call(selected, "corrupt"), TypeError);
    const use = () => {
      if (access === "size") return borrowed.size;
      if (access === "has") return borrowed.has("original");
      if (access === "iterate") return [...borrowed];
      if (access === "forEach") return borrowed.forEach(() => {});
      if (access === "next") return iterator.next();
      return borrowed[access]();
    };
    assert.throws(use, /active collector/u);
    assert.equal(selected.size === 1 && selected.has("original"), true, "completed evidence is unchanged");
    assert.equal(select("original") === undefined && budget.failure() !== undefined, true);
  }
});

test("positive growth uses linear live rows rather than retaining every approximation snapshot", () => {
  const { budget, graph } = fixture({ maximumTransportRows: 128 });
  const select = graph.fixedPoint((key, read, add) => {
    const previous = read(key);
    return copy(previous, add) && (previous.size === 32 || add(previous.size));
  });
  graph.seal();
  const selected = select("growing");
  assert.equal(selected?.size === 32 && [...selected].every((value, index) => value === index), true);
  assert.equal(budget.failure() === undefined, true, "retired borrows consume no live history");
});

test("each distinct result is reserved before insertion and duplicate entries have no second cost", () => {
  const { budget, graph } = fixture({ maximumTransportRows: 6 });
  let first; let duplicate; let overflow;
  const select = graph.fixedPoint((_key, _read, add) => {
    first = add("first");
    duplicate = add("first");
    const second = add("second");
    overflow = add("third");
    return first && duplicate && second && overflow;
  });
  graph.seal();
  assert.equal(select("bounded") === undefined, true);
  assert.equal(first === true && duplicate === true && overflow === false, true, "the third entry is rejected before insertion");
  assert.match(budget.failure(), /transport-row/u);
});

test("late dependencies and shared diamonds complete before any cached evidence is published", () => {
  const { budget, graph } = fixture();
  const original = {};
  let calls = 0;
  const select = graph.fixedPoint((key, read, add) => {
    calls += 1;
    if (key === "seed") return add(original);
    if (key === "late") return copy(read("seed"), add);
    const seeded = read("seed");
    return copy(seeded, add) && (seeded.size === 0 || copy(read("late"), add));
  });
  graph.seal();
  const selected = select("diamond");
  assert.equal(selected?.size === 1 && selected.has(original), true);
  const completedCalls = calls;
  assert.equal(select("late")?.has(original) && select("seed")?.has(original), true);
  assert.equal(calls === completedCalls && budget.failure() === undefined, true);
});

test("whole-family finalization failure preserves earlier evidence and never publishes pending cells", () => {
  const solve = maximumSteps => {
    const base = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumSteps });
    let steps = 0;
    const budget = { ...base, step: () => { steps += 1; return base.step(); } };
    const graph = createSourceStorageGraphQueries(budget);
    const select = graph.fixedPoint((key, read, add) => add(key) && (key === "stable" || copy(read(key === "left" ? "right" : "left"), add)));
    graph.seal();
    const stable = select("stable");
    const selected = select("left");
    return { budget, select, stable, selected, steps };
  };
  const measured = solve(defaultSourceStorageLimits.maximumSteps);
  assert.equal(measured.selected?.size === 2 && measured.budget.failure() === undefined, true);
  const exhausted = solve(measured.steps - 1);
  assert.equal(exhausted.selected === undefined && exhausted.budget.failure() !== undefined, true);
  assert.equal(exhausted.stable.size === 1 && exhausted.stable.has("stable"), true);
  assert.equal(exhausted.select("right") === undefined && exhausted.select("stable") === undefined, true);
});
