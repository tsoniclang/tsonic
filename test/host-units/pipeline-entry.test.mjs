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
