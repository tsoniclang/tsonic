import assert from "node:assert/strict";
import test from "node:test";
import { isDeepStrictEqual } from "node:util";
import { createCompilerSessionFromFiles, createSourceSemanticsExtension, sourcePrimitive, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../target-source-program.js";
import { createSourceTypeFlowAnalysisContext, sourceTypeFlowIntegerFits } from "./defaults.js";
import { TargetCompilerResourceLimitFailure } from "../../artifacts.js";
import { sourceTypeExpansionBudget } from "../type-expansion-budget.js";
import type { SourceTypeDescriptorMember } from "./types.js";

function fixture(text: string, noImplicitAny = true) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/node_modules/@test/words/package.json": JSON.stringify({ name: "@test/words", version: "1.0.0", type: "module", exports: { ".": "./index.d.ts" } }),
    "/src/node_modules/@test/words/index.d.ts": "export type int32 = number; export type float32 = number;",
    "/src/index.ts": `import type { int32, float32 } from "@test/words"; ${text}`,
  }, compilerOptions: { strict: true, noImplicitAny, target: "es2022", module: "esnext", moduleResolution: "bundler" },
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

test("declared tuples retain every finite position, named origin and optional or rest kind", () => {
  const current = fixture(`declare const one: readonly [int32]; declare const three: [int32, float32, number];
    declare const named: readonly [head: int32, tail?: float32, ...rest: number[]];`);
  const one = current.defaults.context.describe(current.declaration("one"));
  const three = current.defaults.context.describe(current.declaration("three"));
  const named = current.defaults.context.describe(current.declaration("named"));
  assert.equal(one?.kind === "tuple" && one.readonly && one.elements.length === 1 &&
    one.elements[0]?.kind === "required" && one.elements[0].type.kind === "primitive" &&
    one.elements[0].type.primitive === "int32", true);
  assert.equal(three?.kind === "tuple" && !three.readonly && three.elements.length === 3 &&
    three.elements.every(element => element.kind === "required") &&
    three.elements[2]?.type.kind === "primitive" && three.elements[2].type.primitive === "float64", true);
  assert.equal(named?.kind === "tuple" && named.readonly && named.elements.length === 3 &&
    named.elements[0]?.kind === "required" && named.elements[1]?.kind === "optional" && named.elements[2]?.kind === "rest", true);
  if (named?.kind !== "tuple") throw new Error("The actual named tuple descriptor is required.");
  assert.equal(named.elements.every(element => element.declaration !== undefined &&
    current.source.ast.is.IsNamedTupleMember(element.declaration)), true, "named tuple origins are the actual checked member nodes");
  assert.equal(named.elements[1]?.type.kind === "optional" && named.elements[1].type.value.kind === "primitive" &&
    named.elements[1].type.value.primitive === "float32", true);
  assert.equal(named.elements[2]?.type.kind === "primitive" && named.elements[2].type.primitive === "float64", true);
});

test("ordinary member origins retain fields, methods and read or write accessor declarations", () => {
  const current = fixture(`class Members {
    readonly field: int32 = 1;
    method(value: int32): int32 { return value; }
    get getter(): int32 { return 1; }
    set setter(next: int32) { void next; }
    get paired(): int32 { return 1; }
    set paired(next: int32) { void next; }
  } declare const selected: Members;`);
  const type = current.defaults.context.describe(current.declaration("selected"));
  assert.equal(type?.kind === "declared" && type.definition?.kind === "shape", true);
  if (type?.kind !== "declared" || type.definition?.kind !== "shape") throw new Error("The complete declared member shape is required.");
  const { ast } = current.source;
  for (const [name, kind] of [["field", "KindPropertyDeclaration"], ["method", "KindMethodDeclaration"],
    ["getter", "KindGetAccessor"], ["setter", "KindSetAccessor"], ["paired", "KindGetAccessor"]]) {
    const member: SourceTypeDescriptorMember | undefined = type.definition.members.find(candidate => candidate.name === name);
    const declaration: Node | undefined = ast.members(type.declaration).find(candidate => candidate !== undefined &&
      ast.kindName(candidate) === kind && ast.text(ast.name(candidate)) === name);
    assert.equal(declaration !== undefined && member?.origin.kind === "declared" && member.origin.declaration === declaration, true, name);
    if (name === "method") {
      assert.equal(member?.type.kind === "callable" && member.type.calls.length === 1 &&
        member.type.calls[0]?.result.kind === "primitive" && member.type.calls[0].result.primitive === "int32", true, name);
    } else {
      assert.equal(member?.type.kind === "primitive" && member.type.primitive === "int32", true, name);
    }
  }
  assert.equal(type.definition.members.find(member => member.name === "field")?.readonly, true);
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("declared structures have no open-inference depth limit", () => {
  const current = fixture("declare const deep: { a: { b: { c: { d: { e: int32 } } } } };");
  let selected = current.defaults.context.describe(current.declaration("deep"));
  for (const name of ["a", "b", "c", "d", "e"]) {
    assert.equal(selected?.kind === "shape", true, "each finite authored structural level remains described");
    if (selected?.kind !== "shape") throw new Error("The actual declared structural level is required.");
    const member = selected.members.find(member => member.name === name);
    assert.equal(member?.origin.kind === "declared" && current.source.ast.is.IsPropertySignatureDeclaration(member.origin.declaration), true);
    selected = member?.type;
  }
  assert.equal(selected?.kind === "primitive" && selected.primitive === "int32", true);
});

test("symbol indexes and inline mapped indexes retain their actual checked origins", () => {
  const current = fixture(`declare const symbols: { readonly [key: symbol]: int32 };
    declare const mapped: { readonly [Key in string]: float32 };`);
  for (const [name, origin, primitive] of [["symbols", "index", "int32"], ["mapped", "mapped", "float32"]] as const) {
    const selected = current.defaults.context.describe(current.declaration(name));
    assert.equal(selected?.kind === "shape" && selected.indexes.length === 1, true);
    if (selected?.kind !== "shape") throw new Error("The actual declared index shape is required.");
    const index = selected.indexes[0];
    assert.equal(index !== undefined && index.readonly && (origin === "index"
      ? current.source.ast.is.IsIndexSignatureDeclaration(index.declaration)
      : current.source.ast.is.IsMappedTypeNode(index.declaration)), true);
    assert.equal(index?.value.kind === "primitive" && index.value.primitive === primitive, true);
    assert.equal(origin === "index" ? index?.key.kind === "intrinsic" && index.key.intrinsic === "symbol"
      : index?.key.kind === "string", true);
  }
});

test("an unannotated self-dependent callable has one precise return-annotation refusal", () => {
  const current = fixture("function recursive() { return recursive; }", false);
  const returned = current.defaults.nodes.find(node => current.source.ast.is.IsReturnStatement(node));
  const value = returned === undefined ? undefined : current.source.ast.as.AsReturnStatement(returned)?.Expression;
  const issues = current.source.effectiveTypes.refusals();
  assert.equal(issues.length, 1);
  assert.equal(value !== undefined && issues[0]?.site === value && issues[0]?.code === "TSONIC_LOCAL_TYPE_SIGNATURE" &&
    issues[0].reason === "This unannotated callable return depends on itself. Annotate the return type.", true);
  assert.equal(value !== undefined && current.source.effectiveTypes.get(value) === issues[0], true,
    "the actual return expression carries the same canonical first cause");
});

test("C2284 finite mapped members retain their exact checked declaration tuple for the origin ruling", () => {
  const current = fixture('type Flags = { [Key in "left" | "right"]: number }; declare const flags: Flags;');
  const declaration = current.declaration("flags");
  const queries = current.source.semantics.forNode(declaration);
  const selected = queries.declarations.declaredValueType(declaration);
  const mapped = current.defaults.nodes.find(node => current.source.ast.is.IsMappedTypeNode(node));
  assert.equal(selected !== undefined && mapped !== undefined, true, "the actual checked mapped type and value are retained");
  if (selected === undefined || mapped === undefined) throw new Error("The original checked mapped type is required.");
  const members = queries.types.propertyInfos(selected);
  assert.equal(members.length, 2, "both finite authored keys are observed without an invented member origin");
});

test("one canonical structural form carries all member, index, call and construct inventories", () => {
  const current = fixture(`interface Factory { readonly prototype: object; new(): object }
    interface Empty {}
    interface IndexedCallable { [name: string]: unknown; (value: number): number }
    type Callback = (value: number) => number; type Construct = new() => object;
    type FunctionObject = { (value: number): number; count: number };
    declare const factory: Factory; declare const empty: Empty; declare const indexed: IndexedCallable;
    declare const callback: Callback; declare const construct: Construct; declare const functionObject: FunctionObject;`);
  for (const [name, form, calls, constructs, members, indexes] of [
    ["factory", "shape", 0, 1, 1, 0], ["empty", "shape", 0, 0, 0, 0],
    ["indexed", "shape", 1, 0, 0, 1], ["callback", "callable", 1, 0, 0, 0],
    ["construct", "callable", 0, 1, 0, 0], ["functionObject", "shape", 1, 0, 1, 0],
  ] as const) {
    let type = current.defaults.context.describe(current.declaration(name));
    if (type?.kind === "declared") {
      assert.equal(type.definition !== undefined && !("members" in type) && !("indexes" in type), true, name);
      type = type.definition;
    }
    assert.equal(type?.kind, form, name);
    if (type?.kind !== "shape" && type?.kind !== "callable") continue;
    assert.equal(type.calls.length, calls, name);
    assert.equal(type.constructs.length, constructs, name);
    if (type.kind === "shape") {
      assert.equal(type.members.length, members, name);
      assert.equal(type.indexes.length, indexes, name);
    }
  }
});

test("nominal recursion cuts by declaration identity even when its actual arguments expand", () => {
  const current = fixture("interface Nest<Value> { child: Nest<Value[]> } declare const value: Nest<number>;");
  const type = current.defaults.context.describe(current.declaration("value"));
  assert.equal(type?.kind === "declared" && type.definition?.kind === "shape", true);
  if (type?.kind !== "declared" || type.definition?.kind !== "shape") throw new Error("The actual complete nominal definition is required.");
  const child = type.definition.members[0]?.type;
  assert.equal(child?.kind === "declared" && child.declaration === type.declaration && child.definition === undefined &&
    child.typeArguments.length === 1 && child.typeArguments[0]?.kind === "array" &&
    child.typeArguments[0].element.kind === "primitive" && child.typeArguments[0].element.primitive === "float64", true);
});

test("expanding alias recursion uses the shared declared resource budget rather than a silent cut", () => {
  assert.throws(() => fixture("type Nest<Value> = { child: Nest<Value[]> }; declare const value: Nest<number>;"),
    (failure: unknown) => failure instanceof TargetCompilerResourceLimitFailure &&
      failure.diagnostic.code === "TSONIC_COMPILER_RESOURCE_LIMIT" && failure.diagnostic.sourceNode !== undefined &&
      failure.diagnostic.evidence?.includes(`depth=${sourceTypeExpansionBudget.depth}`) === true);
});

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
    elements: [{ kind: "required", type: { kind: "primitive", primitive: "int32" } },
      { kind: "required", type: { kind: "primitive", primitive: "float32" } }] });
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
      node !== current.source.ast.name(declaration) &&
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
    elements: [{ kind: "required", type: { kind: "primitive", primitive: "int32" } },
      { kind: "required", type: { kind: "primitive", primitive: "float32" } }] });
  assert.equal(source.semantics.includes(native), false);
  assert.equal(source.sourceFiles.length, 1);
  assert.equal(type.members.every(member => member.origin.kind === "declared" &&
    source.ast.getSourceFile(member.origin.declaration) === native), true);
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
      value: { kind: "primitive", primitive: "float64" }, readonly: false }], calls: [], constructs: [] }]] as const) {
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

test("declared index aliases retain the actual signature only in their resolved definition", () => {
  const current = fixture("type Indexed = { [name: string]: number }; const data: Indexed = { value: 1 };");
  const alias = current.defaults.nodes.find(node => current.source.ast.is.IsTypeAliasDeclaration(node));
  const index = current.defaults.nodes.find(node => current.source.ast.is.IsIndexSignatureDeclaration(node));
  const type = current.defaults.context.describe(current.declaration("data"));
  assert.equal(alias !== undefined && index !== undefined && type?.kind === "declared", true);
  if (type?.kind !== "declared") throw new Error("The nominal index alias is required.");
  assert.equal(type.declaration === alias && !("members" in type) && !("indexes" in type), true);
  assert.equal(type.definition?.kind === "shape", true);
  if (type.definition?.kind !== "shape") throw new Error("The Host-resolved alias body is required.");
  assert.equal(type.definition.indexes[0]?.declaration === index && type.definition.indexes[0]?.readonly === false, true);
  assertSameValue(type.definition.indexes[0]?.key, { kind: "string" });
  assertSameValue(type.definition.indexes[0]?.value, { kind: "primitive", primitive: "float64" });
  assert.equal(type.definition.members.length === 0 && type.definition.indexes.length === 1, true);
  assert.equal(type.definition.calls.length === 0 && type.definition.constructs.length === 0, true);
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
  assert.equal(type?.kind === "declared" && type.definition?.kind === "shape" && type.definition.indexes.length === 1, true);
  if (type?.kind !== "declared" || type.definition?.kind !== "shape") throw new Error("The resolved Record alias body is required.");
  const origin = current.source.ast.typeNode(type.declaration);
  assert.equal(origin !== undefined && current.source.ast.is.IsMappedTypeNode(origin), true);
  assert.equal(type.definition.indexes[0]?.declaration === origin && !("members" in type) && !("indexes" in type), true);
  assertSameValue(type.typeArguments, [{ kind: "string" }, { kind: "primitive", primitive: "int32" }]);
  assertSameValue(type.definition.indexes[0]?.key, { kind: "string" });
  assertSameValue(type.definition.indexes[0]?.value, { kind: "primitive", primitive: "int32" });
  assert.equal(type.definition.indexes[0]?.readonly, false);
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("class and interface indexes retain their exact declaration and readonly metadata", () => {
  const current = fixture("interface Values { readonly [key: string]: int32; } declare const retained: Values;");
  const type = current.defaults.context.describe(current.declaration("retained"));
  const declaration = current.defaults.nodes.find(node => current.source.ast.is.IsInterfaceDeclaration(node));
  const index = current.defaults.nodes.find(node => current.source.ast.is.IsIndexSignatureDeclaration(node));
  assert.equal(type?.kind === "declared" && type.declaration === declaration &&
    type.definition?.kind === "shape" && type.definition.indexes.length === 1, true);
  if (type?.kind !== "declared" || type.definition?.kind !== "shape") throw new Error("The declared interface definition is required.");
  assert.equal(type.definition.indexes[0]?.declaration === index && type.definition.indexes[0]?.readonly === true &&
    !("members" in type) && !("indexes" in type), true);
  assertSameValue(type.definition.indexes[0]?.key, { kind: "string" });
  assertSameValue(type.definition.indexes[0]?.value, { kind: "primitive", primitive: "int32" });
});

function assertSameValue(actual: unknown, expected: unknown): void {
  assert.equal(isDeepStrictEqual(actual, expected), true, "exact source descriptor equality");
}

test("declared definitions have one canonical member and signature inventory", () => {
  const current = fixture(`interface Factory { readonly prototype: object; new(): object; }
    interface CallableObject { readonly tag: string; (value: int32): int32; }
    declare const factory: Factory; declare const callableObject: CallableObject;
    declare const callback: (value: int32) => int32; declare const constructor: new() => object;
    declare const empty: {};`);
  for (const [name, members, calls, constructs] of [["factory", 1, 0, 1], ["callableObject", 1, 1, 0]] as const) {
    const type = current.defaults.context.describe(current.declaration(name));
    assert.equal(type?.kind === "declared" && type.definition?.kind === "shape", true, name);
    if (type?.kind !== "declared" || type.definition?.kind !== "shape") throw new Error("The complete declared definition is required.");
    assert.equal(type.definition.members.length, members, name);
    assert.equal(type.definition.indexes.length, 0, name);
    assert.equal(type.definition.calls.length, calls, name);
    assert.equal(type.definition.constructs.length, constructs, name);
    assert.equal(type.definition.members.every(member => member.origin.kind === "declared"), true, name);
    assert.equal("members" in type || "indexes" in type, false, "nominal references have no duplicate structural inventory");
  }
  for (const [name, calls, constructs] of [["callback", 1, 0], ["constructor", 0, 1]] as const) {
    const type = current.defaults.context.describe(current.declaration(name));
    assert.equal(type?.kind === "callable" && type.calls.length === calls && type.constructs.length === constructs, true, name);
  }
  const empty = current.defaults.context.describe(current.declaration("empty"));
  assert.equal(empty?.kind === "shape" && empty.members.length === 0 && empty.indexes.length === 0 &&
    empty.calls.length === 0 && empty.constructs.length === 0, true, "an empty structure is a shape, never a signature-only callable");
});

test("nominal expanding recursion cuts by declaration identity while alias expansion uses the shared resource budget", () => {
  const current = fixture("interface Nest<Value> { child: Nest<Value[]> } declare const nested: Nest<int32>;");
  const type = current.defaults.context.describe(current.declaration("nested"));
  assert.equal(type?.kind === "declared" && type.definition?.kind === "shape", true);
  if (type?.kind !== "declared" || type.definition?.kind !== "shape") throw new Error("The actual nominal definition is required.");
  const child = type.definition.members[0]?.type;
  assert.equal(child?.kind === "declared" && child.declaration === type.declaration && child.definition === undefined &&
    child.typeArguments[0]?.kind === "array" && child.typeArguments[0].element.kind === "primitive" &&
    child.typeArguments[0].element.primitive === "int32", true, "the recursive reference keeps its substituted arguments and no second definition");
  assert.throws(() => fixture("type Expanding<Value> = { child: Expanding<Value[]> }; declare const expanded: Expanding<int32>;"),
    error => error instanceof TargetCompilerResourceLimitFailure && error.diagnostic.code === "TSONIC_COMPILER_RESOURCE_LIMIT" &&
      error.diagnostic.sourceNode !== undefined && error.message.includes(`depth=${sourceTypeExpansionBudget.depth}`),
  "expanding aliases use the existing shared-budget resource failure at their declared site");
});

test("nominal definitions retain all structure once and cut recursive references by declaration and arguments", () => {
  const current = fixture(`interface Link<Value> { value: Value; next?: Link<Value>; }
    interface Empty {} declare const retained: Link<int32>; declare const empty: Empty;`);
  const type = current.defaults.context.describe(current.declaration("retained"));
  const empty = current.defaults.context.describe(current.declaration("empty"));
  assert.equal(type?.kind === "declared" && type.definition?.kind === "shape", true);
  if (type?.kind !== "declared" || type.definition?.kind !== "shape") throw new Error("The complete nominal structure is required.");
  assert.equal("members" in type || "indexes" in type, false, "a nominal reference never duplicates its definition's structure");
  assert.equal(type.typeArguments[0]?.kind === "primitive" && type.typeArguments[0].primitive === "int32", true);
  const value = type.definition.members.find(member => member.name === "value");
  assert.equal(value?.type.kind === "primitive" && value.type.primitive === "int32", true);
  const next = type.definition.members.find(member => member.name === "next");
  assert.equal(next?.optional === true && next.type.kind === "optional" && next.type.value.kind === "declared", true);
  if (next?.type.kind !== "optional" || next.type.value.kind !== "declared") throw new Error("The actual recursive reference is required.");
  assert.equal(next.type.value.declaration === type.declaration && next.type.value.definition === undefined, true);
  assertSameValue(next.type.value.typeArguments, type.typeArguments);
  assert.equal(empty?.kind === "declared" && empty.definition?.kind === "shape" &&
    empty.definition.members.length === 0 && empty.definition.indexes.length === 0, true,
    "an empty definition remains distinguishable from a recursive reference");
});

test("K-2446 an overloaded member merged across declarations is identified by its symbol's first declaration", () => {
  const current = fixture(`interface Merged { run(value: int32): int32; run(value: string): string; }
    interface Merged { run(value: boolean): boolean; }
    declare const merged: Merged;`);
  const { ast } = current.source;
  const type = current.defaults.context.describe(current.declaration("merged"));
  const structure = type?.kind === "declared" ? type.definition : type;
  assert.equal(structure?.kind === "shape", true);
  if (structure?.kind !== "shape") return;
  const member = structure.members.find(candidate => candidate.name === "run");
  const first = current.defaults.nodes.find(node => ast.is.IsMethodSignatureDeclaration(node) && ast.text(ast.name(node)) === "run");
  assert.equal(member?.origin.kind === "declared" && member.origin.declaration === first, true,
    "one checked logical member keeps the first entry of its own checker declaration vector");
});

test("K-2446 an intersection of distinct same-named members has no single declared origin and is not described", () => {
  const current = fixture(`declare const both: { a: int32 } & { a: string };`);
  assert.equal(current.defaults.context.describe(current.declaration("both")), undefined,
    "several root symbols are not one logical member; no root is chosen");
});
