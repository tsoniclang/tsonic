import assert from "node:assert/strict";
import { before, test } from "node:test";
import { loadFrontFixture } from "./fixtures/front/checked-module.mjs";
import { checkedDomain } from "./fixtures/front/checked-domain.mjs";

let fixture;
let wiring;
let inferStep;
let inferenceStep;
let registration;
let query;
let checkedInputs;

before(async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true, "the current aggregate guard owns this case");
  fixture = await loadFrontFixture();
  ({ pipelineWiring: wiring } = await import("../../packages/host/dist/pipeline/wiring.js"));
  inferStep = await import("../../packages/host/dist/pipeline/infer-deps-step.js");
  inferenceStep = await import("../../packages/host/dist/pipeline/inference-step.js");
  registration = await import("../../packages/host/dist/pipeline/semantic-queries.js");
  query = await import("../../packages/host/dist/query/index.js");
  checkedInputs = await import("../../packages/host/dist/pipeline/checked-inputs.js");
});

const EXPANSION = { maximumDepth: 64, maximumVisits: 4096, maximumUnionMembers: 64, maximumIntersectionMembers: 64 };
const LIMITS = { maximumVariablesPerGroup: 128, maximumAtomicContributionsPerGroup: 256 };
const GRAPH = { maximumWork: 65536, maximumResultEntries: 65536 };

function ready(source) {
  const { checked, interner } = fixture.checkedModuleOf(source);
  assert.deepEqual(fixture.verifyChecked(checked, interner), []);
  const domain = checkedDomain(checked, fixture.hir);
  const items = new Map(checked.items.map(item => [item.definition, domain.nodes[item.node]]));
  items.set(checked.tree.tsonic.definition, checked.tree);
  const descriptions = new Map(wiring.decls.describeDefinitions({ module: checked, nodes: domain.nodes }, []).definitions
    .map(description => [description.definition, description]));
  const declarations = { modules: [{ module: checked, nodes: domain.nodes }], types: interner, typeExpansion: EXPANSION };
  const inference = inferStep.inferDepsOf({ rules: { libraries: { sources: [], sourceRoles: [], declaredSummaries: [] },
    types: interner, typeExpansion: EXPANSION }, hirBody: body => domain.bodyOf.get(body) ?? assert.fail("actual checked body"),
    itemOf: definition => items.get(definition) ?? assert.fail("actual checked declaration"), limits: LIMITS, graph: GRAPH });
  const grouped = wiring.infer.groupsOf(inference, checked.bodies.map(body => body.body));
  assert.equal(grouped.kind, "ok");
  const types = fixture.types.viewTypes(interner);
  const declarationOf = definition => {
    const node = items.get(definition);
    const description = descriptions.get(definition);
    return node === undefined || description === undefined ? null : { scope: description.generics,
      parameterCount: "parameters" in node && "nodes" in node.parameters ? node.parameters.nodes.length : null,
      endpoints: "signatures" in node.tsonic ? node.tsonic.signatures : [] };
  };
  const verification = (group, constraints) => ({
    types, declarationOf, nominalOf: () => null, nodeExists: reference => domain.nodeOf(reference) !== null,
    localExists: domain.localExists,
    bindingScopes: constraints.constraints.flatMap(set => set.constraints.filter(constraint => constraint.kind === "flow")
      .map(() => descriptions.get(domain.bodyOf.get(set.body).owner).generics)),
  });
  const inputs = { declarations, inference, groups: grouped.value, sources: domain.sources, verification };
  const queries = registration.createSourceSemanticQueries(inputs);
  const noCycleInThisCase = () => assert.fail("these ready-group/declared-signature cases must not close an active key");
  const database = query.createDatabase(inputs, { maximumRecords: 65536 }, noCycleInThisCase, "recorded");
  const node = checked.tree.statements.nodes[0];
  const endpoint = node.tsonic.signatures.find(endpoint => endpoint.role === "api-body");
  assert.equal(endpoint !== undefined, true);
  const signature = { definition: endpoint.declaration, endpoint: endpoint.role, ordinal: 0, bindings: { kind: "parametric" } };
  return { checked, interner, domain, descriptions, inputs, queries, database, signature, verification };
}


test("the production checked namespace retains exact body/item membership and declaration sources without global-node fallback", () => {
  const program = ready("export function add(a: number, b: number): number { return a + b; }\n");
  const views = checkedInputs.checkedSourceViews(program.inputs.declarations.modules);
  const module = program.checked;
  const body = module.bodies.find(body => body.root.kind === "Block");
  const outer = module.bodies.find(body => body.root.kind === "SourceFile");
  const definition = views.declarationSourceOf(body.owner);
  assert.equal(definition.kind, "item");
  assert.equal(definition.value.owner, body.owner);
  assert.equal(views.nodeOf(definition) === module.tree.statements.nodes[0], true);
  assert.equal(views.bodies.get(body.body) === body, true);
  assert.equal(views.nodeOf({ kind: "body", value: { body: body.body, node: body.root.id } }) === body.root, true);
  assert.equal(views.nodeOf({ kind: "body", value: { body: body.body, node: outer.root.id } }), null);
  assert.equal(views.nodeOf({ kind: "body", value: { body: outer.body, node: body.root.id } }), null);
  assert.equal(views.nodeOf({ kind: "item", value: { owner: body.owner, node: body.root.id } }), null);
  assert.equal(views.nodeOf({ kind: "item", value: { owner: outer.owner, node: definition.value.node } }), null);
  assert.equal(views.nodeOf({ kind: "body", value: { body: "missing", node: body.root.id } }), null);
  assert.equal(views.nodeOf({ kind: "item", value: { owner: "missing", node: definition.value.node } }), null);
  assert.equal(views.declarationSourceOf("missing"), null);
  assert.equal(views.localExists({ body: body.body, local: body.params[0].local }), true);
  assert.equal(views.localExists({ body: outer.body, local: body.params[0].local }), false);
  for (const local of [-1, -0, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1])
    assert.equal(views.localExists({ body: body.body, local }), false);
  for (const node of [-1, -0, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1])
    assert.equal(views.nodeOf({ kind: "body", value: { body: body.body, node } }), null);
  for (const [index, actual] of body.locals.entries())
    assert.equal(views.localExists({ body: body.body, local: index }), actual.id === index);
  const parameter = module.tree.statements.nodes[0].parameters.nodes[0];
  const parameterSource = views.declarationSourceOf(module.items.find(item => item.node === parameter.id).definition);
  assert.equal(views.nodeOf(parameterSource) === parameter, true);
  assert.equal(views.nodeOf({ kind: "item", value: { owner: body.owner, node: parameter.id } }), null);
});

test("the checked namespace rejects duplicated identities and foreign/extra syntax rows rather than publishing a partial source view", () => {
  const program = ready("export function add(a: number, b: number) { return a + b; }\n");
  const module = program.inputs.declarations.modules[0];
  assert.throws(() => checkedInputs.checkedSourceViews([module, module]), /unique body identities/u);
  assert.throws(() => checkedInputs.checkedSourceViews([{ ...module,
    module: { ...module.module, bodies: [...module.module.bodies, module.module.bodies[0]] } }]), /unique body identities/u);
  assert.throws(() => checkedInputs.checkedSourceViews([{ ...module,
    module: { ...module.module, items: [...module.module.items, module.module.items[0]] } }]), /unique identities/u);
  assert.throws(() => checkedInputs.checkedSourceViews([{ ...module, nodes: [...module.nodes, module.nodes[0]] }]), /outside its actual tree/u);
  assert.throws(() => checkedInputs.checkedSourceViews([{ ...module, nodes: module.nodes.map((node, index) => index === 0 ? { ...node } : node) }]), /actual dense canonical/u);
});

test("the actual annotated declaration row retains its typed request and a verified whole-group solution uses unmemoised placement", () => {
  const program = ready("export function add(a: number, b: number): number { return a + b; }\n");
  const signature = program.database.run(program.queries.declaredSignatureOf, program.signature);
  assert.equal(signature.kind, "completed");
  assert.equal(signature.diagnostics.length, 0);
  const scope = program.descriptions.get(program.signature.definition).generics;
  assert.deepEqual([scope.classParameters.length, scope.methodParameters.length, scope.capturedParameters.length, scope.selfOwners.length], [0, 0, 0, 0]);
  for (const group of program.inputs.groups) {
    const outcome = program.database.run(program.queries.solutionOf, group.id);
    assert.equal(outcome.kind, "completed");
    assert.equal(outcome.value.group === group, true);
    assert.equal(outcome.value.constraints.constraints.length, group.bodies.length);
    assert.equal(outcome.value.positions.every(position => position.error === null), true);
    assert.equal(program.database.errorOf({ request: { query: program.queries.solutionOf.name, key: group.id },
      position: { kind: "result" } }).kind, "completed");
  }
  const cached = program.database.run(program.queries.declaredSignatureOf, { ...program.signature });
  assert.equal(cached.kind, "completed");
  assert.equal(cached.value === signature.value, true);
  assert.equal(program.database.trace().some(event => event.kind === "dependency" && event.state === "active"), false);
  assert.deepEqual(program.database.stats().map(stat => stat.name).sort(), ["declaredSignatureOf", "solutionOf"]);
});

test("a real omitted return demands its one canonical group and projects its actual verified completed variable", () => {
  const program = ready("export function add(a: number, b: number) { return a + b; }\n");
  const outcome = program.database.run(program.queries.declaredSignatureOf, program.signature);
  assert.equal(outcome.kind, "completed");
  assert.deepEqual(fixture.types.readType(program.interner, outcome.value.result), { kind: "primitive", primitive: "float64" });
  const group = program.inputs.groups.find(group => group.signatures.some(part => part.part.kind === "return"));
  const solved = program.database.run(program.queries.solutionOf, group.id);
  assert.equal(solved.kind, "completed");
  const part = group.signatures.find(part => part.part.kind === "return");
  const unit = { query: program.queries.solutionOf.name, key: group.id };
  const projected = inferenceStep.projectInferredPart(unit, solved.value, { kind: "inferred-part", part }, program.database.errorOf);
  assert.equal(projected.type, outcome.value.result);
  assert.equal(projected.error, null);
  assert.deepEqual(projected.origin, { request: unit, position: { kind: "inference-variable", group: group.id, variable: 0 } });
  assert.equal(program.database.trace().some(event => event.kind === "dependency" && event.state === "active"), false);
  assert.equal(program.database.trace().some(event => event.kind === "dependency" && event.from?.query === "solutionOf"
    && event.to.query === "declaredSignatureOf" && event.to.encodedKey === fixture.ids.encodeKey(fixture.types.signatureRequestData(program.signature))), false,
    "the current group never requests its own completed declaration");
});

test("real select default G1 completes before G2 and both declaration slots use the same projected origins", () => {
  const program = ready("export function select(a: number, b = a) { return b; }\n");
  const outcome = program.database.run(program.queries.declaredSignatureOf, program.signature);
  assert.equal(outcome.kind, "completed");
  assert.deepEqual(fixture.types.readType(program.interner, outcome.value.parameters[1].type), { kind: "primitive", primitive: "float64" });
  assert.equal(outcome.value.parameters[1].type, outcome.value.result);
  const initializer = program.inputs.groups.find(group => group.signatures.some(part => part.part.kind === "parameter-initializer"));
  const returned = program.inputs.groups.find(group => group.signatures.some(part => part.part.kind === "return"));
  const completions = program.database.trace().filter(event => event.kind === "completion" && event.fact.query === "solutionOf");
  assert.equal(completions.findIndex(event => event.fact.key === initializer.id) < completions.findIndex(event => event.fact.key === returned.id), true);
  for (const group of [initializer, returned]) {
    const solved = program.database.run(program.queries.solutionOf, group.id);
    assert.equal(solved.kind, "completed");
    for (const part of group.signatures) {
      const answer = inferenceStep.projectInferredPart({ query: "solutionOf", key: group.id }, solved.value,
        { kind: "inferred-part", part }, program.database.errorOf);
      assert.equal(answer.error, null);
      assert.equal(program.database.errorOf(answer.origin).kind, "completed");
    }
  }
  assert.equal(program.database.stats().find(stat => stat.name === "solutionOf").computed, 2);
  assert.equal(program.database.trace().some(event => event.kind === "dependency" && event.state === "active"), false);
});

test("ready annotated recursive endpoints do not turn declared recursion into an active complete-key cycle", () => {
  const program = ready("export function first(value: number): number { return second(value); }\nfunction second(value: number): number { return first(value); }\n");
  for (const node of program.checked.tree.statements.nodes) {
    const endpoint = node.tsonic.signatures.find(endpoint => endpoint.role === "api-body");
    const result = program.database.run(program.queries.declaredSignatureOf, { definition: endpoint.declaration,
      endpoint: endpoint.role, ordinal: 0, bindings: { kind: "parametric" } });
    assert.equal(result.kind, "completed");
    assert.equal(result.diagnostics.length, 0);
  }
  assert.equal(program.database.trace().filter(event => event.kind === "dependency" && event.from !== null).length, 0);
});

test("unknown partition ownership and malformed projection inputs never become a known-null part", () => {
  const program = ready("export function add(a: number, b: number) { return a + b; }\n");
  const group = program.inputs.groups.find(group => group.signatures.length !== 0);
  const outcome = program.database.run(program.queries.solutionOf, group.id);
  assert.equal(outcome.kind, "completed");
  const request = { kind: "inferred-part", part: group.signatures[0] };
  const unit = { query: "solutionOf", key: group.id };
  assert.throws(() => inferenceStep.projectInferredPart({ ...unit, key: "another-group" }, outcome.value, request, program.database.errorOf), /actual completed solution group/u);
  assert.throws(() => inferenceStep.projectInferredPart(unit, outcome.value,
    { ...request, part: { ...request.part, part: { kind: "yield" } } }, program.database.errorOf), /actual owned signature variable/u);
  assert.throws(() => inferenceStep.projectInferredPart(unit, outcome.value, request, () => ({ kind: "uncomputed" })), /verified completed variable/u);
  assert.throws(() => inferenceStep.projectInferredPart(unit, outcome.value, request, () => ({ kind: "completed", error: { kind: "error", causes: [] } })), /original finalized error/u);
  assert.throws(() => program.database.run(program.queries.solutionOf, "unknown-group"), /absent from the ready checked partition/u);
  assert.throws(() => registration.createSourceSemanticQueries({ ...program.inputs, groups: [...program.inputs.groups, group] }), /each nonempty group once/u);
  assert.throws(() => registration.createSourceSemanticQueries({ ...program.inputs,
    groups: program.inputs.groups.map(candidate => candidate === group ? { ...candidate, bodies: [] } : candidate) }), /each nonempty group once/u);
});

test("the actual solution resource refusal retains its original diagnostic without a completed partial answer", () => {
  const program = ready("export function add(a: number, b: number) { return a + b; }\n");
  const inputs = { ...program.inputs, inference: { ...program.inputs.inference,
    limits: { ...LIMITS, maximumVariablesPerGroup: 0 } } };
  const queries = registration.createSourceSemanticQueries(inputs);
  const database = query.createDatabase(inputs, { maximumRecords: 65536 }, () => assert.fail("no cycle in this refusal case"), "recorded");
  const group = inputs.groups.find(group => group.signatures.length !== 0);
  const result = database.run(queries.solutionOf, group.id);
  assert.equal(result.kind, "refused");
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0].code.name, "TSONIC_COMPILER_RESOURCE_LIMIT");
  assert.equal(database.errorOf({ request: { query: queries.solutionOf.name, key: group.id }, position: { kind: "result" } }).kind, "refused");
  assert.equal(database.trace().some(event => event.kind === "completion" && event.outcome === "ok"), false);
  assert.equal(database.diagnostics()[0] === result.diagnostics[0], true);
});

test("actual demand witnesses retain checked source and borrow the real pause prefix only while unresolved", () => {
  const program = ready("export function select(a: number, b = a) { return b; }\n");
  const observe = (program, registered, key, samples) => {
    const data = registered.keyData(key);
    const context = { inputs: program.inputs, fact: { query: registered.name, key: data, encodedKey: fixture.ids.encodeKey(data) },
      errorOf: program.database.errorOf,
      get: (dependency, request, pending, resume) => ({ kind: "dependency",
        schedule: scheduler => scheduler.request(dependency, request, pending, resume) }) };
    let step = registered.compute(context, key);
    while (step.kind === "dependency") {
      let next;
      step.schedule({ request: (dependency, key, pending, resume) => {
        const witness = pending.witness;
        samples.push({ kind: witness.kind, source: witness.source, count: witness.ready.length,
          original: witness.kind === "declared-signature" ? witness.state.request : null,
          target: witness.target.kind });
        const actual = program.database.run(dependency, key);
        assert.equal(actual.kind, "completed");
        next = resume(actual.value);
      } });
      assert.equal(next !== undefined, true);
      step = next;
    }
    return step;
  };
  const signatures = [];
  const result = observe(program, program.queries.declaredSignatureOf, program.signature, signatures);
  assert.equal(result.kind, "ok");
  assert.deepEqual(signatures.map(sample => sample.count), [0, 1]);
  const source = program.domain.declarationSourceOf(program.signature.definition);
  assert.equal(signatures.every(sample => sample.original === program.signature), true);
  for (const sample of signatures) {
    assert.deepEqual(sample.source, source);
    assert.equal(sample.target, "inference-solution");
    assert.equal(program.domain.nodeOf(sample.source) !== null, true);
  }
  const other = ready("export function select(a: number, b = a) { return b; }\n");
  const group = other.inputs.groups.find(group => group.signatures.some(part => part.part.kind === "return"));
  const inference = [];
  assert.equal(observe(other, other.queries.solutionOf, group.id, inference).kind, "ok");
  assert.equal(inference.length, 1);
  assert.equal(inference[0].kind, "inference");
  assert.equal(inference[0].source.kind, "body");
  assert.equal(inference[0].source.value.body, group.bodies[0]);
  assert.equal(inference[0].source.value.node, other.domain.bodyOf.get(group.bodies[0]).root.id);
  assert.equal(inference[0].count, 0);
});

test("constraint pauses retain every actual request body and reject removed or foreign ownership metadata", () => {
  const program = ready("export function add(a: number, b: number): number { return a + b; }\n");
  const group = program.inputs.groups.find(group => program.domain.bodyOf.get(group.bodies[0]).root.kind === "Block");
  const generation = wiring.infer.constraintsOf(program.inputs.inference, group);
  assert.equal(generation.kind, "paused");
  assert.equal("signatureBodies" in generation.paused, false);
  assert.deepEqual(generation.paused.requestBodies, group.bodies);
  const signature = program.database.run(program.queries.declaredSignatureOf, generation.requests[0].request);
  assert.equal(signature.kind, "completed");
  const answers = [{ kind: "declaredSignatureOf", value: signature.value }];
  assert.throws(() => wiring.infer.resumeConstraintsOf(program.inputs.inference,
    { ...generation.paused, requestBodies: [] }, answers), /every pending semantic request/u);
  const module = program.checked.bodies.find(body => body.root.kind === "SourceFile");
  assert.throws(() => wiring.infer.resumeConstraintsOf(program.inputs.inference,
    { ...generation.paused, requestBodies: [module.body] }, answers), /outside its actual group/u);
  assert.throws(() => wiring.infer.resumeConstraintsOf(program.inputs.inference,
    { ...generation.paused, requests: [...generation.requests, ...generation.requests], requestBodies: [...group.bodies, ...group.bodies] },
    [...answers, ...answers]), /more than once in one pause/u);
  assert.equal(wiring.infer.resumeConstraintsOf(program.inputs.inference, generation.paused, answers).value.kind, "ok");
});
