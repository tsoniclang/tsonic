import assert from "node:assert/strict";
import { createAccount } from "../../packages/host/dist/dataflow/index.js";
import { test } from "node:test";
import { loadFrontFixture } from "./fixtures/front/checked-module.mjs";
import { analysisInput } from "./fixtures/front/analysis-input.mjs";

test("selection results keep only their actual checked contributions", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const cases = [
    ["flag || missingRight", ["missingRight"], [0]],
    ["maybe ?? missingRight", ["missingRight"], [0]],
    ["missingLeft ?? missingRight", ["missingLeft", "missingRight"], [0, 1]],
    ["flag ? missingTrue : missingFalse", ["missingTrue", "missingFalse"], [0, 1]],
    ["missingCondition ? missingTrue : false", ["missingCondition", "missingTrue"], [1]],
    ["missingCondition ? true : false", ["missingCondition"], []],
  ];
  for (const [expression, failed, origins] of cases) {
    const source = `export function run(flag:boolean,maybe:boolean|null):boolean {return ${expression};}`;
    const input = analysisInput(fixture, "sdk-minimal", source);
    const checked = captureSourceBarrier(input);
    assert.equal(checked.kind, "ok");
    const module = checked.value.modules.find(row => row.module.module === input.snapshot.entryPoint).module;
    const originals = module.checkerDiagnostics;
    assert.deepEqual(originals.map(({ code, site: { origin: { start, length } } }) =>
      [code.number, source.slice(start, start + length)]), failed.map(name => [2304, name]));
    const returned = module.tree.statements.nodes[0].body.statements.nodes[0].expression;
    const read = returned.kind === "ConditionalExpression" ? returned.tsonic.views.read : returned.tsonic.value.views.read;
    if (origins.length === 0) assert.equal(read.kind, "available");
    else assert.deepEqual(read, { kind: "unavailable", reason: "checker-error", causes: origins.map(index =>
      ({ kind: "diagnostic", diagnostic: { kind: "checker", diagnostic: { module: module.module, index } } })) });
    const typed = typeSourceBarrier(input, checked.value, createAccount(input.limits.dataflow));
    assert.equal(typed.kind, "refused");
    assert.equal(typed.diagnostics.length, originals.length);
    assert.equal(typed.diagnostics.every((row, index) => row === originals[index]), true);
    assert.deepEqual(analyzeHostProgram(input), { kind: "refused", diagnostics: originals });
  }
});
