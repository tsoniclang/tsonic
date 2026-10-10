import assert from "node:assert/strict";
import test from "node:test";
import { createSourceStorageAncestorQuery } from "../../packages/target-api/dist/target-analysis/source-storage/ancestors.js";
import { createSourceStorageGraphQueries } from "../../packages/target-api/dist/target-analysis/source-storage/graph-queries.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/resource-budget.js";

const subject = () => Object.freeze({ node: {}, kind: "value", projection: Object.freeze([]) });

test("ancestry traversal is cycle-safe, exact and uses temporary rather than permanently retained closure rows", () => {
  const nodes = Array.from({ length: 100 }, subject);
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 200 });
  const select = createSourceStorageAncestorQuery(budget, node => new Set([nodes[(nodes.indexOf(node) + 1) % nodes.length]]));
  for (const root of nodes) {
    const values = [...select(root)];
    assert.equal(values.length === nodes.length && nodes.every(node => values.includes(node)), true);
    assert.equal(values[0] === root, true, "same original rooted traversal order");
  }
  assert.equal(budget.failure() === undefined, true, "all overlapping traversals fit the unchanged bounded live footprint");
});

test("ancestry admission preserves independent finite work and full-frontier resource protection", () => {
  const nodes = Array.from({ length: 100 }, subject);
  const broad = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 20 });
  const select = createSourceStorageAncestorQuery(broad, node => new Set(node === nodes[0] ? nodes : []));
  const values = [...select(nodes[0])];
  assert.equal(values.length < nodes.length, true);
  assert.match(broad.failure(), /transport-row/u, "fanout reserves before enqueueing, not only on a later pop");
  const work = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumSteps: 1 });
  [...createSourceStorageAncestorQuery(work, () => new Set([nodes[1]]))(nodes[0])];
  assert.match(work.failure(), /analysis-work/u);
});

test("early closure and throwing traversal release temporary ownership without losing the original failure", () => {
  const root = subject();
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 2 });
  const select = createSourceStorageAncestorQuery(budget, () => new Set());
  for (let attempt = 0; attempt < 32; attempt += 1) {
    for (const actual of select(root)) { assert.equal(actual === root, true); break; }
  }
  const expected = new Error("exact traversal failure");
  const throwing = createSourceStorageAncestorQuery(budget, () => { throw expected; });
  for (let attempt = 0; attempt < 32; attempt += 1) assert.throws(() => [...throwing(root)], error => error === expected);
  assert.equal([...select(root)][0] === root, true);
  assert.equal(budget.failure() === undefined, true);
});

test("derived selections retain every traversed dependency and invalidate only affected callers", () => {
  const root = subject();
  const middle = subject();
  const first = subject();
  const second = subject();
  const unrelated = subject();
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const graph = createSourceStorageGraphQueries(budget);
  let selected = first;
  const incoming = node => {
    graph.read(node);
    return new Set(node === root ? [middle] : node === middle ? [selected] : []);
  };
  const ancestors = createSourceStorageAncestorQuery(budget, incoming);
  const query = graph.query(node => new Set([...ancestors(node)].filter(value => incoming(value).size === 0)));
  const original = query(root);
  const independent = query(unrelated);
  assert.equal(original?.size === 1 && original.has(first), true);
  selected = second;
  graph.invalidate(middle);
  const updated = query(root);
  assert.equal(updated !== original && updated?.size === 1 && updated.has(second), true, "intermediate growth is authoritative");
  assert.equal(query(unrelated) === independent, true);
  graph.seal();
  assert.equal(query(root) === updated, true, "sealed completed query preserves exact retained result");
  assert.equal(budget.failure() === undefined, true);
});
