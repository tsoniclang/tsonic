import assert from "node:assert/strict";
import { test } from "node:test";
import { analysisInput } from "./fixtures/front/analysis-input.mjs";
import { captureSingleModule, loadFrontFixture } from "./fixtures/front/checked-module.mjs";
import { indexSyntaxTree, parseHir, printHir } from "../../packages/host/dist/ir-hir/index.js";
import { captureSourceBarrier } from "../../packages/host/dist/pipeline/source-barrier.js";
import { analyzeHostProgram } from "../../packages/host/dist/pipeline/index.js";
import { parseTir, printTir } from "../../packages/host/dist/ir-tir/index.js";
import { parseMir, printMir, verifyMir } from "../../packages/host/dist/ir-mir/index.js";
import { parseModuleBodies, printModuleBodies } from "../../packages/host/dist/ir-program/index.js";
import { typeSourceBarrier } from "../../packages/host/dist/pipeline/typed-barrier.js";
import { lowerMirDeps, mirVerificationContext } from "../../packages/host/dist/pipeline/lower-mir-step.js";
import { createAccount } from "../../packages/host/dist/dataflow/index.js";
import { internType, instanceKey, viewTypes } from "../../packages/host/dist/ir-types/index.js";
import { lowerToMir } from "../../packages/host/dist/lower-mir/index.js";

test("the checked native extent retains the exact mutable or readonly receiver declaration", async () => {
  assert.equal(typeof process.env.TSONIC_TEST_ADMISSION, "string");
  const fixture = await loadFrontFixture();
  const observations = [];
  for (const [receiver, role] of [["boolean[]", "array-extent"], ["readonly boolean[]", "array-extent"], ["Box", "value"]]) {
    const text = `type Box = { length: number }; export function size(values: ${receiver}): number { return values.length; }`;
    const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": text }, libraries: fixture.sdk.getBundledLibraryClosure(["lib.es5.d.ts"]) });
    const inputs = { ...analysisInput(fixture, "sdk-minimal", text), snapshot };
    const captured = captureSourceBarrier(inputs);
    assert.equal(captured.kind, "ok", receiver);
    const { module } = captured.value.modules.find(row => row.module.module === snapshot.entryPoint);
    const checked = indexSyntaxTree(module.tree).find(node => node.kind === "PropertyAccessExpression");
    assert.equal(checked.tsonic.role, role, receiver);
    const original = checked.name.tsonic.origins.value[0].declaration;
    if (role === "array-extent") {
      assert.deepEqual(checked.tsonic.selectedMember, captured.value.checked.declarationSourceOf(original).value, receiver);
      observations.push(original);
    }
    const wire = printHir(module);
    const parsed = parseHir(wire);
    assert.equal(parsed.kind, "parsed", receiver);
    assert.equal(printHir(parsed.value) === wire, true, receiver);
    const copied = indexSyntaxTree(parsed.value.tree).find(node => node.kind === "PropertyAccessExpression");
    assert.equal(copied.tsonic.role, role, receiver);
    if (role === "array-extent") assert.deepEqual(copied.tsonic.selectedMember, checked.tsonic.selectedMember, receiver);
  }
  assert.notEqual(observations[0], observations[1]);
});

test("an authored write to array length does not claim the native read selector", async () => {
  assert.equal(typeof process.env.TSONIC_TEST_ADMISSION, "string");
  const fixture = await loadFrontFixture();
  const snapshot = fixture.projectSnapshot({
    sourceFiles: { "main.ts": "export function resize(values: boolean[]) { values.length = 0; }" },
    libraries: fixture.sdk.getBundledLibraryClosure(["lib.es5.d.ts"]),
  });
  const opened = fixture.openAndCapture(snapshot, []);
  const captured = captureSingleModule(fixture.front, opened.deps, opened.program, snapshot.entryPoint);
  assert.equal(captured.kind, "ok");
  const properties = captured.value.memberUses.filter(row => row.kind === "property");
  assert.equal(properties.length, 1);
  assert.equal(properties[0].access, "write");
  assert.equal(properties[0].nativeExtent, null);
});

test("a native extent reads the original receiver once and uses the independently selected integer carrier", async () => {
  assert.equal(typeof process.env.TSONIC_TEST_ADMISSION, "string");
  const fixture = await loadFrontFixture();
  for (const [receiver, primitive, holding] of [
    ["boolean[]", "int64", "by-reference"],
    ["readonly boolean[]", "int32", "by-reference"],
  ]) {
    const text = `export function size(values: ${receiver}) { return values.length; }`;
    const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": text }, libraries: fixture.sdk.getBundledLibraryClosure(["lib.es5.d.ts"]) });
    const nativeFacts = { ...snapshot.nativeFacts, arrayExtents: [{ carrier: "array", result: primitive }],
      carrierHolding: snapshot.nativeFacts.carrierHolding.map(row => row.carrier === "array" ? { ...row, holding } : row) };
    const result = analyzeHostProgram({ ...analysisInput(fixture, "sdk-minimal", text), snapshot: { ...snapshot, nativeFacts } });
    assert.equal(result.kind, "ok", receiver);
    const chapter = result.value.modules.find(row => row.module === snapshot.entryPoint);
    const body = chapter.bodies.find(row => row.kind === "selected" && row.tir.root.kind === "Block");
    const property = body.tir.root.statements.nodes[0].expression;
    assert.equal(property.tsonic.role, "array-extent", receiver);
    const operation = property.tsonic.operation.decision.decision;
    assert.equal(operation.operation.kind, "array-extent");
    assert.equal(operation.operation.holding, holding);
    assert.equal(result.value.index.types.terms[operation.result].primitive, primitive);
    assert.equal(result.value.index.types.signatures[body.tir.signature].result, operation.result);
    const operations = body.mir.blocks.flatMap(block => block.statements).filter(statement =>
      statement.kind === "assign" && statement.value.kind === "unary" && statement.value.operation.decision.operation.kind === "array-extent");
    assert.equal(operations.length, 1);
    const operand = operations[0].value.operand;
    assert.equal(operand.kind, "place");
    const place = body.mir.places[operand.place];
    assert.equal(place.base.kind, "local");
    assert.deepEqual(body.mir.locals[place.base.local].source, property.expression.tsonic.resolution.local);
    const index = result.value.index;
    for (const [write, read, value] of [[printTir, parseTir, body.tir], [printMir, parseMir, body.mir],
      [value => printModuleBodies(index, value), wire => parseModuleBodies(index, wire), chapter]]) {
      const wire = write(value);
      const parsed = read(wire);
      assert.equal(parsed.kind, "parsed", receiver);
      assert.equal(write(parsed.value) === wire, true, receiver);
    }
  }
});

test("in-place native extent lowering borrows the original verified receiver place", async () => {
  const fixture = await loadFrontFixture();
  const text = "export function size(values: boolean[], other: boolean[]) { return values.length + other.length; }";
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": text }, libraries: fixture.sdk.getBundledLibraryClosure(["lib.es5.d.ts"]) });
  const nativeFacts = { ...snapshot.nativeFacts, carrierHolding: snapshot.nativeFacts.carrierHolding.map(row =>
    row.carrier === "array" ? { ...row, holding: "in-place" } : row) };
  const inputs = { ...analysisInput(fixture, "sdk-minimal", text), snapshot: { ...snapshot, nativeFacts } };
  const source = captureSourceBarrier(inputs);
  assert.equal(source.kind, "ok");
  const typed = typeSourceBarrier(inputs, source.value, createAccount(inputs.limits.dataflow));
  assert.equal(typed.kind, "ok");
  const body = [...typed.value.bodies.values()].find(row => row.bindings.kind === "instantiated" && row.root.kind === "Block");
  assert.equal(body !== undefined, true);
  const interner = source.value.types;
  const defs = { completionSelector: internType(interner, { kind: "primitive", primitive: "int32" }),
    exceptionStorage: internType(interner, { kind: "intrinsic", intrinsic: "unknown" }) };
  const run = { selectedNativeFacts: nativeFacts, interner, table: viewTypes(interner), defs,
    lowering: inputs.limits.lowering, verification: inputs.limits.mirVerification, declarationOf: typed.value.declarationOf,
    bodyOwner: identity => source.value.checked.bodies.get(identity)?.owner ?? null,
    bodyOf: instance => typed.value.bodies.get(instanceKey(instance)) ?? null };
  const provided = [2];
  const unit = { request: { query: "mirBody", key: instanceKey({ body: body.body, bindings: body.bindings }) }, position: { kind: "result" } };
  const lowered = lowerToMir(lowerMirDeps(run, unit), body, [], provided);
  assert.equal(lowered.kind, "ok");
  const verified = verifyMir(lowered.value, mirVerificationContext(run, body, provided));
  assert.equal(verified.kind, "complete");
  assert.deepEqual(verified.violations, []);
  const extents = lowered.value.blocks.flatMap(block => block.statements).filter(row =>
    row.kind === "assign" && row.value.kind === "unary" && row.value.operation.decision.operation.kind === "array-extent");
  assert.equal(extents.length, 2);
  const [extent, other] = extents;
  assert.equal(extent.value.operation.decision.operation.holding, "in-place");
  const operand = lowered.value.places[extent.value.operand.place];
  assert.equal(operand.base.kind, "local");
  const local = lowered.value.locals[operand.base.local];
  assert.deepEqual(local.role, { kind: "parameter", index: 0 });
  assert.deepEqual(local.source, body.root.statements.nodes[0].expression.left.expression.tsonic.resolution.local);
  assert.notEqual(other.value.operand.place, extent.value.operand.place);
  const crossed = { ...lowered.value, blocks: lowered.value.blocks.map(block => ({ ...block,
    statements: block.statements.map(row => row === extent ? { ...row, value: { ...row.value, operand: other.value.operand } } : row),
  })) };
  const rejected = verifyMir(crossed, mirVerificationContext(run, body, provided));
  assert.equal(rejected.kind, "complete");
  assert.deepEqual(rejected.violations.map(row => row.rule), ["operation-selected"]);
});
