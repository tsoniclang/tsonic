import assert from "node:assert/strict";
import test from "node:test";
import { createSourceStorageGraphQueries } from "../../packages/target-api/dist/target-analysis/source-storage/graph-queries.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/resource-budget.js";

const subject = (node = {}, kind = "value") => ({ node, kind, projection: [] });

test("linear inherited reads reuse the original dependency set within unchanged finite work and storage", () => {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumSteps: 512, maximumTransportRows: 517 });
  const graph = createSourceStorageGraphQueries(budget);
  const input = subject();
  const query = graph.query(depth => {
    const values = depth === 0 ? new Set([input]) : query(depth - 1);
    graph.read(input);
    return values === undefined ? undefined : new Set(values);
  });
  const original = query(128);
  assert.equal(original?.has(input), true, "all128inherited levels retain the exact checked input under512steps and517rows");
  assert.equal(budget.failure() === undefined, true, "no larger peak, dropped read or work exemption");
  assert.equal(budget.row(), false, "all517actual construction and retained evidence cells remain charged");
  assert.match(budget.failure(), /transport-row/u);
  assert.equal(query(128) === undefined, true, "an existing cached result cannot bypass permanent exhaustion");
});

test("read-set aliases preserve transitive mutations, kind separation and final dependency lifetime", () => {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumSteps: 4096, maximumTransportRows: 261 });
  const graph = createSourceStorageGraphQueries(budget);
  const input = subject();
  let revision = 0;
  const query = graph.query(depth => {
    const values = depth === 0 ? new Set([revision]) : query(depth - 1);
    graph.read(input);
    return values === undefined ? undefined : new Set(values);
  });
  const original = query(64);
  assert.equal(original?.has(0), true);
  graph.invalidate(subject(input.node, "return"));
  assert.equal(query(64) === original, true, "an unrelated kind cannot invalidate the aliased read");
  revision = 1;
  graph.invalidate({ ...input, projection: [{ kind: "array-element" }] });
  const updated = query(64);
  assert.equal(updated !== original && updated?.has(1), true, "backing mutation invalidates every original parent");
  graph.seal();
  assert.equal(query(64) === updated, true, "completed result identity survives final sealing");
  assert.equal(budget.failure() === undefined, true);
  let remaining = 0;
  while (budget.row()) remaining += 1;
  assert.equal(remaining, 131, "all130retained cells survive and131construction-only cells are released");
});

test("branched query dependencies keep direct reads and observe either independently changing branch", () => {
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const graph = createSourceStorageGraphQueries(budget);
  const left = subject();
  const right = subject();
  const revisions = new Map([[left, 0], [right, 1]]);
  const leaf = graph.query(key => { graph.read(key); return new Set([revisions.get(key)]); });
  const pair = graph.query(() => {
    const values = new Set([...leaf(left), ...leaf(right)]);
    graph.read(left);
    graph.read(right);
    return values;
  });
  const root = graph.query(key => { const values = pair(key); graph.read(left); return new Set(values); });
  const first = root("selected");
  assert.equal(first?.has(0) && first.has(1), true);
  revisions.set(right, 2);
  graph.invalidate(right);
  const second = root("selected");
  assert.equal(second !== first && second?.has(0) && second.has(2) && !second.has(1), true, "right mutation reaches the same root");
  revisions.set(left, 3);
  graph.invalidate(left);
  const third = root("selected");
  assert.equal(third !== second && third?.has(3) && third.has(2) && !third.has(0), true, "left mutation remains independent");
  assert.equal(budget.failure() === undefined, true);
});
