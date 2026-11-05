import assert from "node:assert/strict";
import test from "node:test";
import { isDeepStrictEqual } from "node:util";
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
  for (const name of ["integer", "radix"]) assertSameValue(current.defaults.context.describe(current.declaration(name)), { kind: "primitive", primitive: "int32" });
  for (const name of ["fractional", "exponent"]) assertSameValue(current.defaults.context.describe(current.declaration(name)), { kind: "primitive", primitive: "float64" });
});

test("authored array syntax preserves the element source fact instead of erasing to number", () => {
  const current = fixture("declare const integers: int32[]; declare const singles: readonly float32[];");
  assertSameValue(current.defaults.context.describe(current.declaration("integers")), { kind: "array", readonly: false, element: { kind: "primitive", primitive: "int32" } });
  assertSameValue(current.defaults.context.describe(current.declaration("singles")), { kind: "array", readonly: true, element: { kind: "primitive", primitive: "float32" } });
});

test("never-open folded arithmetic keeps its checked type rather than a local integer-constant default", () => {
  const current = fixture("export const quotient = 7 / 2; export const sum = 1 + 2;");
  for (const name of ["quotient", "sum"]) {
    assertSameValue(current.defaults.context.describe(current.declaration(name)), { kind: "primitive", primitive: "float64" });
  }
});

test("an imported primitive qualifier keeps its declaration fact instead of its erased number type", () => {
  const current = fixture('declare const value: import("@test/words").int32;');
  assertSameValue(current.defaults.context.describe(current.declaration("value")), { kind: "primitive", primitive: "int32" });
});

test("optional member presence is independent of an absence-capable member value", () => {
  const current = fixture("declare const absent: { value?: int32 }; declare const present: { value: int32 | undefined };");
  for (const [name, optional] of [["absent", true], ["present", false]] as const) {
    const type = current.defaults.context.describe(current.declaration(name));
    assert.equal(type?.kind === "shape", true);
    if (type?.kind !== "shape") throw new Error("The exact declared shape is required.");
    assert.equal(type.members.length, 1);
    assert.equal(type.members[0]!.optional, optional);
    assertSameValue(type.members[0]!.type, { kind: "optional", value: { kind: "primitive", primitive: "int32" } });
  }
});

test("declared undefined and null are absence while a callable void result remains void", () => {
  const current = fixture("declare const empty: undefined; declare const nil: null; declare const callback: () => void;");
  for (const name of ["empty", "nil"]) {
    assertSameValue(current.defaults.context.describe(current.declaration(name)), { kind: "intrinsic", intrinsic: "absence" });
  }
  const callback = current.defaults.context.describe(current.declaration("callback"));
  assert.equal(callback?.kind === "callable", true);
  if (callback?.kind !== "callable") throw new Error("The actual declared callback is required.");
  assertSameValue(callback.calls[0]?.result, { kind: "intrinsic", intrinsic: "void" });
});

test("a required component overrides the occurrence's literal default", () => {
  const current = fixture("declare const required: number[]; export const literal = [1];");
  const declaration = current.declaration("required");
  const queries = current.source.semantics.forNode(declaration);
  const selectedType = queries.declarations.declaredValueType(declaration);
  if (selectedType === undefined) throw new Error("The checked required type is required.");
  const value = current.defaults.context.describe(current.declaration("literal"), { selectedType, declaration,
    authoredTypeNode: current.source.ast.typeNode(declaration) });
  assertSameValue(value, { kind: "array", readonly: false, element: { kind: "primitive", primitive: "float64" } });
});

test("nominal source identity is a declaration and its ordered actual descriptors", () => {
  const current = fixture("declare class Box<T> { value: T } declare const box: Box<int32>;");
  const type = current.defaults.context.describe(current.declaration("box"));
  assert.equal(type?.kind === "declared", true);
  assert.equal(type?.kind === "declared" && current.source.ast.is.IsClassDeclaration(type.declaration), true);
  if (type?.kind === "declared") assertSameValue(type.typeArguments, [{ kind: "primitive", primitive: "int32" }]);
});

test("the two readonly tuple positions retain independent source widths", () => {
  const current = fixture("declare const pair: readonly [int32, float32];");
  assertSameValue(current.defaults.context.describe(current.declaration("pair")), { kind: "tuple", readonly: true,
    elements: [{ kind: "primitive", primitive: "int32" }, { kind: "primitive", primitive: "float32" }] });
});

test("a descending or non-unit-step counter is fixed without a counted-loop proof", () => {
  const current = fixture("function run(): void { for (let index = 8; index >= 0; index -= 2) {} }");
  const node = current.declaration("index"); const rule = current.defaults.fixedRule(node);
  assertSameValue(current.defaults.context.describe(node), { kind: "primitive", primitive: "int64" });
  assert.equal(rule?.kind, "loop-counter"); assert.equal(rule?.declaration === node, true);
  assert.equal(Object.isFrozen(rule), true);
});

for (const selected of [{ annotation: "number", primitive: "float64" }, { annotation: "int32", primitive: "int32" }]) {
  test(`an annotated ${selected.annotation} counter and its reads never acquire loop-counter authority`, () => {
    const current = fixture(`function run(): void { for (let index: ${selected.annotation} = 0; index < 3; index++) { const value = index; } }`);
    const declaration = current.declaration("index");
    const reads = current.defaults.nodes.filter(node => current.source.ast.is.IsIdentifier(node) &&
      current.source.navigation.sourceReferenceFor(node)?.declaration === declaration);
    assert.equal(reads.length >= 3, true, "the exact checked counter reads are retained");
    for (const node of [declaration, ...reads]) {
      assert.equal(current.defaults.fixedRule(node) === undefined, true, "an annotation excludes counter authority before caching");
      assertSameValue(current.defaults.context.describe(node), { kind: "primitive", primitive: selected.primitive });
      assert.equal(current.defaults.fixedRule(node) === undefined, true, "describing an annotated read does not create a counter receipt");
      const outcome = current.source.effectiveTypes.get(node);
      assert.equal(outcome?.kind === "resolved" || outcome?.kind === "default", true, "the annotated occurrence is published");
      if (outcome?.kind !== "resolved" && outcome?.kind !== "default") throw new Error("The exact annotated effective type is required.");
      assertSameValue(outcome.type, { kind: "primitive", primitive: selected.primitive });
      assert.equal(outcome.provenance.fixedRule === undefined, true, "published annotated reads have no counter authority");
    }
  });
}

test("ordinary int64-compatible values do not acquire loop-counter authority", () => {
  const current = fixture("export const value = 8;");
  assert.equal(current.defaults.fixedRule(current.declaration("value")), undefined);
});

test("checked optional-property occurrences keep their narrowed declared width", () => {
  const current = fixture("declare const data: { value?: int32 }; function run(): void { if (data.value !== undefined) { const narrowed = data.value; } }");
  assertSameValue(current.defaults.context.describe(current.declaration("narrowed")), { kind: "primitive", primitive: "int32" });
});

test("excluded annotations and tuple aliases retain the included consumer's query", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/node_modules/@test/words/package.json": JSON.stringify({ name: "@test/words", version: "1.0.0", type: "module", exports: { ".": "./index.d.ts" } }),
    "/src/node_modules/@test/words/index.d.ts": "export type int32 = number; export type float32 = number;",
    "/src/index.ts": 'import { data } from "./native.js"; function run(): void { const retained = data; const pair = data.pair; }',
    "/src/native.ts": 'import type { int32, float32 } from "@test/words"; export type Pair = readonly [int32, float32]; export declare const data: { value: int32; pair: Pair };',
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
  extensionHostOptions: { extensions: [createSourceSemanticsExtension({ modules: [{ moduleSpecifier: "@test/words", packageName: "@test/words",
    exports: [sourcePrimitive("int32", "int32", "number", true, 32), sourcePrimitive("float32", "float32", "number", true, 32)] }] })] } }).checkSource();
  assert.equal(checked.diagnostics.length, 0);
  const consumer = checked.getSourceFile("/src/index.ts");
  const native = checked.getSourceFile("/src/native.ts");
  if (consumer === undefined || native === undefined) throw new Error("The exact checked files are required.");
  const source = createTargetSourceProgram({ ...checked, sourceFiles: Object.freeze([consumer]), getSourceFileQueries(file) {
    assert.equal(file === consumer, true, "foreign metadata keeps the original consumer query");
    return checked.getSourceFileQueries(file);
  } });
  const defaults = createSourceTypeFlowAnalysisContext(source);
  const retained = defaults.nodes.find(node => source.ast.is.IsVariableDeclaration(node) && source.ast.text(source.ast.name(node)) === "retained");
  const pair = defaults.nodes.find(node => source.ast.is.IsVariableDeclaration(node) && source.ast.text(source.ast.name(node)) === "pair");
  if (retained === undefined || pair === undefined) throw new Error("The included declarations are required.");
  const type = defaults.context.describe(retained);
  assert.equal(type?.kind === "shape", true);
  if (type?.kind !== "shape") throw new Error("The exact checked structural type is required.");
  assertSameValue(type.members.find(member => member.name === "value")?.type, { kind: "primitive", primitive: "int32" });
  assertSameValue(defaults.context.describe(pair), { kind: "tuple", readonly: true,
    elements: [{ kind: "primitive", primitive: "int32" }, { kind: "primitive", primitive: "float32" }] });
  assert.equal(source.semantics.includes(native), false);
  assert.equal(source.sourceFiles.length, 1);
  assert.equal(type.members.every(member => member.declaration !== undefined && source.ast.getSourceFile(member.declaration) === native), true);
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

test("negative zero keeps the floating leaf default without changing ordinary zero", () => {
  const current = fixture("function run(): void { const negative = -0; const ordinary = 0; } export const exported = -0;");
  for (const name of ["negative", "exported"]) {
    assertSameValue(current.defaults.context.describe(current.declaration(name)), { kind: "primitive", primitive: "float64" });
  }
  assertSameValue(current.defaults.context.describe(current.declaration("ordinary")), { kind: "primitive", primitive: "int32" });
});

test("annotated unions and index signatures publish their declared type, never their initializer's narrower type", () => {
  const current = fixture("function run(): void { const value: number | string = 1; const dictionary: { [key: string]: number } = {}; }");
  const index = current.defaults.nodes.find(node => current.source.ast.is.IsIndexSignatureDeclaration(node));
  assert.equal(index !== undefined, true);
  if (index === undefined) throw new Error("The actual checked index declaration is required.");
  for (const [name, expected] of [["value", { kind: "union", types: [{ kind: "primitive", primitive: "float64" }, { kind: "string" }] }],
    ["dictionary", { kind: "shape", members: [], indexes: [{ declaration: index, key: { kind: "string" },
      value: { kind: "primitive", primitive: "float64" }, readonly: false }] }]] as const) {
    const described = current.defaults.context.describe(current.declaration(name));
    const published = current.source.effectiveTypes.get(current.declaration(name));
    assertSameValue(described, expected);
    assert.equal(published !== undefined && published.kind !== "refused", true, name);
    if (published === undefined || published.kind === "refused") throw new Error("The declared type must be published.");
    assertSameValue(published.type, expected);
    assert.equal(described?.kind === "primitive" && described.primitive === "int32", false);
    assert.equal(name === "value" ? described?.kind === "union" && described.types.length > 1
      : described?.kind === "shape" && described.indexes.length > 0, true);
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("an opaque declared object publishes the object intrinsic, not a structural shape", () => {
  const current = fixture("declare const value: object;");
  const described = current.defaults.context.describe(current.declaration("value"));
  const published = current.source.effectiveTypes.get(current.declaration("value"));
  assertSameValue(described, { kind: "intrinsic", intrinsic: "object" });
  assert.equal(published !== undefined && published.kind !== "refused", true);
  if (published === undefined || published.kind === "refused") throw new Error("The declared type must be published.");
  assertSameValue(published.type, { kind: "intrinsic", intrinsic: "object" });
  assert.equal(described?.kind === "shape" || published.type.kind === "shape", false);
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("a generic type annotation retains its checked type declaration beside a same-name constructor value", () => {
  const current = fixture(`interface Box<Value> { value: Value; }
    declare const Box: { new<Value>(value: Value): Box<Value> };
    function run(): void { const selected: Box<int32> = new Box<int32>(1); }`);
  const declaration = current.defaults.nodes.find(node => current.source.ast.is.IsInterfaceDeclaration(node) &&
    current.source.ast.text(current.source.ast.name(node)) === "Box");
  const type = current.defaults.context.describe(current.declaration("selected"));
  assert.equal(declaration !== undefined && type?.kind === "declared", true, "the real checked generic declaration is retained");
  if (type?.kind !== "declared") throw new Error("The declared generic descriptor is required.");
  assert.equal(type.declaration === declaration, true, "the constructor value cannot own a type annotation's binders");
  assertSameValue(type.typeArguments, [{ kind: "primitive", primitive: "int32" }]);
});

test("declared index aliases retain the actual signature in both reference and resolved definition", () => {
  const current = fixture("type Indexed = { [name: string]: number }; const data: Indexed = { value: 1 };");
  const alias = current.defaults.nodes.find(node => current.source.ast.is.IsTypeAliasDeclaration(node));
  const index = current.defaults.nodes.find(node => current.source.ast.is.IsIndexSignatureDeclaration(node));
  const type = current.defaults.context.describe(current.declaration("data"));
  assert.equal(alias !== undefined && index !== undefined && type?.kind === "declared", true);
  if (type?.kind !== "declared") throw new Error("The nominal index alias is required.");
  assert.equal(type.declaration === alias && type.members?.length === 0 && type.indexes.length === 1, true);
  assert.equal(type.indexes[0]?.declaration === index && type.indexes[0]?.readonly === false, true);
  assertSameValue(type.indexes[0]?.key, { kind: "string" });
  assertSameValue(type.indexes[0]?.value, { kind: "primitive", primitive: "float64" });
  assert.equal(type.definition?.kind === "shape", true);
  if (type.definition?.kind !== "shape") throw new Error("The Host-resolved alias body is required.");
  assert.equal(type.definition.members.length === 0 && type.definition.indexes[0]?.declaration === index, true);
  assertSameValue(type.definition.indexes[0]?.value, type.indexes[0]?.value);
  const literal = current.defaults.nodes.find(node => current.source.ast.is.IsObjectLiteralExpression(node));
  assert.equal(current.source.effectiveTypes.obligations().filter(row => row.kind === "literal-admission" && row.site === literal).length, 1);
});

test("a recursive alias definition closes at the same declaration and arguments without expanding the inner reference", () => {
  const current = fixture("type Tree = number | readonly Tree[]; declare const retained: Tree;");
  const alias = current.defaults.nodes.find(node => current.source.ast.is.IsTypeAliasDeclaration(node));
  const type = current.defaults.context.describe(current.declaration("retained"));
  assert.equal(type?.kind === "declared" && type.declaration === alias && type.definition?.kind === "union", true);
  if (type?.kind !== "declared" || type.definition?.kind !== "union") throw new Error("The complete recursive alias body is required.");
  assert.equal(type.typeArguments.length, 0);
  assert.equal(type.definition.types.some(member => member.kind === "primitive" && member.primitive === "float64"), true);
  const array = type.definition.types.find(member => member.kind === "array");
  assert.equal(array?.kind === "array" && array.readonly && array.element.kind === "declared", true);
  if (array?.kind !== "array" || array.element.kind !== "declared") throw new Error("The recursive array reference is required.");
  assert.equal(array.element.declaration === alias && array.element.typeArguments.length === 0 && array.element.definition === undefined, true);
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("a mapped Record index retains its real mapped origin and substituted primitive width", () => {
  const current = fixture("const retained: Record<string, int32> = { count: 1 };");
  const type = current.defaults.context.describe(current.declaration("retained"));
  assert.equal(type?.kind === "declared" && type.definition?.kind === "shape" && type.indexes.length === 1, true);
  if (type?.kind !== "declared" || type.definition?.kind !== "shape") throw new Error("The resolved Record alias body is required.");
  const origin = current.source.ast.typeNode(type.declaration);
  assert.equal(origin !== undefined && current.source.ast.is.IsMappedTypeNode(origin), true);
  assert.equal(type.indexes[0]?.declaration === origin && type.definition.indexes[0]?.declaration === origin, true);
  assertSameValue(type.typeArguments, [{ kind: "string" }, { kind: "primitive", primitive: "int32" }]);
  assertSameValue(type.indexes[0]?.key, { kind: "string" });
  assertSameValue(type.indexes[0]?.value, { kind: "primitive", primitive: "int32" });
  assert.equal(type.indexes[0]?.readonly, false);
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("class and interface indexes retain their exact declaration and readonly metadata", () => {
  const current = fixture("interface Values { readonly [key: string]: int32; } declare const retained: Values;");
  const type = current.defaults.context.describe(current.declaration("retained"));
  const declaration = current.defaults.nodes.find(node => current.source.ast.is.IsInterfaceDeclaration(node));
  const index = current.defaults.nodes.find(node => current.source.ast.is.IsIndexSignatureDeclaration(node));
  assert.equal(type?.kind === "declared" && type.declaration === declaration && type.indexes.length === 1, true);
  if (type?.kind !== "declared") throw new Error("The declared interface is required.");
  assert.equal(type.definition === undefined && type.indexes[0]?.declaration === index && type.indexes[0]?.readonly === true, true);
  assertSameValue(type.indexes[0]?.key, { kind: "string" });
  assertSameValue(type.indexes[0]?.value, { kind: "primitive", primitive: "int32" });
});

function assertSameValue(actual: unknown, expected: unknown): void {
  assert.equal(isDeepStrictEqual(actual, expected), true, "exact source descriptor equality");
}
