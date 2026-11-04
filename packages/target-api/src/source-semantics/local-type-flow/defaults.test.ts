import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, createSourceSemanticsExtension, sourcePrimitive, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../target-source-program.js";
import { createSourceTypeFlowAnalysisContext, sourceTypeFlowIntegerFits } from "./defaults.js";

function fixture(text: string) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/node_modules/@test/words/package.json": JSON.stringify({ name: "@test/words", version: "1.0.0", type: "module", exports: { ".": "./index.d.ts" } }),
    "/src/node_modules/@test/words/index.d.ts": "export type int32 = number; export type float32 = number;",
    "/src/index.ts": `import type { int32, float32 } from "@test/words"; ${text}`,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
  extensionHostOptions: { extensions: [createSourceSemanticsExtension({ modules: [{ moduleSpecifier: "@test/words", packageName: "@test/words",
    exports: [sourcePrimitive("int32", "int32", "number", true, 32), sourcePrimitive("float32", "float32", "number", true, 32)] }] })] } }).checkSource();
  assert.equal(checked.diagnostics.length, 0);
  const source = createTargetSourceProgram(checked);
  const defaults = createSourceTypeFlowAnalysisContext(source);
  const declaration = (name: string): Node => {
    const selected = defaults.nodes.find(node => source.ast.is.IsVariableDeclaration(node) && source.ast.text(source.ast.name(node)) === name);
    if (selected === undefined) throw new Error(`The original declaration ${name} is required.`);
    return selected;
  };
  return { source, defaults, declaration };
}

test("integer tokens and fractional or exponent tokens retain distinct leaf defaults", () => {
  const current = fixture("export const integer = 1; export const fractional = 1.0; export const exponent = 1e3; export const radix = 0xff;");
  for (const name of ["integer", "radix"]) assert.deepEqual(current.defaults.context.describe(current.declaration(name)), { kind: "primitive", primitive: "int32" });
  for (const name of ["fractional", "exponent"]) assert.deepEqual(current.defaults.context.describe(current.declaration(name)), { kind: "primitive", primitive: "float64" });
});

test("authored array syntax preserves the element source fact instead of erasing to number", () => {
  const current = fixture("declare const integers: int32[]; declare const singles: readonly float32[];");
  assert.deepEqual(current.defaults.context.describe(current.declaration("integers")), { kind: "array", readonly: false, element: { kind: "primitive", primitive: "int32" } });
  assert.deepEqual(current.defaults.context.describe(current.declaration("singles")), { kind: "array", readonly: true, element: { kind: "primitive", primitive: "float32" } });
});

test("a required component overrides the occurrence's literal default", () => {
  const current = fixture("declare const required: number[]; export const literal = [1];");
  const declaration = current.declaration("required");
  const queries = current.source.semantics.forNode(declaration);
  const selectedType = queries.declarations.declaredValueType(declaration);
  if (selectedType === undefined) throw new Error("The checked required type is required.");
  const value = current.defaults.context.describe(current.declaration("literal"), { selectedType, declaration,
    authoredTypeNode: current.source.ast.typeNode(declaration) });
  assert.deepEqual(value, { kind: "array", readonly: false, element: { kind: "primitive", primitive: "float64" } });
});

test("nominal source identity is a declaration and its ordered actual descriptors", () => {
  const current = fixture("declare class Box<T> { value: T } declare const box: Box<int32>;");
  const type = current.defaults.context.describe(current.declaration("box"));
  assert.equal(type?.kind === "declared", true);
  assert.equal(type?.kind === "declared" && current.source.ast.is.IsClassDeclaration(type.declaration), true);
  if (type?.kind === "declared") assert.deepEqual(type.typeArguments, [{ kind: "primitive", primitive: "int32" }]);
});

test("the two readonly tuple positions retain independent source widths", () => {
  const current = fixture("declare const pair: readonly [int32, float32];");
  assert.deepEqual(current.defaults.context.describe(current.declaration("pair")), { kind: "tuple", readonly: true,
    elements: [{ kind: "primitive", primitive: "int32" }, { kind: "primitive", primitive: "float32" }] });
});

test("a descending or non-unit-step counter is fixed without a counted-loop proof", () => {
  const current = fixture("function run(): void { for (let index = 8; index >= 0; index -= 2) {} }");
  const node = current.declaration("index"); const rule = current.defaults.fixedRule(node);
  assert.deepEqual(current.defaults.context.describe(node), { kind: "primitive", primitive: "int64" });
  assert.equal(rule?.kind, "loop-counter"); assert.equal(rule?.declaration === node, true);
  assert.equal(Object.isFrozen(rule), true);
});

test("ordinary int64-compatible values do not acquire loop-counter authority", () => {
  const current = fixture("export const value = 8;");
  assert.equal(current.defaults.fixedRule(current.declaration("value")), undefined);
});

test("source order uses exact authored starts and one preorder tie breaker", () => {
  const current = fixture("export const first = 1; export const second = 2;");
  const first = current.defaults.context.order(current.declaration("first"));
  const second = current.defaults.context.order(current.declaration("second"));
  assert.equal(first.start < second.start, true); assert.equal(first.preorder < second.preorder, true);
});

test("range admission distinguishes signed, unsigned, floating and decimal domains", () => {
  assert.equal(sourceTypeFlowIntegerFits(2147483647n, "int32"), true);
  assert.equal(sourceTypeFlowIntegerFits(2147483648n, "int32"), false);
  assert.equal(sourceTypeFlowIntegerFits(-1n, "uint32"), false);
  assert.equal(sourceTypeFlowIntegerFits(18446744073709551615n, "uint64"), true);
  assert.equal(sourceTypeFlowIntegerFits(18446744073709551616n, "uint64"), false);
  assert.equal(sourceTypeFlowIntegerFits(10n ** 40n, "float32"), false);
  assert.equal(sourceTypeFlowIntegerFits(10n ** 400n, "float64"), false);
  assert.equal(sourceTypeFlowIntegerFits(79228162514264337593543950336n, "decimal"), false);
});
