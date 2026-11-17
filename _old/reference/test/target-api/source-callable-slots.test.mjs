import assert from "node:assert/strict";
import test from "node:test";
import { sourceTypeFlowFixture as fixture } from "./fixtures/source-type-flow-fixture.mjs";
import { createSourceTypeFlowTerms } from "../../packages/target-api/dist/source-semantics/local-type-flow/term-groups.js";


test("inferred local-class call results use the solved body and exact call binders before member reads", () => {
  for (const reversed of [false, true]) {
    const wrapper = `function wrap<Outer>(first: Outer) {
      class Local<Inner> { first: Outer; value: Inner;
        constructor(first: Outer, value: Inner) { this.first = first; this.value = value; } }
      return new Local<float32>(first, 1);
    }`;
    const consumer = `function run(first: int32): void {
      const result = wrap(first); const value = result.value; void value;
    }`;
    const current = fixture((reversed ? [consumer, wrapper] : [wrapper, consumer]).join("\n"));
    const { ast, facts } = current.source;
    const wrap = current.nodes.find(node => ast.is.IsFunctionDeclaration(node) && ast.text(ast.name(node)) === "wrap");
    const outer = wrap === undefined ? undefined : ast.typeParameters(wrap)[0];
    const call = current.nodes.find(node => ast.is.IsCallExpression(node) && ast.text(ast.as.AsCallExpression(node)?.Expression) === "wrap");
    assert.equal(wrap !== undefined && outer !== undefined && call !== undefined, true);
    const head = facts.values.type(wrap);
    assert.equal(head.kind, "resolved");
    const definition = facts.descriptors.definition(head.value);
    assert.equal(definition.kind, "resolved");
    assert.equal(definition.value.type.kind === "shape" || definition.value.type.kind === "callable", true);
    const signatures = definition.value.type.calls.filter(signature => signature.identity.declaration === wrap);
    assert.equal(signatures.length, 1, "the actual original body identity is retained");
    const body = facts.values.callableReturn(signatures[0].identity);
    assert.equal(body.kind, "resolved");
    assert.equal(body.value.type.kind === "declared" && body.value.type.typeArguments[0]?.kind === "parameter" &&
      body.value.type.typeArguments[0].declaration === outer && body.value.type.typeArguments[1]?.kind === "primitive" &&
      body.value.type.typeArguments[1].primitive === "float32", true, `original body template, reversed=${reversed}`);
    const result = facts.values.type(call);
    const application = facts.applications.application(call);
    assert.equal(result.kind === "resolved" && application.kind === "resolved", true);
    assert.equal(result.value.type.kind === "declared" && result.value.type.typeArguments[0]?.kind === "primitive" &&
      result.value.type.typeArguments[0].primitive === "int32" && result.value.type.typeArguments[1]?.kind === "primitive" &&
      result.value.type.typeArguments[1].primitive === "float32" && application.value.result === result.value, true,
    `one actual instantiated result, reversed=${reversed}`);
    const value = current.slot("value");
    assert.equal(value.type.kind === "primitive" && value.type.primitive === "float32", true,
      "dependent member groups consume the solved result, not a final-outcome overwrite");
    assert.equal(facts.refusals().length, 0);
  }
});

test("declared tuples retain every finite position, named origin and optional or rest kind", () => {
  const current = fixture(`declare const one: readonly [int32]; declare const three: [int32, float32, number];
    declare const named: readonly [head: int32, tail?: float32, ...rest: number[]];`);
  const one = current.slot("one").type;
  const three = current.slot("three").type;
  const named = current.slot("named");
  assert.equal(one.kind === "tuple" && one.readonly && one.elements.length === 1 && one.elements[0]?.kind === "required" &&
    one.elements[0].type.kind === "primitive" && one.elements[0].type.primitive === "int32", true);
  assert.equal(three.kind === "tuple" && !three.readonly && three.elements.length === 3 &&
    three.elements.every(element => element.kind === "required") && three.elements[2]?.type.kind === "primitive" &&
    three.elements[2].type.primitive === "float64", true);
  assert.equal(named.type.kind === "tuple" && named.type.readonly && named.type.elements.length === 3 &&
    named.type.elements[0]?.kind === "required" && named.type.elements[1]?.kind === "optional" && named.type.elements[2]?.kind === "rest", true);
  assert.equal(named.type.elements.every(element => element.declaration !== undefined && current.source.ast.is.IsNamedTupleMember(element.declaration)), true,
    "named tuple origins are the actual original member nodes");
  const tail = current.source.facts.descriptors.component(named, { kind: "tuple-element", index: 1 });
  assert.equal(tail.kind === "resolved" && tail.value.type.kind === "optional" && tail.value.type.value.kind === "primitive" &&
    tail.value.type.value.primitive === "float32", true);
  const rest = current.source.facts.descriptors.component(named, { kind: "tuple-element", index: 2 });
  assert.equal(rest.kind === "resolved" && rest.value.type.kind === "array", true,
    "the original rest component is a sequence, not a fabricated scalar parameter");
  const element = current.source.facts.descriptors.component(rest.value, { kind: "array-element" });
  assert.equal(element.kind === "resolved" && element.value.type.kind === "primitive" && element.value.type.primitive === "float64", true);
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
  const selected = current.slot("selected");
  assert.equal(selected.type.kind, "declared");
  const definition = current.source.facts.descriptors.definition(selected);
  assert.equal(definition.kind === "resolved" && definition.value.type.kind === "shape", true);
  const { ast, facts } = current.source;
  for (const [name, kind] of [["field", "KindPropertyDeclaration"], ["method", "KindMethodDeclaration"],
    ["getter", "KindGetAccessor"], ["setter", "KindSetAccessor"], ["paired", "KindGetAccessor"]]) {
    const member = definition.value.type.members.find(candidate => candidate.name === name);
    const declaration = ast.members(selected.type.declaration).find(candidate => candidate !== undefined &&
      ast.kindName(candidate) === kind && ast.text(ast.name(candidate)) === name);
    assert.equal(declaration !== undefined && member?.origin.kind === "declared" && member.origin.declaration === declaration, true, name);
    const value = facts.descriptors.component(definition.value, { kind: "member", origin: member.origin });
    assert.equal(value.kind, "resolved", name);
    if (name === "method") {
      const head = facts.descriptors.definition(value.value);
      assert.equal(head.kind === "resolved" && (head.value.type.kind === "callable" || head.value.type.kind === "shape") &&
        head.value.type.calls.length === 1 && head.value.type.calls[0]?.result.kind === "primitive" &&
        head.value.type.calls[0].result.primitive === "int32", true, name);
    } else assert.equal(value.value.type.kind === "primitive" && value.value.type.primitive === "int32", true, name);
  }
  const setter = ast.members(selected.type.declaration).find(node => node !== undefined && ast.is.IsSetAccessorDeclaration(node) &&
    ast.text(ast.name(node)) === "paired");
  assert.equal(setter !== undefined, true);
  const write = facts.descriptors.component(definition.value, { kind: "member", origin: { kind: "declared", declaration: setter } });
  assert.equal(write.kind === "resolved" && write.value.type.kind === "primitive" && write.value.type.primitive === "int32", true,
    "the original paired setter retains its independent WRITE child");
  assert.equal(definition.value.type.members.find(member => member.name === "field")?.readonly, true);
  assert.equal(facts.refusals().length, 0);
});

const receiverExamples = [
  { name: "outer and local", count: 2, text: `export function wrap<Outer>(first: Outer) {
    class Local<Inner> { first: Outer; value: Inner;
      constructor(first: Outer, value: Inner) { this.first = first; this.value = value; } }
    return new Local<string>(first, "value"); }` },
  { name: "unused outer", count: 2, text: `export function wrap<Outer>() {
    class Local<Inner> { constructor(readonly value: Inner) {} read(): Inner { return this.value; } }
    return Local; }` },
  { name: "shadowed binder", count: 2, text: `export function wrap<Value>() {
    class Local<Value> { constructor(readonly value: Value) {} read(): Value { return this.value; } }
    return Local; }` },
  { name: "anonymous class", count: 2, text: `export function wrap<Outer>() {
    const Local = class<Inner> { constructor(readonly value: Inner) {} read(): Inner { return this.value; } };
    return Local; }` },
  { name: "nongeneric class", count: 0, text: `export class Plain { value: number = 0; read(): number { return this.value; } }` },
  { name: "outer-only capture", count: 1, text: `export function wrap<Outer>(value: Outer) {
    class Local { constructor(readonly value: Outer) {} read(): Outer { return this.value; } }
    return new Local(value); }` },
];

test("an overloaded implementation retains its genuine body identity without replacing advertised callable signatures", () => {
  const current = fixture(`function choose(value: int32): int32;
    function choose(value: string): string;
    function choose(value: int32 | string): int32 | string { return value; }
    function run(): void { const callable = choose; const selected = choose(1 as int32); void callable; void selected; }`);
  const { ast, facts } = current.source;
  const declarations = current.nodes.filter(node => ast.is.IsFunctionDeclaration(node) && ast.text(ast.name(node)) === "choose");
  const implementation = declarations.find(node => ast.body(node) !== undefined);
  const overloads = declarations.filter(node => ast.body(node) === undefined);
  const call = current.nodes.find(node => ast.is.IsCallExpression(node) && ast.text(ast.as.AsCallExpression(node)?.Expression) === "choose");
  assert.equal(implementation !== undefined && call !== undefined && overloads.length === 2, true);
  const body = facts.values.declaredSlot(implementation);
  assert.equal(body.kind === "resolved" && body.value.type.type.kind === "callable" && body.value.type.type.calls.length === 1, true);
  const signature = body.value.type.type.calls[0];
  assert.equal(signature.identity.declaration === implementation && signature.parameters.length === 1, true,
    "the actual API-domain body signature is not a selected public overload");
  const parameter = facts.descriptors.component(body.value.type, { kind: "parameter", signature: signature.identity, index: 0 });
  assert.equal(parameter.kind === "resolved" && parameter.value.type.kind === "union" && parameter.value.type.types.length === 2, true);
  const returned = facts.values.callableReturn(signature.identity);
  assert.equal(returned.kind === "resolved" && returned.value.type === signature.result, true);
  const advertised = facts.values.type(implementation);
  const application = facts.applications.application(call);
  assert.equal(advertised.kind === "resolved" && application.kind === "resolved", true);
  const inventory = facts.descriptors.definition(advertised.value);
  assert.equal(inventory.kind === "resolved" && inventory.value.type.kind === "callable" && inventory.value.type.calls.length === 2 &&
    inventory.value.type.calls.every(candidate => overloads.includes(candidate.identity.declaration)), true,
  "ordinary value questions retain the complete advertised original overload inventory");
  assert.equal(application.value.identity.signature.declaration === overloads[0] && application.value.identity.signature !== signature.identity, true,
    "the selected original call and API-domain body remain distinct authentic identities");
});

test("C2428 aliased generic method callbacks publish the original selected binder's exact argument", () => {
  const current = fixture(`export function run<Value>(values: Value[]): Value[] {
    const mapper = (value: Value): Value => value;
    const alias = mapper; const mapped = values.map(alias); return mapped;
  }`);
  const { ast, facts } = current.source;
  const call = current.nodes.find(node => ast.is.IsCallExpression(node));
  const owner = current.nodes.find(node => ast.is.IsFunctionDeclaration(node) && ast.text(ast.name(node)) === "run");
  const parameter = ast.typeParameters(owner)[0];
  assert.equal(call !== undefined && parameter !== undefined, true);
  const outcome = facts.values.type(call);
  const selected = facts.applications.application(call);
  assert.equal(outcome.kind === "resolved" && selected.kind === "resolved", true);
  assert.equal(outcome.value.type.kind === "array" && outcome.value.type.element.kind === "parameter" &&
    outcome.value.type.element.declaration === parameter, true,
  "the result contains the project's original parameter, never the uninstantiated library method parameter");
  assert.equal(selected.value.identity.signatureBindings.length, 1);
  const argument = selected.value.identity.signatureBindings[0].value;
  assert.equal(argument.type.kind === "parameter" && argument.type.declaration === parameter &&
    argument.type === outcome.value.type.element && selected.value.result === outcome.value, true,
  "the result and same-call method argument retain identical original declaration and canonical geometry");
  assert.equal(facts.refusals().length, 0);
});

test("C2429 only a published winning default contributes its original authored primitive component", () => {
  const current = fixture(`declare function create<Value = int32>(): Value;
    declare function infer<Value = int32>(value: Value): Value;
    function run(narrow: float32, wide: number): void {
      const chosen = create(); const explicit = create<float32>();
      const authored = infer(narrow); const equalBacking = infer(wide); const fractional = infer(1.5);
      void chosen; void explicit; void authored; void equalBacking; void fractional;
    }`);
  const { ast, facts } = current.source;
  for (const [name, primitive, origin] of [["chosen", "int32", "default"], ["explicit", "float32", "explicit"],
    ["authored", "float32", "inferred"], ["equalBacking", "float64", "inferred"], ["fractional", "float64", "inferred"]]) {
    const declaration = current.declaration(name);
    const call = ast.as.AsVariableDeclaration(declaration)?.Initializer;
    assert.equal(call !== undefined, true, name);
    const selected = facts.applications.application(call);
    assert.equal(selected.kind, "resolved", name);
    assert.equal(selected.value.identity.signatureBindings.length, 1, name);
    const binding = selected.value.identity.signatureBindings[0];
    assert.equal(binding.declaration === selected.value.identity.signature.typeParameters[0], true, `${name}: the exact original selected binder`);
    const originalDefault = ast.as.AsTypeParameterDeclaration(binding.declaration)?.DefaultType;
    assert.equal(originalDefault !== undefined && ast.text(originalDefault) === "int32", true, name);
    assert.equal(ast.typeArguments(call).length > 0, origin === "explicit", `${name}: only original explicit syntax is explicit`);
    assert.equal(selected.value.sourceArguments.length === 0, origin !== "inferred", `${name}: defaults never replace actual inference inputs`);
    const value = current.slot(name);
    assert.equal(value.type.kind === "primitive" && value.type.primitive === primitive && binding.value.type === value.type &&
      selected.value.result.type === value.type, true, `${name}: value, actual result and same-call binder retain the original Source primitive`);
  }
  assert.equal(facts.refusals().length, 0);
});

test("C2431 typeof object members retain their original authored value producers", () => {
  const current = fixture(`declare function produced<Value>(): Value;
    const original = { exact: produced<int32>(), floating: produced<number>(), integer: 7 };
    type Snapshot = typeof original; declare const selected: Snapshot;`);
  const definition = current.source.facts.descriptors.definition(current.slot("selected"));
  assert.equal(definition.kind === "resolved" && definition.value.type.kind === "shape", true);
  for (const [name, primitive] of [["exact", "int32"], ["floating", "float64"], ["integer", "int64"]]) {
    const member = definition.value.type.members.find(member => member.name === name);
    assert.equal(member?.type.kind === "primitive" && member.type.primitive === primitive && member.origin.kind === "declared" &&
      current.source.ast.is.IsPropertyAssignment(member.origin.declaration), true,
    `${name}: the original member initializer owns its native type without reopening a backing Type`);
  }
});

test("conditional structural infer patterns retain exact member callback widths and recursive applications", () => {
  for (const primitive of ["int32", "float32"]) {
    const current = fixture(`interface Thenable<Value> { then(callback: (value: Value) => void): void; }
      type Payload<Value> = Value extends object & { then(callback: infer Callback): void }
        ? Callback extends (value: infer Result) => void ? Result : never : never;
      declare const selected: Payload<Thenable<${primitive}>>;
      declare const recursive: Awaited<Promise<Promise<${primitive}>>>;
      declare const unrelated: Payload<{ other: ${primitive} }>;
      declare const optionalCallback: Awaited<{ then(callback?: ((value: ${primitive}) => void) | undefined): void }>;
      declare const keyed: { key: ${primitive} };`);
    for (const name of ["selected", "recursive", "optionalCallback"]) {
      const result = current.source.facts.descriptors.definition(current.slot(name));
      assert.equal(result.kind === "resolved" && result.value.type.kind === "primitive" && result.value.type.primitive === primitive, true,
        `${name}: structural inference and recursive alias applications preserve ${primitive}`);
    }
    const unrelated = current.source.facts.descriptors.definition(current.slot("unrelated"));
    assert.equal(unrelated.kind === "resolved" && unrelated.value.type.kind === "intrinsic" && unrelated.value.type.intrinsic === "never", true,
      "a false structural branch never borrows an unrelated member");
    assert.equal(current.slot("keyed").type.kind, "shape", "a conditional binding scope never contaminates a sibling");
  }
});

test("conditional distribution selects retained presence and absence without erasing exact primitive widths", () => {
  const current = fixture(`type Split<Value> = Value extends null | undefined ? int32 : Value;
    type Keep<Value> = Value extends null | undefined ? Value : Value;
    declare const split: Split<float32 | null | undefined>; declare const kept: Keep<float32 | null | undefined>;`);
  const split = current.source.facts.descriptors.definition(current.slot("split"));
  assert.equal(split.kind === "resolved" && split.value.type.kind === "union" && split.value.type.types.length === 2 &&
    split.value.type.types.every(type => type.kind === "primitive") &&
    split.value.type.types.some(type => type.kind === "primitive" && type.primitive === "int32") &&
    split.value.type.types.some(type => type.kind === "primitive" && type.primitive === "float32"), true,
  "a checked numeric union cannot erase either authored Source primitive");
  const kept = current.source.facts.descriptors.definition(current.slot("kept"));
  assert.equal(kept.kind === "resolved" && kept.value.type.kind === "optional" && kept.value.type.value.kind === "primitive" &&
    kept.value.type.value.primitive === "float32", true, "both nullish branches retain one native absence and the original present descriptor");
  assert.equal(current.source.facts.refusals().length, 0);
});

test("C2373 distributed callback inference retains its lexical scope through every sibling and recursive tail", () => {
  const current = fixture(`type Unwrap<Value> = Value extends { then(callback: infer Callback): void }
      ? Callback extends ((value: infer Inner) => void) ? Unwrap<Inner> : never : Value;
    interface Layer<Value> { then(callback?: ((value: Value) => void) | null): void; }
    declare const first: Unwrap<Layer<Layer<int32>>>; declare const second: Unwrap<Layer<float32>>;
    declare const nested: Awaited<Promise<Promise<float32>>>; declare const sibling: int32;
    interface NativeIndex { readonly [key: int32]: float32; } declare const indexed: NativeIndex;`);
  for (const [name, primitive] of [["first", "int32"], ["second", "float32"], ["nested", "float32"], ["sibling", "int32"]]) {
    const result = current.source.facts.descriptors.definition(current.slot(name));
    assert.equal(result.kind === "resolved" && result.value.type.kind === "primitive" && result.value.type.primitive === primitive, true,
      `${name}: the actual inferred width survives every captured branch`);
  }
  const indexed = current.source.facts.descriptors.definition(current.slot("indexed"));
  assert.equal(indexed.kind === "resolved" && indexed.value.type.kind === "shape" && indexed.value.type.indexes.length === 1 &&
    indexed.value.type.indexes[0]?.key.kind === "primitive" && indexed.value.type.indexes[0].key.primitive === "int32" &&
    indexed.value.type.indexes[0].value.kind === "primitive" && indexed.value.type.indexes[0].value.primitive === "float32", true,
  "an authored native index retains its exact key and value kinds");
  assert.equal(current.source.facts.refusals().length, 0);
});

test("tail conditional applications retain their successive exact Source binder scopes", () => {
  for (const primitive of ["int32", "float32"]) {
    const current = fixture(`interface Layer<Value> { item: Value; }
      type Peel<Value> = Value extends Layer<infer Inner> ? Peel<Inner> : Value;
      declare const first: Peel<Layer<Layer<Layer<${primitive}>>>>; declare const sibling: ${primitive};`);
    for (const name of ["first", "sibling"]) {
      const result = current.source.facts.descriptors.definition(current.slot(name));
      assert.equal(result.kind === "resolved" && result.value.type.kind === "primitive" && result.value.type.primitive === primitive, true,
        `${name}: the captured tail application retains its exact Source argument`);
    }
    assert.equal(current.source.facts.refusals().length, 0);
  }
});

test("integer tokens and fractional or exponent tokens retain distinct leaf defaults", () => {
  const current = fixture("export const integer = 1; export const fractional = 1.0; export const exponent = 1e3; export const radix = 0xff;");
  for (const [name, primitive] of [["integer", "int64"], ["radix", "int64"], ["fractional", "float64"], ["exponent", "float64"]]) {
    const value = current.slot(name);
    assert.equal(value.type.kind === "primitive" && value.type.primitive === primitive, true, name);
  }
});

test("authored array syntax preserves the element source fact instead of erasing to number", () => {
  const current = fixture("declare const integers: int32[]; declare const singles: readonly float32[];");
  for (const [name, primitive, readonly] of [["integers", "int32", false], ["singles", "float32", true]]) {
    const value = current.slot(name);
    assert.equal(value.type.kind === "array" && value.type.readonly === readonly && value.type.element.kind === "primitive" &&
      value.type.element.primitive === primitive, true, name);
    const child = current.source.facts.descriptors.component(value, { kind: "array-element" });
    assert.equal(child.kind === "resolved" && child.value.type === value.type.element, true, `${name}: the original registered child is retained`);
  }
});

test("never-open folded integer arithmetic retains its native int64 creation default", () => {
  const current = fixture("export const quotient = 7 / 2; export const sum = 1 + 2;");
  for (const name of ["quotient", "sum"]) {
    const value = current.slot(name);
    assert.equal(value.type.kind === "primitive" && value.type.primitive === "int64", true, name);
  }
});

test("an imported primitive qualifier keeps its declaration fact instead of its erased number type", () => {
  const current = fixture('declare const value: import("@test/words").int32;');
  const value = current.slot("value");
  assert.equal(value.type.kind === "primitive" && value.type.primitive === "int32", true);
});

test("optional member presence is independent of an absence-capable member value", () => {
  const current = fixture("declare const absent: { value?: int32 }; declare const present: { value: int32 | undefined };");
  for (const [name, optional] of [["absent", true], ["present", false]]) {
    const value = current.slot(name);
    assert.equal(value.type.kind === "shape" && value.type.members.length === 1, true, name);
    const member = value.type.members[0];
    assert.equal(member.optional === optional && member.type.kind === "optional" && member.type.value.kind === "primitive" &&
      member.type.value.primitive === "int32", true, name);
  }
});

test("declared undefined and null are absence while a callable void result remains void", () => {
  const current = fixture("declare const empty: undefined; declare const nil: null; declare const callback: () => void;");
  for (const name of ["empty", "nil"]) {
    const value = current.slot(name);
    assert.equal(value.type.kind === "intrinsic" && value.type.intrinsic === "absence", true, name);
  }
  const callback = current.slot("callback");
  assert.equal(callback.type.kind === "callable" && callback.type.calls.length === 1 &&
    callback.type.calls[0].result.kind === "intrinsic" && callback.type.calls[0].result.intrinsic === "void", true);
  const result = current.source.facts.values.callableReturn(callback.type.calls[0].identity);
  assert.equal(result.kind === "resolved" && result.value.type === callback.type.calls[0].result, true);
});

test("nominal source identity is a declaration and its ordered actual descriptors", () => {
  const current = fixture("declare class Box<T> { value: T } declare const box: Box<int32>;");
  const value = current.slot("box");
  assert.equal(value.type.kind === "declared" && current.source.ast.is.IsClassDeclaration(value.type.declaration) &&
    value.type.typeArguments.length === 1 && value.type.typeArguments[0].kind === "primitive" &&
    value.type.typeArguments[0].primitive === "int32", true);
});

test("the two readonly tuple positions retain independent source widths", () => {
  const current = fixture("declare const pair: readonly [int32, float32];");
  const value = current.slot("pair");
  assert.equal(value.type.kind === "tuple" && value.type.readonly && value.type.elements.length === 2, true);
  for (const [index, primitive] of ["int32", "float32"].entries()) {
    const element = value.type.elements[index];
    assert.equal(element.kind === "required" && element.type.kind === "primitive" && element.type.primitive === primitive, true);
    const child = current.source.facts.descriptors.component(value, { kind: "tuple-element", index });
    assert.equal(child.kind === "resolved" && child.value.type === element.type, true);
  }
});

test("checked optional-property occurrences keep their narrowed declared width", () => {
  const current = fixture("declare const data: { value?: int32 }; function run(): void { if (data.value !== undefined) { const narrowed = data.value; } }");
  const value = current.slot("narrowed");
  assert.equal(value.type.kind === "primitive" && value.type.primitive === "int32", true);
});

test("an opaque declared object publishes the object intrinsic, not a structural shape", () => {
  const current = fixture("declare const value: object;");
  const value = current.slot("value");
  assert.equal(value.type.kind === "intrinsic" && value.type.intrinsic === "object", true);
  const definition = current.source.facts.descriptors.definition(value);
  assert.equal(definition.kind === "resolved" && definition.value.type === value.type, true);
  assert.equal(current.source.facts.refusals().length, 0);
});

test("a generic type annotation retains its checked type declaration beside a same-name constructor value", () => {
  const current = fixture(`interface Box<Value> { value: Value; }
    declare const Box: { new<Value>(value: Value): Box<Value> };
    function run(): void { const selected: Box<int32> = new Box<int32>(1); }`);
  const declaration = current.nodes.find(node => current.source.ast.is.IsInterfaceDeclaration(node) &&
    current.source.ast.text(current.source.ast.name(node)) === "Box");
  const value = current.slot("selected");
  assert.equal(declaration !== undefined && value.type.kind === "declared" && value.type.declaration === declaration, true,
    "the constructor value never owns the original type annotation's binders");
  assert.equal(value.type.typeArguments.length === 1 && value.type.typeArguments[0].kind === "primitive" &&
    value.type.typeArguments[0].primitive === "int32", true);
});

for (const example of receiverExamples) test(`a ${example.name} this-type retains the complete original checked binder vector`, () => {
  const current = fixture(example.text);
  const { ast, facts } = current.source;
  const owner = current.nodes.find(node => ast.is.IsClassDeclaration(node) || ast.is.IsClassExpression(node));
  const receiver = current.nodes.find(node => ast.kindName(node) === "KindThisKeyword");
  assert.equal(owner !== undefined && receiver !== undefined, true, "the actual class and its original this occurrence are required");
  const outer = current.nodes.find(node => ast.is.IsFunctionDeclaration(node) && ast.text(ast.name(node)) === "wrap");
  const parameters = [...outer === undefined ? [] : ast.typeParameters(outer), ...ast.typeParameters(owner)];
  assert.equal(parameters.length, example.count, "the independently authored outer and local binder inventory has the expected arity");
  const outcome = facts.values.type(receiver);
  assert.equal(outcome.kind === "resolved" && outcome.value.type.kind === "declared", true,
    "the exact receiver remains one resolved nominal instance");
  assert.equal(outcome.value.component.root === receiver && outcome.value.type.declaration === owner, true,
    "the original receiver and class identities are unchanged");
  assert.equal(outcome.value.type.typeArguments.length, parameters.length, "no outer or local argument is omitted");
  for (const [index, declaration] of parameters.entries()) {
    const argument = outcome.value.type.typeArguments[index];
    assert.equal(argument?.kind === "parameter" && argument.declaration === declaration, true,
      `argument ${index} is the identical original parameter, not a constraint or primitive substitute`);
  }
});

for (const kind of ["array", "shape"]) {
  test(`C30 declared ${kind} construction positions do not unite or inherit operand inference`, () => {
    const current = fixture(`function run(): void {
      const container: ${kind === "array" ? "float32[]" : "{first:float32;second:int32}"} = ${kind === "array" ? "[1,2]" : "{first:1,second:2}"};
      const first: float32 = 1; const second: int32 = 2; void container; void first; void second;
    }`);
    const { ast, facts } = current.source;
    const container = { node: current.declaration("container"), path: [] };
    const first = { node: current.declaration("first"), path: [] };
    const second = { node: current.declaration("second"), path: [] };
    const firstPosition = { node: container.node, path: kind === "array" ? [{ kind: "element" }] : [{ kind: "member", name: "first" }] };
    const secondPosition = kind === "array" ? firstPosition : { node: container.node, path: [{ kind: "member", name: "second" }] };
    const firstSlot = facts.values.declaredSlot(first.node);
    const secondSlot = facts.values.declaredSlot(second.node);
    assert.equal(firstSlot.kind === "resolved" && secondSlot.kind === "resolved", true);
    assert.equal(firstSlot.value.type.type.kind === "primitive" && firstSlot.value.type.type.primitive === "float32", true);
    assert.equal(secondSlot.value.type.type.kind === "primitive" && secondSlot.value.type.type.primitive === "int32", true);
    const literal = ast.as.AsVariableDeclaration(container.node)?.Initializer;
    const member = name => {
      const declaration = ast.properties(literal).find(node => node !== undefined && ast.text(ast.name(node)) === name);
      assert.equal(declaration !== undefined, true, `the original construction member ${name} is retained`);
      return declaration;
    };
    const term = kind === "array" ? { kind, site: container.node, readonly: false, element: firstPosition }
      : { kind, site: container.node, members: [
        { name: "first", declaration: member("first"), readonly: false, optional: false, variable: firstPosition },
        { name: "second", declaration: member("second"), readonly: false, optional: false, variable: secondPosition },
      ] };
    const root = ast.getSourceFile(container.node);
    assert.equal(root !== undefined, true);
    const entries = [
      { node: container.node, root, variable: container, kind: "fixed", publish: true, term },
      { node: first.node, root, variable: first, kind: "open-local", publish: true,
        term: { kind: "fixed", site: first.node, value: firstSlot.value.type } },
      { node: second.node, root, variable: second, kind: "fixed", publish: true,
        term: { kind: "fixed", site: second.node, value: secondSlot.value.type } },
    ];
    const links = [{ source: first, target: firstPosition, site: first.node }, { source: second, target: secondPosition, site: second.node }];
    const graph = nodes => ({ roots: [root], nodes, links, producerInputs: [], derived: [], calls: [], refusals: [] });
    const terms = createSourceTypeFlowTerms(ast, graph(entries));
    assert.equal(terms.group(first).variable === terms.group(firstPosition).variable, false);
    assert.equal(terms.group(second).variable === terms.group(secondPosition).variable, false);
    assert.equal(terms.group(first).variable === terms.group(second).variable, false);
    assert.equal(terms.isInference(first), true);
    for (const variable of [container, firstPosition, secondPosition, second]) assert.equal(terms.isInference(variable), false);
    assert.equal(terms.group(container).terms[0] === term, true);
    const open = createSourceTypeFlowTerms(ast, graph([{ ...entries[0], kind: "open-local" }, ...entries.slice(1)]));
    assert.equal(open.group(first).variable === open.group(firstPosition).variable, true);
    assert.equal(open.group(second).variable === open.group(secondPosition).variable, true);
    assert.equal(open.isInference(container), true);
  });
}
