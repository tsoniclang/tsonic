import assert from "node:assert/strict";
import test from "node:test";
import { sourceAnnotationHint } from "../../packages/target-api/dist/source-navigation/annotation-hints.js";
import { sourceTypeFlowFixture } from "./fixtures/source-type-flow-fixture.mjs";

function fixture(body) {
  const { source, nodes } = sourceTypeFlowFixture(`export {}; type Native = number; ${body}`);
  const bindings = {
    ast: source.ast,
    navigation: source.facts.navigation,
    application: node => source.facts.applications.application(node),
  };
  const selected = nodes.filter(node => source.ast.is.IsIdentifier(node) && source.ast.text(node) === "selected" &&
    source.ast.is.IsVariableDeclaration(source.ast.parent(node)) === false);
  return { source, bindings, selected, nodes };
}

for (const [label, body, expected] of [
  ["return", "function run(): Native { const selected = 1; return selected; }", "Annotate `const selected: Native = 1`."],
  ["call", "declare function take(value: Native): void; function run(): void { const selected = 1; take(selected); }", "Annotate `const selected: Native = 1`."],
  ["construction", "declare class Box { constructor(value: Native); } function run(): void { const selected = 1; new Box(selected); }", "Annotate `const selected: Native = 1`."],
  ["wrapper", "declare function take(value: Native): void; function run(): void { const selected = 1; take((((selected)))); }", undefined],
  ["readonly", "declare function take(value: readonly Native[]): void; function run(): void { const selected = [1, 2]; take(selected); }", "Annotate `const selected: Native[] = [1, 2]`."],
]) {
  test(`Source annotation hints preserve the original ${label} result`, () => {
    const current = fixture(body);
    assert.equal(current.selected.length, 1);
    assert.equal(sourceAnnotationHint(current.selected[0], current.bindings), expected);
  });
}

test("Source assignment hints use the original unannotated slot and exact authored input", () => {
  const current = fixture("function run(replacement: Native[]): void { let selected = [1, 2]; selected = replacement; }");
  const input = current.nodes.find(node => current.source.ast.is.IsIdentifier(node) &&
    current.source.ast.text(node) === "replacement" && current.source.ast.is.IsBinaryExpression(current.source.ast.parent(node)));
  assert.equal(input !== undefined, true);
  assert.equal(sourceAnnotationHint(input, current.bindings), "Annotate `let selected: Native[] = [1, 2]`.");
});

test("Source annotation hints retain an exact published annotation instead of erased declaration spelling", () => {
  const current = fixture("declare function take(value: number): void; function run(): void { const selected = 1; take(selected); }");
  assert.equal(sourceAnnotationHint(current.selected[0], { ...current.bindings, annotationType: "int32" }),
    "Annotate `const selected: int32 = 1`.");
});

test("Source annotation hints never transplant a foreign generic binder into the proposed declaration", () => {
  const foreign = fixture("class Box<Value> { value!: Value; } class Receiver<Value> { take(value: Box<Value>): void {} } function run(): void { const selected = new Box<number>(); const receiver = new Receiver<number>(); receiver.take(selected); }");
  assert.equal(sourceAnnotationHint(foreign.selected[0], foreign.bindings), undefined);
  const local = fixture("function run<Value>(input: Value): Value { const selected = input; return selected; }");
  assert.equal(sourceAnnotationHint(local.selected[0], local.bindings), "Annotate `const selected: Value = input`.");
});

for (const body of [
  "function run(): Native { const selected: Native = 1; return selected; }",
  "function run() { const selected = 1; return selected; }",
  "function run(selected: Native): Native { return selected; }",
  "function run(): Native { let selected; selected = 1; return selected; }",
  `function run(): string { const selected = "${"x".repeat(121)}"; return selected; }`,
]) {
  test(`Source annotation hints reject missing authority or nonapplicable storage: ${body.slice(0, 64)}`, () => {
    const current = fixture(body);
    assert.equal(current.selected.length > 0, true);
    for (const occurrence of current.selected) assert.equal(sourceAnnotationHint(occurrence, current.bindings), undefined);
  });
}

test("Source call hints require the exact original argument and a unique selected parameter", () => {
  const current = fixture("declare function take(value: Native): void; function run(): void { const selected = 1; take(selected); }");
  const selected = current.selected[0];
  assert.equal(sourceAnnotationHint(selected, { ...current.bindings, application: () => undefined }), undefined);
  const call = current.nodes.find(node => current.source.ast.is.IsCallExpression(node));
  const result = current.bindings.application(call);
  assert.equal(result.kind, "resolved", "the genuine selected application is published");
  const original = result.value;
  assert.equal(original.arguments.length, 1, "the original direct call has one actual effective parameter place");
  assert.equal(sourceAnnotationHint(selected, {
    ...current.bindings, application: () => ({ kind: "resolved", value: { ...original, sourceArguments: [] } }),
  }), undefined);
  assert.equal(sourceAnnotationHint(selected, {
    ...current.bindings, application: () => ({ kind: "resolved", value: { ...original, arguments: [
      ...original.arguments,
      { ...original.arguments[0], parameter: { ...original.arguments[0].parameter, index: 1 } },
    ] } }),
  }), undefined);
});
