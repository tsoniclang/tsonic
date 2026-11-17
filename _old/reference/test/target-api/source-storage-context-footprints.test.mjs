import assert from "node:assert/strict";
import test from "node:test";
import { createSourceStorageContextFootprints } from "../../packages/target-api/dist/target-analysis/source-storage/graph/context-footprints.js";
import { createSourceStorageSubjects } from "../../packages/target-api/dist/target-analysis/source-storage/model/subjects.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";

function fixture(limits = {}) {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, ...limits });
  const subject = createSourceStorageSubjects(budget.subject, budget.reject);
  const inputs = new Map();
  let reads = 0;
  const ports = createSourceStorageContextFootprints(budget, selected => {
    reads += 1;
    return inputs.get(selected) ?? new Set();
  }, () => undefined);
  const parameter = () => subject({}, "input");
  return { budget, subject, parameter, inputs, ports, reads: () => reads };
}

test("independent context roots reuse every completed suffix within the original finite work bound", () => {
  const { subject, parameter, inputs, ports, budget, reads } = fixture({ maximumSteps: 4_096 });
  const chain = Array.from({ length: 256 }, () => subject({}));
  const port = parameter();
  for (const [index, node] of chain.entries()) inputs.set(node, new Set([chain[index + 1] ?? port]));
  const roots = Array.from({ length: 32 }, () => subject({}));
  for (const [index, root] of roots.entries()) inputs.set(root, new Set([chain[index * 8]]));
  const selected = ports.select(roots[0]);
  assert.equal(selected?.ports.size === 1 && selected.ports.has(port), true, "the complete original formal relation");
  for (const root of [...roots, ...chain]) assert.equal(ports.select(root) === selected, true,
    "all completed roots and suffixes share the identical immutable relation");
  assert.equal(reads(), 288, "each non-port source node is loaded once, not once per query");
  assert.equal(budget.failure() === undefined, true, "near-linear traversal fits the original work cap");
  assert.equal(budget.usage().rows, 291, "289 exact subject indexes plus the single two-row footprint");
});

test("finite row exhaustion is not mislabeled as an invalid positive reservation", () => {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 4 });
  const rows = budget.createRows();
  assert.equal(rows.add(4), true, "the first valid reservation owns the complete finite capacity");
  assert.equal(rows.add(1), false, "an individually valid reservation beyond the live total fails atomically");
  assert.equal(budget.failure(), "Source storage transport exceeds its finite transport-row budget.");
  assert.equal(budget.usage().rows, 4, "a rejected reservation adds no rows and preserves existing ownership");
  rows.release();
  assert.equal(budget.usage().rows, 0, "the original owner releases only its own retained rows");
});

test("missing contextual evidence cannot become an empty completed port relation", () => {
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const subject = createSourceStorageSubjects(budget.subject, budget.reject);
  const root = subject({});
  let available = false;
  const ports = createSourceStorageContextFootprints(budget, () => available ? new Set() : undefined, () => undefined);
  assert.equal(ports.select(root)?.ports === undefined, true, "unavailable dependencies are not published as complete");
  available = true;
  assert.equal(ports.select(root)?.ports?.size === 0, true, "an independent later exact empty relation remains queryable");
  assert.equal(budget.failure() === undefined, true);
});

test("complete first-port relations preserve exact source subjects and stop at selected formal boundaries", () => {
  const { subject, parameter, inputs, ports, budget } = fixture();
  const root = subject({});
  const left = parameter();
  const beyond = parameter();
  const receiver = subject({}, "receiver");
  const projected = subject(left.node, "input", [{ kind: "tuple-element", index: 1 }]);
  inputs.set(root, new Set([left, receiver, projected]));
  inputs.set(left, new Set([beyond]));
  const selected = ports.select(root)?.ports;
  assert.equal(selected.size === 3 && selected.has(left) && selected.has(receiver) && selected.has(projected), true);
  assert.equal(selected.has(beyond), false, "port instantiation owns unbound continuation, not this source segment");
  assert.equal(ports.select(root)?.ports === selected, true, "one complete immutable source relation");
  assert.equal(budget.failure() === undefined, true);
});

test("cyclic source segments retain every reachable port without an unfinished empty observation", () => {
  const { subject, parameter, inputs, ports, budget } = fixture();
  const root = subject({});
  const next = subject({});
  const port = parameter();
  inputs.set(root, new Set([next]));
  inputs.set(next, new Set([root, port]));
  const selected = ports.select(root)?.ports;
  assert.equal(selected.size === 1 && selected.has(port), true);
  const independent = subject({});
  inputs.set(independent, new Set([independent]));
  assert.equal(ports.select(independent)?.ports.size === 0, true, "a fully traversed port-free cycle is actually empty");
  assert.equal(ports.select(next)?.ports.has(port), true, "a second root cannot inherit an unfinished cycle result");
  assert.equal(budget.failure() === undefined, true);
});

test("only complete retained relations survive after the temporary traversal frontier releases", () => {
  const { subject, parameter, inputs, ports, budget, reads } = fixture({ maximumTransportRows: 16 });
  const root = subject({});
  const chain = Array.from({ length: 10 }, () => subject({}));
  const port = parameter();
  inputs.set(root, new Set([chain[0]]));
  for (const [index, current] of chain.entries()) inputs.set(current, new Set([chain[index + 1] ?? port]));
  const selected = ports.select(root)?.ports;
  assert.equal(selected.size === 1 && selected.has(port), true, "full demanded relation fits its real peak");
  const before = reads();
  for (let index = 0; index < 50; index += 1) assert.equal(ports.select(root)?.ports === selected, true);
  assert.equal(reads() === before, true, "selected contexts do not traverse this source segment again");
  const remaining = budget.createRows();
  assert.equal(budget.usage().rows, 14, "twelve exact subject indexes share one two-row completed footprint");
  assert.equal(remaining.add(2), true, "all remaining capacity survives the completed component cache");
  remaining.release();
  assert.equal(budget.failure() === undefined, true);
});

test("checker exceptions preserve identity and unwind all incomplete context-port rows", () => {
  const { subject, inputs, ports, budget } = fixture({ maximumTransportRows: 8 });
  const root = subject({});
  const expected = new Error("context dependency failed");
  inputs.set(root, { [Symbol.iterator]() { throw expected; } });
  let observed;
  try { ports.select(root)?.ports; } catch (error) { observed = error; }
  assert.equal(observed === expected, true);
  const remaining = budget.createRows();
  assert.equal(remaining.add(8), true, "no failed result or traversal row survives");
  remaining.release();
  assert.equal(budget.failure() === undefined, true);
});

test("fanout is reserved before any child is traversed and resource failure stays sticky", () => {
  const { subject, inputs, ports, budget } = fixture({ maximumTransportRows: 4 });
  const root = subject({});
  const children = Array.from({ length: 8 }, () => subject({}));
  let traversed = false;
  inputs.set(root, new Set(children));
  for (const child of children) inputs.set(child, { [Symbol.iterator]() { traversed = true; return [][Symbol.iterator](); } });
  assert.equal(ports.select(root)?.ports === undefined, true);
  assert.equal(traversed, false, "oversized queued fanout rejects before processing another child");
  assert.equal(budget.failure()?.includes("transport-row"), true);
  assert.equal(ports.select(children[0])?.ports === undefined, true);
});

test("a cached port relationship never bypasses an independently exhausted work budget", () => {
  const { parameter, ports, budget } = fixture({ maximumSteps: 3 });
  const port = parameter();
  assert.equal(ports.select(port)?.ports?.has(port), true, "two original work steps admit the complete first relation");
  assert.equal(ports.select(port)?.ports?.has(port), true, "the third step admits the cache read");
  assert.equal(ports.select(port)?.ports === undefined, true);
  assert.equal(budget.failure()?.includes("analysis-work"), true);
});

test("one completed context footprint retains locations and ports from the identical bounded traversal", () => {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 16 });
  const subject = createSourceStorageSubjects(budget.subject, budget.reject);
  const root = subject({});
  const location = subject({});
  const formal = subject({}, "input");
  const beyond = subject({});
  const inputs = new Map([[root, new Set([location])], [location, new Set([root, formal])], [formal, new Set([beyond])]]);
  let reads = 0;
  const footprints = createSourceStorageContextFootprints(budget, selected => {
    reads += 1;
    return inputs.get(selected) ?? new Set();
  }, selected => selected === location || selected === beyond ? "allocation" : undefined);
  const selected = footprints.select(root);
  assert.equal(selected?.ports.size === 1 && selected.ports.has(formal), true, "one exact formal boundary");
  assert.equal(selected?.locations.size === 1 && selected.locations.has(location), true, "no location beyond a selected port");
  assert.equal(reads === 2, true, "ports and locations do not repeat the same source walk");
  assert.equal(footprints.select(root) === selected && reads === 2, true, "only the complete relation is reused");
  const remaining = budget.createRows();
  assert.equal(budget.usage().rows, 8, "three subject indexes retain the port footprint and the exact cyclic component footprint");
  assert.equal(remaining.add(8), true, "the component indexes and payload sets are fully accounted");
  remaining.release();
  assert.equal(budget.failure() === undefined, true);
});

test("mutable binding contexts stop at the exact physical cell without erasing its separately selected values", () => {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 8, maximumSteps: 16 });
  const subject = createSourceStorageSubjects(budget.subject, budget.reject);
  const root = subject({});
  const cell = subject({});
  const writer = subject({}, "input");
  let reads = 0;
  const inputs = new Map([[root, new Set([cell])], [cell, new Set([writer])]]);
  const footprints = createSourceStorageContextFootprints(budget, selected => {
    reads += 1;
    return inputs.get(selected);
  }, selected => selected === cell ? "binding" : undefined);
  const selected = footprints.select(root);
  assert.equal(selected !== undefined && selected.locations.size === 1 && selected.locations.has(cell), true,
    "the exact captured cell is an environment dependency");
  assert.equal(selected.ports.size === 0 && reads === 1, true,
    "another writer's values are not bindings of this cell's reader");
  assert.equal(inputs.get(cell).has(writer), true, "the independent value relation remains unchanged");
  assert.equal(footprints.select(root) === selected && budget.failure() === undefined, true);
  const remaining = budget.createRows();
  assert.equal(budget.usage().rows, 4, "two subject indexes share the one completed physical-cell footprint");
  assert.equal(remaining.add(4), true, "no transient component or union rows survive");
  remaining.release();
});

test("a throwing location query cannot retain an unfinished footprint or its traversal rows", () => {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 4 });
  const subject = createSourceStorageSubjects(budget.subject, budget.reject);
  const root = subject({});
  const expected = new Error("exact physical dependency failed");
  let ready = false;
  const footprints = createSourceStorageContextFootprints(budget, () => new Set(), () => {
    if (!ready) throw expected;
    return "allocation";
  });
  assert.throws(() => footprints.select(root), error => error === expected);
  const remaining = budget.createRows();
  assert.equal(remaining.add(4), true, "the failed selection retains no rows");
  remaining.release();
  ready = true;
  assert.equal(footprints.select(root)?.locations.has(root), true, "a later exact completed query remains possible");
  assert.equal(budget.failure() === undefined, true);
});
