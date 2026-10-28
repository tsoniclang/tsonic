import assert from "node:assert/strict";
import test from "node:test";
import { createSourceStorageContextFootprints } from "../../packages/target-api/dist/target-analysis/source-storage/graph/context-footprints.js";
import { createSourceStorageKeyEncoder } from "../../packages/target-api/dist/target-analysis/source-storage/graph/key-encoding.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";
import { createSourceStorageSubjects } from "../../packages/target-api/dist/target-analysis/source-storage/model/subjects.js";

function chain(size) {
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const subject = createSourceStorageSubjects(budget.subject, budget.reject);
  const nodes = Array.from({ length: size }, () => subject({}));
  const port = subject({}, "input");
  let reads = 0;
  const indexes = new Map(nodes.map((node, index) => [node, index]));
  const footprints = createSourceStorageContextFootprints(budget, node => {
    reads += 1;
    return new Set([nodes[indexes.get(node) + 1] ?? port]);
  }, () => undefined);
  return { budget, nodes, port, footprints, reads: () => reads };
}

test("every completed suffix shares one exact immutable footprint without another graph walk", () => {
  const current = chain(512);
  const selected = current.footprints.select(current.nodes[0]);
  assert.equal(selected?.ports.size === 1 && selected.ports.has(current.port), true);
  assert.equal(current.reads(), 512, "each source dependency is read once");
  const retained = current.budget.usage().rows;
  for (const node of [...current.nodes].reverse()) assert.equal(current.footprints.select(node) === selected, true);
  assert.equal(current.reads(), 512, "all suffix queries are exact completed lookups");
  assert.equal(current.budget.usage().rows, retained, "cache reads allocate no index or payload rows");
  assert.equal(retained, 515, "513 subject indexes share a two-row one-port footprint");
  assert.equal(current.budget.failure() === undefined, true);
});

test("nested context closures scale by their actual nodes rather than repeated transitive prefixes", () => {
  const measurements = [256, 512, 1024].map(size => {
    const current = chain(size);
    for (const node of current.nodes) assert.equal(current.footprints.select(node)?.ports.has(current.port), true);
    assert.equal(current.budget.failure() === undefined, true);
    return { ...current.budget.usage(), nodes: size + 1 };
  });
  for (let index = 1; index < measurements.length; index += 1) {
    const previous = measurements[index - 1];
    const selected = measurements[index];
    const ratio = 1.25 * selected.nodes / previous.nodes;
    assert.equal(selected.steps / previous.steps <= ratio, true, "charged work scales with the genuinely nested chain");
    assert.equal(selected.peakRows / previous.peakRows <= ratio, true, "peak live rows scale with the same nested chain");
  }
});

test("all roots of a source cycle share the complete component, including every external port", () => {
  const current = chain(256);
  const second = current.nodes[127];
  const edges = new Map(current.nodes.map((node, index) => [node, new Set([current.nodes[(index + 1) % current.nodes.length]])]));
  edges.get(second).add(current.port);
  const footprints = createSourceStorageContextFootprints(current.budget, node => edges.get(node), () => undefined);
  const selected = footprints.select(current.nodes[0]);
  assert.equal(selected?.ports.size === 1 && selected.ports.has(current.port), true);
  for (const node of current.nodes) assert.equal(footprints.select(node) === selected, true, "no root inherits an unfinished SCC prefix");
  assert.equal(current.budget.failure() === undefined, true);
});

test("an incomplete or throwing context wave publishes neither child indexes nor partial footprints", () => {
  for (const throwing of [false, true]) {
    const current = chain(16);
    const expected = new Error("checked dependency unavailable");
    let available = false;
    const indexes = new Map(current.nodes.map((node, index) => [node, index]));
    const footprints = createSourceStorageContextFootprints(current.budget, node => {
      const index = indexes.get(node);
      if (index === 8 && !available) {
        if (throwing) throw expected;
        return undefined;
      }
      return new Set([current.nodes[index + 1] ?? current.port]);
    }, () => undefined);
    if (throwing) assert.throws(() => footprints.select(current.nodes[0]), error => error === expected);
    else assert.equal(footprints.select(current.nodes[0]) === undefined, true);
    assert.equal(current.budget.usage().rows, 0, "unpublished components release every owned row");
    available = true;
    assert.equal(footprints.select(current.nodes[0])?.ports.has(current.port), true, "a later exact completed wave is not poisoned");
    assert.equal(current.budget.failure() === undefined, true);
  }
});

test("canonical handles turn nested shared keys into bounded constant-size references", () => {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 8192, maximumSteps: 8192 });
  const encoder = createSourceStorageKeyEncoder(budget);
  let selected = encoder.intern(["leaf"]);
  for (let depth = 0; depth < 1024; depth += 1) selected = encoder.intern(["pair", selected, selected]);
  assert.equal(selected !== undefined, true, "the full shared key DAG fits without transitive re-encoding");
  const before = budget.usage();
  const key = encoder.encode(selected);
  for (let repeat = 0; repeat < 100; repeat += 1) assert.equal(encoder.encode(selected) === key, true);
  assert.equal(budget.usage().rows, before.rows, "reading retained handles creates no further representation");
  assert.equal(budget.usage().steps - before.steps, 101, "one bounded identity check per handle read");
  assert.equal(budget.failure() === undefined, true);
});
