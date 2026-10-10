import assert from "node:assert/strict";
import test from "node:test";
import { createSourceStorageSubstitutions } from "../../packages/target-api/dist/target-analysis/source-storage/substitutions.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/resource-budget.js";
import { createSourceStorageSubjects } from "../../packages/target-api/dist/target-analysis/source-storage/subjects.js";

function fixture(limits = {}, length = 50) {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, ...limits });
  const subject = createSourceStorageSubjects(budget.subject, budget.reject);
  const parameter = {};
  const outer = { parameters: [parameter] };
  const input = subject({});
  const formal = subject(parameter);
  const innerParameter = {};
  const inner = { parameters: [innerParameter] };
  const nodes = Array.from({ length }, () => subject({}));
  const inputs = new Map(nodes.map((node, index) => [node, new Set([nodes[index + 1] ?? formal])]));
  const source = { ast: { is: { IsClassDeclaration: () => false, IsClassExpression: () => false,
    IsVariableDeclaration: () => false, IsParameterDeclaration: () => true },
    as: { AsParameterDeclaration: () => ({ Initializer: undefined }) },
    parameters: node => node.parameters, body: () => undefined } };
  const substitutions = createSourceStorageSubstitutions(source, budget, subject, () => new Set(),
    origin => ({ subjects: origin === formal ? new Set([input]) : origin.node === innerParameter ? new Set([nodes[0]]) : new Set(), context: "caller" }),
    origin => inputs.get(origin) ?? new Set(), { select: () => undefined, hasAllocation: () => false });
  return { budget, subject, substitutions, outer, inner, innerParameter, formal, input, nodes, inputs };
}

test("context traversal reserves only its live frontier while interned binding evidence retains its own rows", () => {
  const current = fixture({ maximumTransportRows: 80, maximumSteps: 4096 });
  const { substitutions, budget } = current;
  const parent = substitutions.forInvocation(current.outer, {}, substitutions.empty, substitutions.empty);
  assert.equal(parent !== undefined, true, "exact initial parent binding");
  const invocation = {};
  const original = substitutions.forInvocation(current.inner, invocation, parent, parent);
  assert.equal(original !== undefined, true, "first complete context fits the finite live peak");
  const selected = original.get(current.subject(current.innerParameter));
  assert.equal(selected.inputs.has(current.nodes[0]) && substitutions.origins(current.formal, selected.context).has(current.input), true,
    "the reached formal retains its original input and exact enclosing context");
  for (let index = 0; index < 10; index += 1) {
    assert.equal(substitutions.forInvocation(current.inner, invocation, parent, parent) === original, true,
      "repeat traversal releases only dead temporary rows and returns identical interned evidence");
  }
  assert.equal(budget.failure() === undefined, true, "cumulative temporary allocations do not masquerade as retained memory");
  let retained = 0;
  while (budget.row()) retained += 1;
  assert.equal(retained === 69, true, "all 11 retained binding/input/context rows remain charged without redundant normalized root sets");
  assert.match(budget.failure(), /transport-row/u);
  assert.equal(substitutions.forInvocation(current.inner, invocation, parent, parent) === undefined, true, "release never clears a failed owner");
});

test("an individually oversized context and exhausted work fail closed without certifying an empty invocation", () => {
  const current = fixture({ maximumTransportRows: 32 });
  const parent = current.substitutions.forInvocation(current.outer, {}, current.substitutions.empty, current.substitutions.empty);
  assert.equal(parent !== undefined, true);
  assert.equal(current.substitutions.forInvocation(current.inner, {}, parent, parent) === undefined, true,
    "the actual live frontier still exceeds the same finite row ceiling");
  assert.match(current.budget.failure(), /transport-row/u);
  assert.equal(current.substitutions.forInvocation({ parameters: [] }, {}, current.substitutions.empty, current.substitutions.empty) === undefined, true,
    "failed zero-argument work cannot publish invented empty evidence");
  const work = fixture({ maximumSteps: 1 });
  assert.equal(work.substitutions.forInvocation(work.outer, {}, work.substitutions.empty, work.substitutions.empty) === undefined, true);
  assert.match(work.budget.failure(), /analysis-work/u);
  assert.equal(work.substitutions.forInvocation({ parameters: [] }, {}, work.substitutions.empty, work.substitutions.empty) === undefined, true);
});

test("throwing context traversal releases its own temporary rows without discarding already retained facts", () => {
  const current = fixture({ maximumTransportRows: 80 });
  const parent = current.substitutions.forInvocation(current.outer, {}, current.substitutions.empty, current.substitutions.empty);
  const failure = new Error("exact traversal failure");
  current.inputs.set(current.nodes[20], { [Symbol.iterator]() { throw failure; } });
  assert.throws(() => current.substitutions.forInvocation(current.inner, {}, parent, parent), error => error === failure);
  assert.equal(current.budget.failure() === undefined, true, "an independent thrown failure does not fabricate budget exhaustion");
  let retained = 0;
  while (current.budget.row()) retained += 1;
  assert.equal(retained === 77, true, "only the original three retained binding rows survive unwind; no redundant root set is retained");
});

test("context scheduling reserves the complete live fanout before traversing another subject", () => {
  const current = fixture({ maximumTransportRows: 12 }, 1);
  const parent = current.substitutions.forInvocation(current.outer, {}, current.substitutions.empty, current.substitutions.empty);
  assert.equal(parent !== undefined, true);
  const children = Array.from({ length: 20 }, () => current.subject({}));
  let traversed = false;
  const fanout = new Map(children.map(child => [child, { [Symbol.iterator]() {
    traversed = true;
    return [current.formal][Symbol.iterator]();
  } }]));
  for (const [child, inputs] of fanout) current.inputs.set(child, inputs);
  current.inputs.set(current.nodes[0], new Set(children));
  assert.equal(current.substitutions.forInvocation(current.inner, {}, parent, parent) === undefined, true);
  assert.match(current.budget.failure(), /transport-row/u);
  assert.equal(traversed, false, "the oversized scheduled frontier rejects before visiting any child");
});
