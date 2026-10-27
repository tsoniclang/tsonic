import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageScopedRecursion } from "../../packages/target-api/dist/target-analysis/source-storage/scoped/scoped-recursion.js";
import { createSourceStorageEquations } from "../../packages/target-api/dist/target-analysis/source-storage/scoped/scoped-equations.js";
import { createSourceStorageScopes } from "../../packages/target-api/dist/target-analysis/source-storage/scoped/scoped-scopes.js";
import { createSourceStorageScopedKeys } from "../../packages/target-api/dist/target-analysis/source-storage/scoped/scoped-keys.js";
import { createSourceStorageTransport } from "../../packages/target-api/dist/target-analysis/source-storage/transport/transport.js";
import { createSourceStorageBindingInputs } from "../../packages/target-api/dist/target-analysis/source-storage/scoped/scoped-transport.js";
import { createSourceStorageInvocationInputs } from "../../packages/target-api/dist/target-analysis/source-storage/graph/invocation-inputs.js";
import { createSourceStorageGraphQueries } from "../../packages/target-api/dist/target-analysis/source-storage/graph/graph-queries.js";
import { createSourceStorageContextFootprints } from "../../packages/target-api/dist/target-analysis/source-storage/graph/context-footprints.js";
import { sourceStorageActivationOwner } from "../../packages/target-api/dist/target-analysis/source-storage/scoped/activation-keys.js";
import { sourceStorageReference } from "../../packages/target-api/dist/target-analysis/source-storage/graph/scoped-model.js";
import { createSourceStorageSubjects } from "../../packages/target-api/dist/target-analysis/source-storage/model/subjects.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";

function callableSource(owners) {
  const file = {};
  const parameters = new Set(owners.flatMap(owner => owner.parameters));
  const nodes = new Set([...owners, ...parameters, ...owners.map(owner => owner.body)]);
  const signatures = new Map(owners.map(owner => [owner, Object.freeze({
    parameters: Object.freeze(owner.parameters.map(declaration => Object.freeze({ declaration }))),
  })]));
  const declarations = Object.freeze({
    declarationSignature: owner => signatures.get(owner),
    signatureParameters: signature => signature.parameters,
    primarySymbolDeclaration: symbol => symbol.declaration,
  });
  return { ast: { parent: node => node.parent, body: node => node.body,
    getSourceFile: node => nodes.has(node) ? file : undefined,
    is: { IsClassDeclaration: () => false, IsClassExpression: () => false,
      IsParameterDeclaration: node => parameters.has(node) } },
  semantics: { includes: candidate => candidate === file,
    forFile(candidate) {
      if (candidate !== file) throw new Error("The recursive fixture requires its exact checked source file.");
      return { declarations };
    } } };
}

function fixture(limits = {}) {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 128, maximumSteps: 4096, ...limits });
  const subject = createSourceStorageSubjects(budget.subject, budget.reject, () => []);
  const first = { parameters: [] }; const second = { parameters: [] };
  first.body = { parent: first }; second.body = { parent: second };
  const firstInput = { parent: first }; const secondInput = { parent: second };
  first.parameters.push(firstInput); second.parameters.push(secondInput);
  const firstCall = { region: first.body }; const secondCall = { region: second.body };
  const source = callableSource([first, second]);
  let calls = 0; let inspect = () => {}; let context = "caller";
  const recursion = createSourceStorageScopedRecursion(source, budget, {
    subject, invocations: new Set([firstCall, secondCall]), accessorTargets: new Map(),
    callbackEntriesFor: () => [],
    regions: { enclosing: node => node.region }, invocationImplementations: node => {
      calls += 1; inspect(node);
      return new Set([node === firstCall ? second : first]);
    },
  }, (_formal, _candidate, invocation) => ({ context,
    subjects: new Set([subject(invocation === firstCall ? firstInput : secondInput, "input")]) }));
  return { budget, subject, recursion, first, second, firstInput, secondInput, firstCall, secondCall,
    calls: () => calls, inspect: callback => { inspect = callback; }, context: value => { context = value; } };
}

test("recursive call graph publishes one exact complete SCC only after every original edge is checked", () => {
  const current = fixture();
  const selected = current.recursion.componentFor(current.first);
  assert.equal(selected?.size === 2 && selected.has(current.first) && selected.has(current.second), true);
  assert.equal(current.recursion.componentFor(current.second) === selected, true, "one component identity is shared");
  assert.equal(current.recursion.incomingFor(current.second)[0].invocation === current.firstCall &&
    current.recursion.incomingFor(current.second)[0].caller === current.first, true, "exact checked edge identities survive");
  assert.equal(Object.isFrozen(current.recursion.incomingFor(current.second)), true);
  assert.equal(current.calls() === 2 && current.budget.failure() === undefined, true, "a complete immutable index is reused");
});

test("selected incoming sites preserve complete recursive rings, self calls and external entry identity within linear work", () => {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 4096, maximumSteps: 8192 });
  const subject = createSourceStorageSubjects(budget.subject, budget.reject, () => []);
  const owners = Array.from({ length: 128 }, () => ({ parameters: [] }));
  const external = { parameters: [] };
  for (const owner of [...owners, external]) {
    owner.body = { parent: owner };
    owner.parameters.push({ parent: owner });
  }
  const calls = owners.map((caller, index) => ({ region: caller.body, caller, candidate: owners[(index + 1) % owners.length] }));
  const self = { region: owners[1].body, caller: owners[1], candidate: owners[1] };
  const entry = { region: external.body, caller: external, candidate: owners[1] };
  const source = callableSource([...owners, external]);
  let selections = 0;
  const recursion = createSourceStorageScopedRecursion(source, budget, {
    subject, invocations: new Set([...calls, self, entry]), accessorTargets: new Map(),
    callbackEntriesFor: () => [],
    regions: { enclosing: node => node.region }, invocationImplementations: node => {
      selections += 1;
      return new Set([node.candidate]);
    },
  }, (_formal, _candidate, invocation) => ({ context: "caller",
    subjects: new Set([subject(invocation.caller.parameters[0], "input")]) }));
  const component = recursion.componentFor(owners[0]);
  assert.equal(component?.size === owners.length && owners.every(owner => component.has(owner)) && !component.has(external), true,
    "graph transposition preserves exact strongly connected membership, not reachability alone");
  const selected = recursion.incomingFor(owners[1]);
  assert.equal(selected.length === 3 && selected[0].caller === owners[0] && selected[0].invocation === calls[0] &&
    selected[1].caller === owners[1] && selected[1].invocation === self && selected[2].caller === external && selected[2].invocation === entry, true,
    "all original sites retain their exact caller and invocation without unrelated component scans");
  assert.equal(Object.isFrozen(selected) && selected.every(Object.isFrozen), true);
  const formal = subject(owners[70].parameters[0], "input", [{ kind: "array-element" }]);
  const equation = { identity: 0, component, entry: owners[0] };
  const input = recursion.entryInputFor(formal, { kind: "variable", equation, owner: owners[70] });
  assert.equal(input === subject(owners[0].parameters[0], "input", formal.projection), true,
    "only component-internal predecessors prove the same exact projected entry port");
  for (let repeat = 0; repeat < 100; repeat += 1) assert.equal(recursion.incomingFor(owners[1]) === selected, true);
  assert.equal(selections === calls.length + 2 && budget.failure() === undefined, true,
    "one checked graph index serves every demand inside the unchanged finite budget");
});

test("recursive incoming-index discovery preserves independent finite row and work guards", () => {
  for (const limits of [{ maximumSteps: 1 }, { maximumTransportRows: 1 }]) {
    const current = fixture(limits);
    assert.equal(current.recursion.componentFor(current.first) === undefined, true);
    assert.equal(current.budget.failure() !== undefined, true, "no partial SCC publishes around exhaustion");
    assert.equal(current.recursion.componentFor(current.second) === undefined, true, "failure remains sticky on a cached demand");
    assert.equal(current.recursion.incomingFor(current.second) === undefined, true,
      "an unavailable graph cannot masquerade as a complete empty call-site relation");
  }
});

test("a throwing recursive index releases unpublished rows and retries the entire graph instead of a partial component", () => {
  const current = fixture();
  const failure = new Error("original checked call failure");
  current.inspect(node => { if (node === current.secondCall) throw failure; });
  assert.throws(() => current.recursion.componentFor(current.first), error => error === failure);
  current.inspect(() => {});
  const selected = current.recursion.componentFor(current.first);
  assert.equal(selected?.has(current.first) && selected.has(current.second) && current.calls() === 4, true);
  assert.equal(current.budget.failure() === undefined, true, "an exception neither publishes partial proof nor corrupts the resource owner");
});

test("exceptional recursive graph unwind preserves independently owned rows and no unpublished graph history", () => {
  const current = fixture();
  const independent = current.budget.createRows();
  assert.equal(independent.add(3), true);
  const failure = new Error("original checked call failure");
  current.inspect(node => { if (node === current.secondCall) throw failure; });
  assert.throws(() => current.recursion.componentFor(current.first), error => error === failure);
  let remaining = 0;
  while (current.budget.row()) remaining += 1;
  assert.equal(remaining === 125, true, "only the three unrelated live rows survive the failed initialization");
});

test("reentrant graph discovery cannot observe or certify an unfinished recursive index", () => {
  const current = fixture();
  current.inspect(() => assert.equal(current.recursion.componentFor(current.first) === undefined, true));
  assert.equal(current.recursion.componentFor(current.first) === undefined, true);
  assert.match(current.budget.failure(), /unfinished call graph/u);
  assert.equal(current.recursion.componentFor(current.second) === undefined, true, "failure remains sticky");
});

test("invariant recursive ports preserve exact entry and projection identity but never infer a callee capture", () => {
  const current = fixture();
  const component = current.recursion.componentFor(current.first);
  const equation = { identity: 0, component, entry: current.first };
  const formal = current.subject(current.secondInput, "input", [{ kind: "array-element" }]);
  assert.equal(formal !== undefined, true, "the fixture uses a supported exact array projection");
  const variable = { kind: "variable", equation, owner: current.second };
  const selected = current.recursion.entryInputFor(formal, variable);
  assert.equal(selected === current.subject(current.firstInput, "input", formal.projection), true,
    "every checked predecessor forwards the identical entry port and projection");
  assert.equal(current.recursion.entryInputFor(formal, { ...variable, capture: current.firstCall }) === undefined, true,
    "a selected callee's lexical capture is not a caller-entry invariant");
  assert.equal(current.budget.failure() === undefined, true);
});

test("callee-scoped defaults cannot masquerade as invariant forwarded caller ports", () => {
  const current = fixture();
  current.context("callee");
  const component = current.recursion.componentFor(current.first);
  const equation = { identity: 0, component, entry: current.first };
  assert.equal(current.recursion.entryInputFor(current.subject(current.secondInput, "input"),
    { kind: "variable", equation, owner: current.second }) === undefined, true);
  assert.equal(current.budget.failure() === undefined, true, "unsupported invariance is absence of proof, not weakened checking");
});

function selectedEquationFixture() {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `export {};
    type Step = (next: Step, count: number) => object;
    const token = {};
    function step(next: Step, count: number): object { return count === 0 ? token : next(next, count - 1); }
    declare function native(next: Step, count: number): object;
    const first = step(step, 3); const second = step(step, 4);
  ` }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, "the original recursive Step source is checked");
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  const nodes = [];
  const visit = node => {
    nodes.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  const named = name => nodes.find(node => source.ast.is.IsFunctionDeclaration(node) &&
    source.ast.text(source.ast.name(node)) === name);
  const owner = named("step");
  const native = named("native");
  const calls = nodes.filter(source.ast.is.IsCallExpression);
  const recursive = calls.find(node => source.ast.as.AsCallExpression(node).Expression !== undefined &&
    source.ast.text(source.ast.as.AsCallExpression(node).Expression) === "next");
  const entries = calls.filter(node => node !== recursive);
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 4096, maximumSteps: 65536 });
  const original = createSourceStorageTransport(source, [file], budget);
  const invocationInputs = createSourceStorageInvocationInputs(source, budget, original.subject, original.subjectFor,
    original.accessorTargets, invocation => original.unresolvedInvocations.has(invocation), () => undefined, original.inputSlotsFor,
    original.argumentTransports);
  const transport = { ...original, invocationInputs,
    bindingInputFor: createSourceStorageBindingInputs(source.ast, original, budget) };
  const graph = createSourceStorageGraphQueries(budget);
  graph.seal();
  const creation = {
    footprints: createSourceStorageContextFootprints(budget, transport.contextualInputs, transport.contextLocation,
      transport.contextualInputs.applicationFor),
    ownerFor: subject => sourceStorageActivationOwner(source, transport.regions.enclosing, subject),
  };
  const recursion = createSourceStorageScopedRecursion(source, budget, transport, transport.invocationInputs);
  const base = createSourceStorageScopes(source, budget, transport.subject, transport.invocationInputs, graph,
    recursion.entryInputFor, creation, transport.inputSlotsFor);
  const frames = [];
  const scopes = { ...base, frameFor(...args) {
    const selected = base.frameFor(...args);
    if (selected !== undefined) frames.push(selected);
    return selected;
  } };
  const keys = createSourceStorageScopedKeys(source, budget, transport, scopes, creation);
  const equations = createSourceStorageEquations(source, budget, transport, scopes, recursion, keys.invocation);
  const expand = (invocation, mixed = false, pending = false) => {
    const initial = equations.scopeFor(owner, invocation, scopes.empty, scopes.empty, {
      kind: "application", mode: "value", invocation, callee: { kind: "leaf", subject: transport.subject(owner), scope: scopes.empty },
      scope: scopes.empty, projection: [], activation: { kind: "invoke" },
    });
    assert.equal(initial !== undefined && initial.equation !== undefined, true, "the checked recursive entry has one equation");
    const variable = scopes.variable(initial.equation, owner);
    const term = sourceStorageReference(transport.subject(owner, "return"), variable);
    frames.length = 0;
    let reads = 0;
    const alternatives = equations.expand(variable, term, request => {
      reads += 1;
      assert.equal(request.subject === transport.invocationTargets.get(recursive) && request.scope.owner === owner, true,
        "native eligibility reads the host callee in its original caller, never the entered callback frame");
      return new Set((pending ? [] : [owner, ...mixed ? [native] : []])
        .map(node => ({ kind: "leaf", subject: transport.subject(node), scope: scopes.empty })));
    });
    assert.equal(alternatives !== undefined && reads === 1, true, "the possible native edge has one scoped supplier decision");
    assert.equal(budget.failure() === undefined, true, "unchanged finite protection remains intact");
    return { alternatives, frames: [...frames] };
  };
  return { entries, expand, scopes: base, budget, owner,
    inputs: source.ast.parameters(owner).map(parameter => transport.subject(parameter, "input")) };
}

test("term substitutions share unchanged structure without changing genuine or shadowed captures", () => {
  const current = selectedEquationFixture();
  const { scopes, owner, inputs } = current;
  const equation = Object.freeze({ identity: 0, component: new Set([owner]), entry: owner, initial: scopes.empty });
  const first = scopes.variable(equation, owner, current.entries[0]);
  const second = scopes.variable(equation, owner, current.entries[1]);
  assert.equal(first !== undefined && second !== undefined && first !== second, true, "distinct original capture variables");
  const frame = Object.freeze({ kind: "frame", owner, parents: Object.freeze([]), entries: new Map() });
  scopes.withQuery(() => {
    const original = sourceStorageReference(inputs[0], scopes.empty);
    const invocation = Object.freeze({ kind: "application", invocation: current.entries[0],
      callee: original, scope: scopes.empty, projection: Object.freeze([]),
      activation: Object.freeze({ kind: "invoke" }), mode: "value" });
    const conditional = Object.freeze({ kind: "transition", capture: first, condition: original, value: invocation });
    assert.equal(scopes.applyTerm(conditional, new Map([[second, frame]])) === conditional, true,
      "an unrelated substitution preserves the original immutable term DAG");
    const bound = Object.freeze({ ...invocation, callee: sourceStorageReference(inputs[0], second), scope: second });
    const changed = scopes.applyTerm(bound, new Map([[second, frame]]));
    assert.equal(changed !== undefined && changed !== bound && changed.scope === frame && changed.callee.scope === frame, true,
      "sharing never skips a genuine callee or activation substitution");
    const shadowed = Object.freeze({ kind: "transition", capture: second,
      condition: sourceStorageReference(inputs[0], second), value: bound });
    const replaced = scopes.applyTerm(shadowed, new Map([[second, frame]]));
    assert.equal(replaced !== undefined && replaced.condition.scope === frame && replaced.value === bound, true,
      "a transition substitutes its condition but leaves its bound capture's body untouched");
  });
  assert.equal(current.budget.failure() === undefined, true, "exact substitutions remain inside the original finite bounds");
});

test("recursive equation edges wait for selected supplier evidence instead of creating speculative frames", () => {
  const current = selectedEquationFixture();
  const pending = current.expand(current.entries[0], false, true);
  assert.equal(pending.frames.length === 1 && pending.alternatives.length === 1, true,
    "an empty current supplier set admits only the actual initial entry, not a guessed recursive edge");
  const completed = current.expand(current.entries[0]);
  assert.equal(completed.frames.length === 2 && completed.alternatives.length === 2, true,
    "the exact recursive source edge becomes available once its supplier evidence arrives");
  assert.equal(current.budget.failure() === undefined, true, "postponing a producer is not an artificial finite refusal");
});

for (const reverse of [false, true]) test(`selected Step source recursion creates only its two-entry source frames (${reverse})`, () => {
  const current = selectedEquationFixture();
  for (const invocation of reverse ? current.entries.reverse() : current.entries) {
    const selected = current.expand(invocation);
    assert.equal(selected.frames.length === 2 && selected.frames.every(frame => frame.entries.size === 2 && frame.callback === undefined), true,
      "the entry and recursive source frames cannot acquire a phantom unknown-timing native callback frame");
  }
});

test("a mixed Step supplier retains its conditional body-less native callback edge", () => {
  const current = selectedEquationFixture();
  const selected = current.expand(current.entries[0], true);
  assert.equal(selected.frames.filter(frame => frame.callback?.timing === "unknown").length === 1, true,
    "a body-less actual supplier is not certified as source-only");
  assert.equal(selected.alternatives.some(term => term.kind === "transition" && term.capture.callback?.timing === "unknown"), true,
    "the native alternative retains the existing conditional transition rather than a certified execution");
});
