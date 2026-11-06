import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../source-semantics/target-source-program.js";
import { sourceAnnotationHint, type SourceAnnotationHintBindings } from "./annotation-hints.js";

function fixture(body: string) {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: { "/src/index.ts": `export {}; type Native = number; ${body}` },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
  }).checkSource();
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(diagnostic => diagnostic !== undefined)));
  const source = createTargetSourceProgram(checked);
  const nodes: Node[] = [];
  const visit = (node: Node): void => {
    nodes.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(checked.getSourceFile("/src/index.ts")!);
  const bindings: SourceAnnotationHintBindings = {
    ast: source.ast,
    navigation: source.navigation,
    call: node => source.semantics.forNode(node).operations.call(node),
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
] as const) {
  test(`Source annotation hints preserve the original ${label} result`, () => {
    const current = fixture(body);
    assert.equal(current.selected.length, 1);
    assert.equal(sourceAnnotationHint(current.selected[0]!, current.bindings), expected);
  });
}

test("Source assignment hints use the original unannotated slot and exact authored input", () => {
  const current = fixture("function run(replacement: Native[]): void { let selected = [1, 2]; selected = replacement; }");
  const input = current.nodes.find(node => current.source.ast.is.IsIdentifier(node) &&
    current.source.ast.text(node) === "replacement" && current.source.ast.is.IsBinaryExpression(current.source.ast.parent(node)));
  assert.equal(input !== undefined, true);
  assert.equal(sourceAnnotationHint(input!, current.bindings), "Annotate `let selected: Native[] = [1, 2]`.");
});

test("Source annotation hints retain an exact published annotation instead of erased declaration spelling", () => {
  const current = fixture("declare function take(value: number): void; function run(): void { const selected = 1; take(selected); }");
  assert.equal(sourceAnnotationHint(current.selected[0]!, { ...current.bindings, annotationType: "int32" }),
    "Annotate `const selected: int32 = 1`.");
});

test("Source annotation hints never transplant a foreign generic binder into the proposed declaration", () => {
  const foreign = fixture("class Box<Value> { value!: Value; } class Receiver<Value> { take(value: Box<Value>): void {} } function run(): void { const selected = new Box<number>(); const receiver = new Receiver<number>(); receiver.take(selected); }");
  assert.equal(sourceAnnotationHint(foreign.selected[0]!, foreign.bindings), undefined);
  const local = fixture("function run<Value>(input: Value): Value { const selected = input; return selected; }");
  assert.equal(sourceAnnotationHint(local.selected[0]!, local.bindings), "Annotate `const selected: Value = input`.");
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
  const selected = current.selected[0]!;
  assert.equal(sourceAnnotationHint(selected, { ...current.bindings, call: () => undefined }), undefined);
  const call = current.nodes.find(node => current.source.ast.is.IsCallExpression(node))!;
  const original = current.bindings.call(call)!;
  assert.equal(sourceAnnotationHint(selected, {
    ...current.bindings, call: () => ({ ...original, sourceArguments: [] }),
  }), undefined);
  assert.equal(sourceAnnotationHint(selected, {
    ...current.bindings, call: () => ({ ...original, sourceArgumentBindings: [
      ...original.sourceArgumentBindings,
      { ...original.sourceArgumentBindings[0]!, sourceParameterIndex: 1 },
    ] }),
  }), undefined);
});
