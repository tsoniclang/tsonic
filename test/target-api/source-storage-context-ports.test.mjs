import assert from "node:assert/strict";
import test from "node:test";
import { createSourceStorageContextPorts } from "../../packages/target-api/dist/target-analysis/source-storage/context-ports.js";
import { createSourceStorageSubjects } from "../../packages/target-api/dist/target-analysis/source-storage/subjects.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/resource-budget.js";

function fixture(limits = {}) {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, ...limits });
  const subject = createSourceStorageSubjects(budget.subject, budget.reject);
  const inputs = new Map();
  let reads = 0;
  const ports = createSourceStorageContextPorts(budget, selected => {
    reads += 1;
    return inputs.get(selected) ?? new Set();
  });
  const parameter = () => subject({}, "input");
  return { budget, subject, parameter, inputs, ports, reads: () => reads };
}

test("complete first-port relations preserve exact source subjects and stop at selected formal boundaries", () => {
  const { subject, parameter, inputs, ports, budget } = fixture();
  const root = subject({});
  const left = parameter();
  const beyond = parameter();
  const receiver = subject({}, "receiver");
  const projected = subject(left.node, "input", [{ kind: "tuple-element", index: 1 }]);
  inputs.set(root, new Set([left, receiver, projected]));
  inputs.set(left, new Set([beyond]));
  const selected = ports.firstPorts(root);
  assert.equal(selected.size === 3 && selected.has(left) && selected.has(receiver) && selected.has(projected), true);
  assert.equal(selected.has(beyond), false, "port instantiation owns unbound continuation, not this source segment");
  assert.equal(ports.firstPorts(root) === selected, true, "one complete immutable source relation");
  assert.equal(budget.failure() === undefined, true);
});

test("cyclic source segments retain every reachable port without an unfinished empty observation", () => {
  const { subject, parameter, inputs, ports, budget } = fixture();
  const root = subject({});
  const next = subject({});
  const port = parameter();
  inputs.set(root, new Set([next]));
  inputs.set(next, new Set([root, port]));
  const selected = ports.firstPorts(root);
  assert.equal(selected.size === 1 && selected.has(port), true);
  const independent = subject({});
  inputs.set(independent, new Set([independent]));
  assert.equal(ports.firstPorts(independent).size === 0, true, "a fully traversed port-free cycle is actually empty");
  assert.equal(ports.firstPorts(next).has(port), true, "a second root cannot inherit an unfinished cycle result");
  assert.equal(budget.failure() === undefined, true);
});

test("only complete retained relations survive after the temporary traversal frontier releases", () => {
  const { subject, parameter, inputs, ports, budget, reads } = fixture({ maximumTransportRows: 16 });
  const root = subject({});
  const chain = Array.from({ length: 10 }, () => subject({}));
  const port = parameter();
  inputs.set(root, new Set([chain[0]]));
  for (const [index, current] of chain.entries()) inputs.set(current, new Set([chain[index + 1] ?? port]));
  const selected = ports.firstPorts(root);
  assert.equal(selected.size === 1 && selected.has(port), true, "full demanded relation fits its real peak");
  const before = reads();
  for (let index = 0; index < 50; index += 1) assert.equal(ports.firstPorts(root) === selected, true);
  assert.equal(reads() === before, true, "selected contexts do not traverse this source segment again");
  const remaining = budget.createRows();
  assert.equal(remaining.add(14), true, "only the two completed relation rows are retained");
  remaining.release();
  assert.equal(budget.failure() === undefined, true);
});

test("checker exceptions preserve identity and unwind all incomplete context-port rows", () => {
  const { subject, inputs, ports, budget } = fixture({ maximumTransportRows: 8 });
  const root = subject({});
  const expected = new Error("context dependency failed");
  inputs.set(root, { [Symbol.iterator]() { throw expected; } });
  let observed;
  try { ports.firstPorts(root); } catch (error) { observed = error; }
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
  assert.equal(ports.firstPorts(root) === undefined, true);
  assert.equal(traversed, false, "oversized queued fanout rejects before processing another child");
  assert.equal(budget.failure()?.includes("transport-row"), true);
  assert.equal(ports.firstPorts(children[0]) === undefined, true);
});

test("a cached port relationship never bypasses an independently exhausted work budget", () => {
  const { parameter, ports, budget } = fixture({ maximumSteps: 3 });
  const port = parameter();
  assert.equal(ports.firstPorts(port)?.has(port), true, "two original work steps admit the complete first relation");
  assert.equal(ports.firstPorts(port)?.has(port), true, "the third step admits the cache read");
  assert.equal(ports.firstPorts(port) === undefined, true);
  assert.equal(budget.failure()?.includes("analysis-work"), true);
});
