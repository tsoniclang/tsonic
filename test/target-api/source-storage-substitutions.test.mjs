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
    origin => ({ subjects: origin === formal ? new Set([input]) : origin.node === innerParameter ? new Set([nodes[0]]) : new Set(), context: "caller" }), graph, () => undefined);
  const transport = {
    incomingFor: origin => inputs.get(origin) ?? new Set(), contextualInputs: origin => inputs.get(origin) ?? new Set(),
    contextLocation: () => undefined,
    storedValuesFor: () => undefined, invocationEffects: new Map(), regions: { enclosing: () => undefined },
  };
  const keys = createSourceStorageScopedKeys(source, budget, transport, scopes);
  return { budget, subject, scopes, keys, source, transport, outer, inner, innerParameter, formal, input, nodes, inputs };
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

test("one key encoding shares exact scoped references instead of retraversing a binding DAG as a tree", () => {
  const current = fixture({ maximumSteps: 512, maximumTransportRows: 1024 }, 1);
  let scope = current.scopes.frameFor(current.outer, {}, current.scopes.empty, current.scopes.empty);
  const unrelated = { parameters: [] };
  for (let depth = 0; depth < 20; depth += 1) scope = current.scopes.frameFor(unrelated, {}, scope, scope);
  assert.equal(scope !== undefined, true);
  const reference = () => sourceStorageReference(current.formal, scope);
  let term = reference();
  for (let depth = 0; depth < 4; depth += 1) term = { kind: "store", destination: reference(), receiver: term, value: term };
  assert.equal(typeof current.keys.encode(term) === "string", true,
    "one complete key fits the original finite request budget without weakening exact binding identity");
  assert.equal(current.budget.failure() === undefined, true);
});

test("key-local memo release preserves distinct reference modes and exact closed versus symbolic evidence", () => {
  const remainingRows = repeats => {
    const current = fixture({ maximumTransportRows: 256, maximumSteps: 65536 }, 1);
    const equation = { identity: 0, entry: current.outer, component: new Set([current.outer]), initial: current.scopes.empty };
    const variable = current.scopes.variable(equation, current.outer);
    const parent = current.scopes.frameFor(current.outer, {}, current.scopes.empty, current.scopes.empty);
    const original = sourceStorageReference(current.input, current.scopes.empty);
    const leaf = { ...original, kind: "leaf" };
    assert.equal(current.keys.encode(original) === current.keys.encode(leaf), false,
      "equal subject and scope never merge a physical leaf with an unresolved reference mode");
    const open = sourceStorageReference(current.formal, variable);
    const closed = sourceStorageReference(current.formal, parent);
    assert.equal(current.keys.closed(open), false);
    assert.equal(current.keys.closed(closed), true);
    const term = { kind: "store", destination: closed, receiver: open, value: open };
    for (let repeat = 0; repeat < repeats; repeat += 1) assert.equal(current.keys.closed(term), false,
      "reusing an independently open child cannot turn the complete request into closed evidence");
    assert.equal(current.budget.failure() === undefined, true);
    let remaining = 0;
    while (current.budget.row()) remaining += 1;
    return remaining;
  };
  assert.equal(remainingRows(100), remainingRows(1), "completed request history retains no memo rows");
});

test("key-local reference reuse retains independently selected scopes and cannot publish an unfinished binding", () => {
  const current = fixture();
  const other = current.subject({});
  const frame = value => Object.freeze({ kind: "frame", entries: new Map([[current.formal,
    [sourceStorageReference(value, current.scopes.empty)]]]), parents: [] });
  const left = sourceStorageReference(current.formal, frame(current.input));
  const right = sourceStorageReference(current.formal, frame(other));
  const combined = value => ({ kind: "store", destination: left, receiver: value, value });
  assert.equal(current.keys.encode(combined(left)) === current.keys.encode(combined(right)), false,
    "one source formal with different exact binding scopes never shares its selected value encoding");
  assert.equal(current.budget.failure() === undefined, true);
  const entries = new Map();
  const cyclic = Object.freeze({ kind: "frame", entries, parents: [] });
  const reference = sourceStorageReference(current.formal, cyclic);
  entries.set(current.formal, [reference]);
  assert.equal(current.keys.encode(reference) === undefined, true, "a cycle is not a complete cached binding");
  assert.match(current.budget.failure(), /unfinished encoding/u);
});

test("repeated key-reference cache hits still account finite work and reserve their complete live memo", () => {
  for (const limits of [{ maximumSteps: 12 }, { maximumTransportRows: 3 }]) {
    const current = fixture(limits, 1);
    const reference = () => sourceStorageReference(current.input, current.scopes.empty);
    let term = reference();
    for (let depth = 0; depth < 4; depth += 1) term = { kind: "store", destination: reference(), receiver: term, value: term };
    assert.equal(current.keys.encode(term) === undefined, true, "neither identical references nor reuse bypasses either finite guard");
    assert.equal(current.budget.failure() !== undefined, true);
  }
});

test("a completed unavailable key reference is not mistaken for an unfinished cyclic encoding", () => {
  const current = fixture();
  const scope = current.scopes.frameFor(current.outer, {}, current.scopes.empty, current.scopes.empty);
  const keys = createSourceStorageScopedKeys(current.source, current.budget,
    { ...current.transport, contextualInputs: () => undefined }, current.scopes);
  const reference = () => sourceStorageReference(current.nodes[0], scope);
  const term = { kind: "store", destination: reference(), receiver: reference(), value: reference() };
  assert.equal(keys.encode(term) === undefined, true, "the original unavailable context cannot become a fabricated key");
  assert.equal(current.budget.failure() === undefined, true,
    "a completed absence is not recursive unfinished evidence and cannot invent a failure reason");
});

test("checked guard continuations have one idempotent ordered key without merging different reference identities", () => {
  const current = fixture();
  const first = {}; const second = {};
  const value = sourceStorageReference(current.input, current.scopes.empty);
  const guarded = (reference, value) => ({ kind: "guarded", reference, value });
  const original = current.keys.encode(guarded(first, guarded(second, value)));
  assert.equal(typeof original === "string", true);
  assert.equal(current.keys.encode(guarded(second, guarded(first, guarded(first, value)))) === original, true,
    "repeated equivalent continuation predicates never grow a recursive key");
  assert.equal(current.keys.encode(guarded({}, guarded(second, value))) === original, false,
    "equal-looking checked reference nodes are not interchangeable evidence");
  assert.equal(current.budget.failure() === undefined, true);
});

test("guard continuation key construction preserves independent finite work and row reservations", () => {
  for (const limits of [{ maximumSteps: 1 }, { maximumTransportRows: 2 }]) {
    const current = fixture(limits);
    const term = { kind: "guarded", reference: {}, value: sourceStorageReference(current.input, current.scopes.empty) };
    assert.equal(current.keys.encode(term) === undefined, true, "no key publishes after either independent guard is exhausted");
    assert.equal(current.budget.failure() !== undefined, true);
  }
});

test("throwing guard continuation key construction releases its unpublished frontier before retry", () => {
  const current = fixture({ maximumTransportRows: 10 });
  const failure = new Error("guarded value unavailable");
  let ready = false;
  const term = { kind: "guarded", reference: {}, get value() {
    if (!ready) throw failure;
    return sourceStorageReference(current.input, current.scopes.empty);
  } };
  assert.throws(() => current.keys.encode(term), error => error === failure);
  const remaining = current.budget.createRows();
  assert.equal(remaining.add(8), true, "only the original scope and exact guard-reference identities remain retained");
  remaining.release();
  ready = true;
  assert.equal(typeof current.keys.encode(term) === "string", true, "no failed key or temporary reservation survives");
  assert.equal(current.budget.failure() === undefined, true);
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

test("substituting only a lexical capture cannot manufacture another physical call activation", () => {
  const current = fixture();
  const candidate = { parameters: [] };
  const equation = { identity: 0, entry: current.outer, component: new Set([current.outer]), initial: current.scopes.empty };
  const capture = current.scopes.variable(equation, current.outer);
  const frame = current.scopes.frameFor(candidate, {}, current.scopes.empty, capture);
  const replacement = current.scopes.frameFor(current.outer, {}, current.scopes.empty, current.scopes.empty);
  const substituted = current.scopes.applyScope(frame, new Map([[capture, replacement]]));
  assert.equal(substituted?.kind === "substitution", true, "the lexical capture really changes");
  assert.equal(current.scopes.activationKey(substituted) === current.scopes.activationKey(frame), true,
    "physical identity follows the actual caller, not unused capture substitutions");
  const called = current.scopes.frameFor(candidate, frame.invocation, capture, current.scopes.empty);
  const changedCaller = current.scopes.applyScope(called, new Map([[capture, replacement]]));
  assert.equal(current.scopes.activationKey(changedCaller) === current.scopes.activationKey(called), false,
    "an effective caller substitution must still change physical identity");
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

test("completed simultaneous substitution operations reuse their canonical result independently of request Map identity", () => {
  const current = fixture({ maximumSteps: 1024 }, 1);
  return current.scopes.withQuery(() => {
    const equation = { identity: 0, entry: current.outer, component: new Set([current.outer, current.inner]), initial: current.scopes.empty };
    const outer = current.scopes.variable(equation, current.outer);
    const inner = current.scopes.variable(equation, current.inner);
    const frame = current.scopes.frameFor(current.inner, {}, outer, outer);
    const replacement = current.scopes.frameFor(current.outer, {}, inner, inner);
    assert.equal(frame !== undefined && replacement !== undefined, true);
    const first = current.scopes.applyScope(frame, new Map([[outer, replacement]]));
    assert.equal(first?.kind === "substitution", true);
    const completed = current.scopes.applyScope(first, new Map([[inner, current.scopes.empty]]));
    assert.equal(completed !== undefined, true);
    for (let repeat = 0; repeat < 100; repeat += 1) {
      assert.equal(current.scopes.applyScope(first, new Map([[inner, current.scopes.empty]])) === completed, true,
        "same immutable operation, no repeated recursive composition");
    }
    assert.equal(current.budget.failure() === undefined, true, "original finite work accounts every lookup");
    let result = completed;
    for (let repeat = 0; repeat < 1024 && result !== undefined; repeat += 1)
      result = current.scopes.applyScope(first, new Map([[inner, current.scopes.empty]]));
    assert.equal(result === undefined, true, "cached transformations cannot bypass the finite work guard");
    assert.match(current.budget.failure(), /analysis-work/u);
  });
});

test("owning scope and equation queries retain exact presence and absence without rescanning immutable parent chains", () => {
  const current = fixture({ maximumSteps: 1024 }, 1);
  return current.scopes.withTraversal(() => {
    const equation = { identity: 0, entry: current.outer, component: new Set([current.outer]), initial: current.scopes.empty };
    const variable = current.scopes.variable(equation, current.outer);
    let scope = variable;
    for (let depth = 0; depth < 20; depth += 1) scope = current.scopes.frameFor(current.inner, {}, scope, scope);
    assert.equal(scope !== undefined, true);
    const missing = {};
    assert.equal(current.scopes.owningScope(scope, current.outer) === variable, true);
    assert.equal(current.scopes.owningScope(scope, missing) === undefined, true);
    assert.equal(current.scopes.family(scope) === equation, true);
    for (let repeat = 0; repeat < 100; repeat += 1) {
      assert.equal(current.scopes.owningScope(scope, current.outer) === variable, true);
      assert.equal(current.scopes.owningScope(scope, missing) === undefined, true);
      assert.equal(current.scopes.family(scope) === equation, true);
    }
    assert.equal(current.budget.failure() === undefined, true);
  });
});

test("completed simultaneous composition reuses every exact selection across nested alternating collectors", () => {
  const current = fixture({ maximumSteps: 4096 }, 1);
  return current.scopes.withQuery(() => {
    const equation = { identity: 0, entry: current.outer, component: new Set([current.outer, current.inner]), initial: current.scopes.empty };
    const outer = current.scopes.variable(equation, current.outer);
    const inner = current.scopes.variable(equation, current.inner);
    const frame = current.scopes.frameFor(current.inner, {}, outer, outer);
    const replacement = current.scopes.frameFor(current.outer, {}, inner, inner);
    let first = current.scopes.applyScope(frame, new Map([[outer, replacement]]));
    for (let depth = 0; depth < 8; depth += 1) first = current.scopes.applyScope(first, new Map([[inner, replacement]]));
    const alternative = current.scopes.frameFor(current.outer, {}, current.scopes.empty, current.scopes.empty);
    const completed = current.scopes.applyScope(first, new Map([[inner, current.scopes.empty]]));
    const changed = current.scopes.applyScope(first, new Map([[inner, alternative]]));
    assert.equal(completed !== undefined && changed !== undefined && completed !== changed, true,
      "independent replacement scopes retain separate canonical complete transformations");
    for (let repeat = 0; repeat < 40; repeat += 1) {
      assert.equal(current.scopes.withTraversal(() => current.scopes.applyScope(first, new Map([[inner, current.scopes.empty]]))) === completed, true);
      assert.equal(current.scopes.withTraversal(() => current.scopes.applyScope(first, new Map([[inner, alternative]]))) === changed, true);
    }
    assert.equal(current.budget.failure() === undefined, true, "completed immutable operations do not expire or overwrite other selections within one query");
    let result = completed;
    for (let repeat = 0; repeat < 4096 && result !== undefined; repeat += 1)
      result = current.scopes.applyScope(first, new Map([[inner, current.scopes.empty]]));
    assert.equal(result === undefined, true, "nested collector hits still obey the original finite work guard");
    assert.match(current.budget.failure(), /analysis-work/u);
  });
});

test("completed and throwing composition queries release request history without releasing canonical views", () => {
  const remainingRows = repeats => {
    const current = fixture({ maximumTransportRows: 256, maximumSteps: 65536 }, 1);
    const equation = { identity: 0, entry: current.outer, component: new Set([current.outer, current.inner]), initial: current.scopes.empty };
    const outer = current.scopes.variable(equation, current.outer);
    const inner = current.scopes.variable(equation, current.inner);
    const frame = current.scopes.frameFor(current.inner, {}, outer, outer);
    const replacement = current.scopes.frameFor(current.outer, {}, inner, inner);
    const first = current.scopes.applyScope(frame, new Map([[outer, replacement]]));
    const completed = current.scopes.applyScope(first, new Map([[inner, current.scopes.empty]]));
    assert.equal(completed !== undefined, true);
    const failure = new Error("exact composition query failure");
    for (let repeat = 0; repeat < repeats; repeat += 1) {
      const collect = () => current.scopes.withQuery(() => {
        assert.equal(current.scopes.withTraversal(() => current.scopes.applyScope(first,
          new Map([[inner, current.scopes.empty]]))) === completed, true);
        if (repeat % 2 === 0) throw failure;
      });
      if (repeat % 2 === 0) assert.throws(collect, error => error === failure);
      else collect();
    }
    assert.equal(current.budget.failure() === undefined, true, "both context lifetimes unwind without inventing exhaustion");
    let remaining = 0;
    while (current.budget.row()) remaining += 1;
    return remaining;
  };
  assert.equal(remainingRows(100), remainingRows(1), "only complete canonical views survive repeated requests and throws");
});

test("completed and throwing scope queries release temporary memo rows without losing canonical identities", () => {
  const remainingRows = repeats => {
    const current = fixture({ maximumTransportRows: 128, maximumSteps: 65536 }, 1);
    const equation = { identity: 0, entry: current.outer, component: new Set([current.outer]), initial: current.scopes.empty };
    const variable = current.scopes.variable(equation, current.outer);
    const frame = current.scopes.frameFor(current.inner, {}, variable, variable);
    const failure = new Error("exact query failure");
    for (let repeat = 0; repeat < repeats; repeat += 1) {
      const missing = {};
      const collect = () => current.scopes.withTraversal(() => {
        assert.equal(current.scopes.owningScope(frame, current.outer) === variable, true);
        assert.equal(current.scopes.owningScope(frame, missing) === undefined, true);
        current.scopes.withTraversal(() => {
          assert.equal(current.scopes.family(frame) === equation, true);
          assert.equal(current.scopes.owningScope(frame, current.outer) === variable, true);
        });
        if (repeat % 2 === 0) throw failure;
      });
      if (repeat % 2 === 0) assert.throws(collect, error => error === failure);
      else collect();
    }
    assert.equal(current.budget.failure() === undefined, true, "finite live memo releases on normal return and unwind");
    let remaining = 0;
    while (current.budget.row()) remaining += 1;
    return remaining;
  };
  assert.equal(remainingRows(1000), remainingRows(1), "query history adds no persistent cache rows");
});

test("recursive equation identity survives its concrete entry frame without changing physical activation identity", () => {
  const current = fixture({}, 1);
  const invocation = {};
  const original = current.scopes.frameFor(current.outer, invocation, current.scopes.empty, current.scopes.empty);
  const equation = { identity: 0, entry: current.outer, component: new Set([current.outer, current.inner]), initial: original };
  const active = current.scopes.frameFor(current.outer, invocation, current.scopes.empty, current.scopes.empty, equation);
  assert.equal(active !== undefined && active !== original, true, "equation context is a distinct exact semantic frame");
  assert.equal(current.scopes.family(original) === undefined, true);
  assert.equal(current.scopes.family(active) === equation, true, "expanding the entry does not erase its recursive binder");
  assert.equal(current.scopes.activationKey(active) === current.scopes.activationKey(original), true,
    "equation bookkeeping does not invent another physical invocation");
  assert.equal(current.scopes.frameFor(current.outer, invocation, current.scopes.empty, current.scopes.empty, equation) === active, true);
  const variable = current.scopes.variable(equation, current.inner);
  const recursive = current.scopes.frameFor(current.inner, {}, variable, variable, equation);
  const view = current.scopes.applyScope(recursive, new Map([[variable, current.scopes.empty]]));
  assert.equal(view?.kind === "substitution" && current.scopes.family(view) === equation, true,
    "simultaneous formal substitution does not erase active equation ownership");
  assert.equal(current.budget.failure() === undefined, true);
});

test("equation selection follows actual caller ownership rather than an unrelated captured environment", () => {
  const current = fixture({}, 1);
  const first = { identity: 0, entry: current.outer, component: new Set([current.outer]), initial: current.scopes.empty };
  const second = { identity: 1, entry: current.inner, component: new Set([current.inner]), initial: current.scopes.empty };
  const caller = current.scopes.variable(first, current.outer);
  const captured = current.scopes.variable(second, current.inner);
  const frame = current.scopes.frameFor(current.inner, {}, caller, captured);
  assert.equal(current.scopes.family(frame) === first, true, "callee capture does not elect its caller's recursion equation");
  const view = current.scopes.applyScope(frame, new Map([[caller, current.scopes.empty]]));
  assert.equal(current.scopes.family(view) === undefined, true, "a substituted caller is resolved before family selection");
  assert.equal(current.budget.failure() === undefined, true);
});

test("deep concrete substitution views retain exact equation and lexical ownership without host recursion", () => {
  const current = fixture({}, 1);
  const equation = { identity: 0, entry: current.outer, component: new Set([current.outer]), initial: current.scopes.empty };
  const variable = current.scopes.variable(equation, current.outer);
  let scope = variable;
  for (let depth = 0; depth < 4000; depth += 1) {
    const frame = current.scopes.frameFor(current.inner, {}, scope, scope);
    scope = current.scopes.applyScope(frame, new Map([[variable, variable]]));
    assert.equal(scope?.kind === "substitution", true, "finite canonical frame view");
  }
  assert.equal(current.scopes.family(scope) === equation, true, "effective caller equation survives deep views");
  assert.equal(current.scopes.owningScope(scope, current.outer) === variable, true, "exact lexical owner is unchanged");
  assert.equal(current.budget.failure() === undefined, true, "existing finite limits do not depend on the JavaScript call stack");
});
