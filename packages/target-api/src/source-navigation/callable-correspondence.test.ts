import assert from "node:assert/strict";
import test from "node:test";
import type { Node } from "@tsonic/tsts";
import { sourceCallArgumentCorrespondences, sourceExpressionCallArgument } from "./callable-arguments.js";
import { fixture } from "./callable-arguments-fixtures.js";

function selected(body: string) {
  const current = fixture(body, true);
  const location = sourceExpressionCallArgument(current.expression, current.source);
  assert.equal(location !== undefined, true, "original checked argument location");
  const checked = current.source.semantics.forNode(location!.call).operations.call(location!.call);
  assert.equal(checked !== undefined, true, "original checked call");
  return { ...current, checked: checked!, context: { ast: current.source.ast,
    semantics: current.source.semantics.forNode(location!.call) } };
}

test("checked correspondence retains original call, formal, binding and vector identities", () => {
  for (const body of [
    "consume((value: unknown): void => {});",
    "consume((((value: unknown): void => {})));",
    "consume(((value: unknown): void => {}) satisfies ((value: unknown) => void));",
    "new construct((value: unknown): void => {});",
  ]) {
    const current = selected(body);
    const rows = sourceCallArgumentCorrespondences(current.context, current.checked);
    assert.equal(rows?.length, 1, body);
    const row = rows![0]!;
    assert.equal(row.bindingIndex, 0, body);
    assert.equal(row.binding === current.checked.sourceArgumentBindings[0], true, body);
    assert.equal(row.argument === current.checked.sourceArguments[0], true, body);
    assert.equal(row.parameter === current.checked.sourceSelectedSignatureParameters[0], true, body);
    assert.equal(row.argument.expression === current.source.ast.arguments(current.checked.call)[0], true, body);
    assert.equal(Object.isFrozen(row) && Object.isFrozen(rows), true, body);
  }
});

test("checked correspondence keeps source and effective indexes distinct for spread elements", () => {
  const current = selected("declare function many(callback: () => void, ...values: number[]): void; many(() => {}, ...[1, 2] as const);");
  const rows = sourceCallArgumentCorrespondences(current.context, current.checked);
  assert.equal(rows?.length, 3);
  assert.deepEqual(rows!.map(row => row.bindingIndex), [0, 1, 2]);
  assert.deepEqual(rows!.map(row => row.binding.sourceArgumentIndex), [0, 1, 1]);
  assert.deepEqual(rows!.map(row => row.binding.effectiveArgumentIndex), [0, 1, 2]);
  assert.deepEqual(rows!.map(row => row.binding.sourceForm), ["value", "spread-element", "spread-element"]);
  assert.deepEqual(rows!.map(row => row.binding.spreadElementIndex), [undefined, 0, 1]);
  assert.equal(rows![1]!.argument === rows![2]!.argument, true, "one original spread, two checked elements");
  assert.equal(rows![1]!.parameter === rows![2]!.parameter, true, "one original rest formal");
});

test("checked correspondence refuses invalid source, effective and selected-formal indexes", () => {
  const current = selected("consume((value: unknown): void => {});");
  const binding = current.checked.sourceArgumentBindings[0]!;
  for (const invalid of [
    { sourceArgumentIndex: -1 }, { sourceArgumentIndex: 0.5 }, { sourceArgumentIndex: 1 },
    { effectiveArgumentIndex: -1 }, { effectiveArgumentIndex: 0.5 },
    { sourceParameterIndex: -1 }, { sourceParameterIndex: 0.5 }, { sourceParameterIndex: 1 },
    { sourceForm: "spread-element" as const }, { spreadElementIndex: 0 },
  ]) {
    const malformed = { ...current.checked, sourceArgumentBindings: [{ ...binding, ...invalid }] };
    assert.equal(sourceCallArgumentCorrespondences(current.context, malformed) === undefined, true,
      JSON.stringify(invalid));
  }
});

test("checked correspondence refuses foreign expressions, duplicate effective slots and foreign formals", () => {
  const current = selected("consume((value: unknown): void => {});");
  const binding = current.checked.sourceArgumentBindings[0]!;
  for (const malformed of [
    { ...current.checked, sourceArguments: [{ ...current.checked.sourceArguments[0]!, expression: {} as Node }] },
    { ...current.checked, sourceArguments: [] },
    { ...current.checked, sourceArgumentBindings: [binding, binding] },
    { ...current.checked, sourceSelectedSignatureParameters: [{ ...current.checked.sourceSelectedSignatureParameters[0]!, parameterIndex: 1 }] },
    { ...current.checked, sourceSelectedSignatureKind: "untyped" as const },
  ]) {
    assert.equal(sourceCallArgumentCorrespondences(current.context, malformed) === undefined, true,
      "no missing, foreign, duplicate or unselected correspondence");
  }
});

test("checked correspondence does not authorize an optional callback consumer", () => {
  const current = fixture("consume?.((value: unknown): void => {});", true);
  const parent = current.source.ast.parent(current.expression);
  assert.equal(parent !== undefined, true);
  const checked = current.source.semantics.forNode(parent!).operations.call(parent!);
  assert.equal(checked !== undefined, true);
  assert.equal(sourceCallArgumentCorrespondences({ ast: current.source.ast,
    semantics: current.source.semantics.forNode(parent!) }, checked!)?.length, 1,
    "the checked relation exists independently of native callback policy");
  assert.equal(sourceExpressionCallArgument(current.expression, current.source) === undefined, true,
    "the location consumer keeps its original optional-call refusal");
});

test("checked correspondence distinguishes foreign records from inconsistent admitted facts", () => {
  const current = selected("consume((value: unknown): void => {});");
  const foreign = selected("consume((value: unknown): void => {});");
  assert.equal(sourceCallArgumentCorrespondences(current.context, foreign.checked) === undefined, true,
    "a different checked program cannot supply this context's call");
  assert.equal(sourceCallArgumentCorrespondences(current.context, { ...current.checked }) === undefined, true,
    "a copied record is not this checked owner's selected call");
  const binding = current.checked.sourceArgumentBindings[0]!;
  for (const inconsistent of [
    { ...current.checked, sourceArguments: [] },
    { ...current.checked, sourceArgumentBindings: [binding, binding] },
    { ...current.checked, sourceSelectedSignatureParameters: [{ ...current.checked.sourceSelectedSignatureParameters[0]!, parameterIndex: 1 }] },
  ]) {
    const semantics = { ...current.context.semantics,
      operations: { ...current.context.semantics.operations, call: () => inconsistent } };
    assert.throws(() => sourceCallArgumentCorrespondences({ ast: current.source.ast, semantics }, inconsistent),
      /A checked call/u, "an admitted checked fact must not silently become an unsupported input");
  }
});
