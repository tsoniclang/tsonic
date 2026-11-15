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
