import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, createSourceSemanticsExtension, sourcePrimitive } from "@tsonic/tsts";
import { sourceTypeFlowFixture as fixture } from "./fixtures/source-type-flow-fixture.mjs";
import { sourceFlowOwnerFixture } from "../host/fixtures/source-flow-owner.mjs";
import { createHostSourceProgramInput } from "../../packages/host/dist/host-input/program.js";
import { composeSourceProgram } from "../../packages/target-api/dist/source-semantics/target-source-program.js";

function resolved(result, label) {
  assert.equal(result.kind, "resolved", result.kind === "refused" ? `${label}: ${result.message}` : label);
  return result.value;
}

function definition(current, value) {
  return resolved(current.source.facts.descriptors.definition(value), "the original Source definition resolves");
}

function component(current, value, selector) {
  return resolved(current.source.facts.descriptors.component(value, selector), "the registered original component resolves");
}

function namedParameter(current, name) {
  const selected = current.nodes.filter(node => current.source.ast.is.IsParameterDeclaration(node) &&
    current.source.ast.text(current.source.ast.name(node)) === name);
  assert.equal(selected.length, 1, `${name}: the complete original parameter domain has one declaration`);
  return selected[0];
}

test("C2446 union occurrence projection preserves subsets and refuses to guess erased numeric branches", () => {
  const current = fixture(`function run(value: int32 | float32 | string, input: ((value: int32) => int32) | string,
    partial: ((value: int32) => int32) | string | undefined): void {
    const unchanged = input;
    if (typeof input !== "string") { const callable = input; void callable; }
    if (typeof value !== "string") { const numeric = value; void numeric; }
    if (typeof partial !== "string") { const optional = partial; void optional; }
    void unchanged;
  }`);
  const unchanged = current.slot("unchanged");
  assert.equal(unchanged.type.kind === "union" && unchanged.type.types.length === 2, true,
    "an unrefined callable|string occurrence retains both original branches");
  const numeric = current.slot("numeric");
  assert.equal(numeric.type.kind === "union" && numeric.type.types.length === 3 &&
    numeric.type.types.some(type => type.kind === "primitive" && type.primitive === "int32") &&
    numeric.type.types.some(type => type.kind === "primitive" && type.primitive === "float32") &&
    numeric.type.types.some(type => type.kind === "string"), true,
  "equal erased numeric backing types never choose a native width");
  const optional = current.slot("optional");
  assert.equal(optional.type.kind, "optional");
  const callable = definition(current, component(current, optional, { kind: "optional-value" }));
  const signature = callable.type.kind === "callable" && callable.type.calls.length === 1 ? callable.type.calls[0] : undefined;
  assert.equal(signature !== undefined && signature.parameters.length === 1 &&
    signature.parameters[0].type.kind === "primitive" && signature.parameters[0].type.primitive === "int32" &&
    signature.result.kind === "primitive" && signature.result.primitive === "int32", true,
  "a callable-and-absence subset retains its original callable and one absence state");
  const initializer = current.source.ast.as.AsVariableDeclaration(current.declaration("optional"))?.Initializer;
  assert.equal(initializer !== undefined, true);
  const published = resolved(current.source.facts.values.type(initializer), "the enrolled original read resolves");
  const publishedCallable = definition(current, component(current, published, { kind: "optional-value" }));
  assert.equal(publishedCallable.type === callable.type && publishedCallable.type.calls[0].identity === signature.identity, true,
    "the same optional subset, original callable and native widths reach value publication");
  const stored = resolved(current.source.facts.values.declaredSlot(namedParameter(current, "partial")), "the original slot resolves").type;
  assert.equal(stored.type.kind, "optional");
  const storedValue = component(current, stored, { kind: "optional-value" });
  assert.equal(storedValue.type.kind === "union" && storedValue.type.types.length === 2 &&
    storedValue.type.types.some(type => type.kind === "string") && storedValue.type.types.some(type => type.kind === "callable"), true,
  "the original parameter retains both authored present storage branches");
});

test("an unresolved foreign conditional alias is not an identity-only nominal cut", () => {
  const current = fixture(`interface Local { read<Value>(value: Value): Awaited<Value>; }
    declare const local: Local;
    export function run(): void { const alias = local; void alias; const count: int32 = 1; void count; }`);
  const slot = current.source.facts.values.declaredSlot(current.declaration("local"));
  assert.equal(slot.kind, "refused", "an open conditional is not disguised as an empty nominal definition");
  const reads = current.source.facts.values.occurrences().filter(node => current.source.ast.is.IsIdentifier(node) &&
    current.source.facts.navigation.sourceReferenceFor(node)?.declaration === current.declaration("local"));
  assert.equal(reads.length, 1, "the original local read owns the refusal");
  const outcome = current.source.facts.values.type(reads[0]);
  assert.equal(outcome.kind === "refused" && outcome.site === reads[0] && outcome.code === "TSONIC_LOCAL_TYPE_UNSUPPORTED", true);
  const issues = current.source.facts.refusals().filter(issue => issue.site === reads[0]);
  assert.equal(issues.length, 1);
  assert.equal(issues[0] === outcome, true, "the publication retains its identical first cause");
  const count = current.slot("count");
  assert.equal(count.type.kind === "primitive" && count.type.primitive === "int32", true,
    "an expressible sibling is independent of the unresolved alias");
});

test("a present object construction retains canonical member correspondence into nullable storage", () => {
  const current = fixture(`interface Row { user: int32; system?: int32; }
    function run(other: Row): void { let value: Row | null | undefined = { user: 1 }; value = other; void value; }`);
  const { ast, facts } = current.source;
  const literal = ast.as.AsVariableDeclaration(current.declaration("value"))?.Initializer;
  assert.equal(literal !== undefined && ast.is.IsObjectLiteralExpression(literal), true);
  const properties = ast.properties(literal);
  assert.equal(properties.length, 1);
  const property = properties[0];
  const storage = current.slot("value");
  assert.equal(storage.type.kind, "optional", "the declaration retains absence-capable storage");
  const construction = resolved(facts.values.construction(literal), "the original construction resolves");
  assert.equal(construction.kind, "present");
  const shape = definition(current, construction.value.value);
  assert.equal(shape.type.kind === "shape" && shape.type.members.length === 1 && shape.type.members[0].name === "user", true);
  const destination = resolved(facts.values.destination(ast.as.AsPropertyAssignment(property)?.Initializer), "the original property destination resolves");
  assert.equal(destination.kind === "present" && destination.value.declaration.origin.kind === "declaration", true);
  const declared = destination.value.declaration.origin.declaration;
  const pair = resolved(facts.objects.correspondingMember(shape,
    component(current, storage, { kind: "optional-value" }), declared, "read"), "the canonical destination pair resolves");
  assert.equal(pair.kind === "present" && pair.value.kind === "present" &&
    pair.value.source.declarations.length === 1 && pair.value.source.declarations[0] === property &&
    pair.value.destination.declarations.includes(declared), true,
  "the original source property and original destination declaration retain their exact pairing");
  assert.equal(pair.value.source.origins.some(origin => origin.kind === "declared" && origin.declaration === property), true);
  assert.equal(facts.refusals().length, 0);
});

test("an inferred call result preserves an unavailable body's original Source refusal", () => {
  const current = fixture(`interface Local { read<Value>(value: Value): Awaited<Value>; }
    declare const local: Local;
    function read() { return local; }
    const result = read(); void result;`);
  const { ast, facts } = current.source;
  const call = ast.as.AsVariableDeclaration(current.declaration("result"))?.Initializer;
  const returned = current.nodes.filter(node => ast.is.IsReturnStatement(node));
  assert.equal(returned.length, 1);
  const value = ast.as.AsReturnStatement(returned[0])?.Expression;
  assert.equal(call !== undefined && value !== undefined, true);
  const outcome = facts.values.type(call);
  const original = facts.values.type(value);
  assert.equal(outcome.kind === "refused" && outcome.site === value && outcome.code === "TSONIC_LOCAL_TYPE_UNSUPPORTED", true,
    "an unrepresented body never re-enters checked return-type reconstruction");
  assert.equal(outcome === original, true);
  const application = facts.applications.application(call);
  assert.equal(application === outcome, true, "a refused body publishes no fabricated application result");
});

test("discarded selections leave the result-publication domain without dropping their operands", () => {
  const current = fixture(`function run(flag: boolean, optional?: () => number): number {
    flag && (() => 1); flag || (() => 2); optional ?? (() => 3); flag ? (() => 4) : (() => 5);
    const selected = flag && true; return selected ? 1 : 0;
  }`);
  const { ast, facts } = current.source;
  const values = new Set(facts.values.occurrences());
  const selections = current.nodes.filter(node => (ast.is.IsConditionalExpression(node) || ast.is.IsBinaryExpression(node) &&
    ["KindAmpersandAmpersandToken", "KindBarBarToken", "KindQuestionQuestionToken"].includes(ast.operatorKindName(node))) &&
    facts.navigation.expressionResultDisposition(node).kind === "discarded");
  assert.equal(selections.length, 4, "all four original effect-only selections are retained");
  for (const selection of selections) {
    assert.equal(values.has(selection), false, "an effect selection publishes no result");
    const condition = ast.is.IsConditionalExpression(selection) ? ast.as.AsConditionalExpression(selection)?.Condition
      : ast.as.AsBinaryExpression(selection)?.Left;
    assert.equal(condition !== undefined && values.has(condition), true, "the original control remains enrolled");
  }
  const initializer = ast.as.AsVariableDeclaration(current.declaration("selected"))?.Initializer;
  assert.equal(initializer !== undefined && values.has(initializer), true, "a consumed logical expression remains a value question");
});

test("an unannotated self-dependent callable has one precise return-annotation refusal", () => {
  const current = fixture("function recursive() { return recursive; }", { compilerOptions: { noImplicitAny: false } });
  const returned = current.nodes.filter(node => current.source.ast.is.IsReturnStatement(node));
  assert.equal(returned.length, 1);
  const value = current.source.ast.as.AsReturnStatement(returned[0])?.Expression;
  const issues = current.source.facts.refusals();
  assert.equal(issues.length, 1);
  assert.equal(value !== undefined && issues[0].site === value && issues[0].code === "TSONIC_LOCAL_TYPE_SIGNATURE" &&
    issues[0].message === "This unannotated callable return depends on itself. Annotate the return type.", true);
  assert.equal(current.source.facts.values.type(value) === issues[0], true,
    "the original returned expression carries the same canonical first cause");
});

test("a required component overrides the occurrence's literal default", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": "declare const required: number[]; export const literal = [1];",
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0);
  const current = sourceFlowOwnerFixture({ checked, apiFacts: undefined, profileFiles: [], safetyProviders: [] });
  const { context } = current.flow;
  const declarations = context.nodes.filter(node => checked.ast.is.IsVariableDeclaration(node));
  assert.equal(declarations.length, 2, "both original component owners are retained");
  const required = declarations.find(node => checked.ast.text(checked.ast.name(node)) === "required");
  const literal = declarations.find(node => checked.ast.text(checked.ast.name(node)) === "literal");
  assert.equal(required !== undefined && literal !== undefined, true);
  const original = context.source.input.syntax(required);
  const selected = resolved(context.place(original, []), "the genuine required component resolves");
  const stored = resolved(current.program.facts.values.declaredSlot(required), "the same declared requirement resolves").type;
  assert.equal(selected.type === stored.type && selected.type.kind === "array" && selected.type.readonly === false, true);
  const element = resolved(current.program.facts.descriptors.component(selected, { kind: "array-element" }), "the required element resolves");
  assert.equal(element.type.kind === "primitive" && element.type.primitive === "float64", true,
    "the selected original number component owns the answer rather than the unrelated integer literal default");
  const inferred = resolved(current.program.facts.values.declaredSlot(literal), "the actual literal retains its separate inference").type;
  assert.equal(inferred.type.kind === "array" && inferred.type.element.kind === "primitive" && inferred.type.element.primitive === "int64", true);
  const requiredUse = fixture("declare const required: number[]; export const literal: number[] = [1];");
  const occurrence = requiredUse.source.ast.as.AsVariableDeclaration(requiredUse.declaration("literal"))?.Initializer;
  assert.equal(occurrence !== undefined, true);
  const destination = resolved(requiredUse.source.facts.values.destination(occurrence), "the actual required use resolves");
  assert.equal(destination.kind === "present" && destination.value.declaration.origin.kind === "declaration" &&
    destination.value.declaration.origin.declaration === requiredUse.declaration("literal"), true,
  "a required use retains the actual declaration, not an arbitrary checked-type override");
  const construction = resolved(requiredUse.source.facts.values.construction(occurrence), "the actual constrained construction resolves");
  assert.equal(construction.kind === "present" && construction.value.value.type.kind === "array" &&
    construction.value.value.type.element.kind === "primitive" && construction.value.value.type.element.primitive === "float64", true,
  "the actual imposed element component overrides the occurrence's ordinary integer default");
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
  assert.equal(consumer !== undefined && native !== undefined, true);
  const original = createHostSourceProgramInput({ checked, apiFacts: undefined, profileFiles: [], safetyProviders: [] });
  const current = composeSourceProgram({ ...original.input, sourceFiles: Object.freeze([consumer]) });
  const { program: source, flow } = current;
  assert.equal(source.sourceFiles.length === 1 && source.sourceFiles[0] === consumer &&
    !source.sourceFiles.includes(native), true, "foreign definitions are not fabricated project source files");
  const declarations = flow.context.nodes.filter(node => source.ast.is.IsVariableDeclaration(node) && source.ast.getSourceFile(node) === consumer);
  assert.deepEqual(declarations.map(node => source.ast.text(source.ast.name(node))), ["retained", "pair"]);
  const retained = resolved(source.facts.values.declaredSlot(declarations[0]), "the included consumer slot resolves").type;
  const shape = resolved(source.facts.descriptors.definition(retained), "the foreign definition resolves");
  assert.equal(shape.type.kind === "shape" && shape.type.members.length === 2, true);
  const value = shape.type.members.find(member => member.name === "value");
  assert.equal(value?.type.kind === "primitive" && value.type.primitive === "int32", true);
  const pair = resolved(source.facts.values.declaredSlot(declarations[1]), "the original tuple alias resolves").type;
  assert.equal(pair.type.kind === "tuple" && pair.type.readonly && pair.type.elements.length === 2 &&
    pair.type.elements[0].kind === "required" && pair.type.elements[0].type.kind === "primitive" && pair.type.elements[0].type.primitive === "int32" &&
    pair.type.elements[1].kind === "required" && pair.type.elements[1].type.kind === "primitive" && pair.type.elements[1].type.primitive === "float32", true);
  assert.equal(shape.type.members.every(member => member.origin.kind === "declared" &&
    source.ast.getSourceFile(member.origin.declaration) === native), true,
  "every authored member keeps its original foreign declaration under the included consumer");
  const initializer = source.ast.as.AsVariableDeclaration(declarations[0])?.Initializer;
  assert.equal(initializer !== undefined, true);
  const component = original.input.input.syntax(initializer);
  assert.equal(component.root === initializer && source.ast.getSourceFile(component.root) === consumer, true,
    "the occurrence's opaque component remains rooted in the original included consumer");
});

test("declared definitions have one canonical member and signature inventory", () => {
  const current = fixture(`interface Factory { readonly prototype: object; new(): object; }
    interface CallableObject { readonly tag: string; (value: int32): int32; }
    declare const factory: Factory; declare const callableObject: CallableObject;
    declare const callback: (value: int32) => int32; declare const constructor: new() => object;
    declare const empty: {};`);
  for (const [name, members, calls, constructs] of [["factory", 1, 0, 1], ["callableObject", 1, 1, 0]]) {
    const nominal = current.slot(name);
    assert.equal(nominal.type.kind, "declared");
    assert.equal("members" in nominal.type || "indexes" in nominal.type, false);
    const shape = definition(current, nominal);
    assert.equal(shape.type.kind === "shape" && shape.type.members.length === members && shape.type.indexes.length === 0 &&
      shape.type.calls.length === calls && shape.type.constructs.length === constructs, true, name);
    assert.equal(shape.type.members.every(member => member.origin.kind === "declared"), true, name);
    assert.equal(definition(current, nominal) === shape, true, "the same per-view definition is reused");
  }
  for (const [name, calls, constructs] of [["callback", 1, 0], ["constructor", 0, 1]]) {
    const type = current.slot(name).type;
    assert.equal(type.kind === "callable" && type.calls.length === calls && type.constructs.length === constructs, true, name);
  }
  const empty = current.slot("empty").type;
  assert.equal(empty.kind === "shape" && empty.members.length === 0 && empty.indexes.length === 0 &&
    empty.calls.length === 0 && empty.constructs.length === 0, true, "empty structure is not signature-only callable");
});

test("nominal definitions retain all structure once and cut recursive references by declaration and arguments", () => {
  const current = fixture(`interface Link<Value> { value: Value; next?: Link<Value>; }
    interface Empty {} declare const retained: Link<int32>; declare const empty: Empty;`);
  const nominal = current.slot("retained");
  assert.equal(nominal.type.kind === "declared" && nominal.type.typeArguments.length === 1, true);
  assert.equal("members" in nominal.type || "indexes" in nominal.type, false);
  const shape = definition(current, nominal);
  assert.equal(shape.type.kind === "shape" && shape.type.members.length === 2, true);
  const value = shape.type.members.find(member => member.name === "value");
  assert.equal(value?.type.kind === "primitive" && value.type.primitive === "int32", true);
  const next = shape.type.members.find(member => member.name === "next");
  assert.equal(next?.optional && next.type.kind === "optional" && next.type.value.kind === "declared", true);
  const child = component(current, component(current, shape, { kind: "member", origin: next.origin }), { kind: "optional-value" });
  assert.equal(child.type.kind === "declared" && child.type.declaration === nominal.type.declaration &&
    child.type.typeArguments.length === 1 && child.type.typeArguments[0] === nominal.type.typeArguments[0] &&
    !("members" in child.type) && !("definition" in child.type), true,
  "the recursive reference retains its authentic declaration/arguments without an embedded second definition");
  const empty = current.slot("empty");
  const emptyShape = definition(current, empty);
  assert.equal(empty.type.kind === "declared" && emptyShape.type.kind === "shape" &&
    emptyShape.type.members.length === 0 && emptyShape.type.indexes.length === 0, true,
  "an earned empty definition stays distinguishable from a lazy recursive reference");
});

test("K-2446 an overloaded member merged across declarations is identified by its symbol's first declaration", () => {
  const current = fixture(`interface Merged { run(value: int32): int32; run(value: string): string; }
    interface Merged { run(value: boolean): boolean; }
    declare const merged: Merged;`);
  const declarations = current.nodes.filter(node => current.source.ast.is.IsMethodSignatureDeclaration(node) &&
    current.source.ast.text(current.source.ast.name(node)) === "run");
  assert.equal(declarations.length, 3, "the complete merged overload declaration vector is retained");
  const shape = definition(current, current.slot("merged"));
  assert.equal(shape.type.kind === "shape" && shape.type.members.length === 1, true);
  const member = shape.type.members[0];
  assert.equal(member.name === "run" && member.origin.kind === "declared" && member.origin.declaration === declarations[0], true,
    "the authentic logical member's published primary origin is its own first declaration");
  const pair = resolved(current.source.facts.objects.correspondingMember(shape, shape, declarations[0], "read"), "the original logical member resolves");
  assert.equal(pair.kind === "present" && pair.value.kind === "present", true);
  assert.equal(pair.value.source.declarations.length === declarations.length &&
    pair.value.source.declarations.every((declaration, index) => declaration === declarations[index]), true,
  "primary origin never discards any original overload");
  const callable = definition(current, pair.value.source.readType);
  assert.equal(callable.type.kind === "callable" && callable.type.calls.length === 3, true);
  assert.equal(callable.type.calls.every((signature, index) => signature.identity.declaration === declarations[index]), true,
    "every original overload retains its exact declaration and original order");
});

test("K-2446 an intersection of distinct same-named members has no single declared origin and is not described", () => {
  const current = fixture("declare const both: { a: int32 } & { a: string };");
  const value = current.source.facts.values.declaredSlot(current.declaration("both"));
  assert.equal(value.kind, "refused", "distinct original member roots cannot be replaced by a first declared origin");
  assert.equal(current.source.facts.values.declaredSlot(current.declaration("both")) === value, true,
    "the exact original refusal is stable rather than a guessed member definition");
});
