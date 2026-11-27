import assert from "node:assert/strict";
import { test } from "node:test";
import { captureSingleModule, loadFrontFixture } from "./fixtures/front/checked-module.mjs";
import { analysisInput } from "./fixtures/front/analysis-input.mjs";
import { captureSourceBarrier } from "../../packages/host/dist/pipeline/source-barrier.js";

const tupleSource = `function take(first: boolean, second: boolean, last: boolean) { return first || second || last; }
export function run(values: readonly [boolean, boolean], last: boolean) { return take(...values, last); }`;
const restSource = `function take(...values: boolean[]) { return values[0]; }
export function run(values: boolean[]) { return take(...values); }`;

test("Front retains actual source and effective ordinals for tuple and sequence spread", async () => {
  assert.equal(typeof process.env.TSONIC_TEST_ADMISSION, "string");
  const fixture = await loadFrontFixture();
  const libraries = fixture.sdk.getBundledLibraryClosure(["lib.es5.d.ts"]);
  for (const [authored, expected] of [
    [tupleSource, [[0, 0, 0, "spread-element", 0, "parameter"], [0, 1, 1, "spread-element", 1, "parameter"], [1, 2, 2, "value", null, "parameter"]]],
    [restSource, [[0, 0, 0, "spread-sequence", null, "rest-sequence"]]],
  ]) {
    const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": authored }, libraries });
    const opened = fixture.openAndCapture(snapshot, []);
    const captured = captureSingleModule(fixture.front, opened.deps, opened.program, snapshot.entryPoint);
    assert.equal(captured.kind, "ok");
    const raw = captured.value;
    const call = raw.tree.statements.nodes.at(-1).body.statements.nodes[0].expression;
    const spread = call.arguments.nodes[0];
    const recorded = raw.calls.find(row => row.invocation.node === call.id);
    assert.equal(recorded.kind, "applicable");
    const [candidate] = raw.types.candidates[recorded.candidates].candidates;
    const [source] = candidate.sourceArguments;
    assert.deepEqual(source.occurrence, { module: raw.module, node: spread.id });
    assert.deepEqual(source.expression, { module: raw.module, node: spread.expression.id });
    assert.equal(source.kind, "spread");
    assert.deepEqual(candidate.arguments.value.map(row => [
      row.sourceArgumentIndex, row.effectiveArgumentIndex, row.parameterIndex, row.sourceForm, row.spreadElementIndex, row.parameterForm,
    ]), expected);
    for (const row of candidate.arguments.value) {
      assert.equal(row.sourceArgument === candidate.sourceArguments[row.sourceArgumentIndex].occurrence, true);
      assert.equal(Object.hasOwn(row, "effectiveArgument"), false);
    }
  }
});

test("Checked call spread retains the exact authored operand and its finite tuple slots", async () => {
  const fixture = await loadFrontFixture();
  const input = analysisInput(fixture, "sdk-minimal", tupleSource);
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": tupleSource },
    libraries: fixture.sdk.getBundledLibraryClosure(["lib.es5.d.ts"]) });
  const captured = captureSourceBarrier({ ...input, snapshot });
  assert.equal(captured.kind, "ok");
  const module = captured.value.modules.find(row => row.module.module === snapshot.entryPoint).module;
  const call = module.tree.statements.nodes.at(-1).body.statements.nodes[0].expression;
  const [spread, last] = call.arguments.nodes;
  const [transport, following] = call.tsonic.application.value.arguments;
  assert.equal(spread.kind, "SpreadElement");
  assert.equal(transport.kind, "spread");
  assert.equal(transport.expression, spread.expression.id);
  assert.equal(transport.tuple.kind, "available");
  assert.equal(transport.tuple.value.length, 2);
  assert.equal(transport.tuple.value[0], transport.tuple.value[1]);
  assert.deepEqual(following, { kind: "value", expression: last.id });
});
