import { fixtureTypeWork, insertFixtureType, insertFixtureSignature } from "./fixtures/types-construction.mjs";
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { before, test } from "node:test";
import { loadFrontFixture } from "./fixtures/front/checked-module.mjs";
import { checkedDomain } from "./fixtures/front/checked-domain.mjs";

let fixture;
let wiring;
let pipeline;
let irInfer;
before(async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  fixture = await loadFrontFixture();
  ({ pipelineWiring: wiring } = await import("../../packages/host/dist/pipeline/wiring.js"));
  pipeline = await import("../../packages/host/dist/pipeline/infer-deps-step.js");
  irInfer = await import("../../packages/host/dist/ir-infer/index.js");
});

const EXPANSION = { maximumDepth: 64, maximumVisits: 4096, maximumUnionMembers: 64, maximumIntersectionMembers: 64 };
const LIMITS = { maximumVariablesPerGroup: 128, maximumAtomicContributionsPerGroup: 256 };
const GRAPH = { maximumWork: 65536, maximumResultEntries: 65536 };

function ready(source) {
  const { checked, interner, snapshot } = fixture.checkedModuleOf(source);
  assert.deepEqual(fixture.verifyChecked(checked, interner), []);
  const domain = checkedDomain(checked, fixture.hir);
  const { nodes } = domain;
  const items = new Map(checked.items.map(item => [item.definition, nodes[item.node]]));
  items.set(checked.tree.tsonic.definition, checked.tree);
  const scopes = fixture.hir.deriveDeclarationScopes(checked, nodes);
  const descriptions = new Map(wiring.decls.describeDefinitions({ module: checked, nodes }, scopes, []).definitions
    .map(item => [item.definition, item]));
  const typeWork = fixtureTypeWork(fixture.types);
  const deps = pipeline.inferDepsOf({ structuralCuts: domain.sources.structuralCuts, cuts: domain.sources.cuts, checkedNodeOf: domain.nodeOf, typeWork,
    bindingScopeOf: definition => scopes.bindingScopeOf(definition) ?? assert.fail("actual checked scope required"),
    rules: { libraries: { sources: [], sourceRoles: [], guarantees: [] },
    types: interner, selectedNativeFacts: snapshot.nativeFacts, typeExpansion: EXPANSION }, hirBody: body => domain.bodyOf.get(body) ?? assert.fail("actual body required"),
    itemOf: definition => items.get(definition) ?? assert.fail("actual declaration required"), bindings: [checked.bindings], ...fixture.hir.createModuleBindingViews([checked.bindings]), limits: LIMITS, graph: GRAPH });
  const inputs = { modules: [{ module: checked, nodes }], types: interner, typeWork, typeExpansion: EXPANSION };
  const partition = wiring.infer.groupsOf(deps, checked.bodies.map(body => body.body));
  assert.equal(partition.kind, "ok");
  return { checked, interner, domain, descriptions, deps, inputs, items, nativeFacts: snapshot.nativeFacts, groups: partition.value };
}

function verificationViews(program, record) {
  const { group, constraints } = record;
  const exported = fixture.types.exportTypes(program.interner, { maximumWork: 1000000, maximumCreatedRecords: 100000 });
  assert.equal(exported.kind, "complete");
  const types = { terms: exported.value.types.map((unused, index) => fixture.types.readType(program.interner, index)),
    signatures: exported.value.signatures.map((unused, index) => fixture.types.readSignature(program.interner, index)) };
  const declarationOf = definition => {
    const node = program.items.get(definition);
    const description = program.descriptions.get(definition);
    return node === undefined || description === undefined ? null : { scope: description.generics,
      parameterCount: "parameters" in node && "nodes" in node.parameters ? node.parameters.nodes.length : null,
      endpoints: "signatures" in node.tsonic ? node.tsonic.signatures : [] };
  };
  return { types, selectedNativeFacts: program.nativeFacts, declarationOf, nominalOf: () => null,
    bindingScopes: irInfer.inferenceBindingSites({ group, constraints, solution: record.solution }).map(binding =>
      program.descriptions.get(binding.definition ?? program.domain.bodyOf.get(binding.site.kind === "body" ? binding.site.body
        : binding.site.kind === "constraint" ? binding.site.constraint.body : assert.fail("This fixture requires its actual binding owner.")).owner).generics),
    nodeExists: reference => program.domain.nodeOf(reference) !== null, localExists: program.domain.localExists };
}

test("candidate requests borrow the checked bodyless endpoint and reject a crossed owning definition", async () => {
  const { callableEndpoints, endpointRequest } = await import("../../packages/host/dist/infer/candidates.js");
  const state = ready("export interface Callable { (flag: boolean): boolean; }"
    + "export function ordinary(flag: boolean): boolean { return flag; }");
  const callable = [...state.items.values()].find(item => item.kind === "CallSignature");
  const ordinary = [...state.items.values()].find(item => item.kind === "FunctionDeclaration");
  assert.ok(callable && ordinary);
  const endpoints = callableEndpoints(state.deps, callable.tsonic.definition);
  assert.equal(endpoints === callable.tsonic.signatures, true);
  assert.equal(endpoints.length, 1);
  const [endpoint] = endpoints;
  assert.equal(endpoint.role, "api-signature");
  assert.equal(endpoint.body, null);
  const bindings = { kind: "instantiated", bindings: { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] } };
  const request = endpointRequest(state.deps, endpoint, bindings);
  assert.deepEqual(request, { definition: callable.tsonic.definition, endpoint: "api-signature", ordinal: 0, bindings });
  const step = wiring.decls.declaredSignatureOf(state.inputs, request, state.domain.sources.cuts);
  assert.equal(step.kind, "done");
  assert.equal(step.value.kind, "ok");
  assert.equal(step.value.value.declaration, callable.tsonic.definition);
  assert.throws(() => callableEndpoints({ ...state.deps, itemOf: () => callable }, ordinary.tsonic.definition),
    /callable endpoint inventory must retain its actual declaration/u);
});

function verifyRecord(program, record) {
  return irInfer.verifyInference({ ...record, ...verificationViews(program, record),
    placedSignatureOf: body => record.placements.get(body) ?? null });
}

function drive(program) {
  const completed = new Map();
  const parts = new Map();
  const signature = (request, group) => {
    assert.equal(group.signatures.some(part => part.definition === request.definition), false,
      "a group never requests its own completed declaration");
    let step = wiring.decls.declaredSignatureOf(program.inputs, request, program.domain.sources.cuts);
    if (step.kind === "paused") {
      const answers = step.requests.map(request => {
        const result = parts.get(irInfer.inferredPartKey(request.part));
        assert.notEqual(result, undefined, "another group's part must really be complete");
        return result;
      });
      step = wiring.decls.resumeDeclaredSignatureOf(program.inputs, step.paused, answers);
    }
    assert.equal(step.kind, "done");
    assert.equal(step.value.kind, "ok");
    assert.equal(step.value.positions.every(position => position.error === null), true);
    return step.value.value;
  };
  for (const group of program.groups) {
    let generation = wiring.infer.constraintsOf(program.deps, group);
    if (generation.kind === "paused") generation = wiring.infer.resumeConstraintsOf(program.deps, generation.paused,
      generation.requests.map(request => request.kind === "inferred-part"
        ? parts.get(irInfer.inferredPartKey(request.part)) ?? assert.fail("the actual outside part must already be verified and complete")
        : { kind: request.kind, value: signature(request.request, group) }));
    assert.equal(generation.kind, "done");
    assert.equal(generation.value.kind, "ok");
    const constraints = generation.value.value.constraints;
    assert.deepEqual(constraints.map(set => set.body), group.bodies);
    assert.deepEqual(constraints.flatMap(set => set.variables.map(variable => variable.id)),
      constraints.flatMap(set => set.variables).map((unused, index) => index));
    const solving = wiring.infer.solveGroup(program.deps, group, generation.value.value, { query: "solutionOf", key: group.id });
    assert.equal(solving.kind, "paused");
    const answers = solving.requests.map(request => {
      if (request.kind === "declaredSignatureOf") return { kind: request.kind, value: signature(request.request, group) };
      const step = wiring.decls.placeSignature(program.inputs, request.placement, { query: "solutionOf", key: group.id }, program.domain.sources.cuts);
      assert.equal(step.kind, "done");
      assert.equal(step.value.kind, "ok");
      assert.equal(step.value.positions.every(position => position.error === null), true);
      return { kind: request.kind, value: step.value.value };
    });
    const done = wiring.infer.resumeSolveGroup(program.deps, solving.paused, answers);
    assert.equal(done.kind, "done");
    assert.equal(done.value.kind, "ok");
    const placements = new Map(group.bodies.map((body, index) => {
      const answer = answers[index];
      return [body, (answer.kind === "placeSignature" ? answer.value.signature : answer.value).id];
    }));
    const record = { group, constraints, generated: generation.value.value, placements, ...done.value.value,
      handoff: { requests: solving.requests, answers } };
    assert.deepEqual(verifyRecord(program, record), []);
    for (const set of constraints) for (const variable of set.variables) if (variable.kind === "signature")
      parts.set(irInfer.inferredPartKey(variable.signature), { part: variable.signature,
        type: record.solution.variables[variable.id].value.type, error: record.solution.variables[variable.id].error,
        origin: { request: { query: "solutionOf", key: group.id },
          position: { kind: "inference-variable", group: group.id, variable: variable.id } } });
    completed.set(group.id, record);
  }
  return completed;
}

test("a fixed destructuring fit reads the actual inline producer and binds each selected slot once", () => {
  const program = ready(`
    function producer(pair: [boolean, string]): [boolean, string] { return pair; }
    export function start(pair: [boolean, string]): boolean {
      const [first, second] = producer(pair);
      return first;
    }
  `);
  const selected = program.checked.tree.statements.nodes[1];
  const body = selected.tsonic.body;
  const { name, initializer } = selected.body.statements.nodes[0].declarationList.declarations.nodes[0];
  const record = [...drive(program).values()].find(row => row.group.bodies.includes(body));
  assert.ok(record);
  const set = record.constraints.find(row => row.body === body);
  const applications = set.constraints.filter(row => row.kind === "call");
  assert.deepEqual(applications.map(row => row.occurrence.node), [initializer.id]);
  const flows = set.constraints.filter(row => row.kind === "flow" && row.role === "initialization");
  assert.deepEqual(flows.map(row => row.occurrence), [initializer, ...name.elements.nodes].map(node => ({ body, node: node.id })));
  assert.equal(flows[0].to, initializer.tsonic.views.read.value);
  const { elements } = fixture.types.readType(program.interner, initializer.tsonic.views.read.value);
  for (const [index, element] of name.elements.nodes.entries()) {
    const row = flows[index + 1];
    assert.equal(row.from, elements[index].type);
    assert.equal(row.to, element.tsonic.declaredType.value);
    const decision = record.solution.constraints.find(selected => selected.constraint.body === body &&
      selected.constraint.index === set.constraints.indexOf(row))?.decision;
    assert.deepEqual(decision, { kind: "flow", embedding: { kind: "identity" } });
  }
  const [first, second] = name.elements.nodes;
  const crossed = program.checked.items.find(row => row.node === first.id).definition;
  assert.throws(() => wiring.infer.constraintsOf({ ...program.deps,
    itemOf: definition => definition === crossed ? second : program.deps.itemOf(definition) }, record.group),
  /a local binding read retains its actual checked variable and selected local/u);
});

test("a finite call spread selects each real tuple slot and the following authored argument", () => {
  const program = ready(`
    function take(first: boolean, second: string, tail: boolean): boolean { return tail; }
    function producer(pair: [boolean, string]): [boolean, string] { return pair; }
    function later(): boolean { return false; }
    export function start(pair: [boolean, string]): boolean { return take(...producer(pair), later()); }
  `);
  const source = program.checked.tree.statements.nodes[3].body.statements.nodes[0].expression;
  const [spread, tail] = source.arguments.nodes;
  const record = [...drive(program).values()].find(row => row.constraints.some(set =>
    set.constraints.some(constraint => constraint.kind === "call" && constraint.occurrence.node === source.id)));
  assert.ok(record);
  const set = record.constraints.find(candidate => candidate.constraints.some(constraint =>
    constraint.kind === "call" && constraint.occurrence.node === source.id));
  const index = set.constraints.findIndex(constraint => constraint.kind === "call" && constraint.occurrence.node === source.id);
  const constraint = set.constraints[index];
  const [operand, later] = constraint.application.arguments;
  assert.deepEqual([operand.kind, operand.occurrence.node, later.kind, later.occurrence.node], ["spread", spread.expression.id, "value", tail.id]);
  assert.equal(spread.expression.kind, "CallExpression");
  const tuple = fixture.types.readType(program.interner, spread.expression.tsonic.views.read.value);
  assert.equal(tuple.kind, "tuple");
  assert.deepEqual(operand.tuple, tuple.elements.map(element => element.type));
  const selected = record.solution.constraints.find(row => row.constraint.body === set.body && row.constraint.index === index).decision;
  assert.equal(selected.kind, "call");
  assert.deepEqual(selected.application.parameters, [
    { kind: "argument", parameter: 0, argument: 0, component: 0, passing: "by-value" },
    { kind: "argument", parameter: 1, argument: 0, component: 1, passing: "by-value" },
    { kind: "argument", parameter: 2, argument: 1, component: null, passing: "by-value" },
  ]);
  const producer = record.solution.constraints.find(row => row.constraint.body === set.body &&
    set.constraints[row.constraint.index]?.occurrence.node === spread.expression.id);
  assert.equal(producer.decision.kind, "call");
  assert.equal(producer.decision.application.result, spread.expression.tsonic.views.read.value);
  const crossed = { ...record, solution: { ...record.solution, constraints: record.solution.constraints.map(row => row.decision === selected
    ? { ...row, decision: { ...selected, application: { ...selected.application, parameters: selected.application.parameters
      .map((parameter, ordinal) => ordinal === 0 ? { ...parameter, component: 1 } : parameter) } } } : row) } };
  assert.equal(verifyRecord(program, crossed).some(row => row.rule === "parameter-mapping-total"
    && row.detail.some(detail => detail.kind === "text" && detail.value === "authored-spread-slots")), true);
});

test("a checked no-value result has one default decision and no invented producer", () => {
  const program = ready("export function quit() { return; } export function value(flag: boolean) { return flag; }");
  const records = [...drive(program).values()];
  const record = records.find(row => row.constraints.some(set =>
    set.constraints.some(constraint => constraint.kind === "default" && constraint.rule === "signature-producers")));
  assert.ok(record);
  const [set] = record.constraints;
  const [variable] = set.variables;
  const [fallback] = set.constraints;
  assert.equal(variable.kind, "signature");
  assert.equal(variable.signature.part.kind, "return");
  assert.deepEqual(fallback, { kind: "default", rule: "signature-producers", variable: variable.id,
    occurrence: variable.occurrence, type: record.solution.bodies[0].completion });
  assert.deepEqual(set.evidence, []);
  assert.equal(record.contributions.length, 1);
  assert.deepEqual(record.contributions[0].reads, [variable.id]);
  assert.deepEqual(record.contributions[0].bounds, []);
  assert.deepEqual(record.solution.checks, []);
  assert.deepEqual(record.solution.constraints[0].decision, { kind: "default", type: fallback.type });
  const value = records.find(row => row !== record && row.group.signatures.some(part => part.part.kind === "return"));
  const type = value.solution.bodies[0].completion;
  const crossed = { ...record, solution: { ...record.solution, constraints: record.solution.constraints.map(row =>
    ({ ...row, decision: { ...row.decision, type } })) } };
  assert.equal(verifyRecord(program, crossed).some(violation => violation.rule === "decision-kind"), true);
});

test("verified group placement retains the actual endpoint and rejects a same-table foreign answer", async () => {
  const { completeInference } = await import("../../packages/host/dist/pipeline/inference-step.js");
  const program = ready("export function left(flag: boolean): boolean { return flag; } "
    + "export function right(flag: boolean): boolean { return flag; }");
  const records = [...drive(program).values()];
  const callable = records.filter(record => record.handoff.requests[0].placement.kind === "callable-body");
  assert.equal(callable.length, 2);
  const [first, second] = callable;
  const body = first.group.bodies[0];
  const answer = first.handoff.answers[0];
  const foreign = second.handoff.answers[0];
  const views = verificationViews(program, first);
  const complete = handoff => completeInference(first.group, first.generated, first, views, handoff, program.deps.hirBody);
  assert.equal(complete(first.handoff).placed.get(body) === answer.value, true);
  assert.equal(views.types.signatures[foreign.value.signature.id] === foreign.value.signature, true);
  assert.throws(() => complete({ ...first.handoff, answers: [foreign] }), /actual complete bindings/u);
  assert.throws(() => complete({ ...first.handoff, answers: [{ ...answer, value: { ...answer.value, signature: foreign.value.signature } }] }),
    /actual checked declaration/u);
  const root = program.deps.hirBody(body).root;
  const originalOwner = answer.value.signature.owner;
  const owner = answer.value.request.definition;
  const otherOwner = originalOwner?.kind === "body"
    ? { kind: "item", value: { owner, node: program.items.get(owner).id } }
    : { kind: "body", value: { body, node: root.id } };
  const crossedId = insertFixtureSignature(fixture.types, program.interner, { ...answer.value.signature, owner: otherOwner });
  const crossed = fixture.types.readSignature(program.interner, crossedId);
  const crossedResult = { ...first, solution: { ...first.solution, bodies: [{ ...first.solution.bodies[0], signature: crossedId }] } };
  const crossedHandoff = { ...first.handoff, answers: [{ ...answer, value: { ...answer.value, signature: crossed } }] };
  assert.throws(() => completeInference(first.group, first.generated, crossedResult, verificationViews(program, crossedResult),
    crossedHandoff, program.deps.hirBody), /actual checked signature owner occurrence/u);
  for (const request of [
    { ...answer.value.request, endpoint: "api-signature" },
    { ...answer.value.request, ordinal: 1 },
  ]) {
    assert.throws(() => complete({ ...first.handoff, answers: [{ ...answer, value: { ...answer.value, request } }] }),
      /actual checked endpoint role, ordinal and body/u);
  }
  assert.throws(() => complete({ ...first.handoff, answers: [{ ...answer, value: { ...answer.value,
    request: { ...answer.value.request, bindings: foreign.value.request.bindings },
  } }] }), /actual complete bindings/u);

  const request = answer.value.request;
  const declared = wiring.decls.declaredSignatureOf(program.inputs, request, program.domain.sources.cuts);
  assert.equal(declared.kind, "done");
  assert.equal(declared.value.kind, "ok");
  const fromDeclaration = complete({ requests: [{ kind: "declaredSignatureOf", request }],
    answers: [{ kind: "declaredSignatureOf", value: declared.value.value }] }).placed.get(body);
  assert.equal(fromDeclaration.request === request && fromDeclaration.signature === declared.value.value, true);
});

test("an actual numeric assignment selects against ready native storage without bounding it again", () => {
  const program = ready("export let value = 1; value = (9_007_199_254_740_993);");
  const scheme = program.deps.rules.constraints.literal;
  let evaluation;
  let admission;
  const literal = { ...scheme, evaluate: (input, work) => {
    evaluation = input;
    admission = work;
    return scheme.evaluate(input, work);
  } };
  const traced = { ...program, deps: { ...program.deps, rules: { ...program.deps.rules,
    constraints: { ...program.deps.rules.constraints, literal } } } };
  const record = [...drive(traced).values()].find(row => row.contributions.some(item => item.key.role.kind === "literal"));
  const { constraint, evidence, contribution } = evaluation;
  const [destination] = evidence;
  const authored = program.domain.nodeOf({ kind: "body", value: constraint.occurrence });
  const target = program.domain.nodeOf(destination.value.component);
  assert.deepEqual(constraint.value, authored.tsonic.literal);
  assert.equal(target.tsonic.role, "assignment-target");
  assert.notEqual(target.tsonic.place.value.write.value, constraint.destination);
  assert.deepEqual(fixture.types.readType(program.interner, constraint.destination), { kind: "primitive", primitive: "int64" });
  assert.deepEqual(contribution.reads, []);
  assert.deepEqual(contribution.bounds, []);
  assert.deepEqual(record.solution.constraints.find(row => row.decision.kind === "literal").decision,
    { kind: "literal", embedding: { kind: "identity" } });
  assert.throws(() => scheme.evaluate({ ...evaluation, evidence: [] }, admission), /one actual destination evidence/);
  const input = { context: { occurrence: constraint.occurrence, origin: authored.origin,
    bindings: { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] } },
    literal: constraint.value, destination: destination.value };
  const selected = program.deps.rules.literalFit(input, admission);
  assert.deepEqual(selected.value, { kind: "decided", decision: { kind: "identity" } });
  const exactFitWork = 4 + 3 * 64;
  const exactFitEntries = 3 + 3 * 64;
  for (const dimension of ["work", "created-records"]) {
    const limited = { unit: admission.unit, typeWork: fixture.types.createTypePublicationWork({
      maximumWork: dimension === "work" ? exactFitWork - 1 : exactFitWork,
      maximumCreatedRecords: dimension === "created-records" ? exactFitEntries - 1 : exactFitEntries,
    }) };
    const stopped = program.deps.rules.literalFit(input, limited);
    assert.equal(stopped.kind, "refused");
    assert.equal(stopped, fixture.types.typePublicationRefusalOf(limited.typeWork));
    assert.equal(program.deps.rules.literalFit(input, limited), stopped);
    assert.equal(stopped.diagnostics[0].site.origin, authored.origin);
  }
  const exact = { unit: admission.unit, typeWork: fixture.types.createTypePublicationWork({
    maximumWork: exactFitWork, maximumCreatedRecords: exactFitEntries,
  }) };
  assert.deepEqual(program.deps.rules.literalFit(input, exact), selected);
});

test("native index Rules use the solved key, reached access and carrier's own bounds failure", () => {
  const program = ready("export function keep(flag: boolean): boolean { return flag; }");
  const checked = program.checked.tree.statements.nodes[0];
  const group = program.groups.find(row => row.bodies.includes(checked.tsonic.body));
  assert.notEqual(group, undefined);
  const occurrence = { body: checked.tsonic.body, node: checked.body.statements.nodes[0].expression.id };
  const add = term => insertFixtureType(fixture.types, program.interner, term);
  const element = add({ kind: "primitive", primitive: "bool" });
  const integral = add({ kind: "primitive", primitive: "uint64" });
  const open = add({ kind: "open", group: group.id, variable: 0 });
  const output = add({ kind: "open", group: group.id, variable: 1 });
  const array = add({ kind: "array", element, readonly: false });
  const frozen = add({ kind: "array", element, readonly: true });
  const fixed = add({ kind: "fixed-array", element, extent: { length: 4n, runtimeBase: "number" } });
  const bindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
  const context = { occurrence, origin: checked.origin, bindings };
  const value = type => ({ type, component: { kind: "body", value: occurrence }, category: { kind: "dynamic" },
    numeric: null, sum: null, nominal: null, pointer: null });

  for (const [carrier, receiver, access, failure] of [
    ["array", array, "write", program.nativeFacts.arrayIndexFailure],
    ["array", frozen, "read", program.nativeFacts.arrayIndexFailure],
    ["fixed-array", fixed, "read-write", program.nativeFacts.fixedArrayIndexFailure],
  ]) {
    const scheme = program.deps.rules.constraints.index;
    const reference = { body: occurrence.body, index: 0 };
    const constraint = { kind: "index", occurrence, receiver, key: open, access, result: element, bindings };
    const listed = scheme.enumerate({ constraint, group: group.id, variables: [], reference });
    assert.equal(listed.kind, "ok");
    const [contribution] = listed.value;
    assert.deepEqual(contribution.reads, [0]);
    assert.deepEqual(contribution.bounds, []);
    const expected = { carrier, holding: carrier === "array" ? "by-reference" : "in-place", receiver, key: integral, read: access === "write" ? null : element,
      write: access === "read" ? null : element, failure,
      writeCheck: access === "read" ? null : program.nativeFacts.destinationCheck };
    const input = { constraint, contribution, evidence: [receiver, open, element].map(type => ({ value: value(type), error: null })),
      reads: [{ variable: 0, value: value(integral), error: null }], origin: checked.origin };
    const solved = scheme.evaluate(input);
    assert.deepEqual(solved, { kind: "ok", diagnostics: [], value: {
      bounds: [], selectedCandidate: null, decision: { kind: "index", index: expected },
    } });
    assert.deepEqual(program.deps.rules.index({ context, receiver: value(receiver), key: value(integral), access, result: element }).value,
      { kind: "decided", decision: expected });
    assert.throws(() => scheme.evaluate({ ...input, reads: [] }), /final value of each declared read/);
    const authored = { ...constraint, result: output };
    const footprint = scheme.enumerate({ constraint: authored, group: group.id, variables: [], reference });
    assert.equal(footprint.kind, "ok");
    const [producer] = footprint.value;
    assert.deepEqual(producer.reads, [0]);
    assert.deepEqual(producer.bounds, [1]);
    const evaluated = scheme.evaluate({ ...input, constraint: authored, contribution: producer,
      evidence: [receiver, open, output].map(type => ({ value: value(type), error: null })) });
    assert.equal(evaluated.kind, "ok");
    assert.deepEqual(evaluated.value.decision, { kind: "index", index: expected });
    const [produced] = evaluated.value.bounds;
    assert.equal(evaluated.value.bounds.length, 1);
    assert.equal(produced.kind, "producer");
    assert.equal(produced.variable, 1);
    assert.equal(produced.value.type, element);
    assert.deepEqual(produced.value.component, { kind: "body", value: occurrence });
  }
  for (const [receiver, key, access, result] of [
    [element, integral, "read", element], [array, element, "read", element],
    [frozen, integral, "write", element], [array, integral, "read", integral],
  ]) assert.throws(() => program.deps.rules.index({ context, receiver: value(receiver), key: value(key), access, result }),
    error => error.cause.owner === "rules" && /not decided yet:/.test(error.message));
});

test("a supplied argument retains its outside inferred part and its actual use occurrence", () => {
  const program = ready("function use(value = wide) { return value; } const wide = 9_007_199_254_740_993; export const observed = use(wide);");
  const records = [...drive(program).values()];
  const caller = records.find(record => record.constraints.some(set => set.constraints.some(row => row.kind === "call")));
  const system = caller.constraints.find(set => set.constraints.some(row => row.kind === "call"));
  const index = system.constraints.findIndex(row => row.kind === "call");
  const call = system.constraints[index];
  const [argument] = call.application.arguments;
  const source = program.domain.nodeOf({ kind: "body", value: argument.occurrence });
  assert.equal(source.kind, "Identifier");
  assert.equal(source.text, "wide");
  const [producer] = records.filter(record => record.group.id !== caller.group.id
    && record.constraints.some(set => set.variables.some(variable => variable.kind === "literal")));
  const [variable] = producer.constraints.flatMap(set => set.variables).filter(row => row.kind === "signature" && row.signature.part.kind === "variable");
  const finalized = producer.solution.variables[variable.id].value.type;
  assert.equal(argument.type, finalized);
  assert.deepEqual(fixture.types.readType(program.interner, finalized), { kind: "primitive", primitive: "int64" });
  const [evidence] = system.evidence.filter(row => row.value.component.kind === "body"
    && row.value.component.value.node === argument.occurrence.node);
  assert.deepEqual(evidence.value.component, { kind: "body", value: argument.occurrence });
  assert.equal(evidence.value.type, finalized);
  const contribution = caller.contributions.find(row => row.constraint.body === system.body && row.constraint.index === index);
  assert.deepEqual(contribution.reads, []);
  assert.equal(contribution.bounds.length, 1);
  const decision = caller.solution.constraints.find(row => row.constraint.body === system.body && row.constraint.index === index).decision;
  assert.deepEqual(decision.application.parameters, [{ kind: "argument", parameter: 0, argument: 0, component: null, passing: "by-value" }]);
  assert.equal(decision.application.result, finalized);
});

test("native default reads the finalized exact literal rather than writing a second producer", () => {
  const program = ready("export const value = 9_007_199_254_740_993;");
  const completed = [...drive(program).values()].find(record => record.constraints.some(set => set.constraints.some(entry => entry.kind === "default")));
  assert.ok(completed);
  const source = completed.constraints.find(set => set.constraints.some(entry => entry.kind === "default"));
  const constraint = source.constraints.find(entry => entry.kind === "default");
  const literal = source.variables.find(variable => variable.id === constraint.variable);
  assert.equal(literal.kind, "literal");
  assert.equal(literal.value.value.numerator, 9007199254740993n);
  const contribution = completed.contributions.find(row => row.key.role.kind === "default");
  assert.deepEqual(contribution.bounds, []);
  assert.deepEqual(contribution.reads, [literal.id]);
  const final = completed.solution.variables[literal.id];
  assert.deepEqual(fixture.types.readType(program.interner, final.value.type), { kind: "primitive", primitive: "int64" });
  const decision = completed.solution.constraints.find(row => row.decision.kind === "default");
  assert.deepEqual(decision.decision, { kind: "default", type: final.value.type });
  const crossedType = insertFixtureType(fixture.types, program.interner, { kind: "primitive", primitive: "float64" });
  assert.equal(verifyRecord(program, { ...completed, solution: { ...completed.solution,
    constraints: completed.solution.constraints.map(row => row === decision ? { ...row, decision: { kind: "default", type: crossedType } } : row),
  } }).some(violation => violation.rule === "decision-kind"), true);
  assert.equal(verifyRecord(program, { ...completed, contributions: completed.contributions.map(row => row === contribution
    ? { ...row, reads: [], bounds: [literal.id] } : row),
  }).some(violation => violation.rule === "contribution-footprint-complete"), true);
  const rule = program.deps.rules.constraints.default;
  assert.throws(() => rule.evaluate({ constraint, reads: [], evidence: [], candidates: [], contribution }),
    /reads its own finalized variable/u);
  const group = completed.group;
  const generated = wiring.infer.constraintsOf(program.deps, group);
  assert.equal(generated.kind, "done");
  assert.equal(generated.value.kind, "ok");
  const limits = { ...program.deps.graph, maximumWork: source.variables.length };
  const stopped = wiring.infer.solveGroup({ ...program.deps, graph: limits }, group, generated.value.value,
    { query: "solutionOf", key: group.id });
  assert.equal(stopped.kind, "done");
  assert.equal(stopped.value.kind, "refused");
  assert.equal(stopped.value.diagnostics[0].code.name, "TSONIC_COMPILER_RESOURCE_LIMIT");
});

test("native literal defaults follow only the actual unannotated producer positions", () => {
  const program = ready("export function inferred(flag: boolean) { if (flag) return (1); return (2); } "
    + "export function withDefault(value = (3)) { return value; } export const sum = (4) + 5;");
  const defaults = [...drive(program).values()].flatMap(record => record.constraints.flatMap(set => set.constraints
    .filter(constraint => constraint.kind === "default").map(constraint => {
      const literal = program.domain.nodeOf({ kind: "body", value: constraint.occurrence });
      const body = program.domain.bodyOf.get(set.body);
      assert.equal(literal.kind, "NumericLiteral");
      assert.equal(literal.tsonic.literal.value.numerator, BigInt(literal.text));
      assert.deepEqual(fixture.types.readType(program.interner, record.solution.variables[constraint.variable].value.type),
        { kind: "primitive", primitive: "int64" });
      return [literal.text, body.root.kind];
    })));
  assert.deepEqual(defaults.sort(([left], [right]) => left.localeCompare(right)),
    [["1", "Block"], ["2", "Block"], ["3", "ParenthesizedExpression"], ["4", "BinaryExpression"], ["5", "BinaryExpression"]]);

  for (const source of ["export function declared(): number { return (1); }",
    "export function declared(value: number = (1)): number { return value; }"]) {
    const annotated = ready(source);
    const generated = annotated.groups.flatMap(group => {
      let step = wiring.infer.constraintsOf(annotated.deps, group);
      if (step.kind === "paused") step = wiring.infer.resumeConstraintsOf(annotated.deps, step.paused, step.requests.map(request => {
        assert.equal(request.kind, "declaredSignatureOf");
        const declared = wiring.decls.declaredSignatureOf(annotated.inputs, request.request, annotated.domain.sources.cuts);
        assert.equal(declared.kind, "done");
        assert.equal(declared.value.kind, "ok");
        return { kind: request.kind, value: declared.value.value };
      }));
      assert.equal(step.kind, "done");
      assert.equal(step.value.kind, "ok");
      return step.value.value.constraints.flatMap(set => set.constraints);
    });
    assert.equal(generated.some(constraint => constraint.kind === "default"), false);
    const flows = generated.filter(constraint => constraint.kind === "flow"
      && fixture.types.readType(annotated.interner, constraint.from).kind === "literal");
    assert.equal(flows.length, 1);
    assert.deepEqual(fixture.types.readType(annotated.interner, flows[0].to), { kind: "primitive", primitive: "float64" });
  }
});

test("Rules finalizes an inferred Boolean against its own checked bound, never a borrowed literal bound", () => {
  const program = ready("export let state = true; export const exact = false;");
  const completed = [...drive(program).values()];
  const initializers = completed.flatMap(record => record.constraints.flatMap(set => set.variables
    .filter(variable => variable.kind === "signature" && variable.signature.part.kind === "variable")
    .map(variable => ({ variable, solution: record.solution, declaration: program.items.get(variable.signature.definition) }))));
  const mutable = initializers.find(row => row.declaration.name.text === "state");
  const constant = initializers.find(row => row.declaration.name.text === "exact");
  assert.ok(mutable && constant);
  const check = mutable.solution.checks.find(entry => entry.variable === mutable.variable.id && entry.bound.kind === "producer");
  assert.ok(check);
  const input = { variable: mutable.variable, producers: [check.bound], demands: [],
    default: null, declaredConstraint: null, declaredDefault: null };
  const { finalize } = program.deps.rules.variables.signature;
  const actual = finalize({ ...input, inferredTypeBound: mutable.declaration.tsonic.inferredTypeBound });
  assert.equal(actual.kind, "ok");
  assert.deepEqual(fixture.types.readType(program.interner, actual.value.value.type), { kind: "primitive", primitive: "bool" });
  assert.equal(check.outcome.embedding.conversion, "literal-fit");
  assert.throws(() => finalize({ ...input, inferredTypeBound: constant.declaration.tsonic.inferredTypeBound }),
    /inside its actual checker bound/u);
  assert.throws(() => finalize({ ...input, inferredTypeBound: { kind: "unavailable", reason: "not-provided", causes: [] } }),
    /actual checker bound for an inferred Boolean initializer/u);
});

test("real boolean negation retains one unary operator constraint with its actual operand evidence", () => {
  const program = ready("export function negate(flag: boolean): boolean { return !flag; }\n");
  const record = [...drive(program).values()].find(record => record.constraints.some(set =>
    set.constraints.some(constraint => constraint.kind === "op")));
  const system = record.constraints.find(set => set.constraints.some(constraint => constraint.kind === "op"));
  const position = system.constraints.findIndex(constraint => constraint.kind === "op");
  const constraint = system.constraints[position];
  assert.equal(constraint.operator, "!");
  assert.equal(constraint.operands.length, 1);
  const node = program.domain.nodeOf({ kind: "body", value: constraint.occurrence });
  assert.equal(node.kind, "PrefixUnaryExpression");
  assert.deepEqual(system.evidence.slice(0, 2).map(value => value.value.component), [
    { kind: "body", value: { body: constraint.occurrence.body, node: node.operand.id } },
    { kind: "body", value: constraint.occurrence },
  ]);
  const decision = record.solution.constraints.find(solved => solved.constraint.body === system.body
    && solved.constraint.index === position).decision;
  assert.equal(decision.kind, "op");
  assert.deepEqual(decision.operation.operation, { kind: "native-operator", operator: "!", carrier: "bool" });
  assert.deepEqual(decision.operation.operands, constraint.operands);
  assert.deepEqual(decision.operation.execution, { kind: "pure" });
  assert.equal(isDeepStrictEqual(irInfer.parseConstraints(irInfer.printConstraints(system)), { kind: "parsed", value: system }), true);
});

test("unary elaboration retains the actual Rules decision and rejects a missing or foreign unary realization", () => {
  const program = ready("export function negate(flag: boolean): boolean { return !flag; }\n");
  const record = [...drive(program).values()].find(record => record.constraints.some(set =>
    set.constraints.some(constraint => constraint.kind === "op")));
  const constraints = record.constraints.find(set => set.constraints.some(constraint => constraint.kind === "op"));
  const body = program.domain.bodyOf.get(constraints.body);
  const deps = { cuts: program.domain.sources.cuts, types: program.interner, typeWork: program.inputs.typeWork, rules: program.deps.rules, nodeOf: program.domain.nodeOf, bindingOf: program.deps.bindingOf,
    typeOf: type => fixture.types.readType(program.interner, type),
    signatureOf: signature => fixture.types.readSignature(program.interner, signature),
    checkerDiagnosticsOf: module => {
      assert.equal(module, program.checked.module);
      return program.checked.checkerDiagnostics;
    } };
  const input = { instance: { body: body.body, bindings: { kind: "parametric" } },
    scope: program.descriptions.get(body.owner).generics, body, layoutAlias: null,
    typing: { kind: "ready", constraints, solution: record.solution, template: null }, nestedBodies: [], initializers: [] };
  const result = wiring.elaborate.elaborate(deps, input);
  assert.equal(result.kind, "ok");
  const expression = result.value.root.statements.nodes[0].expression;
  const retained = record.solution.constraints.find(solved => solved.decision.kind === "op").decision.operation;
  assert.equal(expression.tsonic.operation.kind, "decided");
  assert.equal(expression.tsonic.operation.decision.decision, retained);
  assert.equal(expression.id, body.root.statements.nodes[0].expression.id);
  assert.equal(expression.operand.id, body.root.statements.nodes[0].expression.operand.id);
  const incomplete = { ...record.solution, constraints: record.solution.constraints.filter(solved => solved.decision.kind !== "op") };
  assert.throws(() => wiring.elaborate.elaborate(deps, { ...input, typing: { ...input.typing, solution: incomplete } }),
    error => error.cause?.owner === "elaborate" && error.message.includes("no operator decision at the unary expression"));
  const crossed = { ...record.solution, constraints: record.solution.constraints.map(solved => solved.decision.kind === "op"
    ? { ...solved, decision: { ...solved.decision, operation: { ...retained, operation: { ...retained.operation, operator: "~" } } } }
    : solved) };
  assert.throws(() => wiring.elaborate.elaborate(deps, { ...input, typing: { ...input.typing, solution: crossed } }),
    error => error.cause?.owner === "elaborate" && error.message.includes("the native operator decision must retain its selected operator"));
  for (const [field, value] of [["operator", "TildeToken"], ["role", "update"]]) {
    const changed = structuredClone(body);
    const unary = changed.root.statements.nodes[0].expression;
    if (field === "operator") unary.operator = value;
    else unary.tsonic.role = value;
    assert.throws(() => wiring.elaborate.elaborate(deps, { ...input, body: changed }),
      error => error.cause?.owner === "elaborate" && error.message.includes("the unary operator"));
  }
});

test("boolean negation never substitutes truthiness for a different native operand carrier", () => {
  const program = ready("export function negate(flag: boolean): boolean { return !flag; }\n");
  const body = program.checked.bodies.find(body => body.params.length === 1);
  const occurrence = { body: body.body, node: body.root.statements.nodes[0].expression.id };
  const input = type => ({ context: { occurrence, origin: body.root.origin,
    bindings: { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] } }, operator: "!", operands: [{ type,
    component: { kind: "body", value: occurrence }, category: { kind: "dynamic" },
    numeric: null, sum: null, nominal: null, pointer: null }] });
  const boolean = insertFixtureType(fixture.types, program.interner, { kind: "primitive", primitive: "bool" });
  const selected = program.deps.rules.operator(input(boolean));
  assert.equal(selected.kind, "ok");
  assert.equal(selected.value.kind, "decided");
  assert.equal(selected.value.decision.result, boolean);
  for (const primitive of ["float64", "int32", "char"]) {
    const type = insertFixtureType(fixture.types, program.interner, { kind: "primitive", primitive });
    assert.throws(() => program.deps.rules.operator(input(type)),
      error => error.cause?.owner === "rules" && error.message.includes(`the unary operator ! over ${primitive}`));
  }
});

test("real direct scalar call retains one authoritative candidate endpoint relation and its exact completion", () => {
  const program = ready("export function value(): boolean { return true; } export function read(): boolean { return value(); }\n");
  const records = [...drive(program).values()];
  const record = records.find(record => record.constraints.some(set => set.constraints.some(constraint => constraint.kind === "call")));
  assert.notEqual(record, undefined);
  const system = record.constraints.find(set => set.constraints.some(constraint => constraint.kind === "call"));
  const candidate = system.candidates[0].candidates[0];
  const original = program.domain.bodyOf.get(system.body).candidateLists[0].candidates[0];
  assert.equal(candidate.appliedSignature, original.appliedSignature);
  assert.equal(candidate.bindings, original.bindings);
  assert.equal(candidate.conditionalFailure, original.conditionalFailure);
  assert.equal(candidate.contributions, original.contributions);
  assert.equal(candidate.endpoints.kind, "available");
  const declaration = program.items.get(candidate.declaration);
  assert.equal(candidate.endpoints.value.api.body, declaration.tsonic.body);
  assert.equal(candidate.endpoints.value.advertised.signature, candidate.endpoints.value.api.signature);
  const decision = record.solution.constraints.find(solved => solved.decision.kind === "call").decision;
  assert.equal(decision.application.api, candidate.endpoints.value.api);
  assert.equal(decision.application.result, fixture.types.readSignature(program.interner, decision.application.api.signature).result);
  assert.equal(isDeepStrictEqual(irInfer.parseConstraints(irInfer.printConstraints(system)), { kind: "parsed", value: system }), true,
    "The actual authoritative candidate and call constraint survive the canonical text boundary.");
  const retired = { ...system, candidates: [{ ...system.candidates[0], candidates: [{ ...original,
    advertised: candidate.endpoints.value.advertised, api: candidate.endpoints.value.api }] }] };
  assert.throws(() => irInfer.printConstraints(retired), TypeError);
  const unavailable = { kind: "unavailable", reason: "incomplete-association", causes: [] };
  const pending = { ...system, candidates: [{ ...system.candidates[0], candidates: [{ ...candidate, endpoints: unavailable }] }] };
  assert.equal(isDeepStrictEqual(irInfer.parseConstraints(irInfer.printConstraints(pending)), { kind: "parsed", value: pending }), true,
    "An unavailable endpoint association is preserved without fabricating an endpoint.");
  const first = wiring.infer.constraintsOf(program.deps, record.group);
  assert.equal(first.kind, "paused");
  const callee = first.requests.find(request => request.kind === "declaredSignatureOf" && request.request.definition === candidate.declaration);
  assert.notEqual(callee, undefined);
  assert.equal(callee.request.endpoint, candidate.endpoints.value.api.role);
  assert.equal(callee.request.bindings.kind, "instantiated");
});

test("a same-group call reads its actual finalized argument, preserves dependency errors and admits its exact solve footprint", () => {
  const program = ready("export function value(input: boolean): boolean { return input; } export function read(input: boolean): boolean { return value(!input); }\n");
  const scheme = program.deps.rules.constraints.call;
  let actual;
  const traced = { ...program, deps: { ...program.deps, rules: { ...program.deps.rules,
    constraints: { ...program.deps.rules.constraints, call: { ...scheme, evaluate: input => {
      actual = input;
      return scheme.evaluate(input);
    } } } } } };
  const record = [...drive(traced).values()].find(record => record.constraints.some(set =>
    set.constraints.some(constraint => constraint.kind === "call")));
  const system = record.constraints.find(set => set.constraints.some(constraint => constraint.kind === "call"));
  const argument = fixture.types.readType(program.interner, actual.constraint.application.arguments[0].type);
  const result = fixture.types.readType(program.interner, actual.constraint.application.result);
  assert.equal(argument.kind, "open");
  assert.equal(result.kind, "open");
  assert.equal(argument.group, record.group.id);
  assert.deepEqual(actual.contribution.reads, [argument.variable]);
  assert.deepEqual(actual.contribution.bounds, [result.variable]);
  assert.equal(actual.reads[0], record.solution.variables[argument.variable]);
  assert.equal(fixture.types.readType(program.interner, actual.reads[0].value.type).primitive, "bool");
  assert.throws(() => scheme.evaluate({ ...actual, reads: [] }),
    error => error.cause?.owner === "rules" && error.message.includes("actual final value of every declared variable read"));
  const enumeration = { group: record.group.id, remainingContributions: LIMITS.maximumAtomicContributionsPerGroup,
    constraint: actual.constraint, reference: actual.contribution.constraint, variables: system.variables,
    candidates: actual.candidates, evidence: actual.evidence };
  const repeated = { ...actual.constraint, application: { ...actual.constraint.application,
    arguments: [{ ...actual.constraint.application.arguments[0], type: actual.constraint.application.result },
      actual.constraint.application.arguments[0], actual.constraint.application.arguments[0]] } };
  assert.deepEqual(scheme.enumerate({ ...enumeration, constraint: repeated }).value[0].reads,
    [result.variable, argument.variable].sort((left, right) => left - right));
  const foreign = insertFixtureType(fixture.types, program.interner, { kind: "open",
    group: program.groups.find(group => group.id !== record.group.id).id, variable: argument.variable });
  assert.throws(() => scheme.enumerate({ ...enumeration, constraint: { ...actual.constraint,
    application: { ...actual.constraint.application, arguments: [{ ...actual.constraint.application.arguments[0], type: foreign }] } } }),
  error => error.cause?.owner === "rules" && error.message.includes("an open type of group"));
  const errorType = insertFixtureType(fixture.types, program.interner, { kind: "error" });
  const error = { kind: "error", causes: [{ kind: "unit", unit: { request: { query: "solutionOf", key: record.group.id },
    position: { kind: "inference-variable", group: record.group.id, variable: argument.variable } } }] };
  const failed = scheme.evaluate({ ...actual, reads: [{ ...actual.reads[0], value: { ...actual.reads[0].value,
    type: errorType, category: { kind: "dynamic" }, numeric: null, sum: null, nominal: null, pointer: null }, error }] });
  assert.equal(failed.kind, "ok");
  assert.deepEqual(failed.diagnostics, []);
  assert.equal(failed.value.decision.kind, "error");
  assert.equal(failed.value.decision.error, error);
  assert.equal(failed.value.selectedCandidate, null);
  assert.equal(failed.value.bounds.length, 1);
  assert.equal(failed.value.bounds[0].variable, result.variable);
  assert.equal(failed.value.bounds[0].value.type, errorType);
  assert.equal(failed.value.bounds[0].error, error);
  assert.deepEqual([system.variables.length, record.contributions.length,
    record.contributions.reduce((count, contribution) => count + contribution.reads.length, 0),
    record.contributions.reduce((count, contribution) => count + contribution.bounds.length, 0),
    record.solution.constraints.length], [2, 3, 2, 2, 3]);
  const observed = { kind: "call", occurrence: actual.constraint.occurrence, origin: actual.origin, scope: actual.scope };
  const generated = { constraints: record.constraints, outsideParts: [], selectionContexts: [observed] };
  const unit = { query: "solutionOf", key: record.group.id };
  const crossed = { ...generated, selectionContexts: [{ ...observed, occurrence: actual.constraint.application.arguments[0].occurrence }] };
  assert.throws(() => wiring.infer.solveGroup(program.deps, record.group, crossed, unit), /actual checked occurrence origin in constraint order/);
  assert.throws(() => wiring.infer.solveGroup(program.deps, record.group, {
    ...generated, selectionContexts: [{ kind: "member", occurrence: observed.occurrence, origin: observed.origin }],
  }, unit), /selection context must have the same role/u);
  for (let maximumWork = 0; maximumWork < 14; maximumWork += 1) {
    const under = wiring.infer.solveGroup({ ...program.deps, graph: { ...GRAPH, maximumWork },
      hirBody: () => assert.fail("a refused solve cannot read a later signature body"),
      itemOf: () => assert.fail("a refused solve cannot read a later signature declaration") }, record.group, generated, unit);
    assert.equal(under.kind, "done", `maximum ${maximumWork}`);
    assert.equal(under.value.kind, "refused", `maximum ${maximumWork}`);
    assert.equal(under.value.diagnostics.length, 1);
  }
  const exact = wiring.infer.solveGroup({ ...program.deps, graph: { ...GRAPH, maximumWork: 14 } }, record.group, generated, unit);
  assert.equal(exact.kind, "paused");
  assert.equal(exact.paused.solved.length, 3);
});

function callContext(program, group, constraint) {
  const body = program.domain.bodyOf.get(constraint.occurrence.body);
  const node = program.domain.nodeOf({ kind: "body", value: constraint.occurrence });
  return { origin: node.origin, scope: program.deps.bindingScopeOf(body.owner), typeWork: program.deps.typeWork,
    unit: { query: "solutionOf", key: group.id } };
}

test("constructed call result categories retain the selected native carrier without fabricating number evidence for char", () => {
  const program = ready("export function value(): boolean { return true; } export function read(): boolean { return value(); }\n");
  const record = [...drive(program).values()].find(record => record.constraints.some(set =>
    set.constraints.some(constraint => constraint.kind === "call")));
  const system = record.constraints.find(set => set.constraints.some(constraint => constraint.kind === "call"));
  const original = system.constraints.find(constraint => constraint.kind === "call");
  const originalCandidate = system.candidates[0].candidates[0];
  const signature = fixture.types.readSignature(program.interner, originalCandidate.endpoints.value.api.signature);
  const cases = [
    [{ kind: "primitive", primitive: "bool" }, { kind: "known", category: "boolean" }],
    [{ kind: "primitive", primitive: "float64" }, { kind: "known", category: "number" }],
    [{ kind: "string" }, { kind: "known", category: "string" }],
    [{ kind: "intrinsic", intrinsic: "absence" }, { kind: "known", category: "absence" }],
    ...["int32", "float32"].map(primitive =>
      [{ kind: "primitive", primitive }, { kind: "known", category: "number" }]),
    ...["char", "decimal"].map(primitive =>
      [{ kind: "primitive", primitive }, { kind: "dynamic" }]),
  ];
  for (const [term, category] of cases) {
    const resultType = insertFixtureType(fixture.types, program.interner, term);
    const selected = insertFixtureSignature(fixture.types, program.interner, { ...signature, result: resultType });
    const calleeType = insertFixtureType(fixture.types, program.interner, { kind: "callable", calls: [selected], constructs: [] });
    const candidate = { ...originalCandidate, appliedSignature: { kind: "available", value: selected },
      endpoints: { kind: "available", value: {
        advertised: { ...originalCandidate.endpoints.value.advertised, signature: selected },
        advertisedSignature: selected,
        api: { ...originalCandidate.endpoints.value.api, signature: selected }, apiSignature: selected } } };
    const candidates = [{ ...system.candidates[0], candidates: [candidate] }];
    const constraint = { ...original, application: { ...original.application, callee: calleeType } };
    const value = type => ({ value: { type, component: { kind: "body", value: constraint.occurrence },
      category: { kind: "dynamic" }, numeric: null, sum: null, nominal: null, pointer: null }, error: null });
    const evidence = [value(calleeType), value(constraint.application.result)];
    const scheme = program.deps.rules.constraints.call;
    const enumeration = scheme.enumerate({ group: record.group.id, reference: { body: system.body, index: 0 },
      constraint, variables: system.variables, candidates, evidence, remainingContributions: 1 });
    assert.equal(enumeration.kind, "ok");
    const result = scheme.evaluate({ ...callContext(program, record.group, original),
      constraint, contribution: enumeration.value[0], evidence, candidates, reads: [] });
    assert.equal(result.kind, "ok");
    assert.equal(result.value.decision.application.result, resultType);
    assert.equal(result.value.bounds[0].value.type, resultType);
    assert.equal(isDeepStrictEqual(result.value.bounds[0].value.category, category), true,
      "The result retains only genuinely established source-category evidence.");
    assert.equal(isDeepStrictEqual(fixture.types.readType(program.interner, resultType), term), true,
      "Category uncertainty never changes the selected native type or its carrier.");
  }
});

test("actual fixed call arguments retain their checked source and reject malformed or unoffered mapping evidence", () => {
  const program = ready("export function value(input: boolean): boolean { return input; } export function read(input: boolean): boolean { return value(input); }");
  const record = [...drive(program).values()].find(record => record.constraints.some(set =>
    set.constraints.some(constraint => constraint.kind === "call")));
  const system = record.constraints.find(set => set.constraints.some(constraint => constraint.kind === "call"));
  const constraint = system.constraints.find(constraint => constraint.kind === "call");
  const scheme = program.deps.rules.constraints.call;
  const candidates = system.candidates;
  const evidence = system.evidence.slice(0, 3);
  assert.deepEqual(evidence.map(row => row.value.type), [
    constraint.application.callee, constraint.application.result, constraint.application.arguments[0].type,
  ]);
  const enumerate = selected => scheme.enumerate({ group: record.group.id, reference: { body: system.body, index: 0 },
    constraint: selected, variables: system.variables, candidates, evidence, remainingContributions: 1 });
  const enumeration = enumerate(constraint);
  assert.equal(enumeration.kind, "ok");
  const evaluate = (rows, selected = candidates) => scheme.evaluate({ ...callContext(program, record.group, constraint), constraint, contribution: enumeration.value[0],
    evidence: rows, candidates: selected, reads: [] });
  assert.deepEqual(evaluate(evidence).value.decision.application.parameters,
    [{ kind: "argument", parameter: 0, argument: 0, component: null, passing: "by-value" }]);
  assert.throws(() => evaluate(evidence.slice(0, 2)), /actual callee and result evidence/u);
  assert.throws(() => evaluate([...evidence.slice(0, 2), { ...evidence[2], value: { ...evidence[2].value,
    type: constraint.application.callee } }]), /actual selected occurrence evidence/u);
  assert.throws(() => enumerate({ ...constraint, application: { ...constraint.application,
    arguments: [{ ...constraint.application.arguments[0], kind: "spread" }] } }), /contribution footprints/u);
  const candidate = candidates[0].candidates[0];
  assert.throws(() => evaluate(evidence, [{ ...candidates[0], candidates: [{ ...candidate,
    endpoints: { kind: "unavailable", reason: "incomplete-association", causes: [] } }] }]), /original candidate bindings/u);
  const body = program.domain.bodyOf.get(system.body);
  for (const argument of [null, { kind: "value", expression: constraint.occurrence.node }]) {
    const changed = structuredClone(body);
    const call = fixture.hir.indexSyntaxTree(changed.root).find(node => node.id === constraint.occurrence.node);
    assert.equal(call.kind, "CallExpression");
    call.tsonic.application.value.arguments = argument === null ? [] : [argument];
    const deps = { ...program.deps, hirBody: identity => identity === changed.body ? changed : program.deps.hirBody(identity) };
    const paused = wiring.infer.constraintsOf(deps, record.group);
    assert.equal(paused.kind, "paused");
    const answers = paused.requests.map(request => {
      assert.equal(request.kind, "declaredSignatureOf");
      const answer = wiring.decls.declaredSignatureOf(program.inputs, request.request, program.domain.sources.cuts);
      assert.equal(answer.kind, "done");
      assert.equal(answer.value.kind, "ok");
      return { kind: request.kind, value: answer.value.value };
    });
    assert.throws(() => wiring.infer.resumeConstraintsOf(deps, paused.paused, answers),
      argument === null ? /actual captured source argument inventory/u : /actual selected source transport/u);
  }
});

test("real unannotated return solves its actual producer before one unmemoised same-group placement", () => {
  const program = ready("export function add(a: number, b: number) { return a + b; }\n");
  const records = drive(program);
  const record = [...records.values()].find(record => record.group.signatures.length > 0);
  assert.equal(record.group.signatures[0].part.kind, "return");
  assert.deepEqual(record.constraints[0].variables.map(variable => variable.kind), ["signature", "local"]);
  const signature = fixture.types.readSignature(program.interner, record.solution.bodies[0].signature);
  assert.deepEqual(fixture.types.readType(program.interner, signature.result), { kind: "primitive", primitive: "float64" });
});

test("actual chained defaults request only their demanded formal parts in initializer dependency order", () => {
  const program = ready("export function chain(a: boolean, b = a, c = b): boolean { return c; }\n");
  const owner = program.checked.tree.statements.nodes[0];
  const callable = program.checked.bodies.find(body => body.body === owner.tsonic.body);
  const initializer = index => program.groups.find(group => group.bodies.includes(callable.params[index].initializer));
  const first = initializer(1);
  const second = initializer(2);
  assert.notEqual(first, undefined);
  assert.notEqual(second, undefined);
  assert.equal(program.groups.indexOf(first) < program.groups.indexOf(second), true);
  const future = callable.params[2].declaration;
  const deps = { ...program.deps, itemOf: definition => {
    assert.notEqual(definition, future, "an initializer reading a never reads the future c declaration or type");
    return program.deps.itemOf(definition);
  } };
  const initial = wiring.infer.constraintsOf(deps, first);
  assert.equal(initial.kind, "done");
  assert.equal(initial.value.kind, "ok");
  const dependent = wiring.infer.constraintsOf(program.deps, second);
  assert.equal(dependent.kind, "paused");
  assert.deepEqual(dependent.requests, [{ kind: "inferred-part", part: {
    definition: callable.owner, part: { kind: "parameter-initializer", index: 1 },
  } }]);
  const records = drive(program);
  const completed = [...records.values()];
  assert.equal(completed.findIndex(record => record.group.id === first.id)
    < completed.findIndex(record => record.group.id === second.id), true);
  for (const group of [first, second]) for (const body of records.get(group.id).solution.bodies)
    assert.deepEqual(fixture.types.readType(program.interner, body.completion), { kind: "primitive", primitive: "bool" });
});

test("actual independent default initializer completes before the omitted return consumes its exact outside-group part", () => {
  const program = ready("export function select(a: number, b = a) { return b; }\n");
  const records = drive(program);
  const completed = [...records.values()];
  const initializer = completed.find(record => record.group.signatures.some(part => part.part.kind === "parameter-initializer"));
  const returned = completed.find(record => record.group.signatures.some(part => part.part.kind === "return"));
  assert.notEqual(initializer, undefined);
  assert.notEqual(returned, undefined);
  assert.notEqual(initializer.group.id, returned.group.id);
  assert.equal(completed.indexOf(initializer) < completed.indexOf(returned), true);
  for (const record of [initializer, returned]) {
    assert.deepEqual(record.solution.variables.map(variable => variable.variable), [0]);
    assert.equal(record.solution.bodies.every(body => fixture.types.readType(program.interner, body.completion).kind === "primitive"), true);
  }
  const initializerBody = program.domain.bodyOf.get(initializer.solution.bodies[0].body);
  assert.deepEqual(initializer.solution.bodies[0].captures, initializerBody.captures.map(local => ({ local, capture: "captured-location" })));
  const captureLocal = initializerBody.locals.find(local => local.role === "capture");
  assert.equal(captureLocal !== undefined, true);
  assert.deepEqual(captureLocal.capturedFrom, initializerBody.captures[0]);
  assert.equal(captureLocal.mutable, program.domain.bodyOf.get(captureLocal.capturedFrom.body).locals[captureLocal.capturedFrom.local].mutable);
});

test("ONE Rules capture-mode operation retains ordered qualified locals without a carrier or creation execution", () => {
  const program = ready("export function select(a: boolean, b = a): boolean { return b; }\n");
  const child = program.checked.bodies.find(body => body.captures.length === 1);
  const local = child.captures[0];
  const other = { body: child.body, local: child.locals[0].id };
  const cases = [
    [false, { kind: "binding" }, "captured-value"],
    [true, { kind: "binding" }, "captured-location"],
    [false, { kind: "parameter", passing: "by-value" }, "captured-value"],
    [false, { kind: "parameter", passing: "move" }, "captured-value"],
    [false, { kind: "parameter", passing: "byref-readonly" }, "captured-location"],
    [false, { kind: "parameter", passing: "byref-readwrite" }, "captured-location"],
    [false, { kind: "capture", capture: "captured-location" }, "captured-location"],
    [false, { kind: "capture", capture: "captured-value" }, "captured-value"],
  ];
  for (const [reassignable, incoming, capture] of cases) {
    const input = [{ local, reassignable, incoming }];
    const selected = program.deps.rules.decideCaptureModes(input);
    assert.equal(selected.kind, "ok");
    assert.deepEqual(selected.value, [{ local, capture }]);
    assert.equal(selected.value[0].local === local, true);
  }
  const selected = program.deps.rules.decideCaptureModes([
    { local: other, reassignable: false, incoming: { kind: "binding" } },
    { local, reassignable: true, incoming: { kind: "binding" } },
  ]);
  assert.deepEqual(selected.value.map(row => row.local), [other, local]);
  assert.deepEqual(program.deps.rules.decideCaptureModes([]).value, []);
  for (const references of [[local, { ...local }], [{ ...local, local: -0 }], [{ ...local, local: -1 }]])
    assert.throws(() => program.deps.rules.decideCaptureModes(references.map(local =>
      ({ local, reassignable: false, incoming: { kind: "binding" } }))), /capture mode/iu);
});

test("actual demanded capture qualifiers pre-admit their input, one formal index and decided output", async () => {
  const { bodyCaptureModes } = await import("../../packages/host/dist/infer/captures.js");
  const program = ready("export function select(a: boolean, b = a): boolean { return b; }\n");
  const child = program.checked.bodies.find(body => body.captures.length === 1);
  const owner = program.domain.bodyOf.get(child.captures[0].body);
  const exact = 6 * child.captures.length + 2 * owner.params.length;
  assert.equal(exact, 10);
  for (let maximum = 0; maximum <= exact; maximum += 1) {
    let used = 0;
    let stopped = false;
    let reads = 0;
    const deps = { ...program.deps, hirBody: reference => {
      assert.equal(stopped, false, "no ready owner read after refusal"); reads += 1;
      return program.deps.hirBody(reference);
    } };
    const selected = bodyCaptureModes(deps, child, work => {
      assert.equal(stopped, false, "no admission after refusal");
      if (work > maximum - used) { stopped = true; return false; }
      used += work; return true;
    });
    assert.equal(selected === null, maximum < exact);
    assert.equal(reads, maximum < 6 ? 0 : 1);
  }
  const malformed = { ...child, captures: [{ ...child.captures[0], local: -0 }] };
  assert.throws(() => bodyCaptureModes(program.deps, malformed, () => true), /actual qualified outer local/u);
  const inheritedOwner = { ...owner, locals: owner.locals.map(local => local.id === child.captures[0].local
    ? { ...local, role: "capture" } : local) };
  assert.throws(() => bodyCaptureModes({ ...program.deps, hirBody: () => inheritedOwner }, child, () => true),
    /actual incoming logical capture mode/u);
  assert.throws(() => bodyCaptureModes({ ...program.deps, hirBody: () => ({ ...owner, params: [] }) }, child, () => true),
    /actual formal row or checked pattern-bound declaration/u, "an absent formal is not silently reclassified as a binding");
  const first = owner.params.find(row => row.local === child.captures[0].local);
  assert.throws(() => bodyCaptureModes({ ...program.deps, hirBody: () => ({ ...owner,
    params: owner.params.map(row => row === first ? { ...row, declaration: owner.owner } : row) }) }, child, () => true),
    /exact checked local and declaration association/u);
  assert.throws(() => bodyCaptureModes({ ...program.deps, hirBody: () => ({ ...owner, params: [first, first] }) }, child, () => true),
    /repeats its actual local/u);
  assert.throws(() => bodyCaptureModes({ ...program.deps, hirBody: () => ({ ...owner, body: child.body }) }, child, () => true),
    /actual qualified outer local/u);
});

test("many real captured formals read their SAME demanded owner parameter vector once", async () => {
  const { bodyCaptureModes } = await import("../../packages/host/dist/infer/captures.js");
  const count = 64;
  const names = Array.from({ length: count }, (_, index) => `value${index}`);
  const program = ready(`export function select(${names.map(name => `${name}: number`).join(", ")}, result = ${names.join(" + ")}): number { return result; }\n`);
  const child = program.checked.bodies.find(body => body.captures.length === count);
  assert.equal(child !== undefined, true);
  const owner = program.domain.bodyOf.get(child.captures[0].body);
  let reads = 0;
  const params = new Proxy(owner.params, { get(target, key) {
    if (typeof key === "string" && /^(0|[1-9][0-9]*)$/u.test(key)) reads += 1;
    return Reflect.get(target, key);
  } });
  const selected = bodyCaptureModes({ ...program.deps, hirBody: () => ({ ...owner, params }) }, child, () => true);
  assert.equal(selected.kind, "ok");
  assert.equal(selected.value.length, count);
  assert.equal(reads, owner.params.length, "no capture-times-formals search");
});

test("Elaborate replays the actual solved placed-body rows without selecting modes or guessing capture storage", () => {
  const program = ready("export function select(a: boolean, b = a): boolean { return b; }\n");
  const records = [...drive(program).values()];
  const body = program.checked.bodies.find(body => body.captures.length === 1);
  const record = records.find(record => record.solution.bodies.some(typing => typing.body === body.body));
  const constraints = record.constraints.find(set => set.body === body.body);
  const typing = record.solution.bodies.find(typing => typing.body === body.body);
  const deps = { cuts: program.domain.sources.cuts, types: program.interner, typeWork: program.inputs.typeWork, rules: { ...program.deps.rules,
    decideCaptureModes: () => assert.fail("Elaborate retains Rules authority; it does not select capture modes.") },
    ...fixture.hir.createModuleBindingViews([program.checked.bindings]),
    typeOf: type => fixture.types.readType(program.interner, type),
    signatureOf: signature => fixture.types.readSignature(program.interner, signature), nodeOf: program.domain.nodeOf,
    checkerDiagnosticsOf: () => [] };
  const input = { instance: { body: body.body, bindings: { kind: "parametric" } }, scope: program.descriptions.get(body.owner).generics,
    body, layoutAlias: null, typing: { kind: "ready", constraints, solution: record.solution, template: null }, nestedBodies: [], initializers: [] };
  const result = wiring.elaborate.elaborate(deps, input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.captures === typing.captures, true);
  assert.deepEqual(result.value.root.tsonic.resolution.local, body.captures[0]);
  const captured = result.value.locals.find(local => local.role === "capture");
  assert.equal(captured !== undefined, true);
  assert.deepEqual(captured.capturedFrom, body.captures[0]);
  assert.equal(captured.storage, constraints.evidence[0].value.type);
  for (const captures of [[], [{ ...typing.captures[0], local: { body: body.body, local: 0 } }]])
    assert.throws(() => wiring.elaborate.elaborate(deps, { ...input,
      typing: { ...input.typing, solution: { ...record.solution,
        bodies: record.solution.bodies.map(row => row.body === body.body ? { ...row, captures } : row) } } }),
    /actual ordered qualified body captures/u);
  assert.throws(() => wiring.elaborate.elaborate(deps, { ...input, typing: { ...input.typing, constraints: { ...constraints, evidence: [] } } }),
    /which no parameter names/u, "no initializer completion or checked slot is substituted for absent actual read evidence");
});

test("nested real arithmetic allocates source-order variables but evaluates only genuinely final operand evidence", () => {
  const program = ready("export function add(a: number, b: number) { return (a + b) + (a + b); }\n");
  const records = drive(program);
  const record = [...records.values()].find(record => record.group.signatures.length > 0);
  assert.deepEqual(record.constraints[0].variables.map(variable => variable.kind), ["signature", "local", "local", "local"]);
  assert.equal(record.contributions.some(contribution => contribution.reads.length === 2), true);
  assert.deepEqual(record.positions.filter(position => position.position.kind === "inference-variable")
    .map(position => position.position.variable), [2, 3, 1, 0]);
  assert.equal(record.positions.every(position => position.error === null), true);
});

test("an annotated callable waits only for its different default-argument group, never its own complete group", () => {
  const program = ready("export function select(a: number, b = a): number { return b; }\n");
  assert.equal(program.groups.every(group => group.bodies.length === 1), true);
  drive(program);
});

test("one group owns the variable/contribution/work limits and refuses without any partial system or solution", () => {
  const program = ready("export function add(a: number, b: number) { return a + b; }\n");
  const group = program.groups.find(group => group.signatures.length > 0);
  for (const maximumVariablesPerGroup of [0, 1]) {
    const result = wiring.infer.constraintsOf({ ...program.deps, limits: { ...LIMITS, maximumVariablesPerGroup } }, group);
    assert.equal(result.kind, "done");
    assert.equal(result.value.kind, "refused");
    assert.equal(result.value.diagnostics.length, 1);
  }
  const generated = wiring.infer.constraintsOf({ ...program.deps, limits: { ...LIMITS, maximumVariablesPerGroup: 2 } }, group);
  assert.equal(generated.kind, "done");
  assert.equal(generated.value.kind, "ok");
  for (const maximumAtomicContributionsPerGroup of [0, 1]) {
    const result = wiring.infer.solveGroup({ ...program.deps, limits: { ...LIMITS, maximumAtomicContributionsPerGroup } }, group, generated.value.value, { query: "solutionOf", key: group.id });
    assert.equal(result.kind, "done");
    assert.equal(result.value.kind, "refused");
  }
  const result = wiring.infer.solveGroup({ ...program.deps, graph: { ...GRAPH, maximumWork: 0 } }, group, generated.value.value, { query: "solutionOf", key: group.id });
  assert.equal(result.kind, "done");
  assert.equal(result.value.kind, "refused");
});

test("outside-part resume rejects a missing or wrong identity and retains the original classified ErrorValue without re-diagnosing", () => {
  const program = ready("export function select(a: number, b = a) { return b; }\n");
  const group = program.groups.find(group => group.signatures.some(part => part.part.kind === "return"));
  const step = wiring.infer.constraintsOf(program.deps, group);
  assert.equal(step.kind, "paused");
  assert.deepEqual(step.requests.map(request => request.kind), ["inferred-part"]);
  const part = step.requests[0].part;
  assert.throws(() => wiring.infer.resumeConstraintsOf(program.deps, step.paused, []), /answers for/u);
  const type = insertFixtureType(fixture.types, program.interner, { kind: "error" });
  const owner = program.groups.find(candidate => candidate.signatures.some(owned => irInfer.inferredPartKey(owned) === irInfer.inferredPartKey(part)));
  const actual = wiring.infer.constraintsOf(program.deps, owner).value.value.constraints.flatMap(set => set.variables)
    .find(variable => variable.kind === "signature" && irInfer.inferredPartKey(variable.signature) === irInfer.inferredPartKey(part));
  const origin = { request: { query: "solutionOf", key: owner.id },
    position: { kind: "inference-variable", group: owner.id, variable: actual.id } };
  const cause = { kind: "unit", unit: { request: { query: "sourceError", key: "actual" }, position: { kind: "result" } } };
  const error = { kind: "error", causes: [cause] };
  assert.throws(() => wiring.infer.resumeConstraintsOf(program.deps, step.paused,
    [{ part: { ...part, part: { kind: "return" } }, type, error, origin }]), /actual requested part identity/u);
  const answer = { part, type, error, origin };
  for (const invalid of [undefined, { ...origin, position: { kind: "result" } },
    { request: { query: "solutionOf", key: group.id }, position: { ...origin.position, group: group.id } },
    { ...origin, position: { ...origin.position, variable: -0 } }])
    assert.throws(() => wiring.infer.resumeConstraintsOf(program.deps, step.paused, [{ ...answer, origin: invalid }]),
      /different group's finalized variable origin/u);
  const generated = wiring.infer.resumeConstraintsOf(program.deps, step.paused, [answer]);
  assert.equal(generated.kind, "done");
  assert.equal(generated.value.kind, "ok");
  assert.equal(generated.value.value.outsideParts[0], answer);
  assert.equal(generated.value.value.outsideParts[0].error, error);
  assert.equal(generated.value.value.outsideParts[0].error.causes[0], cause);
  assert.deepEqual(generated.value.diagnostics, []);
  const absorbed = generated.value.value.constraints[0].evidence.find(value => value.error !== null).error;
  assert.equal(absorbed.causes[0].kind, "unit");
  assert.equal(absorbed.causes[0].unit === origin, true);
  const solved = wiring.infer.solveGroup(program.deps, group, generated.value.value, { query: "solutionOf", key: group.id });
  assert.equal(solved.kind, "paused");
  assert.equal(solved.paused.variables[0].error === absorbed, true,
    "Rules retains the actual consumer's unit absorption, not copied host roots or a type-to-cause cache");
  assert.equal(solved.paused.positions[0].error === absorbed, true);
  assert.deepEqual(solved.earned, []);
});

test("read-only flow operands are not fabricated bounds and both dependency roles remain independently complete", () => {
  const program = ready("export function add(a: number, b: number) { return a + b; }\n");
  const group = program.groups.find(group => group.signatures.length > 0);
  const generated = wiring.infer.constraintsOf(program.deps, group).value.value;
  const step = wiring.infer.solveGroup(program.deps, group, generated, { query: "solutionOf", key: group.id });
  assert.equal(step.kind, "paused");
  const flow = step.paused.contributions.find(contribution => contribution.key.role.kind === "flow");
  assert.deepEqual(flow.reads, [1]);
  assert.deepEqual(flow.bounds, [0]);
  const record = [...drive(program).values()].find(record => record.group.id === group.id);
  assert.equal(record.solution.checks.some(check => check.variable === 1 && check.contribution.role.kind === "flow"), false);
});

test("SolveGroup's scripted multi-bound scheme reads its declared footprint linearly and preserves the exact invocation budget", () => {
  const program = ready("export function value(a: number): number { return a; }\n");
  const group = program.groups.find(group => program.domain.bodyOf.get(group.bodies[0]).root.kind === "Block");
  const body = group.bodies[0];
  const occurrence = { body, node: program.domain.bodyOf.get(body).root.id };
  const type = insertFixtureType(fixture.types, program.interner, { kind: "primitive", primitive: "float64" });
  const evidence = { type, component: { kind: "body", value: occurrence }, category: { kind: "known", category: "number" },
    numeric: null, sum: null, nominal: null, pointer: null };
  for (const count of [8, 64, 256]) {
    const open = Array.from({ length: count }, (unused, variable) => insertFixtureType(fixture.types, program.interner, { kind: "open", group: group.id, variable }));
    const variables = open.map((unused, id) => ({ kind: "local", id, occurrence, local: null }));
    let visits = 0;
    let evaluations = 0;
    const footprint = Array.from({ length: count }, (unused, variable) => variable);
    for (let variable = 0; variable < count; variable += 1)
      Object.defineProperty(footprint, variable, { get: () => { visits += 1; return variable; }, enumerable: true, configurable: true });
    const contribution = { key: { node: occurrence, candidate: null, role: { kind: "operator" } },
      reads: [], bounds: footprint, constraint: { body, index: 0 } };
    const scheme = {
      enumerate: () => ({ kind: "ok", value: [contribution], diagnostics: [] }),
      evaluate: () => {
        evaluations += 1;
        return { kind: "ok", diagnostics: [], value: { bounds: variables.map(variable => ({ variable: variable.id,
          contribution: contribution.key, kind: "producer", value: evidence, error: null })),
        decision: null, selectedCandidate: null } };
      },
    };
    const generated = { outsideParts: [], selectionContexts: [], constraints: [{ group: group.id, body, variables, candidates: [],
      constraints: [{ kind: "op", occurrence, operator: "+", operands: open, result: type, permissionScope: null }],
      evidence: [...open.map(type => ({ value: { ...evidence, type }, error: null })), { value: evidence, error: null }] }] };
    const deps = { ...program.deps, rules: { ...program.deps.rules, constraints: { ...program.deps.rules.constraints, op: scheme } },
      limits: { maximumVariablesPerGroup: count, maximumAtomicContributionsPerGroup: 1 } };
    const exact = 3 * count + 2;
    for (const maximumWork of [exact - 1, exact]) {
      visits = 0; evaluations = 0;
      const result = wiring.infer.solveGroup({ ...deps, graph: { ...GRAPH, maximumWork } }, group, generated, { query: "solutionOf", key: group.id });
      assert.equal(evaluations, 1, "the single multi-bound scheme is evaluated once");
      assert.equal(visits, 2 * count, "one footprint admission pass and one readiness pass, never per-bound rescans");
      if (maximumWork === exact) {
        assert.equal(result.kind, "paused");
        assert.deepEqual(result.paused.variables.map(variable => variable.variable), variables.map(variable => variable.id));
        assert.equal(result.paused.checks.length, count);
      } else {
        assert.equal(result.kind, "done");
        assert.equal(result.value.kind, "refused");
        assert.equal(result.value.diagnostics.length, 1);
      }
    }
  }
});

test("a genuine good signature final and an errored demand retain distinct final, check and completed-result truth", async () => {
  const program = ready("export function value(a: number) { return a; }\n");
  const group = program.groups.find(group => group.signatures.length > 0);
  const unit = { query: "solutionOf", key: group.id };
  const body = program.domain.bodyOf.get(group.bodies[0]);
  const generated = wiring.infer.constraintsOf(program.deps, group).value.value;
  const system = generated.constraints[0];
  const original = system.constraints[0];
  const types = fixture.types;
  const errorType = insertFixtureType(types, program.interner, { kind: "error" });
  const diagnosticUnit = { request: { query: "demandError", key: "actual-demand" }, position: { kind: "result" } };
  const identity = { kind: "host", unit: diagnosticUnit, code: "TEST_DEMAND_ERROR" };
  const diagnostic = { code: { kind: "host", name: identity.code, rendered: identity.code }, severity: "error",
    site: { kind: "source", origin: body.root.origin }, source: null, evidence: [], message: "actual errored demand",
    arguments: [], related: [], fix: null };
  const rootError = { kind: "error", causes: [{ kind: "diagnostic", diagnostic: identity }] };
  const error = { kind: "error", causes: [{ kind: "unit", unit: diagnosticUnit }] };
  const demand = { ...original, occurrence: { body: body.body, node: body.root.statements.nodes[0].id },
    from: original.to, to: errorType, role: "argument" };
  const dynamic = { type: errorType, component: { kind: "body", value: demand.occurrence },
    category: { kind: "dynamic" }, numeric: null, sum: null, nominal: null, pointer: null };
  const constraints = { ...generated, constraints: [{ ...system, constraints: [...system.constraints, demand],
    evidence: [...system.evidence, { value: { ...dynamic, type: original.to }, error: null }, { value: dynamic, error }] }] };
  const step = wiring.infer.solveGroup(program.deps, group, constraints, unit);
  assert.equal(step.kind, "paused");
  assert.equal(step.paused.variables[0].error, null, "a genuinely good producer is not poisoned by a failed demand");
  assert.equal(types.readType(program.interner, step.paused.variables[0].value.type).kind, "primitive");
  const check = step.paused.checks.find(check => check.outcome.kind === "error");
  assert.equal(check.outcome.error === error, true);
  const at = step.paused.positions.find(entry => entry.position.kind === "source-node");
  assert.equal(at.error === error, true, "the actual checked demand retains its original error at its source position");
  assert.deepEqual(at.position.node, { kind: "body", value: demand.occurrence });
  assert.equal(step.paused.positions.find(entry => entry.position.kind === "result").error !== null, true);
  const answers = step.requests.map(request => {
    assert.equal(request.kind, "placeSignature");
    const placed = wiring.decls.placeSignature(program.inputs, request.placement, unit, program.domain.sources.cuts);
    assert.equal(placed.kind, "done");
    assert.equal(placed.value.kind, "ok");
    return { kind: request.kind, value: placed.value.value };
  });
  const result = wiring.infer.resumeSolveGroup(program.deps, step.paused, answers);
  assert.equal(result.kind, "done");
  assert.equal(result.value.kind, "ok");
  const { createDatabase } = await import("../../packages/host/dist/query/index.js");
  const database = createDatabase({}, { maximumRecords: 512 }, () => assert.fail("an actual completed demand does not close a cycle"), "recorded");
  const root = { name: diagnosticUnit.request.query, keyData: key => key, answerPolicy: { kind: "refusal-only" },
    compute: () => ({ kind: "ok", value: errorType, positions: [{ position: { kind: "result" }, error: rootError }],
      diagnostics: [diagnostic], emissions: [{ identity, diagnostic }] }) };
  assert.equal(database.run(root, diagnosticUnit.request.key).kind, "completed");
  const solution = { name: unit.query, keyData: key => key, answerPolicy: { kind: "refusal-only" },
    compute: () => ({ kind: "ok", value: result.value.value, positions: result.value.value.positions, diagnostics: [], emissions: [] }) };
  assert.equal(database.run(solution, group.id).kind, "completed");
  assert.equal(database.errorOf({ request: unit, position: { kind: "inference-variable", group: group.id, variable: 0 } }).error, null);
  assert.equal(database.errorOf({ request: unit, position: at.position }).error === error, true);
  assert.equal(database.errorOf({ request: unit, position: { kind: "result" } }).error !== null, true);
  assert.equal(database.run(solution, group.id).kind, "completed");
  assert.deepEqual(database.diagnostics(), [diagnostic], "the absorbing solve emits no second diagnostic");
});

test("an annotated initializer absorbs its failed initialization at the earlier actual source position without a fabricated inferred part", () => {
  const program = ready("export function value(input: boolean = true): boolean { return input; }\n");
  const body = program.checked.bodies.find(body => body.root.kind === "TrueKeyword");
  const group = program.groups.find(group => group.bodies.includes(body.body));
  assert.equal(group.signatures.length, 0);
  const generated = wiring.infer.constraintsOf(program.deps, group);
  assert.equal(generated.kind, "done");
  assert.equal(generated.value.kind, "ok");
  const original = { request: { query: "originalInitialization", key: "original" }, position: { kind: "result" } };
  const error = { kind: "error", causes: [{ kind: "unit", unit: original }] };
  const flow = program.deps.rules.constraints.flow;
  const deps = { ...program.deps, rules: { ...program.deps.rules, constraints: { ...program.deps.rules.constraints,
    flow: { ...flow, evaluate: () => ({ kind: "ok", value: { bounds: [], decision: { kind: "error", error },
      selectedCandidate: null }, diagnostics: [] }) } } } };
  const unit = { query: "solutionOf", key: group.id };
  const solved = wiring.infer.solveGroup(deps, group, generated.value.value, unit);
  assert.equal(solved.kind, "paused");
  assert.equal(solved.paused.variables.length, 0);
  const source = solved.paused.positions.find(position => position.position.kind === "source-node");
  assert.equal(source.error === error, true);
  assert.deepEqual(source.position.node, { kind: "body", value: { body: body.body, node: body.root.id } });
  const placement = solved.requests[0].placement;
  assert.equal(placement.kind, "execution-body");
  assert.deepEqual(placement.error, { kind: "error", causes: [{ kind: "unit", unit: { request: unit, position: source.position } }] });
  assert.equal(fixture.types.readType(program.interner, placement.completion).kind, "error");
  const placed = wiring.decls.placeSignature(program.inputs, placement, unit, program.domain.sources.cuts);
  assert.equal(placed.kind, "done");
  assert.equal(placed.value.kind, "ok");
  assert.equal(placed.value.value.request, null);
  assert.equal(placed.value.value.signature.result, placement.completion);
  assert.deepEqual(placed.value.diagnostics, []);
  const completed = wiring.infer.resumeSolveGroup(deps, solved.paused, [{ kind: "placeSignature", value: placed.value.value }]);
  assert.equal(completed.kind, "done");
  assert.equal(completed.value.kind, "ok");
  assert.deepEqual(completed.value.diagnostics, []);
  assert.equal(completed.value.value.positions.find(position => position.position.kind === "source-node").error === error, true);
});

test("actual Rules propagate only dependent error operands with every original cause and no diagnostic", () => {
  const program = ready("export function add(a: number, b: number) { return a + b; }\n");
  const group = program.groups.find(group => group.signatures.length > 0);
  const generated = wiring.infer.constraintsOf(program.deps, group).value.value;
  const system = generated.constraints[0];
  const operation = system.constraints.find(constraint => constraint.kind === "op");
  const types = fixture.types;
  const errorType = insertFixtureType(types, program.interner, { kind: "error" });
  const causes = [0, 1].map(index => ({ kind: "unit", unit: {
    request: { query: "realOperand", key: index }, position: { kind: "result" },
  } }));
  const errors = causes.map(cause => ({ kind: "error", causes: [cause] }));
  const values = errors.map(error => ({ value: { type: errorType, component: { kind: "body", value: operation.occurrence },
    category: { kind: "dynamic" }, numeric: null, sum: null, nominal: null, pointer: null }, error }));
  const scheme = program.deps.rules.constraints.op;
  const constraint = { ...operation, operands: [errorType, errorType] };
  const enumeration = scheme.enumerate({ group: group.id, remainingContributions: 1, reference: { body: system.body, index: 0 },
    constraint, variables: system.variables, candidates: [], evidence: [...values, system.evidence[2]] });
  assert.equal(enumeration.kind, "ok");
  const evaluate = operands => scheme.evaluate({ constraint, contribution: enumeration.value[0],
    evidence: [...operands, system.evidence[2]], reads: [], candidates: [] });
  const combined = evaluate(values);
  assert.equal(combined.kind, "ok");
  assert.equal(combined.value.decision.kind, "error");
  assert.deepEqual(combined.value.decision.error.causes, causes);
  assert.equal(combined.value.bounds[0].error === combined.value.decision.error, true);
  assert.equal(combined.value.bounds[0].variable, system.variables.find(variable => variable.kind === "local").id);
  assert.equal(types.readType(program.interner, combined.value.bounds[0].value.type).kind, "error");
  assert.deepEqual(combined.diagnostics, []);
  assert.equal(evaluate([values[0], values[0]]).value.decision.error === errors[0], true, "one original error is not rewrapped");
  assert.equal(evaluate([values[0], { ...values[1], error: { kind: "error", causes: [causes[0]] } }])
    .value.decision.error.causes.length, 1, "equal actual cause identities are not chosen by first type or source spelling");
  assert.throws(() => evaluate([{ ...values[0], error: null }, values[1]]), /actual provenance/u);
  const variable = system.variables.find(variable => variable.kind === "signature");
  const finalized = program.deps.rules.variables.signature.finalize({
    variable, producers: [{ contribution: enumeration.value[0].key, variable: variable.id, kind: "producer",
      ...system.evidence[0] }, { ...combined.value.bounds[0], variable: variable.id }],
    demands: [], inferredTypeBound: null, default: null, declaredConstraint: null, declaredDefault: null,
  });
  assert.equal(finalized.kind, "ok");
  assert.equal(finalized.value.error === combined.value.decision.error, true);
  assert.equal(types.readType(program.interner, finalized.value.value.type).kind, "error");
});

test("every public Infer invocation rejects malformed original counts before body, rule or semantic-state reads", () => {
  const program = ready("export function value(a: number) { return a; }\n");
  const unread = new Proxy({}, { get: () => assert.fail("a malformed count must be rejected before semantic-state reads") });
  const operations = [
    deps => wiring.infer.constraintsOf(deps, unread),
    deps => wiring.infer.resumeConstraintsOf(deps, unread, []),
    deps => wiring.infer.solveGroup(deps, unread, unread, unread),
    deps => wiring.infer.resumeSolveGroup(deps, unread, []),
  ];
  for (const [owner, field] of [["limits", "maximumVariablesPerGroup"], ["limits", "maximumAtomicContributionsPerGroup"],
    ["graph", "maximumWork"], ["graph", "maximumResultEntries"]]) {
    for (const value of [NaN, Infinity, -Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1, undefined, null, "4", 4n]) {
      const deps = { ...program.deps, [owner]: { ...program.deps[owner], [field]: value },
        hirBody: () => assert.fail("invalid inference limit reached a body reader"),
        itemOf: () => assert.fail("invalid inference limit reached a declaration reader") };
      Object.defineProperty(deps, "rules", { get: () => assert.fail("invalid inference limit reached Rules") });
      for (const operation of operations) assert.throws(() => operation(deps),
        new RegExp(field + " must be a nonnegative safe integer", "u"), field + ":" + String(value));
    }
  }
});
