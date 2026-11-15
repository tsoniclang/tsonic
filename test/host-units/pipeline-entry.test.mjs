import assert from "node:assert/strict";
import { test } from "node:test";
import { loadFrontFixture, navigationCapture, preparation } from "./fixtures/front/checked-module.mjs";

function analysisInput(fixture, library) {
  const snapshot = fixture.projectSnapshot({
    sourceFiles: { "main.ts": "export function add(a: number, b: number): number { return a + b; }\n" },
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
