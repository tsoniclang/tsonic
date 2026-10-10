import assert from "node:assert/strict";
import test from "node:test";
import { createSourceStorageScopes } from "../../packages/target-api/dist/target-analysis/source-storage/scoped-scopes.js";
import { createSourceStorageScopedKeys } from "../../packages/target-api/dist/target-analysis/source-storage/scoped-keys.js";
import { sourceStorageReference } from "../../packages/target-api/dist/target-analysis/source-storage/scoped-model.js";
import { createSourceStorageGraphQueries } from "../../packages/target-api/dist/target-analysis/source-storage/graph-queries.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/resource-budget.js";
import { createSourceStorageSubjects } from "../../packages/target-api/dist/target-analysis/source-storage/subjects.js";

function fixture(limits = {}, length = 50) {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, ...limits });
  const subject = createSourceStorageSubjects(budget.subject, budget.reject);
  const parameter = {};
  const outer = { parameters: [parameter] };
  const input = subject({});
  const formal = subject(parameter, "input");
  const innerParameter = {};
  const inner = { parameters: [innerParameter] };
  const nodes = Array.from({ length }, () => subject({}));
  const inputs = new Map(nodes.map((node, index) => [node, new Set([nodes[index + 1] ?? formal])]));
  const source = { ast: { is: { IsClassDeclaration: () => false, IsClassExpression: () => false,
    IsCallExpression: () => false, IsNewExpression: () => false,
    IsPropertyAccessExpression: () => false, IsElementAccessExpression: () => false,
    IsObjectLiteralExpression: () => false, IsArrayLiteralExpression: () => false,
    IsVariableDeclaration: () => false, IsParameterDeclaration: node => node === parameter || node === innerParameter },
    as: { AsParameterDeclaration: () => ({ Initializer: undefined }) },
    parameters: node => node.parameters, body: () => undefined } };
  const graph = createSourceStorageGraphQueries(budget);
  graph.seal();
  const scopes = createSourceStorageScopes(source, budget, subject,
    origin => ({ subjects: origin === formal ? new Set([input]) : origin.node === innerParameter ? new Set([nodes[0]]) : new Set(), context: "caller" }), graph);
  const keys = createSourceStorageScopedKeys(source, budget, {
    incomingFor: origin => inputs.get(origin) ?? new Set(), contextualInputs: origin => inputs.get(origin) ?? new Set(),
    storedValuesFor: () => undefined, invocationEffects: new Map(), regions: { enclosing: () => undefined },
  }, scopes);
  return { budget, subject, scopes, keys, outer, inner, innerParameter, formal, input, nodes, inputs };
}

test("context traversal reserves only its live frontier while interned binding evidence retains its own rows", () => {
  const current = fixture({ maximumTransportRows: 80, maximumSteps: 4096 });
  const { scopes, keys, budget } = current;
  const parent = scopes.frameFor(current.outer, {}, scopes.empty, scopes.empty);
  assert.equal(parent !== undefined, true, "exact initial parent binding");
  const invocation = {};
  const original = scopes.frameFor(current.inner, invocation, parent, parent);
  assert.equal(original !== undefined, true, "first complete context fits the finite live peak");
  const selected = scopes.lookup(current.subject(current.innerParameter, "input"), original);
  const inherited = scopes.lookup(current.formal, selected.terms[0].scope);
  assert.equal(selected.terms[0].subject === current.nodes[0] && inherited.terms[0].subject === current.input, true,
    "the reached formal retains its original input and exact enclosing context");
  const key = keys.encode(sourceStorageReference(current.nodes[0], parent));
  assert.equal(typeof key === "string", true, "complete demanded context fits the same finite peak");
  for (let index = 0; index < 10; index += 1) {
    assert.equal(scopes.frameFor(current.inner, invocation, parent, parent) === original, true,
      "repeat traversal releases only dead temporary rows and returns identical interned evidence");
    assert.equal(keys.encode(sourceStorageReference(current.nodes[0], parent)) === key, true);
  }
  assert.equal(budget.failure() === undefined, true, "cumulative temporary allocations do not masquerade as retained memory");
  let retained = 0;
  while (budget.row()) retained += 1;
  assert.equal(retained === 62, true,
    "ten identity rows, six frame/entry/actual rows and two unified context-footprint rows remain charged");
  assert.match(budget.failure(), /transport-row/u);
  assert.equal(scopes.frameFor(current.inner, invocation, parent, parent) === undefined, true, "release never clears a failed owner");
});

test("an individually oversized context and exhausted work fail closed without certifying an empty invocation", () => {
  const current = fixture({ maximumTransportRows: 32 });
  const parent = current.scopes.frameFor(current.outer, {}, current.scopes.empty, current.scopes.empty);
  assert.equal(parent !== undefined, true);
  assert.equal(current.keys.encode(sourceStorageReference(current.nodes[0], parent)) === undefined, true,
    "the actual live frontier still exceeds the same finite row ceiling");
  assert.match(current.budget.failure(), /transport-row/u);
  assert.equal(current.scopes.frameFor({ parameters: [] }, {}, current.scopes.empty, current.scopes.empty) === undefined, true,
    "failed zero-argument work cannot publish invented empty evidence");
  const work = fixture({ maximumSteps: 1 });
  assert.equal(work.scopes.frameFor(work.outer, {}, work.scopes.empty, work.scopes.empty) === undefined, true);
  assert.match(work.budget.failure(), /analysis-work/u);
  assert.equal(work.scopes.frameFor({ parameters: [] }, {}, work.scopes.empty, work.scopes.empty) === undefined, true);
});

test("throwing context traversal releases its own temporary rows without discarding already retained facts", () => {
  const current = fixture({ maximumTransportRows: 80 });
  const parent = current.scopes.frameFor(current.outer, {}, current.scopes.empty, current.scopes.empty);
  const failure = new Error("exact traversal failure");
  current.inputs.set(current.nodes[20], { [Symbol.iterator]() { throw failure; } });
  assert.throws(() => current.keys.encode(sourceStorageReference(current.nodes[0], parent)), error => error === failure);
  assert.equal(current.budget.failure() === undefined, true, "an independent thrown failure does not fabricate budget exhaustion");
  let retained = 0;
  while (current.budget.row()) retained += 1;
  assert.equal(retained === 73, true, "only four identity rows and three retained frame/entry/actual rows survive unwind");
});

test("context scheduling reserves the complete live fanout before traversing another subject", () => {
  const current = fixture({ maximumTransportRows: 12 }, 1);
  const parent = current.scopes.frameFor(current.outer, {}, current.scopes.empty, current.scopes.empty);
  assert.equal(parent !== undefined, true);
  const children = Array.from({ length: 20 }, () => current.subject({}));
  let traversed = false;
  const fanout = new Map(children.map(child => [child, { [Symbol.iterator]() {
    traversed = true;
    return [current.formal][Symbol.iterator]();
  } }]));
  for (const [child, inputs] of fanout) current.inputs.set(child, inputs);
  current.inputs.set(current.nodes[0], new Set(children));
  assert.equal(current.keys.encode(sourceStorageReference(current.nodes[0], parent)) === undefined, true);
  assert.match(current.budget.failure(), /transport-row/u);
  assert.equal(traversed, false, "the oversized scheduled frontier rejects before visiting any child");
});

test("deep activation identities use bounded explicit traversal rather than recursive history strings", () => {
  const current = fixture();
  let scope = current.scopes.empty;
  const candidate = { parameters: [] };
  for (let index = 0; index < 20_000; index += 1) {
    scope = current.scopes.frameFor(candidate, {}, scope, current.scopes.empty);
    assert.equal(scope !== undefined, true, "finite checked call-chain frame");
  }
  const selected = current.scopes.activationKey(scope);
  assert.equal(typeof selected === "string" && selected.length < 10, true,
    "interned activation identity does not serialize its full call history");
  assert.equal(current.scopes.activationKey(scope) === selected, true);
  assert.equal(current.budget.failure() === undefined, true);
});

test("activation identity retains the actual caller and does not depend on a redundant capture frame", () => {
  const current = fixture();
  const candidate = { parameters: [] };
  const invocation = {};
  const left = current.scopes.frameFor(candidate, {}, current.scopes.empty, current.scopes.empty);
  const right = current.scopes.frameFor(candidate, {}, current.scopes.empty, current.scopes.empty);
  const first = current.scopes.frameFor(candidate, invocation, left, left);
  const same = current.scopes.frameFor(candidate, invocation, left, right);
  const different = current.scopes.frameFor(candidate, invocation, right, right);
  assert.equal(current.scopes.activationKey(first) === current.scopes.activationKey(same), true);
  assert.equal(current.scopes.activationKey(first) === current.scopes.activationKey(different), false);
  assert.equal(current.budget.failure() === undefined, true);
});

test("deep cyclic capture discovery reuses the bounded completed relation owner", () => {
  const current = fixture();
  const candidate = { parameters: [] };
  const equation = { identity: 0, entry: candidate, component: new Set([candidate]), initial: current.scopes.empty };
  const variable = current.scopes.variable(equation, candidate);
  let scope = variable;
  for (let index = 0; index < 20_000; index += 1)
    scope = current.scopes.frameFor(candidate, {}, scope, scope);
  const variables = current.scopes.variablesFor(scope);
  assert.equal(variables?.size === 1 && variables.has(variable), true, "every deep scope retains the identical recursive variable");
  assert.equal(current.scopes.variablesFor(scope) === variables, true, "only a completed relation is reused");
  assert.equal(current.budget.failure() === undefined, true);
});
