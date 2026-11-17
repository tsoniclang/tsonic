import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { before, test } from "node:test";
import { loadFrontFixture } from "./fixtures/front/checked-module.mjs";
import { checkedDomain } from "./fixtures/front/checked-domain.mjs";
import { expectedComposedAdd } from "./fixtures/elaborate/add-composed.expected.mjs";

let fixture;
let wiring;
let pipeline;
let semanticQueries;
let query;
let irTir;
let irMir;
let lowerMirStep;
let inferenceStep;

before(async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true, "the actual aggregate resource guard is required");
  fixture = await loadFrontFixture();
  ({ pipelineWiring: wiring } = await import("../../packages/host/dist/pipeline/wiring.js"));
  pipeline = await import("../../packages/host/dist/pipeline/infer-deps-step.js");
  semanticQueries = await import("../../packages/host/dist/pipeline/semantic-queries.js");
  query = await import("../../packages/host/dist/query/index.js");
  irTir = await import("../../packages/host/dist/ir-tir/index.js");
  irMir = await import("../../packages/host/dist/ir-mir/index.js");
  lowerMirStep = await import("../../packages/host/dist/pipeline/lower-mir-step.js");
  inferenceStep = await import("../../packages/host/dist/pipeline/inference-step.js");
});

const EXPANSION = { maximumDepth: 64, maximumVisits: 4096, maximumUnionMembers: 64, maximumIntersectionMembers: 64 };

for (const resultAnnotation of [": number", ""])
test(`real SDK source add with ${resultAnnotation === "" ? "inferred" : "annotated"} result passes HIR, genuine Decls/Rules/Infer, composed TIR and actual LowerMir/MIR`, () => {
  const source = `export function add(a: number, b: number)${resultAnnotation} { return a + b; }\n`;
  const { checked, interner, module, snapshot } = fixture.checkedModuleOf(source);
  const { types, hir } = fixture;
  assert.deepEqual(fixture.verifyChecked(checked, interner), [], "the actual checked source passes HIR");
  const nodes = hir.indexSyntaxTree(checked.tree);
  const domain = checkedDomain(checked, hir);
  const items = new Map(checked.items.map(item => [item.definition, nodes[item.node]]));
  items.set(checked.tree.tsonic.definition, checked.tree);
  const definitionTable = wiring.decls.describeDefinitions({ module: checked, nodes }, []);
  const descriptions = new Map(definitionTable.definitions.map(description => [description.definition, description]));
  const declarationOf = definition => {
    const item = items.get(definition);
    const description = descriptions.get(definition);
    return item === undefined || description === undefined ? null : { scope: description.generics,
      parameterCount: "parameters" in item && "nodes" in item.parameters ? item.parameters.nodes.length : null,
      endpoints: "signatures" in item.tsonic ? item.tsonic.signatures : [] };
  };
  const inputs = { modules: [{ module: checked, nodes }], types: interner, typeExpansion: EXPANSION };
  const deps = pipeline.inferDepsOf({
    rules: { libraries: { sources: [], sourceRoles: [], guarantees: [] }, types: interner, typeExpansion: EXPANSION },
    hirBody: body => domain.bodyOf.get(body) ?? assert.fail("the requested body is not in the ready module"),
    itemOf: definition => items.get(definition) ?? assert.fail("the requested declaration is not in the ready module"),
    bindings: [checked.bindings], ...hir.createModuleBindingViews([checked.bindings]),
    limits: { maximumVariablesPerGroup: 32, maximumAtomicContributionsPerGroup: 32 },
    graph: { maximumWork: 4096, maximumResultEntries: 4096 },
  });
  const grouped = wiring.infer.groupsOf(deps, checked.bodies.map(body => body.body));
  assert.equal(grouped.kind, "ok");
  const table = types.viewTypes(interner);
  const tableOf = () => table;
  const semanticInputs = { declarations: inputs, inference: deps, groups: grouped.value, sources: domain.sources,
    verification: (group, constraints) => ({ types: table, declarationOf, nominalOf: () => null,
      nodeExists: reference => domain.nodeOf(reference) !== null, localExists: domain.localExists,
      bindingScopes: constraints.constraints.flatMap(set => set.constraints.filter(constraint => constraint.kind === "flow")
        .map(() => descriptions.get(domain.bodyOf.get(set.body).owner).generics)) }) };
  const registered = semanticQueries.createSourceSemanticQueries(semanticInputs);
  const database = query.createDatabase(semanticInputs, { maximumRecords: 65536 },
    () => assert.fail("add's ready declarations and group-local placement must not close an active key"), "recorded");
  const solved = new Map();
  for (const group of grouped.value) {
    const finished = database.run(registered.solutionOf, group.id);
    assert.equal(finished.kind, "completed");
    assert.equal(finished.value.positions.every(position => position.error === null), true);
    for (const constraints of finished.value.constraints.constraints)
      solved.set(constraints.body, { ...finished.value, constraints });
  }
  assert.equal(database.trace().some(event => event.kind === "dependency" && event.state === "active"), false);
  for (const [body, record] of solved) {
    const checkedBody = domain.bodyOf.get(body);
    assert.deepEqual(record.constraints.constraints.map(constraint => constraint.kind),
      checkedBody.root.kind === "SourceFile" ? [] : ["op", "flow"]);
  }
  const typed = new Map();
  const elaborateDeps = { types: interner, rules: deps.rules, nodeOf: domain.nodeOf, typeOf: type => types.readType(interner, type),
    signatureOf: signature => types.readSignature(interner, signature), bindingOf: deps.bindingOf, checkerDiagnosticsOf: () => checked.checkerDiagnostics };
  const elaborate = body => {
    const record = solved.get(body.body);
    const result = wiring.elaborate.elaborate(elaborateDeps, {
      instance: { body: body.body, bindings: { kind: "parametric" } }, scope: descriptions.get(body.owner).generics,
      body, constraints: record.constraints,
      solution: record.solution, template: null, nestedBodies: body.nestedBodies.map(nested => typed.get(nested)), initializers: [],
    });
    assert.equal(result.kind, "ok");
    typed.set(body.body, result.value);
    return result.value;
  };
  const functionBody = checked.bodies.find(body => body.root.kind === "Block");
  const moduleBody = checked.bodies.find(body => body.root.kind === "SourceFile");
  const endpoint = checked.tree.statements.nodes[0].tsonic.signatures[0];
  const declared = database.run(registered.declaredSignatureOf, { definition: endpoint.declaration,
    endpoint: endpoint.role, ordinal: 0, bindings: { kind: "parametric" } });
  assert.equal(declared.kind, "completed");
  assert.equal(functionBody.owner, checked.tree.statements.nodes[0].tsonic.definition);
  const actualFunction = elaborate(functionBody);
  assert.equal(actualFunction.signature, declared.value.id);
  const float64 = types.internType(interner, { kind: "primitive", primitive: "float64" });
  assert.equal(isDeepStrictEqual(actualFunction, expectedComposedAdd(functionBody, { signature: actualFunction.signature, float64,
    parameters: checked.tree.statements.nodes[0].parameters.nodes })), true,
    "the authored saved expectation is consumed, not derived from output");
  const actualModule = elaborate(moduleBody);
  assert.equal(actualModule.root.kind, "SourceFile");
  assert.equal(actualModule.root.statements.nodes[0].body === actualFunction.root, true, "one canonical typed subtree");
  for (const [index, parameter] of actualFunction.params.entries()) {
    assert.equal(actualModule.root.statements.nodes[0].parameters.nodes[index] === parameter, true,
      "the module and body share the one actual selected parameter occurrence");
    assert.equal(parameter.parent, checked.tree.statements.nodes[0].id);
    assert.equal(parameter.parent === actualFunction.root.id, false, "the actual header parent is not rewritten to the body root");
    assert.equal(parameter.id, functionBody.locals[index].declaration.value.node);
    assert.equal(functionBody.locals[index].declaration.kind, "item");
    assert.equal(functionBody.locals[index].declaration.value.owner, parameter.tsonic.declaration);
    assert.equal("acceptsOmission" in parameter.tsonic, false, "the header does not duplicate signature omission authority");
  }
  assert.deepEqual(types.readType(interner, actualModule.completion), { kind: "intrinsic", intrinsic: "void" });
  const publication = { module, tree: actualModule.root, bodies: checked.bodies.map(body => typed.get(body.body)) };
  const verifier = { source: checked, module: publication, types: tableOf(), declarationOf,
    bindingScopesOf: target => {
      if (target.kind === "module") return target.module === module ? [] : null;
      const body = domain.bodyOf.get(target.instance.body);
      const scope = descriptions.get(body?.owner)?.generics;
      if (scope === undefined) return null;
      return body.root.kind === "SourceFile" ? [scope, scope,
        ...checked.tree.statements.nodes.map(statement => descriptions.get(statement.tsonic.definition).generics)] : [scope];
    },
    memberTableOf: () => null, bodyOf: instance => instance.bindings.kind === "parametric" ? typed.get(instance.body) ?? null : null,
    nominalOf: () => null, nodeOf: domain.nodeOf, localExists: domain.localExists, diagnostics: checked.checkerDiagnostics };
  assert.deepEqual(irTir.verifyTirModule(verifier, publication), [], "the genuine composed typed module passes its barrier");
  for (const body of publication.bodies) assert.deepEqual(irTir.verifyTir(verifier, body), [], "each canonical body passes TIR");
  const scope = descriptions.get(functionBody.owner).generics;
  assert.deepEqual([scope.classParameters.length, scope.methodParameters.length, scope.capturedParameters.length, scope.selfOwners.length],
    [0, 0, 0, 0], "the actual checked declaration has no class, method, captured or self formal slots");
  const bindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
  const selected = { body: functionBody.body, bindings: { kind: "instantiated", bindings } };
  const record = solved.get(functionBody.body);
  const completedParts = database.run(registered.solutionOf, record.group.id);
  assert.equal(completedParts.kind, "completed");
  const actualParts = completedParts.value.group.signatures.filter(part => part.definition === functionBody.owner).map(part =>
    inferenceStep.projectInferredPart({ query: registered.solutionOf.name, key: record.group.id }, completedParts.value,
      { kind: "inferred-part", part }, database.errorOf));
  assert.equal(actualParts.length, resultAnnotation === "" ? 1 : 0);
  const selectedSignature = wiring.decls.placeSignature(inputs, { kind: "callable-body", instance: selected, parts: actualParts },
    { query: "typedBody", key: [selected.body, types.artifactBindingsData(selected.bindings)] });
  assert.equal(selectedSignature.kind, "done");
  assert.equal(selectedSignature.value.kind, "ok");
  assert.equal(selectedSignature.value.value.id, actualFunction.signature, "actual selected empty-scope placement preserves the canonical signature");
  const replay = template => wiring.elaborate.elaborate(elaborateDeps, { instance: selected, scope, body: functionBody,
    constraints: record.constraints, solution: record.solution, template, nestedBodies: [], initializers: [] });
  assert.throws(() => replay(null), /without its template/u);
  assert.throws(() => replay({ ...actualFunction, owner: moduleBody.owner }), /actual parametric body template/u);
  const selectedResult = replay(actualFunction);
  assert.equal(selectedResult.kind, "ok");
  const actualExecution = selectedResult.value;
  assert.equal(actualExecution.root === actualFunction.root, false, "the selected body is genuinely elaborated from checked input, not cloned and retagged TIR");
  assert.equal(actualExecution.bindings === selected.bindings, true);
  assert.equal(actualExecution.signature, selectedSignature.value.value.id);
  const selectedPublication = { ...publication, bodies: [...publication.bodies, actualExecution] };
  const selectedVerifier = { ...verifier, module: selectedPublication, bodyOf: instance => instance.body === selected.body
    && types.artifactBindingsKey(instance.bindings) === types.artifactBindingsKey(selected.bindings) ? actualExecution : verifier.bodyOf(instance),
    bindingScopesOf: target => target.kind === "body" && target.instance.body === selected.body
      && target.instance.bindings.kind === "instantiated" ? [scope, scope] : verifier.bindingScopesOf(target) };
  assert.deepEqual(irTir.verifyTir(selectedVerifier, actualExecution), [], "the actual selected execution body passes the typed-body barrier");
  assert.deepEqual(irTir.verifyTirModule(selectedVerifier, selectedPublication), [], "the canonical publication retains both template and selected execution once");
  const text = irTir.printTir(actualExecution);
  const parsed = irTir.parseTir(text);
  assert.equal(isDeepStrictEqual(parsed, { kind: "parsed", value: actualExecution }), true,
    "selected headers and their syntax references survive the one TIR codec");
  assert.equal(text.includes("TirParam("), false, "the superseded scalar parameter form is not emitted");
  const candidateVerifier = candidate => ({ ...selectedVerifier,
    module: { ...selectedPublication, bodies: selectedPublication.bodies.map(body => body === actualExecution ? candidate : body) },
    bodyOf: instance => instance.body === selected.body
      && types.artifactBindingsKey(instance.bindings) === types.artifactBindingsKey(selected.bindings) ? candidate : verifier.bodyOf(instance) });
  for (const mutate of [
    body => { body.params[0].parent = body.root.id; },
    body => { body.params[0].tsonic.local.body = moduleBody.body; },
    body => { body.params[0].tsonic.declaration = moduleBody.owner; },
    body => { body.params[0].tsonic.passing = "borrow-shared"; },
    body => { body.params[0].tsonic.role = "optional"; },
    body => { body.params[0].tsonic.storage = actualModule.completion; },
    body => { body.params[0] = body.params[1]; },
    body => { body.params.pop(); },
  ]) {
    const candidate = structuredClone(actualExecution);
    mutate(candidate);
    assert.equal(irTir.verifyTir(candidateVerifier(candidate), candidate).length > 0, true,
      "foreign, duplicate and mismatched selected headers are not admitted");
  }
  for (const missing of [true, false]) {
    const wrongSource = { ...selectedVerifier, nodeOf: reference => reference.kind === "item"
      && reference.value.owner === actualExecution.params[0].tsonic.declaration
      ? missing ? null : checked.tree : domain.nodeOf(reference) };
    assert.equal(irTir.verifyTir(wrongSource, actualExecution).some(violation => violation.rule === "parameter-order"), true,
      "a missing or foreign checked ITEM/header relation cannot be replaced by a globally present node");
  }
  const run = {
    selectedNativeFacts: snapshot.nativeFacts,
    interner,
    table: tableOf(),
    defs: {
      completionSelector: types.internType(interner, { kind: "primitive", primitive: "int32" }),
      exceptionStorage: types.internType(interner, { kind: "intrinsic", intrinsic: "unknown" }),
    },
    lowering: { maximumRecords: 100000 },
    verification: { maximumWork: 1000000 },
    declarationOf,
    bodyOwner: body => domain.bodyOf.get(body)?.owner ?? null,
    bodyOf: selectedVerifier.bodyOf,
  };
  const currentRun = { ...run, table: tableOf() };
  const unit = { request: { query: "mirBody", key: [actualExecution.body, types.artifactBindingsData(actualExecution.bindings)] },
    position: { kind: "result" } };
  assert.throws(() => wiring.lowerMir.lowerToMir(lowerMirStep.lowerMirDeps(currentRun, unit), actualFunction, []),
    /selected complete body instance/u, "production lowering does not accept the schema-level parametric template");
  const lower = limits => wiring.lowerMir.lowerToMir(lowerMirStep.lowerMirDeps({ ...currentRun, lowering: limits }, unit), actualExecution, []);
  const lowered = lower(run.lowering);
  assert.equal(lowered.kind, "ok", "the real typed function lowers without a handwritten graph");
  const mir = lowered.value;
  const mirContext = lowerMirStep.mirVerificationContext(currentRun, actualExecution);
  assert.equal(mirContext.selectedNativeFacts === snapshot.nativeFacts, true, "the caller forwards the same captured native facts record");
  assert.deepEqual(irMir.verifyMir(mir, mirContext), { kind: "complete", violations: [] });
  assert.equal(isDeepStrictEqual(irMir.parseMir(irMir.printMir(mir)), { kind: "parsed", value: mir }), true,
    "the actual current MIR graph roundtrips its canonical codec");
  assert.deepEqual(mir.entries.map(entry => entry.provided), [2], "the real execution entry keeps its provided count");
  assert.deepEqual(mir.locals.filter(local => local.role.kind === "parameter").map(local => local.source),
    actualFunction.params.map(parameter => parameter.tsonic.local));
  const records = mir.locals.length + mir.places.length + mir.constants.length + mir.blocks.length +
    mir.blocks.reduce((total, block) => total + block.statements.length, 0);
  assert.equal(lower({ maximumRecords: records }).kind, "ok", "exact graph size succeeds");
  for (const maximumRecords of [0, records - 1]) {
    const refused = lower({ maximumRecords });
    assert.equal(refused.kind, "refused", "the same producer refuses before publishing a partial graph");
    assert.equal(refused.diagnostics.length, 1);
    assert.equal(refused.diagnostics[0].code.kind, "host");
    assert.equal(refused.diagnostics[0].code.name, "TSONIC_COMPILER_RESOURCE_LIMIT");
  }
  assert.deepEqual(irMir.verifyMir(mir, { ...mirContext, limits: { maximumWork: 0 } }),
    { kind: "resource-limit", body: mir.body, dimension: "work", maximum: 0 });
  assert.equal(domain.nodeOf({ kind: "body", value: { body: functionBody.body, node: checked.tree.id } }), null,
    "a globally present node in another body's namespace is not accepted");
  assert.equal(domain.localExists({ body: moduleBody.body, local: functionBody.params[0].local }), false,
    "a parameter local is not a module-body local");
  for (const nested of [null, { ...actualFunction, body: moduleBody.body }, { ...actualFunction, owner: moduleBody.owner },
    { ...actualFunction, bindings: selected.bindings }]) {
    const invalidView = { ...verifier, bodyOf: instance => instance.body === functionBody.body ? nested : verifier.bodyOf(instance) };
    assert.equal(irTir.verifyTir(invalidView, actualModule).length > 0, true, "a nested parameter context must be its actual canonical parametric body");
  }
  for (const mutate of [
    parameter => { parameter.tsonic.local = null; },
    parameter => { parameter.tsonic.passing = null; },
    parameter => { parameter.tsonic.local.body = moduleBody.body; },
    parameter => { parameter.tsonic.local.local = functionBody.params[1].local; },
    parameter => { parameter.tsonic.passing = "borrow-shared"; },
    parameter => { parameter.name.tsonic.storage = actualModule.completion; },
  ]) {
    const changed = structuredClone(publication);
    mutate(changed.tree.statements.nodes[0].parameters.nodes[0]);
    const changedBodyOf = new Map(changed.bodies.map(body => [body.body, body]));
    const changedVerifier = { ...verifier, module: changed,
      bodyOf: instance => instance.bindings.kind === "parametric" ? changedBodyOf.get(instance.body) ?? null : null };
    const violations = irTir.verifyTir(changedVerifier, changedBodyOf.get(moduleBody.body));
    assert.equal(violations.some(violation => violation.rule === "binding-storage" || violation.rule === "parameter-order"), true,
      "nested parameter storage/formal rules remain enforced in the enclosing module body");
  }
});
