import assert from "node:assert/strict";
import test from "node:test";
import { createTargetGraphComponentQuery } from "./graph-component-query.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "./source-storage/model/resource-budget.js";

test("one component query shares complete cyclic results and never reloads a cached suffix", () => {
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const edges = new Map([[1, new Set([2])], [2, new Set([1, 3])], [3, new Set<number>()]]);
  let loads = 0;
  const select = createTargetGraphComponentQuery<number, number, ReadonlySet<number>>(vertex => {
    loads += 1;
    return { data: vertex, neighbours: edges.get(vertex)! };
  }, members => new Set(members.flatMap(member => [member.data, ...member.successors.flatMap(values => [...values])])), budget);
  const root = select(1);
  assert.equal(root?.size === 3 && root.has(1) && root.has(2) && root.has(3), true);
  assert.equal(select(2) === root, true, "all cycle roots use the identical completed component");
  assert.equal(select(3)?.size === 1 && select(3)?.has(3), true);
  assert.equal(loads, 3, "all later roots are completed cache reads");
  assert.equal(budget.usage().rows, 3, "only the three component index rows are owned by the generic traversal");
});

test("missing and throwing inputs roll back every in-flight component index", () => {
  for (const throwing of [false, true]) {
    const budget = createSourceStorageBudget(defaultSourceStorageLimits);
    let available = false;
    const expected = new Error("exact graph premise unavailable");
    const select = createTargetGraphComponentQuery<number, number, readonly number[]>(vertex => {
      if (vertex === 2 && !available) {
        if (throwing) throw expected;
        return undefined;
      }
      return { data: vertex, neighbours: new Set(vertex === 1 ? [2] : []) };
    }, members => Object.freeze(members.map(member => member.data)), budget);
    if (throwing) assert.throws(() => select(1), error => error === expected);
    else assert.equal(select(1) === undefined, true);
    assert.equal(budget.usage().rows, 0, "failed waves retain neither root nor completed-child indexes");
    available = true;
    assert.equal(select(1)?.[0], 1, "the later exact graph can be selected without stale recursion state");
    assert.equal(select(2)?.[0], 2);
    assert.equal(budget.failure() === undefined, true);
  }
});

test("the generic component owner charges independent work and memory failures without cache bypass", () => {
  for (const limits of [{ maximumSteps: 1 }, { maximumTransportRows: 1 }]) {
    const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, ...limits });
    const select = createTargetGraphComponentQuery<number, number, number>(vertex => ({ data: vertex,
      neighbours: new Set(vertex === 1 ? [2] : []) }), members => members[0]!.data, budget);
    assert.equal(select(1) === undefined, true);
    assert.equal(budget.failure() !== undefined, true);
    assert.equal(budget.usage().rows, 0, "the rejected wave releases every index row it actually acquired");
    assert.equal(select(2) === undefined, true, "sticky failure cannot be bypassed by an atomic or cached component");
  }
});
