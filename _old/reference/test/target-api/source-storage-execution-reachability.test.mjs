import assert from "node:assert/strict";
import test from "node:test";
import { createSourceStorageExecutionReachability } from "../../packages/target-api/dist/target-analysis/source-storage/scoped/execution-reachability.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";

function fixture(length = 16, maximumTransportRows = 128) {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows, maximumSteps: 4096 });
  const regions = Array.from({ length: length + 1 }, () => ({}));
  const calls = regions.slice(0, -1).map((region, index) => ({ region, candidate: { region: regions[index + 1] } }));
  let inspect = () => {}; let inspected = 0;
  const query = createSourceStorageExecutionReachability({ ast: {
    is: { IsNewExpression: () => false, IsCallExpression: () => false },
  } }, budget, {
    invocations: new Set(calls), accessorTargets: new Map(),
    pointerInvocations: new Set(), invocationEffects: new Map(),
    regions: { enclosing: node => node.region, callable: node => [node.region], instance: () => ({ regions: [], exact: true }) },
    callbackEntriesFor: () => [], callbackInputFrontiersFor: () => [],
    invocationImplementations: node => { inspected += 1; inspect(node); return new Set([node.candidate]); },
    hasOnlySourceImplementations: () => true,
  });
  return { query, budget, calls, regions, inspected: () => inspected, inspect: callback => { inspect = callback; } };
}

test("exact execution reachability charges each completed region once and only the live pending frontier", () => {
  const current = fixture(16, 115);
  const target = current.regions[16];
  assert.equal(current.query.region(current.regions[0], target), true, "every original call edge reaches the demanded region");
  for (const call of current.calls) assert.equal(current.query.invocation(call, target), true, "exact indexed invocation survives");
  assert.equal(current.query.region({}, target), false, "an unrelated original region is not imported");
  assert.equal(current.inspected() === 16 && current.budget.failure() === undefined, true,
    "96 bidirectional index rows plus 18 selected rows and one live frontier row suffice");
});

test("forward and reverse execution selections share one exact bidirectional index", () => {
  const current = fixture(16, 133);
  const origin = current.regions[0];
  const target = current.regions[16];
  const reachable = current.query.reachableFrom(origin);
  assert.equal(reachable !== undefined && reachable.size === 17 && current.regions.every(region => reachable.has(region)), true,
    "the entry and every transitive callee retain exact identity");
  assert.equal(current.query.region(origin, target), true, "reverse selection remains independent of the forward cache");
  assert.equal(current.query.reachableFrom(origin) === reachable, true, "forward evidence is interned by entry region");
  assert.equal(current.inspected(), 16, "both directions initialize each original invocation only once");
  assert.equal(current.budget.failure() === undefined, true, "one index, both retained selections and only a live frontier fit");
});

for (const direction of ["callers", "callees"]) {
  test(`${direction} execution traversal rejects one row below its exact live requirement`, () => {
    const current = fixture(16, 114);
    const selected = direction === "callers" ? current.query.region(current.regions[0], current.regions[16])
      : current.query.reachableFrom(current.regions[0]);
    assert.equal(selected === undefined, true, "no partial selection is published at the live row ceiling");
    assert.match(current.budget.failure(), /transport-row/u);
  });
}

test("forward execution retains calls, accessors, constructor initializers and cycles without unrelated regions", () => {
  const [entry, helper, accessor, constructor, initializer, unrelated, outside] = Array.from({ length: 7 }, () => ({}));
  const calls = [
    { region: entry, target: helper },
    { region: accessor, target: constructor, initialize: initializer },
    { region: constructor, target: helper },
    { region: unrelated, target: outside },
  ];
  const access = { region: helper, target: accessor };
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumSteps: 256, maximumTransportRows: 128 });
  const query = createSourceStorageExecutionReachability({ ast: {
    is: { IsNewExpression: node => node.initialize !== undefined, IsCallExpression: () => false,
      IsExpressionStatement: () => false, IsReturnStatement: () => false, IsThrowStatement: () => false,
      IsIfStatement: () => false, IsWhileStatement: () => false, IsDoStatement: () => false,
      IsForOfStatement: () => false, IsForInStatement: () => false,
      IsPropertyAccessExpression: () => false, IsElementAccessExpression: () => false },
    as: { AsNewExpression: node => ({ Expression: node.target }) },
  }, navigation: { isProjectDeclaration: node => calls.includes(node) } }, budget, {
    invocations: new Set(calls), accessorTargets: new Map([[access, [access.target]]]),
    pointerInvocations: new Set(), invocationEffects: new Map(),
    regions: { enclosing: node => node.region, callable: node => [node],
      instance: node => ({ regions: [{ node: node.initialize }], exact: true }) },
    callbackEntriesFor: () => [], callbackInputFrontiersFor: () => [],
    invocationImplementations: node => new Set([node.target]),
    hasOnlySourceImplementations: () => true,
  });
  const reachable = query.reachableFrom(entry);
  assert.equal(reachable !== undefined && reachable.size === 5 &&
    [entry, helper, accessor, constructor, initializer].every(region => reachable.has(region)), true, "all native execution edge kinds survive");
  assert.equal(query.invocation(calls[1], initializer), true, "constructor invocation retains its initializer entry");
  assert.equal(query.region(unrelated, initializer), false, "unrelated callers are not imported");
  assert.equal(query.region(helper, entry), false, "forward direction never leaks into reverse selection");
  assert.equal(budget.failure() === undefined, true);
});

test("unindexed execution calls reject instead of certifying an empty selected region", () => {
  const current = fixture(1);
  assert.equal(current.query.invocation({}, current.regions[1]) === undefined, true);
  assert.match(current.budget.failure(), /indexed original invocation/u);
  assert.equal(current.query.region(current.regions[0], current.regions[1]) === undefined, true, "failure stays sticky");
});

test("execution graph exceptions release unpublished evidence and retry every original edge", () => {
  const current = fixture(2);
  const failure = new Error("exact checked execution failure");
  current.inspect(node => { if (node === current.calls[1]) throw failure; });
  assert.throws(() => current.query.region(current.regions[0], current.regions[2]), error => error === failure);
  current.inspect(() => {});
  assert.equal(current.query.region(current.regions[0], current.regions[2]), true);
  assert.equal(current.inspected() === 4 && current.budget.failure() === undefined, true, "no partially initialized graph is reused");
});

test("unfinished execution graph reentry fails closed before publishing any reachability result", () => {
  const current = fixture(1);
  current.inspect(() => assert.equal(current.query.region(current.regions[0], current.regions[1]) === undefined, true));
  assert.equal(current.query.region(current.regions[0], current.regions[1]) === undefined, true);
  assert.match(current.budget.failure(), /unfinished call graph/u);
});
