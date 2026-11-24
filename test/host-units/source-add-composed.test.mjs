import { insertFixtureType } from "./fixtures/types-construction.mjs";
import assert from "node:assert/strict";
import { suppliedTirScopes, tirFixtureBodyVerifier, tirFixtureVerifier } from "./fixtures/typed-occurrence-witnesses.mjs";
import { isDeepStrictEqual } from "node:util";
import { before, test } from "node:test";
import { loadFrontFixture } from "./fixtures/front/checked-module.mjs";
import { analysisInput } from "./fixtures/front/analysis-input.mjs";
import { checkedDomain } from "./fixtures/front/checked-domain.mjs";
import { expectedComposedAdd } from "./fixtures/elaborate/add-composed.expected.mjs";

let fixture;
let wiring;
let pipeline;
let semanticQueries;
let query;
let irTir;
let verifyBody;
let verifyChapter;
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
  verifyBody = await tirFixtureBodyVerifier(irTir.verifyTir);
  verifyChapter = await tirFixtureVerifier(irTir.verifyTirModule);
  irMir = await import("../../packages/host/dist/ir-mir/index.js");
  lowerMirStep = await import("../../packages/host/dist/pipeline/lower-mir-step.js");
  inferenceStep = await import("../../packages/host/dist/pipeline/inference-step.js");
});

const EXPANSION = { maximumDepth: 64, maximumVisits: 4096, maximumUnionMembers: 64, maximumIntersectionMembers: 64 };

test("checked enum members share only their actual authored execution roots with the verified chapter", async () => {
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { createAccount } = await import("../../packages/host/dist/dataflow/index.js");
  const { inferredPartsOf } = await import("../../packages/host/dist/ir-infer/index.js");
  const input = analysisInput(fixture, "sdk-minimal",
    'export enum Code { Start = 2, End = 5, Next } export enum Word { Yes = "yes" }');
  const captured = captureSourceBarrier(input);
  assert.equal(captured.kind, "ok", JSON.stringify(captured.diagnostics));
  const typed = typeSourceBarrier(input, captured.value, createAccount(input.limits.dataflow));
  assert.equal(typed.kind, "ok", JSON.stringify(typed.diagnostics));
  const chapter = typed.value.modules.get(input.snapshot.entryPoint);
  assert.equal(chapter.tree.kind, "ready-root");
  const [numeric, text] = chapter.tree.root.statements.nodes.map(slot => slot.node);
  assert.equal(numeric.kind, "EnumDeclaration");
  assert.equal(text.kind, "EnumDeclaration");
  assert.notEqual(numeric.tsonic.type, text.tsonic.type);
  const table = fixture.types.viewTypes(captured.value.types);
  for (const declaration of [numeric, text]) {
    assert.deepEqual(table.terms[declaration.tsonic.type], { kind: "enum", definition: declaration.tsonic.definition });
    for (const member of declaration.members.nodes) {
      const executions = chapter.bodies.filter(execution => execution.owner === member.tsonic.definition);
      const definition = member.tsonic.definition;
      const reference = captured.value.checked.declarationSourceOf(definition);
      const original = captured.value.checked.nodeOf(reference);
      assert.equal(original.kind, "EnumMember");
      assert.equal(member.tsonic.storage, declaration.tsonic.type);
      if (member.initializer === null) {
        assert.equal(member.name.text, "Next");
        assert.equal(member.tsonic.initializer, null);
        assert.equal(executions.length, 0);
        assert.deepEqual(inferredPartsOf(definition, original), []);
        continue;
      }
      assert.equal(executions.length, 2);
      const parametric = executions.find(execution => execution.bindings.kind === "parametric");
      const instantiated = executions.find(execution => execution.bindings.kind === "instantiated");
      assert.deepEqual(inferredPartsOf(definition, original), [{ definition, part: { kind: "enum-member-value" } }]);
      assert.equal(parametric.root === member.initializer, true);
      for (const body of [parametric, instantiated]) {
        assert.equal(body.body, member.tsonic.initializer);
        assert.notEqual(body.completion, member.tsonic.storage);
        assert.equal(table.signatures[body.signature].result, body.completion);
        const placement = typed.value.placedSignatureOf({ body: body.body, bindings: body.bindings });
        assert.equal(placement.request, null);
        assert.equal(placement.signature === table.signatures[body.signature], true);
        const carrier = table.terms[body.completion];
        if (declaration === numeric) assert.deepEqual(carrier, { kind: "primitive", primitive: "int64" });
        else assert.deepEqual(carrier.value, { kind: "string", value: "yes" });
      }
    }
  }
});

test("verified enum evaluation publishes named numeric and text constants without granting runtime activation", async () => {
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { printProgramIndex, parseProgramIndex } = await import("../../packages/host/dist/ir-program/index.js");
  const input = analysisInput(fixture, "sdk-minimal", 'export enum Code { Start=2, End=Start+3, Next }'
    + 'export enum Word { Yes="yes" } export enum State { Pending, Done }'
    + 'export enum Code { Other=8, OneMore } export enum Empty {}');
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index, modules } = result.value;
  const chapter = modules.find(module => module.module === input.snapshot.entryPoint);
  const enums = chapter.tree.root.statements.nodes.map(slot => slot.node);
  assert.notEqual(enums[0].tsonic.definition, enums[3].tsonic.definition);
  assert.equal(enums[0].tsonic.type, enums[3].tsonic.type, "merged declaration parts share the actual nominal owner");
  assert.notEqual(enums[0].tsonic.type, enums[4].tsonic.type, "an empty enum retains its own nominal owner");
  const members = new Map(enums.flatMap(declaration => declaration.members.nodes.map(member => [member.name.text, member])));
  const values = new Map(index.constants.map(row => [row.reference.member, row]));
  assert.equal(values.size, members.size);
  for (const [name, expected] of [["Start", 2n], ["End", 5n], ["Next", 6n], ["Yes", "yes"], ["Pending", 0n], ["Done", 1n],
    ["Other", 8n], ["OneMore", 9n]]) {
    const member = members.get(name);
    const record = values.get(member.tsonic.definition);
    assert.equal(record.reference.context, "enum-member");
    assert.equal("initializer" in record.reference, false);
    assert.equal(record.reference.bindings.kind, "instantiated");
    const published = index.bodies.filter(body => body.owner === member.tsonic.definition);
    assert.equal(published.length, member.initializer === null ? 0 : 1);
    assert.equal(published.every(body => body.kind === "template"), true);
    if (typeof expected === "string") {
      assert.equal(record.value.kind, "string");
      assert.equal(record.value.value, expected);
    } else {
      assert.equal(record.value.kind, "number");
      assert.deepEqual(record.value.value, { numerator: expected, denominator: 1n, negativeZero: false });
    }
  }
  assert.equal(index.dependencyInventory.operations.length, 1, "only the actual module initializer is a runtime operation");
  const printed = printProgramIndex(index);
  assert.match(printed, /EnumConstantReference\(member=def:/u);
  const roundTrip = parseProgramIndex(printed);
  assert.equal(roundTrip.kind, "parsed");
  assert.deepEqual(roundTrip.value.constants, index.constants);

  const bounded = { ...input, limits: { ...input.limits, evaluation: { ...input.limits.evaluation, maximumSteps: 0 } } };
  const refused = analyzeHostProgram(bounded);
  assert.equal(refused.kind, "refused");
  assert.equal("value" in refused, false);
  assert.equal(refused.diagnostics[0].source, "evaluate");
  assert.deepEqual(refused.diagnostics[0].arguments, [{ kind: "text", value: "evaluation.maximumSteps" }, { kind: "number", value: 0 }]);
});

test("an enum read keeps its verified member and value carrier through both syntax codecs", async () => {
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { printModuleBodies, parseModuleBodies } = await import("../../packages/host/dist/ir-program/index.js");
  const { createAccount } = await import("../../packages/host/dist/dataflow/index.js");
  const input = analysisInput(fixture, "sdk-minimal", "export enum Code { Start=2, Other=2, End=Start+3 }");
  const captured = captureSourceBarrier(input);
  assert.equal(captured.kind, "ok");
  const typed = typeSourceBarrier(input, captured.value, createAccount(input.limits.dataflow));
  assert.equal(typed.kind, "ok");
  const context = typed.value.verifierOf(input.snapshot.entryPoint);
  const chapter = typed.value.modules.get(input.snapshot.entryPoint);
  const [start, other, end] = chapter.tree.root.statements.nodes[0].node.members.nodes;
  const producer = chapter.bodies.find(body => body.owner === start.tsonic.definition && body.bindings.kind === "parametric");
  const consumer = chapter.bodies.find(body => body.owner === end.tsonic.definition && body.bindings.kind === "parametric");
  const original = consumer.root.left.tsonic;
  const selected = captured.value.checked.declarationSourceOf(start.tsonic.definition);
  const crossed = captured.value.checked.declarationSourceOf(other.tsonic.definition);
  assert.equal(selected.kind === "item" && crossed.kind === "item", true);
  assert.deepEqual(original.resolution, { kind: "enum-member", declaration: selected.value, aliases: [],
    bindings: { kind: "instantiated", bindings: { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] } } });
  assert.equal(original.type, producer.completion);
  assert.deepEqual(verifyBody(context, consumer), []);

  for (const [resolution, expected] of [[{ ...original.resolution, declaration: crossed.value }, ["enum-reference-exact"]],
    [{ ...original.resolution, bindings: { kind: "parametric" } }, ["binding-vector-complete", "enum-reference-exact"]],
    [{ kind: "definition", definition: start.tsonic.definition, aliases: [] }, ["binding-vector-complete", "enum-reference-exact"]]]) {
    consumer.root.left.tsonic = { ...original, resolution };
    assert.deepEqual(verifyBody(context, consumer).map(finding => finding.rule), expected, resolution.kind);
  }
  consumer.root.left.tsonic = original;
  const text = irTir.printTir(consumer);
  assert.match(text, /enum-member\(/u);
  assert.equal(isDeepStrictEqual(irTir.parseTir(text), { kind: "parsed", value: consumer }), true);

  const analyzed = analyzeHostProgram(input);
  assert.equal(analyzed.kind, "ok", JSON.stringify(analyzed.diagnostics));
  const actual = analyzed.value.modules.find(module => module.module === input.snapshot.entryPoint);
  const document = printModuleBodies(analyzed.value.index, actual);
  assert.match(document, /enum-member\(/u);
  const parsed = parseModuleBodies(analyzed.value.index, document);
  assert.equal(parsed.kind, "parsed");
  assert.equal(printModuleBodies(analyzed.value.index, parsed.value), document);
});

test("a qualified enum constant uses its actual declaration qualifier rather than opening a runtime receiver", async () => {
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { printModuleBodies, parseModuleBodies } = await import("../../packages/host/dist/ir-program/index.js");
  const { createAccount } = await import("../../packages/host/dist/dataflow/index.js");
  const source = "export enum Code { Start=2, Same=2, End=Code.Start+3 } export enum Other { Start=2 }";
  const input = analysisInput(fixture, "sdk-minimal", source);
  const captured = captureSourceBarrier(input);
  assert.equal(captured.kind, "ok");
  const typed = typeSourceBarrier(input, captured.value, createAccount(input.limits.dataflow));
  assert.equal(typed.kind, "ok");
  const context = typed.value.verifierOf(input.snapshot.entryPoint);
  const chapter = typed.value.modules.get(input.snapshot.entryPoint);
  const [code, other] = chapter.tree.root.statements.nodes.map(slot => slot.node);
  const [start, same, end] = code.members.nodes;
  const consumer = chapter.bodies.find(body => body.owner === end.tsonic.definition && body.bindings.kind === "parametric");
  const access = consumer.root.left;
  const selected = captured.value.checked.declarationSourceOf(start.tsonic.definition);
  const crossed = captured.value.checked.declarationSourceOf(same.tsonic.definition);
  assert.equal(selected.kind === "item" && crossed.kind === "item", true);
  assert.equal(access.kind, "PropertyAccessExpression");
  assert.equal(access.tsonic.role, "enum-member");
  assert.deepEqual(access.expression.tsonic, { role: "enum-qualifier", nominal: code.tsonic.definition });
  assert.deepEqual(access.tsonic.resolution, { kind: "enum-member", declaration: selected.value, aliases: [],
    bindings: { kind: "instantiated", bindings: { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] } } });
  assert.deepEqual(verifyBody(context, consumer), []);

  const original = access.tsonic;
  access.tsonic = { ...original, resolution: { ...original.resolution, declaration: crossed.value } };
  assert.equal(verifyBody(context, consumer).some(finding => finding.rule === "enum-reference-exact"), true);
  access.tsonic = original;
  const qualifier = access.expression.tsonic;
  access.expression.tsonic = { ...qualifier, nominal: other.tsonic.definition };
  assert.equal(verifyBody(context, consumer).some(finding => finding.rule === "enum-reference-exact"), true);
  access.expression.tsonic = qualifier;
  const text = irTir.printTir(consumer);
  assert.match(text, /enum-qualifier/u);
  assert.equal(isDeepStrictEqual(irTir.parseTir(text), { kind: "parsed", value: consumer }), true);

  const analyzed = analyzeHostProgram(input);
  assert.equal(analyzed.kind, "ok", JSON.stringify(analyzed.diagnostics));
  const actual = analyzed.value.modules.find(module => module.module === input.snapshot.entryPoint);
  const document = printModuleBodies(analyzed.value.index, actual);
  assert.match(document, /enum-qualifier/u);
  const parsed = parseModuleBodies(analyzed.value.index, document);
  assert.equal(parsed.kind, "parsed");
  assert.equal(printModuleBodies(analyzed.value.index, parsed.value), document);
});

test("a qualified enum constant crosses an actual import binding without borrowing a namespace value", async () => {
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { createAccount } = await import("../../packages/host/dist/dataflow/index.js");
  const base = analysisInput(fixture, "sdk-minimal");
  const snapshot = fixture.projectSnapshot({
    sourceFiles: {
      "main.ts": "import { Code as Qualified } from './codes.js'; export enum Output { Result=Qualified.Start+3 }",
      "codes.ts": "export enum Code { Start=2 }",
    },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }],
  });
  const input = { ...base, snapshot };
  const captured = captureSourceBarrier(input);
  assert.equal(captured.kind, "ok", JSON.stringify(captured.diagnostics));
  const typed = typeSourceBarrier(input, captured.value, createAccount(input.limits.dataflow));
  assert.equal(typed.kind, "ok", JSON.stringify(typed.diagnostics));
  const context = typed.value.verifierOf(input.snapshot.entryPoint);
  const chapter = typed.value.modules.get(input.snapshot.entryPoint);
  const output = chapter.tree.root.statements.nodes.find(slot => slot.node.kind === "EnumDeclaration").node.members.nodes[0];
  const consumer = chapter.bodies.find(body => body.owner === output.tsonic.definition && body.bindings.kind === "parametric");
  const access = consumer.root.left;
  assert.equal(access.tsonic.resolution.aliases.length, 1);
  const [binding] = access.tsonic.resolution.aliases;
  assert.equal(captured.value.checked.nodeOf(binding).kind, "ImportSpecifier");
  assert.equal(captured.value.checked.nodeOf({ kind: "item", value: access.tsonic.resolution.declaration }).name.text, "Start");
  assert.deepEqual(verifyBody(context, consumer), []);
  const original = access.tsonic;
  access.tsonic = { ...original, resolution: { ...original.resolution, aliases: [] } };
  assert.equal(verifyBody(context, consumer).some(finding => finding.rule === "enum-reference-exact"), true);
  access.tsonic = original;
  const analyzed = analyzeHostProgram(input);
  assert.equal(analyzed.kind, "ok", JSON.stringify(analyzed.diagnostics));
});

test("initial and predecessor-derived enum types carry their authored value sources", async () => {
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { printHir, parseHir } = await import("../../packages/host/dist/ir-hir/index.js");
  const input = analysisInput(fixture, "sdk-minimal", "export enum Chain { Zero, One=Zero+1, Two, Three=Two+1 }");
  const captured = captureSourceBarrier(input);
  assert.equal(captured.kind, "ok", JSON.stringify(captured.diagnostics));
  const source = captured.value.enums[0];
  const [zero, one, two, three] = source.declaration.members.nodes;
  const oneSource = { definition: one.tsonic.declaration.definition, body: one.tsonic.initializer };
  assert.equal(zero.tsonic.valueSource, null);
  assert.deepEqual(one.tsonic.valueSource, oneSource);
  assert.equal(two.tsonic.valueSource === one.tsonic.valueSource, true);
  assert.deepEqual(three.tsonic.valueSource, { definition: three.tsonic.declaration.definition, body: three.tsonic.initializer });
  const text = printHir(source.module.module);
  const parsed = parseHir(text);
  assert.equal(parsed.kind, "parsed");
  assert.equal(printHir(parsed.value), text);

  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const rows = new Map(result.value.index.constants.map(row => [row.reference.member, row.value]));
  for (const [member, expected] of [[zero, 0n], [one, 1n], [two, 2n], [three, 3n]]) {
    const value = rows.get(member.tsonic.declaration.definition);
    assert.equal(value.kind, "number");
    assert.equal(value.value.numerator, expected);
    assert.deepEqual(result.value.index.types.terms[value.type], { kind: "primitive", primitive: "int64" });
  }
});

test("authored fractional enum members use the selected exact Float64 literal format", async () => {
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const analyze = text => {
    const input = analysisInput(fixture, "sdk-minimal", text);
    return { result: analyzeHostProgram(input), entryPoint: input.snapshot.entryPoint };
  };
  const authored = analyze("export enum Measure { Ratio=1.5, Scaled=125e-2 }");
  assert.equal(authored.result.kind, "ok", JSON.stringify(authored.result.diagnostics));
  const { index, modules } = authored.result.value;
  const chapter = modules.find(module => module.module === authored.entryPoint);
  const named = chapter.tree.root.statements.nodes[0].node;
  const expectedBits = new Map([["Ratio", 0x3ff8000000000000n], ["Scaled", 0x3ff4000000000000n]]);
  for (const member of named.members.nodes) {
    const row = index.constants.find(record => record.reference.member === member.tsonic.definition);
    assert.equal(row.reference.context, "enum-member");
    assert.deepEqual(index.types.terms[row.value.type], { kind: "primitive", primitive: "float64" });
    assert.equal(row.value.kind, "floating");
    assert.equal(row.value.bits, expectedBits.get(member.name.text));
  }
  const implicit = analyze("export enum Measure { Ratio=1.5, Next }");
  assert.equal(implicit.result.kind, "refused");
  assert.equal("value" in implicit.result, false);
  assert.equal(implicit.result.diagnostics.at(-1).source, "decls");
  assert.equal(implicit.result.diagnostics.at(-1).message, "An implicit enum member requires a completed integral predecessor.");
});

for (const resultAnnotation of [": number", ""])
test(`real SDK source add with ${resultAnnotation === "" ? "inferred" : "annotated"} result passes HIR, genuine Decls/Rules/Infer, composed TIR and actual LowerMir/MIR`, () => {
  const source = `export function add(a: number, b: number)${resultAnnotation} { return a + b; }\n`;
  const { checked, interner, typeWork, module, snapshot } = fixture.checkedModuleOf(source);
  const { types, hir } = fixture;
  assert.deepEqual(fixture.verifyChecked(checked, interner), [], "the actual checked source passes HIR");
  const nodes = hir.indexSyntaxTree(checked.tree);
  const domain = checkedDomain(checked, hir);
  const items = new Map(checked.items.map(item => [item.definition, nodes[item.node]]));
  items.set(checked.tree.tsonic.definition, checked.tree);
  const definitionTable = wiring.decls.describeDefinitions({ module: checked, nodes }, hir.deriveDeclarationScopes(checked, nodes), []);
  const descriptions = new Map(definitionTable.definitions.map(description => [description.definition, description]));
  const declarationOf = definition => {
    const item = items.get(definition);
    const description = descriptions.get(definition);
    return item === undefined || description === undefined ? null : { scope: description.generics,
      parameterCount: "parameters" in item && "nodes" in item.parameters ? item.parameters.nodes.length : null,
      endpoints: "signatures" in item.tsonic ? item.tsonic.signatures : [] };
  };
  const inputs = { modules: [{ module: checked, nodes }], types: interner, typeWork, typeExpansion: EXPANSION };
  const deps = pipeline.inferDepsOf({ typeWork, structuralCuts: domain.sources.structuralCuts, cuts: domain.sources.cuts, checkedNodeOf: domain.nodeOf,
    bindingScopeOf: definition => descriptions.get(definition)?.generics ?? assert.fail("actual checked scope required"),
    rules: { libraries: { sources: [], sourceRoles: [], guarantees: [] }, types: interner,
      selectedNativeFacts: snapshot.nativeFacts, typeExpansion: EXPANSION },
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
  const base = { declarations: inputs, instantiation: { maximumWork: 65536, maximumCreatedRecords: 65536 } };
  const formSites = wiring.validate.indexFormDiagnostics({ role: "source", scopeOf: domain.sources.formScopeOf }, checked);
  assert.equal(formSites.length, 0);
  const semanticInputs = { inference: deps, groups: grouped.value, sources: domain.sources,
    forms: semanticQueries.formDiagnosticsQuery(base, site => formSites.includes(site)), projectForms: new Map(), groupForms: () => formSites,
    bindingScopeOf: definition => descriptions.get(definition).generics,
    verification: (group, constraints) => ({ types: table, declarationOf, nominalOf: () => null,
      nodeExists: reference => domain.nodeOf(reference) !== null, localExists: domain.localExists,
      bindingScopes: constraints.constraints.flatMap(set => set.constraints.filter(constraint => constraint.kind === "flow")
        .map(() => descriptions.get(domain.bodyOf.get(set.body).owner).generics)) }) };
  const registered = semanticQueries.createSourceSemanticQueries(base, semanticInputs).queries;
  const database = query.createDatabase(base, { maximumRecords: 65536 },
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
  const elaborateDeps = { cuts: domain.sources.cuts, types: interner, typeWork, rules: deps.rules, nodeOf: domain.nodeOf, typeOf: type => types.readType(interner, type),
    staticStorageOf: () => null,
    signatureOf: signature => types.readSignature(interner, signature), bindingOf: deps.bindingOf, checkerDiagnosticsOf: () => checked.checkerDiagnostics };
  const elaborate = body => {
    const record = solved.get(body.body);
    const result = wiring.elaborate.elaborate(elaborateDeps, {
      instance: { body: body.body, bindings: { kind: "parametric" } }, scope: descriptions.get(body.owner).generics,
      body, layoutAlias: null, typing: { kind: "ready", constraints: record.constraints, solution: record.solution, template: null },
      nestedBodies: body.nestedBodies.map(nested => typed.get(nested)), initializers: [],
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
  const float64 = insertFixtureType(types, interner, { kind: "primitive", primitive: "float64" });
  assert.equal(isDeepStrictEqual(actualFunction, expectedComposedAdd(functionBody, { signature: actualFunction.signature, float64,
    parameters: checked.tree.statements.nodes[0].parameters.nodes })), true,
    "the authored saved expectation is consumed, not derived from output");
  const actualModule = elaborate(moduleBody);
  assert.equal(actualModule.root.kind, "SourceFile");
  assert.equal(actualModule.root.statements.nodes[0].node.body === actualFunction.root, true, "one canonical typed subtree");
  for (const [index, parameter] of actualFunction.params.entries()) {
    assert.equal(actualModule.root.statements.nodes[0].node.parameters.nodes[index] === parameter, true,
      "the module and body share the one actual selected parameter occurrence");
    assert.equal(parameter.parent, checked.tree.statements.nodes[0].id);
    assert.equal(parameter.parent === actualFunction.root.id, false, "the actual header parent is not rewritten to the body root");
    assert.equal(parameter.id, functionBody.locals[index].declaration.value.node);
    assert.equal(functionBody.locals[index].declaration.kind, "item");
    assert.equal(functionBody.locals[index].declaration.value.owner, parameter.tsonic.declaration);
    assert.equal("acceptsOmission" in parameter.tsonic, false, "the header does not duplicate signature omission authority");
  }
  assert.deepEqual(types.readType(interner, actualModule.completion), { kind: "intrinsic", intrinsic: "void" });
  const publication = { module, tree: { kind: "ready-root", root: actualModule.root }, bodies: checked.bodies.map(body => typed.get(body.body)) };
  const verifier = { source: checked, module: publication, types: tableOf(), declarationOf, declarationSourceOf: domain.declarationSourceOf,
    layoutAliasOf: null,
    bindingScopesOf: suppliedTirScopes(target => {
      if (target.kind === "module") return target.module === module ? [] : null;
      const body = domain.bodyOf.get(target.instance.body);
      const scope = descriptions.get(body?.owner)?.generics;
      if (scope === undefined) return null;
      return body.root.kind === "SourceFile" ? [scope, scope,
        ...checked.tree.statements.nodes.map(statement => descriptions.get(statement.tsonic.definition).generics)] : [scope];
    }),
    staticStorageOf: () => null,
    memberTableOf: () => null, bodyOf: instance => instance.bindings.kind === "parametric" ? typed.get(instance.body) ?? null : null,
    nominalOf: () => null, nodeOf: domain.nodeOf, localExists: domain.localExists, diagnostics: checked.checkerDiagnostics };
  assert.deepEqual(verifyChapter(verifier, publication), [], "the genuine composed typed module passes its barrier");
  for (const body of publication.bodies) assert.deepEqual(verifyBody(verifier, body), [], "each canonical body passes TIR");
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
    { query: "typedBody", key: [selected.body, types.artifactBindingsData(selected.bindings)] }, domain.sources.cuts);
  assert.equal(selectedSignature.kind, "done");
  assert.equal(selectedSignature.value.kind, "ok");
  assert.equal(selectedSignature.value.value.signature.id, actualFunction.signature, "actual selected empty-scope placement preserves the canonical signature");
  assert.equal(selectedSignature.value.value.request.bindings === selected.bindings, true, "the actual complete environment accompanies the answer");
  const replay = template => wiring.elaborate.elaborate(elaborateDeps, { instance: selected, scope, body: functionBody, layoutAlias: null,
    typing: { kind: "ready", constraints: record.constraints, solution: record.solution, template }, nestedBodies: [], initializers: [] });
  assert.throws(() => replay(null), /without its template/u);
  assert.throws(() => replay({ ...actualFunction, owner: moduleBody.owner }), /actual parametric body template/u);
  const selectedResult = replay(actualFunction);
  assert.equal(selectedResult.kind, "ok");
  const actualExecution = selectedResult.value;
  assert.equal(actualExecution.root === actualFunction.root, false, "the selected body is genuinely elaborated from checked input, not cloned and retagged TIR");
  assert.equal(actualExecution.bindings === selected.bindings, true);
  assert.equal(actualExecution.signature, selectedSignature.value.value.signature.id);
  const selectedPublication = { ...publication, bodies: [...publication.bodies, actualExecution] };
  const selectedVerifier = { ...verifier, module: selectedPublication, bodyOf: instance => instance.body === selected.body
    && types.artifactBindingsKey(instance.bindings) === types.artifactBindingsKey(selected.bindings) ? actualExecution : verifier.bodyOf(instance),
    layoutAliasOf: null,
    bindingScopesOf: (target, subject, visit) => target.kind === "body" && target.instance.body === selected.body
      && target.instance.bindings.kind === "instantiated" ? { kind: "complete", scopes: [scope, scope] }
      : verifier.bindingScopesOf(target, subject, visit) };
  assert.deepEqual(verifyBody(selectedVerifier, actualExecution), [], "the actual selected execution body passes the typed-body barrier");
  assert.deepEqual(verifyChapter(selectedVerifier, selectedPublication), [], "the canonical publication retains both template and selected execution once");
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
    assert.equal(verifyBody(candidateVerifier(candidate), candidate).length > 0, true,
      "foreign, duplicate and mismatched selected headers are not admitted");
  }
  for (const missing of [true, false]) {
    const wrongSource = { ...selectedVerifier, nodeOf: reference => reference.kind === "item"
      && reference.value.owner === actualExecution.params[0].tsonic.declaration
      ? missing ? null : checked.tree : domain.nodeOf(reference) };
    assert.equal(verifyBody(wrongSource, actualExecution).some(violation => violation.rule === "parameter-order"), true,
      "a missing or foreign checked ITEM/header relation cannot be replaced by a globally present node");
  }
  const run = {
    selectedNativeFacts: snapshot.nativeFacts,
    interner,
    table: tableOf(),
    defs: {
      completionSelector: insertFixtureType(types, interner, { kind: "primitive", primitive: "int32" }),
      exceptionStorage: insertFixtureType(types, interner, { kind: "intrinsic", intrinsic: "unknown" }),
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
  assert.throws(() => wiring.lowerMir.lowerToMir(lowerMirStep.lowerMirDeps(currentRun, unit), actualFunction, [], [2]),
    /selected complete body instance/u, "production lowering does not accept the schema-level parametric template");
  const lower = limits => wiring.lowerMir.lowerToMir(lowerMirStep.lowerMirDeps({ ...currentRun, lowering: limits }, unit), actualExecution, [], [2]);
  const lowered = lower(run.lowering);
  assert.equal(lowered.kind, "ok", "the real typed function lowers without a handwritten graph");
  const mir = lowered.value;
  const mirContext = lowerMirStep.mirVerificationContext(currentRun, actualExecution, [2]);
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
    assert.equal(verifyBody(invalidView, actualModule).length > 0, true, "a nested parameter context must be its actual canonical parametric body");
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
    mutate(changed.tree.root.statements.nodes[0].node.parameters.nodes[0]);
    const changedBodyOf = new Map(changed.bodies.map(body => [body.body, body]));
    const changedVerifier = { ...verifier, module: changed,
      bodyOf: instance => instance.bindings.kind === "parametric" ? changedBodyOf.get(instance.body) ?? null : null };
    const violations = verifyBody(changedVerifier, changedBodyOf.get(moduleBody.body));
    assert.equal(violations.some(violation => violation.rule === "binding-storage" || violation.rule === "parameter-order"), true,
      "nested parameter storage/formal rules remain enforced in the enclosing module body");
  }
});
