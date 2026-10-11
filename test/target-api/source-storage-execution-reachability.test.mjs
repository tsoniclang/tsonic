import assert from "node:assert/strict";
import test from "node:test";
import { createSourceStorageExecutionReachability } from "../../packages/target-api/dist/target-analysis/source-storage/execution-reachability.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/resource-budget.js";

function fixture(length = 16, maximumTransportRows = 128) {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows, maximumSteps: 4096 });
  const regions = Array.from({ length: length + 1 }, () => ({}));
  const calls = regions.slice(0, -1).map((region, index) => ({ region, candidate: { region: regions[index + 1] } }));
  let inspect = () => {}; let inspected = 0;
  const query = createSourceStorageExecutionReachability({ ast: { is: { IsNewExpression: () => false } } }, budget, {
    invocations: new Set(calls), accessorTargets: new Map(),
    regions: { enclosing: node => node.region, callable: node => [node.region], instance: () => [] },
    invocationImplementations: node => { inspected += 1; inspect(node); return new Set([node.candidate]); },
  });
  return { query, budget, calls, regions, inspected: () => inspected, inspect: callback => { inspect = callback; } };
}

test("exact execution reachability charges each completed region once and only the live pending frontier", () => {
  const current = fixture(16, 83);
  const target = current.regions[16];
  assert.equal(current.query.region(current.regions[0], target), true, "every original call edge reaches the demanded region");
  for (const call of current.calls) assert.equal(current.query.invocation(call, target), true, "exact indexed invocation survives");
  assert.equal(current.query.region({}, target), false, "an unrelated original region is not imported");
  assert.equal(current.inspected() === 16 && current.budget.failure() === undefined, true,
    "one complete checked index and result are reused under the same eighty-three live-row ceiling");
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
