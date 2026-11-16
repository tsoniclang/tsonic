import assert from "node:assert/strict";
import { test } from "node:test";
import { loadFrontFixture, navigationCapture, preparation } from "./fixtures/front/checked-module.mjs";

function analysisInput(fixture, library, source = "export function add(a: number, b: number): number { return a + b; }\n") {
  const snapshot = fixture.projectSnapshot({
    sourceFiles: { "main.ts": source },
    libraries: library === "es2024" ? fixture.bundled()
      : [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }],
  });
  const extensions = fixture.front.createCheckerExtensions([]);
  assert.deepEqual(fixture.snapshots.verifySnapshot(snapshot, fixture.front.extensionReferencesOf(extensions)), []);
  const typeExpansion = { maximumDepth: 128, maximumVisits: 100000, maximumUnionMembers: 1024, maximumIntersectionMembers: 1024 };
  return {
    snapshot, preparation, extensions,
    limits: {
      navigationCapture,
      query: { maximumRecords: 1000000 },
      inference: { maximumVariablesPerGroup: 10000, maximumAtomicContributionsPerGroup: 10000 },
      evaluation: { maximumSteps: 100000, maximumIntermediateBits: 4096, maximumResultBits: 4096, maximumArithmeticWork: 100000 },
      dataflow: { maximumWork: 1000000, maximumResultEntries: 1000000 },
      analyses: { maximumProjectionDepth: 64, maximumOriginAlternatives: 64, maximumConditionAlternatives: 64,
        maximumRelationalRecordsPerBody: 100000, maximumRelationalReferencesPerBody: 100000 },
      summaries: { maximumIterationsPerComponent: 100, maximumComponentSize: 10000 },
      metadata: { maximumWork: 100000, maximumGeometryBits: 4096 },
      instantiation: { maximumWork: 1000000, maximumCreatedRecords: 1000000, maximumBindingVectorsPerArtifact: 1000, typeExpansion },
      lowering: { maximumRecords: 1000000 }, mirVerification: { maximumWork: 1000000 },
    },
  };
}

for (const library of ["es2024", "sdk-minimal"])
test(`public Host analysis source barrier captures the complete actual ${library} declaration input before an exported add`, async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const input = analysisInput(fixture, library);
  const result = captureSourceBarrier(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.packages.modules.length, "the first production barrier cannot skip loaded declaration modules");
  assert.equal(result.value.modules.some(module => module.module.module === fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts")), true);
});

test("real public Host analysis retains an omitted initializer's actual captured boolean mutation", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", "export function choose(a:boolean,b:boolean=(a=true)):boolean{return a;}");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.packages.modules.length);
  const main = result.value.modules.find(module => module.module === fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts"));
  const caller = main.bodies.find(body => body.kind === "selected" && body.tir.params.length === 2);
  assert.notEqual(caller, undefined);
  const child = main.bodies.find(body => body.kind === "selected" && body.instance.body === caller.tir.params[1].tsonic.initializer);
  assert.notEqual(child, undefined);
  assert.equal(child.tir.root, caller.tir.params[1].initializer);
  assert.deepEqual(child.tir.captures, [{ local: caller.tir.params[0].tsonic.local, capture: "captured-location" }]);
  const summary = result.value.index.summaries.find(row => row.key.kind === "body" && row.key.execution.instance.body === child.instance.body);
  assert.notEqual(summary, undefined);
  assert.equal(summary.writes.length, 1);
  assert.deepEqual(summary.contentsOnReturn, summary.writes);
  assert.equal(summary.initialization.points.some(point => point.kind === "need"), false);
  const returned = summary.initialization.points.findIndex(point => point.kind === "return");
  assert.equal(returned >= 0, true);
  assert.deepEqual(summary.initialization.rows.filter(row => row.point === returned),
    [{ point: returned, cell: null, condition: 0 }, { point: returned, cell: 0, condition: 1 }]);
  const mutations = child.facts[0].origins.writes.filter(row => row.targets.length !== 0);
  assert.equal(mutations.length, 1);
  assert.equal(mutations[0].operation, "mutation");
  assert.deepEqual(mutations[0].targets, [child.facts[0].arena.contexts[0].captures[0].location]);
  assert.deepEqual(caller.facts.map(facts => facts.execution.provided), [1, 2]);
  assert.deepEqual(caller.facts.map(facts => facts.origins.activations.length), [1, 0]);
  assert.equal(caller.facts[0].origins.exitContents.onReturn.length, 1);
  assert.equal(caller.facts[1].origins.exitContents.onReturn.length, 0);
});

test("real public Host analysis preserves an imported generic declaration's actual constraint and default", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal");
  input.snapshot = fixture.projectSnapshot({ sourceFiles: {
    "main.ts": "import type { Box } from './foreign.js';export type Applied=Box;export function value(input:boolean):boolean{return input;}",
    "foreign.ts": "export interface Box<T extends boolean=boolean>{(value:T):T;}",
  }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.diagnostics.some(diagnostic => diagnostic.severity === "error"), false);
  assert.equal(result.value.modules.length, input.snapshot.packages.modules.length);
  const main = result.value.modules.find(module => module.module === fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts"));
  const foreign = result.value.modules.find(module => module.module === fixture.moduleOf(fixture.packageOf("/project"), "src/foreign.ts"));
  const box = foreign.tree.statements.nodes[0];
  const parameter = box.typeParameters.nodes[0];
  const applied = main.tree.statements.nodes[1];
  const selected = result.value.index.types.terms[applied.tsonic.type];
  assert.equal(selected.kind, "declared");
  assert.equal(selected.definition, box.tsonic.definition);
  assert.deepEqual(selected.arguments.map(type => result.value.index.types.terms[type]), [{ kind: "primitive", primitive: "bool" }]);
  for (const type of [parameter.tsonic.parameter.constraint, parameter.tsonic.parameter.default])
    assert.deepEqual(result.value.index.types.terms[type], { kind: "primitive", primitive: "bool" });
  assert.equal(foreign.tree.tsonic.module, foreign.module);
  assert.equal(main.tree.tsonic.module, main.module);
  assert.notEqual(foreign.module, main.module);
  assert.equal(main.bodies.some(body => body.kind === "selected" && body.tir.params.length === 1), true);
});

test("real public AnalyzeHostProgram closes the exported float64 add and every actual loaded declaration module", async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.diagnostics.some(diagnostic => diagnostic.severity === "error"), false);
  const { index, modules } = result.value;
  assert.equal(index.schema, 1);
  assert.equal(index.modules.length, input.snapshot.packages.modules.length);
  assert.equal(modules.length, input.snapshot.packages.modules.length);
  const main = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const module = modules.find(module => module.module === main);
  assert.notEqual(module, undefined);
  const selected = module.bodies.filter(body => body.kind === "selected");
  assert.equal(selected.length, 2, "actual module execution and exported function execution are both present");
  assert.equal(selected.every(body => body.instance.bindings.kind === "instantiated"), true);
  assert.equal(module.bodies.filter(body => body.kind === "template").length, 2);
  assert.equal(index.dependencyInventory.operations.length, 2);
  assert.equal(index.summaries.length, 2);
  const add = selected.find(body => body.tir.params.length === 2);
  assert.notEqual(add, undefined);
  assert.deepEqual(add.mir.entries.map(entry => entry.provided), [2]);
  assert.equal(add.facts.length, 1);
  assert.equal(add.mir.blocks.some(block => block.statements.some(statement => statement.kind === "assign"
    && statement.value.kind === "binary" && statement.value.operation.decision.operation.kind === "native-operator"
    && statement.value.operation.decision.operation.operator === "+"
    && statement.value.operation.decision.operation.carrier === "float64")), true,
  "the selected native addition survives as the canonical MIR binary assignment");
});

test("real public Host analysis preserves a declared structural alias without inventing an execution body", async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const source = "export type Fields = { value: boolean; }; export function identity(input: boolean): boolean { return input; }\n";
  const input = analysisInput(fixture, "sdk-minimal", source);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.diagnostics.some(diagnostic => diagnostic.severity === "error"), false);
  assert.equal(result.value.modules.length, input.snapshot.packages.modules.length);
  const main = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const module = result.value.modules.find(module => module.module === main);
  assert.equal(module !== undefined, true);
  const root = module.bodies.find(body => body.kind === "selected" && body.tir.root.kind === "SourceFile");
  assert.equal(root !== undefined, true);
  const alias = root.tir.root.statements.nodes.find(node => node.kind === "TypeAliasDeclaration");
  assert.equal(alias !== undefined, true);
  assert.equal(alias.type.kind, "TypeLiteral");
  assert.equal(alias.type.tsonic.type, alias.tsonic.type);
  const shape = result.value.index.types.terms[alias.tsonic.type];
  assert.equal(shape.kind, "shape");
  assert.deepEqual(shape.members.map(member => member.key), [{ kind: "text", value: "value" }]);
  assert.deepEqual(result.value.index.types.terms[shape.members[0].read], { kind: "primitive", primitive: "bool" });
  const published = result.value.index.modules.find(module => module.module === main);
  assert.equal(published.items.some(item => item.definition === alias.tsonic.definition && item.node === alias.id), true);
  assert.equal(module.bodies.filter(body => body.kind === "template").length, 2);
  assert.equal(module.bodies.filter(body => body.kind === "selected").length, 2);
});

test("real public Host analysis preserves generic nested structural members and bodyless accessors without creating executions", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const source = "export type Fields<T> = { value: T; readonly nested: { flag: boolean; }; method(input: boolean): boolean; get enabled(): boolean; set enabled(input: boolean | string); }; "
    + "export function identity(input: boolean): boolean { return input; }\n";
  const input = analysisInput(fixture, "sdk-minimal", source);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.packages.modules.length);
  const main = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const module = result.value.modules.find(module => module.module === main);
  const selected = module.bodies.filter(body => body.kind === "selected");
  assert.equal(selected.length, 2);
  assert.equal(module.bodies.filter(body => body.kind === "template").length, 2);
  const root = selected.find(body => body.tir.root.kind === "SourceFile");
  assert.equal(root !== undefined, true);
  const alias = root.tir.root.statements.nodes.find(node => node.kind === "TypeAliasDeclaration");
  assert.equal(alias !== undefined && alias.type.kind === "TypeLiteral", true);
  const parameter = alias.typeParameters.nodes[0].tsonic.parameter.declaration;
  const shape = result.value.index.types.terms[alias.tsonic.type];
  assert.equal(shape.kind, "shape");
  const members = new Map(shape.members.map(member => [member.key.value, member]));
  assert.deepEqual(result.value.index.types.terms[members.get("value").read], { kind: "param", parameter });
  assert.equal(members.get("nested").write, null);
  const nested = result.value.index.types.terms[members.get("nested").read];
  assert.equal(nested.kind, "shape");
  assert.deepEqual(nested.members.map(member => member.key), [{ kind: "text", value: "flag" }]);
  const callable = alias.type.members.nodes.find(node => node.kind === "MethodSignature");
  const getter = alias.type.members.nodes.find(node => node.kind === "GetAccessor");
  const setter = alias.type.members.nodes.find(node => node.kind === "SetAccessor");
  assert.equal(callable !== undefined && getter !== undefined && setter !== undefined, true);
  for (const declaration of [callable, getter, setter]) {
    assert.equal(declaration.tsonic.template, null);
    for (const formal of declaration.parameters.nodes) assert.equal(formal.tsonic.local, null);
    assert.equal(declaration.tsonic.signatures.every(endpoint => endpoint.body === null), true);
  }
  assert.deepEqual(members.get("enabled").readOrigins, [{ kind: "declared", declaration: getter.tsonic.definition }]);
  assert.deepEqual(members.get("enabled").writeOrigins, [{ kind: "declared", declaration: setter.tsonic.definition }]);
});

test("real public Host analysis reads a declared structural field through its actual selected native place", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal",
    "export type Box = { flag: boolean; }; export function read(box: Box): boolean { return box.flag; }\n");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.packages.modules.length);
  const main = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const module = result.value.modules.find(module => module.module === main);
  const caller = module.bodies.find(body => body.kind === "selected" && body.tir.params.length === 1);
  assert.equal(caller !== undefined, true);
  const read = caller.tir.root.statements.nodes[0].expression;
  assert.equal(read.kind, "PropertyAccessExpression");
  assert.deepEqual(result.value.index.types.terms[read.tsonic.convertedType], { kind: "primitive", primitive: "bool" });
  assert.equal(caller.mir.places.some(place => (place.base.kind === "place" || place.base.kind === "checked")
    && place.base.projection.kind === "field" && place.base.tir.node === read.id
    && place.storage === read.tsonic.convertedType), true);
});

for (const [form, value, unaryCount] of [["single", "!flag", 1], ["nested", "!(!flag)", 2]])
test(`real public Host analysis retains ${form} boolean negation as its selected native unary operations`, async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `export function negate(flag: boolean): boolean { return ${value}; }\n`);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.packages.modules.length);
  const main = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const module = result.value.modules.find(module => module.module === main);
  const callable = module.bodies.find(body => body.kind === "selected" && body.tir.params.length === 1);
  assert.notEqual(callable, undefined);
  const expression = callable.tir.root.statements.nodes[0].expression;
  assert.equal(expression.kind, "PrefixUnaryExpression");
  assert.equal(expression.operator, "ExclamationToken");
  assert.equal(callable.mir.blocks.flatMap(block => block.statements).filter(statement => statement.kind === "assign"
    && statement.value.kind === "unary" && statement.value.operation.decision.operation.kind === "native-operator"
    && statement.value.operation.decision.operation.operator === "!"
    && statement.value.operation.decision.operation.carrier === "bool").length, unaryCount);
  assert.deepEqual(callable.facts.map(facts => facts.execution.provided), [1]);
});

test("real public Host analysis publishes a recursive declared alias without unfolding its member graph", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal",
    "export type Link = { next: Link }; export function identity(value: boolean): boolean { return value; }\n");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.packages.modules.length);
  const main = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const module = result.value.modules.find(module => module.module === main);
  const root = module.bodies.find(body => body.kind === "selected" && body.tir.root.kind === "SourceFile");
  const alias = root.tir.root.statements.nodes.find(node => node.kind === "TypeAliasDeclaration");
  assert.equal(alias !== undefined, true);
  const shape = result.value.index.types.terms[alias.tsonic.type];
  assert.equal(shape.kind, "shape");
  assert.equal(shape.members.length, 1);
  assert.deepEqual(shape.members[0].key, { kind: "text", value: "next" });
  assert.equal(shape.members[0].read, alias.tsonic.type);
});

test("real public Host analysis returns a string parameter with its actual entry origins", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", "export function echo(value: string): string { return value; }\n");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.packages.modules.length);
  const main = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const module = result.value.modules.find(module => module.module === main);
  const callable = module.bodies.find(body => body.kind === "selected" && body.tir.params.length === 1);
  assert.equal(callable !== undefined, true);
  assert.deepEqual(callable.facts.map(facts => facts.execution.provided), [1]);
  assert.equal(result.value.index.types.terms[callable.tir.params[0].type.tsonic.type].kind, "string");
  const facts = callable.facts[0];
  const returns = facts.origins.subjects.filter(subject => subject.role === "return");
  assert.equal(returns.length, 1);
  const returned = facts.arena.origins.find(origins => origins.id === returns[0].origins);
  assert.equal(returned.kind, "complete");
  assert.equal(returned.includesAbsence, false);
  assert.equal(returned.producers.length, 1);
  const bound = facts.arena.boundProducers.find(row => row.id === returned.producers[0]);
  const producer = facts.arena.producers.find(row => row.id === bound.producer);
  assert.equal(producer.kind, "parameter");
  assert.equal(producer.index, 0);
  assert.deepEqual(bound.bindings, callable.mir.bindings.bindings);
  assert.equal(facts.arena.contexts.find(row => row.id === bound.context).arguments[0], returned.id);
  const escapes = facts.origins.escapes.filter(escape => escape.target.kind === "return");
  assert.equal(escapes.length, 1);
  assert.equal(escapes[0].producer, producer.id);
  const summary = result.value.index.summaries.find(summary => summary.key.kind === "body"
    && fixture.types.executionKey(summary.key.execution) === fixture.types.executionKey(facts.execution));
  assert.equal(summary !== undefined, true);
  const resultOrigins = summary.arena.origins.find(origins => origins.id === summary.result);
  assert.equal(resultOrigins.producers.length, 1);
  assert.equal(summary.retention.length, 1);
  assert.equal(summary.retention[0].source, resultOrigins.producers[0]);
  assert.deepEqual(summary.retention[0].into, { kind: "return" });
  assert.equal(summary.retention[0].at.kind, "body");
  assert.deepEqual(summary.retention[0].at.execution, facts.execution);
  assert.deepEqual(summary.retention[0].at.point, escapes[0].point);
  assert.equal(summary.retention[0].at.edge, null);
});

test("real public Host analysis retains an authored thrown string and its actual unwind outcome", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", "export function escape(value:string):never{throw value;}");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  const main = result.value.modules.find(module => module.module === fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts"));
  const callable = main.bodies.find(body => body.kind === "selected" && body.tir.params.length === 1);
  assert.equal(callable !== undefined, true);
  const thrown = callable.mir.blocks.find(block => block.terminator.kind === "throw");
  assert.equal(thrown !== undefined, true);
  assert.deepEqual(thrown.terminator.unwind, { kind: "escape" });
  const facts = callable.facts[0];
  const summary = result.value.index.summaries.find(row => row.key.kind === "body"
    && fixture.types.executionKey(row.key.execution) === fixture.types.executionKey(facts.execution));
  assert.equal(summary !== undefined, true);
  assert.equal(summary.returns, false);
  assert.equal(summary.unwinds, true);
  assert.deepEqual(summary.initialization.points, [{ kind: "unwind" }]);
  const origins = summary.arena.origins[summary.thrown];
  assert.equal(origins.kind, "complete");
  assert.equal(origins.includesAbsence, false);
  assert.equal(origins.producers.length, 1);
  const bound = summary.arena.boundProducers[origins.producers[0]];
  assert.deepEqual(summary.arena.producers[bound.producer], { id: bound.producer, path: null, kind: "parameter", index: 0 });
  assert.deepEqual(bound.bindings, callable.mir.bindings.bindings);
  assert.deepEqual(facts.origins.escapes.map(row => [row.point, row.target]),
    [[{ block: thrown.id, statement: null }, { kind: "throw" }]]);
  assert.equal(summary.retention.length, 1);
  assert.equal(summary.retention[0].source, origins.producers[0]);
  assert.deepEqual(summary.retention[0].into, { kind: "throw" });
  assert.deepEqual(summary.retention[0].at.point, { block: thrown.id, statement: null });
});

test("real public Host analysis separates actual returned and thrown string formals at their finite exits", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal",
    "export function choose(flag:boolean,left:string,right:string):string{if(flag){return left;}throw right;}");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  const main = result.value.modules.find(module => module.module === fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts"));
  const callable = main.bodies.find(body => body.kind === "selected" && body.tir.params.length === 3);
  assert.equal(callable !== undefined, true);
  const facts = callable.facts[0];
  const summary = result.value.index.summaries.find(row => row.key.kind === "body"
    && fixture.types.executionKey(row.key.execution) === fixture.types.executionKey(facts.execution));
  assert.equal(summary !== undefined, true);
  assert.equal(summary.returns, true);
  assert.equal(summary.unwinds, true);
  assert.deepEqual(summary.initialization.points, [{ kind: "return" }, { kind: "unwind" }]);
  for (const [kind, origins, index] of [["return", summary.result, 1], ["throw", summary.thrown, 2]]) {
    const value = summary.arena.origins[origins];
    assert.equal(value.kind, "complete");
    assert.equal(value.includesAbsence, false);
    assert.equal(value.producers.length, 1);
    const bound = summary.arena.boundProducers[value.producers[0]];
    assert.deepEqual(summary.arena.producers[bound.producer], { id: bound.producer, path: null, kind: "parameter", index });
    assert.deepEqual(bound.bindings, callable.mir.bindings.bindings);
    const exit = callable.mir.blocks.find(block => block.terminator.kind === kind);
    assert.equal(exit !== undefined, true);
    const retained = summary.retention.filter(row => row.into.kind === kind);
    assert.equal(retained.length, 1);
    assert.equal(retained[0].source, bound.id);
    assert.deepEqual(retained[0].at.point, { block: exit.id, statement: null });
    assert.equal(facts.origins.escapes.some(row => row.point.block === exit.id && row.target.kind === kind), true);
  }
  assert.notEqual(summary.arena.origins[summary.result].producers[0], summary.arena.origins[summary.thrown].producers[0]);
});

test("real public Host analysis transports a string argument and return through the selected direct call", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal",
    "export function pass(value: string): string { return value; } export function call(value: string): string { return pass(value); }\n");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.packages.modules.length);
  const main = result.value.modules.find(module => module.module === fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts"));
  const selected = main.bodies.filter(body => body.kind === "selected");
  const caller = selected.find(body => body.mir.blocks.some(block => block.terminator.kind === "call"));
  assert.equal(caller !== undefined, true);
  const call = caller.mir.blocks.find(block => block.terminator.kind === "call").terminator;
  assert.equal(call.callee.kind, "direct");
  const callee = selected.find(body => fixture.types.sameInstance(body.instance, call.callee.resolution.activation));
  assert.equal(callee !== undefined, true);
  assert.deepEqual(call.arguments.map(argument => [argument.kind, argument.passing]), [["value", "by-value"]]);
  assert.deepEqual(caller.facts.map(facts => facts.execution.provided), [1]);
  const facts = caller.facts[0];
  const returned = facts.origins.subjects.find(subject => subject.role === "return");
  assert.equal(returned !== undefined, true);
  const origins = facts.arena.origins.find(row => row.id === returned.origins);
  assert.equal(origins.kind, "complete");
  assert.equal(origins.includesAbsence, false);
  assert.equal(origins.producers.length, 1);
  const bound = facts.arena.boundProducers.find(row => row.id === origins.producers[0]);
  const producer = facts.arena.producers.find(row => row.id === bound.producer);
  assert.equal(producer.kind, "parameter");
  assert.equal(producer.index, 0);
  assert.deepEqual(bound.bindings, caller.mir.bindings.bindings);
  const summary = result.value.index.summaries.find(row => row.key.kind === "body"
    && fixture.types.executionKey(row.key.execution) === fixture.types.executionKey(facts.execution));
  assert.equal(summary !== undefined, true);
  assert.equal(summary.arena.origins.find(row => row.id === summary.result).producers.length, 1);
  assert.equal(summary.retention.some(row => row.into.kind === "return"), true);
});

test("real public Host analysis returns the second actual string-call argument rather than a destination entry", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal",
    "export function second(left: string, right: string): string { return right; } export function call(left: string, right: string): string { return second(left, right); }\n");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.packages.modules.length);
  const main = result.value.modules.find(module => module.module === fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts"));
  const caller = main.bodies.find(body => body.kind === "selected" && body.mir.blocks.some(block => block.terminator.kind === "call"));
  assert.equal(caller !== undefined, true);
  const facts = caller.facts[0];
  const invocation = facts.origins.invocations[0].alternatives[0];
  assert.deepEqual(invocation.arguments.map(argument => facts.arena.origins[argument.actual].producers), [[0], [1]]);
  const returned = facts.origins.subjects.find(subject => subject.role === "return");
  const origins = facts.arena.origins[returned.origins];
  assert.deepEqual(origins.producers, [1]);
  assert.deepEqual(facts.arena.origins[invocation.result].producers, [1]);
  const bound = facts.arena.boundProducers[origins.producers[0]];
  assert.equal(facts.arena.producers[bound.producer].kind, "parameter");
  assert.equal(facts.arena.producers[bound.producer].index, 1);
  const summary = result.value.index.summaries.find(row => row.key.kind === "body"
    && fixture.types.executionKey(row.key.execution) === fixture.types.executionKey(facts.execution));
  assert.deepEqual(summary.arena.origins[summary.result].producers, [1]);
  assert.deepEqual(summary.retention.map(row => row.source), [1]);
  assert.equal(summary.retention.every(row => row.into.kind === "return"), true);
});

test("real public Host analysis uses a selected native boolean negation as its branch condition", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal",
    "export function choose(flag: boolean, a: number, b: number): number { if (!flag) return a; else return b; }\n");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.packages.modules.length);
  const main = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const module = result.value.modules.find(module => module.module === main);
  const callable = module.bodies.find(body => body.kind === "selected" && body.tir.params.length === 3);
  assert.notEqual(callable, undefined);
  assert.equal(callable.tir.root.statements.nodes[0].expression.kind, "PrefixUnaryExpression");
  assert.equal(callable.mir.blocks.filter(block => block.terminator.kind === "switch").length, 1);
  assert.equal(callable.mir.blocks.filter(block => block.terminator.kind === "return").length, 2);
  assert.equal(callable.mir.blocks.flatMap(block => block.statements).filter(statement => statement.kind === "assign"
    && statement.value.kind === "unary" && statement.value.operation.decision.operation.kind === "native-operator"
    && statement.value.operation.decision.operation.operator === "!"
    && statement.value.operation.decision.operation.carrier === "bool").length, 1);
  assert.deepEqual(callable.facts.map(facts => facts.execution.provided), [3]);
});

test("real public AnalyzeHostProgram closes supplied and omitted boolean-default entries with their genuine initializer execution", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", "export function value(argument: boolean = true): boolean { return argument; }\n");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  const main = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const module = result.value.modules.find(module => module.module === main);
  const selected = module.bodies.filter(body => body.kind === "selected");
  const callable = selected.find(body => body.tir.params.length === 1);
  assert.notEqual(callable, undefined);
  assert.deepEqual(callable.mir.entries.map(entry => entry.provided), [1, 0]);
  assert.equal(callable.facts.length, 2);
  assert.deepEqual(callable.facts.map(facts => facts.execution.provided), [0, 1]);
  const header = callable.tir.params[0];
  const initializer = selected.find(body => body.instance.body === header.tsonic.initializer);
  assert.notEqual(initializer, undefined);
  assert.equal(initializer.tir.root === header.initializer, true);
  assert.deepEqual(initializer.mir.entries.map(entry => entry.provided), [0]);
  const calls = callable.mir.blocks.filter(block => block.terminator.kind === "call" && block.terminator.callee.kind === "body");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].terminator.callee.instance.body, initializer.instance.body);
  assert.equal(calls[0].terminator.tir.node, header.id);
  assert.equal(result.value.index.dependencyInventory.dependencies.some(edge => edge.dependent.instance.body === callable.instance.body
    && edge.dependent.provided === 0 && edge.target.kind === "body" && edge.target.execution.instance.body === initializer.instance.body), true);
  assert.equal(result.value.index.dependencyInventory.dependencies.some(edge => edge.dependent.instance.body === callable.instance.body
    && edge.dependent.provided === 1 && edge.target.kind === "body" && edge.target.execution.instance.body === initializer.instance.body), false);
});

test("real public Host analysis retains the qualified outer parameter of a capture-bearing default initializer", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", "export function select(a: boolean, b = a): boolean { return b; }\n");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.packages.modules.length);
  const main = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const module = result.value.modules.find(module => module.module === main);
  const selected = module.bodies.filter(body => body.kind === "selected");
  const callable = selected.find(body => body.tir.params.length === 2);
  assert.notEqual(callable, undefined);
  const header = callable.tir.params[1];
  const initializer = selected.find(body => body.instance.body === header.tsonic.initializer);
  assert.notEqual(initializer, undefined);
  assert.equal(initializer.tir.root === header.initializer, true);
  assert.deepEqual(initializer.tir.captures, [{ local: callable.tir.params[0].tsonic.local, capture: "captured-location" }]);
  assert.deepEqual(callable.facts.map(facts => facts.execution.provided), [1, 2]);
  const calls = callable.mir.blocks.filter(block => block.terminator.kind === "call" && block.terminator.callee.kind === "body");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].terminator.callee.instance.body, initializer.instance.body);
  assert.equal(calls[0].terminator.tir.node, header.id);
  assert.equal(calls[0].terminator.callee.captures.length, 1);
  assert.equal(calls[0].terminator.callee.captures[0].capture, "captured-location");
  const mirCapture = initializer.mir.locals.find(local => local.role.kind === "capture");
  assert.equal(mirCapture !== undefined, true);
  assert.deepEqual(mirCapture.source, callable.tir.params[0].tsonic.local);
  assert.equal(mirCapture.mode, "captured-location");
  assert.equal(initializer.facts[0].initialization.reads.some(row => row.node === initializer.tir.root.id && !row.assigned), true);
  const childSummary = result.value.index.summaries.find(summary => summary.key.kind === "body"
    && summary.key.execution.instance.body === initializer.instance.body);
  assert.equal(childSummary !== undefined, true);
  const need = childSummary.initialization.points.find(point => point.kind === "need");
  assert.equal(need !== undefined, true);
  assert.deepEqual(need.witness.read, { kind: "body", value: { body: initializer.instance.body, node: initializer.tir.root.id } });
  const callerSummaries = result.value.index.summaries.filter(summary => summary.key.kind === "body"
    && summary.key.execution.instance.body === callable.instance.body);
  assert.deepEqual(callerSummaries.map(summary => summary.key.execution.provided), [1, 2]);
  assert.equal(callerSummaries.every(summary => summary.initialization.points.every(point => point.kind !== "need")), true,
    "the actual provided a discharges the child's original read only at the omitted b entry");
  assert.equal(callerSummaries.every(summary => summary.arena.producers.every(row => row.kind !== "local")), true);
});

test("real public Host analysis transports a captured string default through its actual value and location relations", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", "export function select(a: string, b = a): string { return b; }\n");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.packages.modules.length);
  const main = result.value.modules.find(module => module.module === fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts"));
  const caller = main.bodies.find(body => body.kind === "selected" && body.tir.params.length === 2);
  assert.notEqual(caller, undefined);
  const header = caller.tir.params[1];
  const child = main.bodies.find(body => body.kind === "selected" && body.instance.body === header.tsonic.initializer);
  assert.notEqual(child, undefined);
  assert.equal(child.tir.root, header.initializer);
  assert.deepEqual(child.tir.captures, [{ local: caller.tir.params[0].tsonic.local, capture: "captured-location" }]);
  const summaryOf = (body, provided) => result.value.index.summaries.find(summary => summary.key.kind === "body"
    && summary.key.execution.instance.body === body && summary.key.execution.provided === provided);
  const producersOf = summary => summary.arena.origins[summary.result].producers.map(bound =>
    summary.arena.producers[summary.arena.boundProducers[bound].producer]);
  const childSummary = summaryOf(child.instance.body, 0);
  assert.notEqual(childSummary, undefined);
  assert.deepEqual(producersOf(childSummary).map(producer => [producer.kind, producer.index]), [["capture", 0]]);
  assert.equal(child.facts[0].initialization.reads.some(row => row.node === child.tir.root.id && !row.assigned), true);
  assert.equal(childSummary.initialization.points.some(point => point.kind === "need"), true);
  assert.deepEqual(caller.facts.map(facts => facts.execution.provided), [1, 2]);
  for (const provided of [1, 2]) {
    const summary = summaryOf(caller.instance.body, provided);
    assert.notEqual(summary, undefined);
    assert.deepEqual(producersOf(summary).map(producer => [producer.kind, producer.index]), [["parameter", provided - 1]]);
    assert.equal(summary.initialization.points.every(point => point.kind !== "need"), true);
    assert.equal(summary.retention.some(row => row.into.kind === "return"), true);
  }
});

test("real public Host analysis discharges chained captured defaults against their actual preceding initializer results", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal",
    "export function chain(a: boolean, b = a, c = b): boolean { return c; }\n");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.packages.modules.length);
  const main = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const module = result.value.modules.find(module => module.module === main);
  const caller = module.bodies.find(body => body.kind === "selected" && body.tir.params.length === 3);
  assert.equal(caller !== undefined, true);
  assert.deepEqual(caller.mir.entries.map(entry => entry.provided), [3, 2, 1]);
  assert.deepEqual(caller.facts.map(facts => facts.execution.provided), [1, 2, 3]);
  for (const index of [1, 2]) {
    const header = caller.tir.params[index];
    const child = module.bodies.find(body => body.kind === "selected" && body.instance.body === header.tsonic.initializer);
    assert.equal(child !== undefined && child.tir.root === header.initializer, true);
    const source = caller.tir.params[index - 1].tsonic.local;
    assert.deepEqual(child.tir.captures, [{ local: source, capture: "captured-location" }]);
    const capture = child.mir.locals.find(local => local.role.kind === "capture");
    assert.equal(capture !== undefined, true);
    assert.deepEqual(capture.source, source);
    const summary = result.value.index.summaries.find(summary => summary.key.kind === "body"
      && summary.key.execution.instance.body === child.instance.body);
    assert.equal(summary !== undefined, true);
    const need = summary.initialization.points.find(point => point.kind === "need");
    assert.equal(need !== undefined, true);
    assert.deepEqual(need.witness.read, { kind: "body", value: { body: child.instance.body, node: child.tir.root.id } });
  }
  const summaries = result.value.index.summaries.filter(summary => summary.key.kind === "body"
    && summary.key.execution.instance.body === caller.instance.body);
  assert.deepEqual(summaries.map(summary => summary.key.execution.provided), [1, 2, 3]);
  assert.equal(summaries.every(summary => summary.initialization.points.every(point => point.kind !== "need")), true);
  for (const provided of [1, 2, 3]) {
    const dependencies = result.value.index.dependencyInventory.dependencies.filter(edge => edge.reason === "initializer"
      && edge.dependent.instance.body === caller.instance.body && edge.dependent.provided === provided);
    assert.equal(dependencies.length, 3 - provided);
  }
});

test("actual placed-body capture verification rejects wrong modes, qualified locals and creator associations", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { verifyTir } = await import("../../packages/host/dist/ir-tir/index.js");
  const input = analysisInput(fixture, "sdk-minimal", "export function select(a: boolean, b = a): boolean { return b; }\n");
  const source = captureSourceBarrier(input);
  assert.equal(source.kind, "ok");
  const typed = typeSourceBarrier(input, source.value);
  assert.equal(typed.kind, "ok");
  const child = [...typed.value.bodies.values()].find(body => body.bindings.kind === "instantiated" && body.captures.length === 1);
  assert.equal(child !== undefined, true);
  const verifier = typed.value.verifierOf(child.root.origin.module);
  assert.deepEqual(verifyTir(verifier, child), []);
  assert.equal(verifyTir(verifier, { ...child, captures: [{ ...child.captures[0], capture: "captured-value" }] })
    .some(finding => finding.rule === "closure-capture-binding"), true);
  assert.equal(verifyTir(verifier, { ...child, captures: [{ ...child.captures[0], local: { body: child.body, local: 0 } }] })
    .some(finding => finding.rule === "capture-qualified"), true);
  const nodeOf = reference => {
    const node = verifier.nodeOf(reference);
    return node?.kind === "Parameter" && node.tsonic.initializer === child.body
      ? { ...node, tsonic: { ...node.tsonic, initializer: null } } : node;
  };
  assert.equal(verifyTir({ ...verifier, nodeOf }, child).some(finding => finding.rule === "capture-qualified"), true,
    "a capture cannot substitute an arrow-value decision for its actual placed creator association");
});

for (const count of [2, 12])
test(`real public Host publication orders all ${count + 1} default entries numerically without changing their MIR prologues`, async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const parameters = Array.from({ length: count }, (_, index) => `argument${index}: boolean = true`).join(", ");
  const input = analysisInput(fixture, "sdk-minimal", `export function value(${parameters}): boolean { return argument0; }\n`);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.packages.modules.length);
  const main = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const module = result.value.modules.find(module => module.module === main);
  const callable = module.bodies.find(body => body.kind === "selected" && body.tir.params.length === count);
  assert.notEqual(callable, undefined);
  assert.deepEqual(callable.mir.entries.map(entry => entry.provided), Array.from({ length: count + 1 }, (_, index) => count - index));
  assert.deepEqual(callable.facts.map(facts => facts.execution.provided), Array.from({ length: count + 1 }, (_, index) => index));
  for (let provided = 0; provided <= count; provided += 1) {
    const dependencies = result.value.index.dependencyInventory.dependencies.filter(edge => edge.reason === "initializer"
      && edge.dependent.instance.body === callable.instance.body && edge.dependent.provided === provided);
    assert.equal(dependencies.length, count - provided);
  }
});

for (const [form, statements] of [
  ["else", "if (flag) return a; else return b;"],
  ["fall-through", "if (flag) return a; return b;"],
  ["blocks", "if (flag) { return a; } else { return b; }"],
])
test(`real public Host analysis closes a scalar boolean ${form} branch with both actual return paths`, async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `export function choose(flag: boolean, a: number, b: number): number { ${statements} }\n`);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.packages.modules.length);
  const main = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const module = result.value.modules.find(module => module.module === main);
  const callable = module.bodies.find(body => body.kind === "selected" && body.tir.params.length === 3);
  assert.notEqual(callable, undefined);
  assert.equal(callable.tir.root.statements.nodes[0].kind, "IfStatement");
  assert.equal(callable.mir.blocks.filter(block => block.terminator.kind === "switch").length, 1);
  assert.equal(callable.mir.blocks.filter(block => block.terminator.kind === "return").length, 2);
  assert.deepEqual(callable.facts.map(facts => facts.execution.provided), [3]);
});

test("real public Host analysis closes an inferred null default with the single native absence type", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", "export function value(argument = null) { return argument; }\n");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  const main = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const module = result.value.modules.find(module => module.module === main);
  const callable = module.bodies.find(body => body.kind === "selected" && body.tir.params.length === 1);
  assert.notEqual(callable, undefined);
  const parameter = result.value.index.types.signatures[callable.tir.signature].parameters[0];
  assert.deepEqual(result.value.index.types.terms[parameter.type], { kind: "intrinsic", intrinsic: "absence" });
  assert.deepEqual(callable.mir.entries.map(entry => entry.provided), [1, 0]);
  assert.deepEqual(callable.facts.map(facts => facts.execution.provided), [0, 1]);
});

for (const annotation of [": boolean", ""])
test(`real public Host analysis executes an ${annotation === "" ? "inferred" : "annotated"} local boolean initializer as its own selected body`, async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `export function local(): boolean { const value${annotation} = true; return value; }\n`);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  const main = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const module = result.value.modules.find(module => module.module === main);
  const selected = module.bodies.filter(body => body.kind === "selected");
  const callable = selected.find(body => body.tir.root.kind === "Block");
  assert.notEqual(callable, undefined);
  const declaration = callable.tir.root.statements.nodes[0].declarationList.declarations.nodes[0];
  const initializer = selected.find(body => body.instance.body === declaration.tsonic.initializer);
  assert.notEqual(initializer, undefined);
  assert.equal(initializer.tir.root === declaration.initializer, true);
  assert.equal(selected.length, 3);
  assert.equal(callable.facts.length, 1);
  assert.equal(callable.mir.blocks.some(block => block.terminator.kind === "call" && block.terminator.callee.kind === "body"
    && block.terminator.callee.instance.body === initializer.instance.body
    && block.terminator.tir.node === declaration.id), true);
  assert.equal(result.value.index.dependencyInventory.dependencies.some(edge => edge.reason === "initializer"
    && edge.dependent.instance.body === callable.instance.body && edge.target.kind === "body"
    && edge.target.execution.instance.body === initializer.instance.body), true);
  if (annotation !== "") {
    const conversions = initializer.mir.blocks.flatMap(block => block.statements)
      .filter(statement => statement.kind === "assign" && statement.value.kind === "convert");
    assert.equal(conversions.some(statement => statement.value.operation.decision.operation.kind === "conversion"
      && statement.value.operation.decision.operation.embedding.kind === "conversion"
      && statement.value.operation.decision.operation.embedding.conversion === "literal-fit"), true);
  }
  const { evaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const table = result.value.index.types;
  const evaluated = evaluate({ types: table, typeOf: type => table.terms[type], signatureOf: signature => table.signatures[signature],
    selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation }, initializer.instance, initializer.mir, [],
  "compile-time", { query: "constValue", key: [initializer.instance, "compile-time"] });
  assert.equal(evaluated.kind, "done");
  assert.equal(evaluated.value.kind, "ok");
  assert.deepEqual(evaluated.value.value, { kind: "value", value: { kind: "boolean", value: true, type: initializer.tir.completion } });
});

test("real public Host analysis discharges a body-local captured initializer through its actual storage lifetime", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal",
    "export function local(input: boolean): boolean { let a: boolean = input; const b: boolean = a; return b; }\n");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.packages.modules.length);
  const main = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const module = result.value.modules.find(module => module.module === main);
  const caller = module.bodies.find(body => body.kind === "selected" && body.tir.params.length === 1);
  assert.notEqual(caller, undefined);
  const declarations = caller.tir.root.statements.nodes.slice(0, 2)
    .map(statement => statement.declarationList.declarations.nodes[0]);
  const source = declarations[0].name.tsonic.declaration.local;
  const child = module.bodies.find(body => body.kind === "selected" && body.instance.body === declarations[1].tsonic.initializer);
  assert.equal(child !== undefined && child.tir.root === declarations[1].initializer, true);
  assert.deepEqual(child.tir.captures, [{ local: source, capture: "captured-location" }]);
  const local = caller.mir.locals.find(local => local.source?.body === source.body && local.source.local === source.local);
  assert.notEqual(local, undefined);
  const facts = caller.facts[0];
  const cell = facts.arena.cells.find(cell => cell.role.kind === "local" && cell.role.local === local.id);
  assert.equal(cell !== undefined && cell.occurrence.kind === "declared", true);
  assert.equal(caller.tir.locals[source.local].declaration.value.node, declarations[0].id);
  assert.deepEqual(cell.occurrence.at, { kind: "node", node: { kind: "body", value: { body: caller.instance.body, node: declarations[0].id } } });
  assert.equal(cell.lifetimes.some(marker => marker.kind === "live"), true);
  for (const marker of cell.lifetimes) {
    const operation = caller.mir.blocks[marker.point.block].statements[marker.point.statement];
    assert.equal(operation.kind, marker.kind === "live" ? "storage-live" : "storage-dead");
    assert.equal(operation.local, local.id);
  }
  const summary = result.value.index.summaries.find(summary => summary.key.kind === "body"
    && summary.key.execution.instance.body === caller.instance.body);
  assert.notEqual(summary, undefined);
  assert.equal(summary.initialization.points.every(point => point.kind !== "need"), true);
});

test("real public Host analysis retains one current local cell across two distinct captured initializer calls", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal",
    "export function local(input: boolean): boolean { let a: boolean = input; const b: boolean = a; const c: boolean = a; return c; }\n");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.packages.modules.length);
  const main = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const module = result.value.modules.find(module => module.module === main);
  const caller = module.bodies.find(body => body.kind === "selected" && body.tir.params.length === 1);
  assert.equal(caller !== undefined, true);
  const declarations = caller.tir.root.statements.nodes.slice(0, 3)
    .map(statement => statement.declarationList.declarations.nodes[0]);
  const source = declarations[0].name.tsonic.declaration.local;
  const local = caller.mir.locals.find(local => local.source?.body === source.body && local.source.local === source.local);
  assert.equal(local !== undefined, true);
  const facts = caller.facts[0];
  const cells = facts.arena.cells.filter(cell => cell.role.kind === "local" && cell.role.local === local.id);
  assert.equal(cells.length, 1);
  const cell = cells[0];
  assert.equal(caller.tir.locals[source.local].declaration.value.node, declarations[0].id);
  assert.deepEqual(cell.occurrence, { kind: "declared", at: { kind: "node", node: { kind: "body", value: { body: caller.instance.body, node: declarations[0].id } } } });
  const children = declarations.slice(1).map(declaration => declaration.tsonic.initializer);
  const calls = caller.mir.blocks.filter(block => block.terminator.kind === "call"
    && block.terminator.callee.kind === "body" && children.includes(block.terminator.callee.instance.body));
  assert.equal(calls.length, 2);
  for (const block of calls) {
    const activation = facts.origins.activations.find(row => row.point.block === block.id && row.point.statement === null);
    assert.equal(activation !== undefined, true);
    const capture = facts.arena.contexts[activation.context].captures[0];
    assert.equal(capture.cell, cell.id);
    const bound = facts.arena.boundProducers[capture.location];
    const producer = facts.arena.producers[bound.producer];
    assert.equal(producer.kind, "local");
    assert.deepEqual(producer.local, source);
  }
  const summary = result.value.index.summaries.find(summary => summary.key.kind === "body"
    && summary.key.execution.instance.body === caller.instance.body);
  assert.equal(summary !== undefined, true);
  assert.equal(summary.initialization.points.every(point => point.kind !== "need"), true);
});

test("real public Host analysis rejects an uninitialized body-local captured read without publishing a program", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal",
    "export function local(): boolean { let a: boolean; const b: boolean = a; return b; }\n");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "refused");
  assert.equal("value" in result, false);
  assert.equal(result.diagnostics.some(diagnostic => diagnostic.code.rendered === "TSONIC_READ_BEFORE_INITIALIZATION"), true);
});

test("real public Host analysis closes a direct zero-argument scalar call through its actual selected callee", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { sameInstance } = await import("../../packages/host/dist/ir-types/index.js");
  const input = analysisInput(fixture, "sdk-minimal",
    "export function value(): boolean { return true; } export function read(): boolean { return value(); }\n");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.packages.modules.length);
  const main = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const module = result.value.modules.find(module => module.module === main);
  const selected = module.bodies.filter(body => body.kind === "selected");
  const caller = selected.find(body => body.mir.blocks.some(block => block.terminator.kind === "call"));
  assert.notEqual(caller, undefined);
  const block = caller.mir.blocks.find(block => block.terminator.kind === "call");
  const call = block.terminator;
  assert.equal(call.callee.kind, "direct");
  assert.notEqual(call.callee.resolution.activation, null);
  const callee = selected.find(body => sameInstance(body.instance, call.callee.resolution.activation));
  assert.notEqual(callee, undefined);
  assert.notEqual(callee, caller);
  assert.equal(call.arguments.length, 0);
  assert.equal(caller.facts.some(facts => facts.origins.activations.some(row => row.node === call.tir.node
    && row.point.block === block.id && row.point.statement === null && sameInstance(row.activation, callee.instance))), true);
  assert.equal(result.value.index.dependencyInventory.dependencies.some(edge => edge.reason === "call"
    && sameInstance(edge.dependent.instance, caller.instance) && edge.dependent.provided === 0
    && edge.target.kind === "body" && sameInstance(edge.target.execution.instance, callee.instance)
    && edge.target.execution.provided === 0), true);
});

for (const [count, source] of [
  [1, "export function value(input: boolean): boolean { return input; } export function read(input: boolean): boolean { return value(input); }"],
  [2, "export function add(a: number, b: number): number { return a + b; } export function read(a: number, b: number): number { return add(a, b); }"],
])
test(`real public Host analysis closes ${count} fixed by-value scalar call arguments through the selected mapping`, async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", source);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.packages.modules.length);
  const main = result.value.modules.find(module => module.module === fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts"));
  const caller = main.bodies.find(body => body.kind === "selected" && body.mir.blocks.some(block => block.terminator.kind === "call"));
  assert.equal(caller !== undefined, true);
  const call = caller.mir.blocks.find(block => block.terminator.kind === "call").terminator;
  assert.equal(call.callee.kind, "direct");
  assert.deepEqual(call.callee.resolution.decision.parameters, Array.from({ length: count }, (_, parameter) =>
    ({ kind: "argument", parameter, argument: parameter, component: null, passing: "by-value" })));
  assert.deepEqual(call.arguments.map(argument => [argument.kind, argument.passing]),
    Array.from({ length: count }, () => ["value", "by-value"]));
  assert.equal(result.value.index.dependencyInventory.dependencies.some(edge => edge.reason === "call"
    && edge.dependent.instance.body === caller.instance.body && edge.dependent.provided === count
    && edge.target.kind === "body" && edge.target.execution.instance.body === call.callee.resolution.activation.body
    && edge.target.execution.provided === count), true);
});

for (const [position, expression] of [["argument", "value(!input)"], ["result", "!value(input)"]])
test(`real public Host analysis composes native boolean negation with a scalar call ${position}`, async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal",
    `export function value(input: boolean): boolean { return input; } export function read(input: boolean): boolean { return ${expression}; }\n`);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.packages.modules.length);
  const main = result.value.modules.find(module => module.module === fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts"));
  const caller = main.bodies.find(body => body.kind === "selected" && body.mir.blocks.some(block => block.terminator.kind === "call"));
  assert.notEqual(caller, undefined);
  const returned = caller.tir.root.statements.nodes[0].expression;
  assert.equal(returned.kind, position === "argument" ? "CallExpression" : "PrefixUnaryExpression");
  const unary = position === "argument" ? returned.arguments.nodes[0] : returned;
  assert.equal(unary.kind, "PrefixUnaryExpression");
  assert.equal(unary.operator, "ExclamationToken");
  const call = caller.mir.blocks.find(block => block.terminator.kind === "call").terminator;
  assert.equal(call.callee.kind, "direct");
  assert.deepEqual(call.callee.resolution.decision.parameters,
    [{ kind: "argument", parameter: 0, argument: 0, component: null, passing: "by-value" }]);
  assert.equal(caller.mir.blocks.flatMap(block => block.statements).filter(statement => statement.kind === "assign"
    && statement.value.kind === "unary" && statement.value.operation.decision.operation.kind === "native-operator"
    && statement.value.operation.decision.operation.operator === "!"
    && statement.value.operation.decision.operation.carrier === "bool").length, 1);
  assert.equal(result.value.index.dependencyInventory.dependencies.some(edge => edge.reason === "call"
    && edge.dependent.instance.body === caller.instance.body && edge.dependent.provided === 1
    && edge.target.kind === "body" && edge.target.execution.instance.body === call.callee.resolution.activation.body
    && edge.target.execution.provided === 1), true);
});

test("real public Host analysis closes a twelve-call dependency chain with every actual body and summary", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const links = 12;
  const declarations = ["export function value0(input: boolean): boolean { return input; }"];
  for (let index = 1; index <= links; index += 1)
    declarations.push(`export function value${index}(input: boolean): boolean { return value${index - 1}(input); }`);
  const input = analysisInput(fixture, "sdk-minimal", declarations.join("\n"));
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.packages.modules.length);
  const main = result.value.modules.find(module => module.module === fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts"));
  const selected = main.bodies.filter(body => body.kind === "selected");
  assert.equal(selected.length, links + 2);
  assert.equal(main.bodies.filter(body => body.kind === "template").length, links + 2);
  assert.equal(result.value.index.dependencyInventory.operations.length, links + 2);
  assert.equal(result.value.index.summaries.length, links + 2);
  assert.equal(result.value.index.dependencyInventory.dependencies.filter(edge => edge.reason === "call").length, links);
  assert.equal(selected.reduce((count, body) => count + body.mir.blocks.filter(block => block.terminator.kind === "call").length, 0), links);
  for (const body of selected) {
    assert.equal(body.facts.length, 1);
    assert.deepEqual(body.facts.map(facts => facts.execution.provided), [body.tir.params.length]);
    for (const block of body.mir.blocks) if (block.terminator.kind === "call") {
      const call = block.terminator;
      assert.equal(call.callee.kind, "direct");
      assert.equal(selected.some(target => target.instance.body === call.callee.resolution.activation.body), true);
    }
  }
});

test("real public Host analysis preserves every repeated callee occurrence across nested calls and branches", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal",
    "export function value(input: boolean): boolean { return input; }\n"
    + "export function choose(input: boolean): boolean { if (value(!input)) { return !value(input); } return value(value(input)); }\n");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.packages.modules.length);
  const main = result.value.modules.find(module => module.module === fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts"));
  assert.equal(main !== undefined, true);
  const selected = main.bodies.filter(body => body.kind === "selected");
  assert.equal(selected.length, 3);
  assert.equal(main.bodies.filter(body => body.kind === "template").length, 3);
  const caller = selected.find(body => body.mir.blocks.some(block => block.terminator.kind === "call"));
  assert.equal(caller !== undefined, true);
  const calls = caller.mir.blocks.filter(block => block.terminator.kind === "call").map(block => block.terminator);
  assert.equal(calls.length, 4);
  assert.equal(caller.mir.blocks.some(block => block.terminator.kind === "switch"), true);
  assert.equal(caller.mir.blocks.filter(block => block.terminator.kind === "return").length, 2);
  const targets = new Set();
  for (const call of calls) {
    assert.equal(call.callee.kind, "direct");
    targets.add(call.callee.resolution.activation.body);
    assert.equal(selected.some(body => body.instance.body === call.callee.resolution.activation.body), true);
    assert.deepEqual(call.callee.resolution.decision.parameters,
      [{ kind: "argument", parameter: 0, argument: 0, component: null, passing: "by-value" }]);
  }
  assert.equal(targets.size, 1, "four actual call occurrences share one completed callee operation");
  const inventory = result.value.index.dependencyInventory;
  const dependencies = inventory.dependencies.filter(edge => edge.reason === "call"
    && edge.dependent.instance.body === caller.instance.body);
  assert.equal(dependencies.length, 4);
  assert.equal(new Set(dependencies.map(edge => edge.at.node)).size, 4);
  assert.equal(dependencies.every(edge => edge.target.kind === "body"
    && targets.has(edge.target.execution.instance.body) && edge.target.execution.provided === 1), true);
  assert.equal(inventory.operations.length, 3);
  assert.equal(result.value.index.summaries.length, 3);
  assert.deepEqual(caller.facts.map(facts => facts.execution.provided), [1]);
});

test("real public Host analysis joins a named import to its actual selected callee in another loaded module", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal");
  input.snapshot = fixture.projectSnapshot({
    sourceFiles: {
      "main.ts": "import { value } from './leaf.js'; export function read(input: boolean): boolean { return value(!input); }\n",
      "leaf.ts": "export function value(input: boolean): boolean { return input; }\n",
    },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }],
  });
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.packages.modules.length);
  const main = result.value.modules.find(module => module.module === fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts"));
  const leaf = result.value.modules.find(module => module.module === fixture.moduleOf(fixture.packageOf("/project"), "src/leaf.ts"));
  assert.equal(main !== undefined && leaf !== undefined, true);
  const record = result.value.index.modules.find(module => module.module === main.module);
  assert.equal(record !== undefined, true);
  assert.equal(record.bindings.length, 1);
  const caller = main.bodies.find(body => body.kind === "selected" && body.mir.blocks.some(block => block.terminator.kind === "call"));
  assert.equal(caller !== undefined, true);
  const call = caller.mir.blocks.find(block => block.terminator.kind === "call").terminator;
  const name = caller.tir.root.statements.nodes[0].expression.expression;
  assert.equal(name.tsonic.resolution.kind, "definition");
  assert.deepEqual(name.tsonic.resolution.aliases, [record.bindings[0].occurrence]);
  assert.equal(call.callee.kind, "direct");
  assert.equal(leaf.bodies.some(body => body.kind === "selected" && body.instance.body === call.callee.resolution.activation.body), true);
  assert.equal(main.bodies.some(body => body.instance.body === call.callee.resolution.activation.body), false);
  const inventory = result.value.index.dependencyInventory;
  assert.equal(inventory.operations.length, 4);
  assert.equal(result.value.index.summaries.length, 4);
  const edges = inventory.dependencies.filter(edge => edge.reason === "call");
  assert.equal(edges.length, 1);
  assert.equal(edges[0].dependent.instance.body, caller.instance.body);
  assert.equal(edges[0].target.kind, "body");
  assert.equal(edges[0].target.execution.instance.body, call.callee.resolution.activation.body);
  assert.equal(edges[0].target.execution.provided, 1);
});

for (const reexport of [false, true])
test(`real public Host analysis preserves the actual ${reexport ? "three-module re-export" : "renamed import"} binding chain`, async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal");
  const sourceFiles = reexport ? {
    "main.ts": "import { forwarded as renamed } from './relay.js'; export function read(input: boolean): boolean { return renamed(!input); }\n",
    "relay.ts": "export { value as forwarded } from './leaf.js';\n",
    "leaf.ts": "export function value(input: boolean): boolean { return input; }\n",
  } : {
    "main.ts": "import { value as renamed } from './leaf.js'; export function read(input: boolean): boolean { return renamed(!input); }\n",
    "leaf.ts": "export function value(input: boolean): boolean { return input; }\n",
  };
  input.snapshot = fixture.projectSnapshot({ sourceFiles,
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.modules.length, input.snapshot.packages.modules.length);
  const moduleOf = name => fixture.moduleOf(fixture.packageOf("/project"), `src/${name}.ts`);
  const main = result.value.modules.find(module => module.module === moduleOf("main"));
  const leaf = result.value.modules.find(module => module.module === moduleOf("leaf"));
  assert.equal(main !== undefined && leaf !== undefined, true);
  const mainRecord = result.value.index.modules.find(module => module.module === main.module);
  assert.equal(mainRecord !== undefined && mainRecord.bindings.length === 1, true);
  const aliases = [mainRecord.bindings[0].occurrence];
  if (reexport) {
    const relay = result.value.index.modules.find(module => module.module === moduleOf("relay"));
    assert.equal(relay !== undefined && relay.bindings.length === 1, true);
    aliases.push(relay.bindings[0].occurrence);
  }
  const caller = main.bodies.find(body => body.kind === "selected" && body.mir.blocks.some(block => block.terminator.kind === "call"));
  assert.equal(caller !== undefined, true);
  const name = caller.tir.root.statements.nodes[0].expression.expression;
  assert.equal(name.tsonic.resolution.kind, "definition");
  assert.deepEqual(name.tsonic.resolution.aliases, aliases);
  const call = caller.mir.blocks.find(block => block.terminator.kind === "call").terminator;
  assert.equal(call.callee.kind, "direct");
  assert.equal(leaf.bodies.some(body => body.kind === "selected" && body.instance.body === call.callee.resolution.activation.body), true);
  assert.equal(main.bodies.some(body => body.instance.body === call.callee.resolution.activation.body), false);
  const inventory = result.value.index.dependencyInventory;
  assert.equal(inventory.operations.length, reexport ? 5 : 4);
  assert.equal(result.value.index.summaries.length, inventory.operations.length);
  const edges = inventory.dependencies.filter(edge => edge.reason === "call");
  assert.equal(edges.length, 1);
  assert.equal(edges[0].dependent.instance.body, caller.instance.body);
  assert.equal(edges[0].target.kind, "body");
  assert.equal(edges[0].target.execution.instance.body, call.callee.resolution.activation.body);
  assert.equal(edges[0].target.execution.provided, 1);
});

test("actual named callable inference requires the supplied qualified B1 row rather than a checked type shortcut", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const input = analysisInput(fixture, "sdk-minimal");
  input.snapshot = fixture.projectSnapshot({ sourceFiles: {
    "main.ts": "import { value as renamed } from './leaf.js'; export function read(input: boolean): boolean { return renamed(!input); }",
    "leaf.ts": "export function value(input: boolean): boolean { return input; }",
  }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  for (const kind of ["missing", "unavailable", "cycle", "foreign"]) {
    const captured = captureSourceBarrier(input);
    assert.equal(captured.kind, "ok");
    const source = captured.value;
    const bindingOf = occurrence => {
      const actual = source.bindingOf(occurrence);
      assert.equal(actual !== null, true);
      if (kind === "missing") return null;
      if (kind === "unavailable") return { ...actual, target: { kind: "unavailable", reason: "not-provided", causes: [] } };
      if (kind === "cycle") return { ...actual, target: { kind: "available", value: { kind: "binding", occurrence } } };
      return { ...actual, occurrence: { ...occurrence, value: { ...occurrence.value, node: occurrence.value.node + 1 } } };
    };
    assert.throws(() => typeSourceBarrier(input, { ...source, bindingOf }), kind === "missing" ? /actual ready nearest-target row/
      : kind === "foreign" ? /exact requested qualified occurrence/ : /actual nearest target is unavailable/);
  }
});

test("the actual selected-call analysis admits its indices before growth and retains the original account refusal", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { analyzeTypedSource } = await import("../../packages/host/dist/pipeline/analysis-barrier.js");
  const { accountFailure, createAccount, refuseAccount } = await import("../../packages/host/dist/dataflow/index.js");
  const { InvocationAccount } = await import("../../packages/host/dist/dataflow/account.js");
  const input = analysisInput(fixture, "sdk-minimal",
    "export function value(): boolean { return true; } export function read(): boolean { return value(); }\n");
  const ready = () => {
    const captured = captureSourceBarrier(input);
    assert.equal(captured.kind, "ok");
    const typed = typeSourceBarrier(input, captured.value);
    assert.equal(typed.kind, "ok");
    return typed.value;
  };
  const fresh = (maximumResultEntries = 1000000) => createAccount({ maximumWork: 1000000, maximumResultEntries });
  const completeAccount = fresh();
  const complete = analyzeTypedSource(input, ready(), completeAccount);
  assert.equal(complete.kind, "ok");
  const entries = InvocationAccount.stateOf(completeAccount).entries;
  assert.equal(analyzeTypedSource(input, ready(), fresh(entries)).kind, "ok", "the exact actual cumulative admission is sufficient");
  for (const maximum of [0, 1, 2, 8, 32, entries - 1]) {
    const account = fresh(maximum);
    const result = analyzeTypedSource(input, ready(), account);
    assert.equal(result.kind, "refused", `actual selected-call result limit ${maximum}`);
    assert.notEqual(accountFailure(account), null);
    assert.equal(Object.hasOwn(result, "value"), false);
    const unread = new Proxy({}, { get() { assert.fail("No typed source is read after the original analysis refusal."); } });
    assert.equal(analyzeTypedSource(input, unread, account).kind, "refused");
  }
  const original = { kind: "refused", diagnostics: [] };
  const stopped = fresh();
  assert.equal(refuseAccount(stopped, original), original);
  const unread = new Proxy({}, { get() { assert.fail("An original caller refusal precedes every typed-source read."); } });
  assert.equal(analyzeTypedSource(input, unread, stopped), original);
});

for (const limit of ["work", "result-entries", "query.maximumRecords"])
test(`real public AnalyzeHostProgram refuses ${limit} exhaustion without publishing a partial program`, async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal");
  if (limit === "work") input.limits.dataflow.maximumWork = 0;
  else if (limit === "result-entries") input.limits.dataflow.maximumResultEntries = 0;
  else input.limits.query.maximumRecords = 0;
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "refused");
  assert.equal(Object.hasOwn(result, "value"), false, "a refused invocation cannot expose a partial HostProgram");
  assert.equal(result.diagnostics.length, 1);
  const diagnostic = result.diagnostics[0];
  assert.equal(diagnostic.code.kind, "host");
  assert.equal(diagnostic.code.name, "TSONIC_COMPILER_RESOURCE_LIMIT");
  assert.equal(diagnostic.severity, "error");
  assert.equal(diagnostic.source, limit === "query.maximumRecords" ? "query" : "infer");
  const reportedLimit = limit === "query.maximumRecords" ? limit : `partition graph ${limit}`;
  assert.deepEqual(diagnostic.arguments, [{ kind: "text", value: reportedLimit }, { kind: "number", value: 0 }]);
});
