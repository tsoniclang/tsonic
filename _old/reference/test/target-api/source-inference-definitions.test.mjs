import assert from "node:assert/strict";
import test from "node:test";
import { sourceTypeFlowFixture as fixture } from "./fixtures/source-type-flow-fixture.mjs";

function resolved(result, label) {
  assert.equal(result.kind, "resolved", result.kind === "refused" ? `${label}: ${result.message}` : label);
  return result.value;
}

function definition(current, value) {
  return resolved(current.source.facts.descriptors.definition(value), "the original definition resolves");
}

function component(current, value, selector) {
  return resolved(current.source.facts.descriptors.component(value, selector), `the original ${selector.kind} child resolves`);
}

function member(current, value, name) {
  assert.equal(value.type.kind, "shape");
  const selected = value.type.members.find(candidate => candidate.name === name);
  assert.equal(selected !== undefined, true, `the original member ${name} is retained`);
  return { metadata: selected, value: component(current, value, { kind: "member", origin: selected.origin }) };
}

test("a closed foreign conditional alias publishes its exact primitive result inside a project interface", () => {
  const current = fixture(`interface Local { read(value: int32): Awaited<Promise<int32>>; }
    declare const local: Local;
    export function run(): void { const alias = local; void alias; }`);
  const original = current.slot("local");
  assert.equal(original.type.kind, "declared");
  const body = definition(current, original);
  const callable = definition(current, member(current, body, "read").value);
  assert.equal(callable.type.kind, "callable");
  assert.equal(callable.type.calls.length, 1);
  const result = definition(current, component(current, callable,
    { kind: "result", signature: callable.type.calls[0].identity }));
  assert.equal(result.type.kind === "primitive" && result.type.primitive === "int32", true,
    "the original Awaited result keeps its authored int32 width");
  assert.equal(current.source.facts.refusals().length, 0);
});

test("normalized mapped union bodies do not reopen their own alias on an object constituent", () => {
  for (const alias of [false, true]) {
    const current = fixture(`type Input = readonly (string | float32)[] | { readonly marker: string; readonly value: float32 };
      type Locked<Value> = { readonly [Key in keyof Value]: Value[Key] };
      type Result = Locked<Input>;
      declare const selected: ${alias ? "Result" : "Locked<Input>"};`);
    const body = definition(current, current.slot("selected"));
    assert.equal(body.type.kind === "union" && body.type.types.length === 2 && body.sum !== undefined, true,
      `the same mapped application retains both alternatives, alias=${alias}`);
    const alternatives = body.sum.arms.map(value => definition(current, value));
    const array = alternatives.find(value => value.type.kind === "array");
    const object = alternatives.find(value => value.type.kind === "shape");
    assert.equal(array !== undefined && object !== undefined, true);
    const selected = member(current, object, "value");
    assert.equal(array.type.readonly && selected.metadata.readonly && selected.metadata.origin.kind === "declared" &&
      selected.value.type.kind === "primitive" && selected.value.type.primitive === "float32", true,
    `both original constituent forms, widths and member origins survive, alias=${alias}`);
    assert.equal(alternatives.some(value => value.type.kind === "declared"), false,
      "a completed mapped constituent is not a recursive reference to its enclosing alias");
  }
});

test("normalized mapped definitions exclude all enclosing alias metadata but retain genuine member recursion", () => {
  const current = fixture(`type Input = readonly (string | float32)[] | { readonly value: float32 };
    type Locked<Value> = { readonly [Key in keyof Value]: Value[Key] };
    type First = Locked<Input>; type Second = First; type Third = Second;
    type Link<Value> = { value: Value; next?: Link<Value> };
    declare const selected: Third; declare const recursive: Link<float32>;`);
  const body = definition(current, current.slot("selected"));
  assert.equal(body.type.kind === "union" && body.type.types.length === 2 && body.sum !== undefined, true);
  assert.equal(body.sum.arms.every(value => {
    const selected = definition(current, value).type;
    return selected.kind === "array" || selected.kind === "shape";
  }), true, "completed aliases do not reenter their enclosing normalization chain");
  const recursive = current.slot("recursive");
  assert.equal(recursive.type.kind, "declared");
  const next = member(current, definition(current, recursive), "next").value;
  const target = next.type.kind === "optional" ? component(current, next, { kind: "optional-value" }) : next;
  assert.equal(target.type.kind === "declared" && target.type.declaration === recursive.type.declaration, true,
    "the original recursive member retains its real nominal identity");
});

test("generic recursive aliases publish their original exact template separately from concrete occurrences", () => {
  const current = fixture(`type Tree<Value> = Value | readonly Tree<Value>[];
    declare const selected: Tree<float32>;`);
  const { ast, facts } = current.source;
  const declaration = current.nodes.find(node => ast.is.IsTypeAliasDeclaration(node) && ast.text(ast.name(node)) === "Tree");
  assert.equal(declaration !== undefined, true);
  const parameter = ast.typeParameters(declaration)[0];
  const template = resolved(facts.values.declaredSlot(declaration), "the original Tree declaration resolves").type;
  const concrete = current.slot("selected");
  assert.equal(template.type.kind === "declared" && template.type.declaration === declaration &&
    template.type.typeArguments.length === 1, true);
  const templateArgument = component(current, template, { kind: "type-argument", declaration, index: 0 });
  assert.equal(templateArgument.type.kind === "parameter" && templateArgument.type.declaration === parameter &&
    definition(current, template).type.kind === "union", true,
  "the declaration retains its complete generic definition and original binder");
  assert.equal(concrete.type.kind === "declared" && concrete.type.declaration === declaration, true);
  const actualArgument = component(current, concrete, { kind: "type-argument", declaration, index: 0 });
  assert.equal(actualArgument.type.kind === "primitive" && actualArgument.type.primitive === "float32", true,
    "the concrete occurrence never replaces the declaration's template parameter");
  assert.equal(current.source.facts.refusals().length, 0);
});

test("checked conditional aliases preserve distinct parameter and result widths through exact infer binders", () => {
  for (const reverse of [false, true]) {
    const declarations = [
      "type Callback = (value: float32, optional?: int32) => int32;",
      "type Arguments = Parameters<Callback>;",
      "type Result = ReturnType<Callback>;",
      "type Capture<Value> = Value extends (...arguments_: infer Parameters) => infer Result ? { arguments_: Parameters; result: Result } : never;",
    ];
    const current = fixture(`${(reverse ? declarations.reverse() : declarations).join("\n")}
      declare const arguments_: Arguments; declare const result: Result; declare const captured: Capture<Callback>;`);
    const tuple = definition(current, current.slot("arguments_"));
    const result = definition(current, current.slot("result"));
    const captured = definition(current, current.slot("captured"));
    assert.equal(tuple.type.kind === "tuple" && tuple.type.elements.length === 2, true);
    const first = component(current, tuple, { kind: "tuple-element", index: 0 });
    const second = component(current, tuple, { kind: "tuple-element", index: 1 });
    assert.equal(first.type.kind === "primitive" && first.type.primitive === "float32", true);
    assert.equal(tuple.type.elements[1].kind === "optional" && second.type.kind === "optional", true);
    const payload = component(current, second, { kind: "optional-value" });
    assert.equal(payload.type.kind === "primitive" && payload.type.primitive === "int32", true);
    assert.equal(tuple.type.elements.every(element => element.declaration !== undefined &&
      current.source.ast.is.IsParameterDeclaration(element.declaration)), true,
    "each inferred tuple child retains its actual authored formal declaration");
    assert.equal(result.type.kind === "primitive" && result.type.primitive === "int32", true,
      "the result does not choose the checker-identical parameter's float32 width");
    assert.equal(definition(current, member(current, captured, "arguments_").value).type.kind, "tuple");
    const returned = definition(current, member(current, captured, "result").value);
    assert.equal(returned.type.kind === "primitive" && returned.type.primitive === "int32", true);
    assert.equal(current.source.facts.refusals().length, 0);
  }
});

test("nested checked conditional steps retain an outer infer binding by its exact selected scope", () => {
  const current = fixture(`interface Box<Value> { value: Value; }
    type Inner<Value> = Value extends Box<infer Element> ? (Element extends int32 ? Element : never) : never;
    declare const selected: Inner<Box<int32>>;`);
  const { ast, facts } = current.source;
  const declaration = current.nodes.find(node => ast.is.IsTypeAliasDeclaration(node) && ast.text(ast.name(node)) === "Inner");
  const inferred = current.nodes.find(node => ast.is.IsTypeParameterDeclaration(node) && ast.text(ast.name(node)) === "Element");
  assert.equal(declaration !== undefined && inferred !== undefined, true);
  const original = current.slot("selected");
  assert.equal(original.type.kind === "declared" && original.type.declaration === declaration, true);
  const selected = definition(current, original);
  assert.equal(selected.type.kind === "primitive" && selected.type.primitive === "int32", true,
    "the original outer infer binding survives the nested selected conditional");
  assert.equal(facts.descriptors.freeParameters(selected).some(parameter => parameter.declaration === inferred), false,
    "the closed selected branch has consumed the same original infer binder");
  assert.equal(facts.refusals().length, 0);
});

test("normalised intersection aliases preserve the underlying nominal declaration instead of a false self-recursion cut", () => {
  const current = fixture(`class Failure { readonly code: int32 = 1; }
    type Maybe = Failure | null | undefined;
    type Present = NonNullable<Maybe>;
    declare const selected: Present;`);
  const { ast } = current.source;
  const failure = current.nodes.find(node => ast.is.IsClassDeclaration(node) && ast.text(ast.name(node)) === "Failure");
  assert.equal(failure !== undefined, true);
  let selected = current.slot("selected");
  const visited = new Set();
  while (selected.type.kind === "declared" && selected.type.declaration !== failure || selected.type.kind === "intersection") {
    assert.equal(visited.has(selected), false, "normalization does not manufacture a recursive alias cut");
    visited.add(selected);
    selected = definition(current, selected);
  }
  assert.equal(selected.type.kind === "declared" && selected.type.declaration === failure, true,
    "the underlying original Failure identity survives NonNullable");
  const code = member(current, definition(current, selected), "code");
  assert.equal(code.metadata.readonly && code.metadata.origin.kind === "declared" &&
    code.value.type.kind === "primitive" && code.value.type.primitive === "int32", true);
  assert.equal(current.source.facts.refusals().length, 0);
});

test("declared structures have no open-inference depth limit", () => {
  const current = fixture("declare const deep: { a: { b: { c: { d: { e: int32 } } } } };");
  let selected = current.slot("deep");
  for (const name of ["a", "b", "c", "d", "e"]) {
    const field = member(current, definition(current, selected), name);
    assert.equal(field.metadata.origin.kind === "declared" &&
      current.source.ast.is.IsPropertySignatureDeclaration(field.metadata.origin.declaration), true);
    selected = field.value;
  }
  assert.equal(selected.type.kind === "primitive" && selected.type.primitive === "int32", true);
});

test("symbol indexes and inline mapped indexes retain their actual checked origins", () => {
  const current = fixture(`declare const symbols: { readonly [key: symbol]: int32 };
    declare const mapped: { readonly [Key in string]: float32 };`);
  for (const [name, origin, primitive] of [["symbols", "index", "int32"], ["mapped", "mapped", "float32"]]) {
    const selected = definition(current, current.slot(name));
    assert.equal(selected.type.kind === "shape" && selected.type.indexes.length === 1, true);
    const index = selected.type.indexes[0];
    assert.equal(index.readonly && (origin === "index"
      ? current.source.ast.is.IsIndexSignatureDeclaration(index.declaration)
      : current.source.ast.is.IsMappedTypeNode(index.declaration)), true);
    const key = component(current, selected, { kind: "index-key", declaration: index.declaration });
    const value = component(current, selected, { kind: "index-value", declaration: index.declaration });
    assert.equal(value.type.kind === "primitive" && value.type.primitive === primitive, true);
    assert.equal(origin === "index" ? key.type.kind === "intrinsic" && key.type.intrinsic === "symbol"
      : key.type.kind === "string", true);
  }
});

test("C2284 finite mapped members retain their exact checked declaration tuple for the origin ruling", () => {
  const current = fixture('type Flags = { [Key in "left" | "right"]: number }; declare const flags: Flags;');
  const mapped = current.nodes.find(node => current.source.ast.is.IsMappedTypeNode(node));
  assert.equal(mapped !== undefined, true);
  const selected = definition(current, current.slot("flags"));
  assert.equal(selected.type.kind === "shape" && selected.type.members.length === 2, true,
    "both original finite keys survive without an invented property declaration");
  assert.deepEqual(selected.type.members.map(member => member.name), ["left", "right"]);
  for (const metadata of selected.type.members) {
    assert.equal(metadata.origin.kind === "mapped" && metadata.origin.owner === mapped, true);
    assert.equal(component(current, selected, { kind: "member", origin: metadata.origin }).type === metadata.type, true);
  }
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
  ]) {
    const original = current.slot(name);
    if (original.type.kind === "declared") assert.equal("members" in original.type || "indexes" in original.type, false);
    const selected = definition(current, original);
    assert.equal(selected.type.kind, form, name);
    assert.equal(selected.type.calls.length, calls, name);
    assert.equal(selected.type.constructs.length, constructs, name);
    if (form === "shape") {
      assert.equal(selected.type.members.length, members, name);
      assert.equal(selected.type.indexes.length, indexes, name);
    }
  }
});

test("nominal recursion cuts by declaration identity even when its actual arguments expand", () => {
  const current = fixture("interface Nest<Value> { child: Nest<Value[]> } declare const nested: Nest<int32>;");
  const original = current.slot("nested");
  assert.equal(original.type.kind, "declared");
  const child = member(current, definition(current, original), "child").value;
  assert.equal(child.type.kind === "declared" && child.type.declaration === original.type.declaration &&
    child.type.typeArguments.length === 1 && !("definition" in child.type), true);
  const argument = component(current, child, { kind: "type-argument", declaration: child.type.declaration, index: 0 });
  assert.equal(argument.type.kind, "array");
  const element = component(current, argument, { kind: "array-element" });
  assert.equal(element.type.kind === "primitive" && element.type.primitive === "int32", true);
});

test("annotated unions and index signatures publish their declared type, never their initializer's narrower type", () => {
  const current = fixture("function run(): void { const value: number | string = 1; const dictionary: { [key: string]: number } = {}; }");
  const index = current.nodes.find(node => current.source.ast.is.IsIndexSignatureDeclaration(node));
  assert.equal(index !== undefined, true);
  const value = current.slot("value");
  assert.equal(value.type.kind === "union" && value.type.types.length === 2 && value.sum !== undefined, true);
  assert.equal(value.sum.arms.some(arm => arm.type.kind === "primitive" && arm.type.primitive === "float64") &&
    value.sum.arms.some(arm => arm.type.kind === "string"), true,
  "the original annotation retains both authored alternatives rather than the numeric initializer");
  const dictionary = definition(current, current.slot("dictionary"));
  assert.equal(dictionary.type.kind === "shape" && dictionary.type.members.length === 0 &&
    dictionary.type.indexes.length === 1 && dictionary.type.indexes[0].declaration === index &&
    !dictionary.type.indexes[0].readonly, true);
  assert.equal(component(current, dictionary, { kind: "index-key", declaration: index }).type.kind, "string");
  const indexed = component(current, dictionary, { kind: "index-value", declaration: index });
  assert.equal(indexed.type.kind === "primitive" && indexed.type.primitive === "float64", true);
  assert.equal(current.source.facts.refusals().length, 0);
});

test("declared index aliases retain the actual signature only in their resolved definition", () => {
  const current = fixture("type Indexed = { [name: string]: number }; const data: Indexed = { value: 1 };");
  const alias = current.nodes.find(node => current.source.ast.is.IsTypeAliasDeclaration(node));
  const index = current.nodes.find(node => current.source.ast.is.IsIndexSignatureDeclaration(node));
  const original = current.slot("data");
  assert.equal(alias !== undefined && index !== undefined && original.type.kind === "declared" &&
    original.type.declaration === alias && !("members" in original.type) && !("indexes" in original.type), true);
  const selected = definition(current, original);
  assert.equal(selected.type.kind === "shape" && selected.type.members.length === 0 && selected.type.indexes.length === 1 &&
    selected.type.calls.length === 0 && selected.type.constructs.length === 0, true);
  assert.equal(selected.type.indexes[0].declaration === index && !selected.type.indexes[0].readonly, true);
  assert.equal(component(current, selected, { kind: "index-key", declaration: index }).type.kind, "string");
  const value = component(current, selected, { kind: "index-value", declaration: index });
  assert.equal(value.type.kind === "primitive" && value.type.primitive === "float64", true);
  const literal = current.nodes.find(node => current.source.ast.is.IsObjectLiteralExpression(node));
  assert.equal(literal !== undefined, true);
  const construction = resolved(current.source.facts.values.construction(literal), "the original literal admission resolves");
  assert.equal(construction.kind === "present" && construction.value.occurrence === literal &&
    construction.value.destination.kind === "present" && construction.value.destination.value.kind === "direct" &&
    construction.value.destination.value.destination.applied.type === original.type, true,
  "the same literal carries its exact admitted authored index destination");
});

test("a recursive alias definition closes at the same declaration and arguments without expanding the inner reference", () => {
  const current = fixture("type Tree = number | readonly Tree[]; declare const retained: Tree;");
  const alias = current.nodes.find(node => current.source.ast.is.IsTypeAliasDeclaration(node));
  const original = current.slot("retained");
  assert.equal(original.type.kind === "declared" && original.type.declaration === alias && original.type.typeArguments.length === 0, true);
  const body = definition(current, original);
  assert.equal(body.type.kind === "union" && body.sum !== undefined, true);
  assert.equal(body.sum.arms.some(value => value.type.kind === "primitive" && value.type.primitive === "float64"), true);
  const array = body.sum.arms.find(value => value.type.kind === "array");
  assert.equal(array !== undefined && array.type.readonly, true);
  const element = component(current, array, { kind: "array-element" });
  assert.equal(element.type.kind === "declared" && element.type.declaration === alias &&
    element.type.typeArguments.length === 0 && !("definition" in element.type), true);
  assert.equal(current.source.facts.refusals().length, 0);
});

test("a mapped Record index retains its real mapped origin and substituted primitive width", () => {
  const current = fixture("const retained: Record<string, int32> = { count: 1 };");
  const original = current.slot("retained");
  assert.equal(original.type.kind, "declared");
  const selected = definition(current, original);
  assert.equal(selected.type.kind === "shape" && selected.type.indexes.length === 1, true);
  const origin = current.source.ast.typeNode(original.type.declaration);
  assert.equal(origin !== undefined && current.source.ast.is.IsMappedTypeNode(origin) &&
    selected.type.indexes[0].declaration === origin && !selected.type.indexes[0].readonly, true);
  assert.equal(component(current, original,
    { kind: "type-argument", declaration: original.type.declaration, index: 0 }).type.kind, "string");
  const argument = component(current, original, { kind: "type-argument", declaration: original.type.declaration, index: 1 });
  assert.equal(argument.type.kind === "primitive" && argument.type.primitive === "int32", true);
  assert.equal(component(current, selected, { kind: "index-key", declaration: origin }).type.kind, "string");
  assert.equal(component(current, selected, { kind: "index-value", declaration: origin }).type === argument.type, true);
  assert.equal(current.source.facts.refusals().length, 0);
});

test("class and interface indexes retain their exact declaration and readonly metadata", () => {
  const current = fixture("interface Values { readonly [key: string]: int32; } declare const retained: Values;");
  const original = current.slot("retained");
  const declaration = current.nodes.find(node => current.source.ast.is.IsInterfaceDeclaration(node));
  const index = current.nodes.find(node => current.source.ast.is.IsIndexSignatureDeclaration(node));
  assert.equal(original.type.kind === "declared" && original.type.declaration === declaration &&
    !("members" in original.type) && !("indexes" in original.type), true);
  const selected = definition(current, original);
  assert.equal(selected.type.kind === "shape" && selected.type.indexes.length === 1 &&
    selected.type.indexes[0].declaration === index && selected.type.indexes[0].readonly, true);
  assert.equal(component(current, selected, { kind: "index-key", declaration: index }).type.kind, "string");
  const value = component(current, selected, { kind: "index-value", declaration: index });
  assert.equal(value.type.kind === "primitive" && value.type.primitive === "int32", true);
});
