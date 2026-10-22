import assert from "node:assert/strict";
import test from "node:test";
import { carrierDeclarationId, deriveCarrierVocabulary, inspectCarrierRegistrySource,
  validateCarrierRegistry, validateCarrierRegistrySymmetry } from "../helpers/carrier-registry.mjs";

const model = "src/target-model/types/model.ts";
const constructors = "src/target-model/types/carriers/native.ts";
const source = new Map([
  [model, `
    export interface Named { readonly kind: "target-named"; readonly id: string; }
    type Primitive = { readonly kind: "source-primitive"; readonly name: string };
    export type TargetTypeRef = Named | Primitive;
  `],
  [constructors, `
    import type { TargetTypeRef as Ref, Named } from "../model.js";
    export function named(value: Ref): Named { return { kind: "target-named", id: "exact-id" }; }
    export function read(value: Ref): Ref { return value; }
    export function wrapped(value: Ref): Ref { return named(value); }
    export function label(value: Ref): string { return named(value).id; }
    export const arrow = (value: Ref): Ref => ({ kind: "source-primitive", name: "int32" });
    export const outer = (value: Ref): Ref => {
      const local = (): Ref => ({ kind: "target-named", id: "not-an-export" });
      return local();
    };
  `],
]);
const root = { module: model, symbol: "TargetTypeRef" };
const vocabulary = deriveCarrierVocabulary(source, root);
const row = (id, declaration, kinds = ["target-named"]) => ({ id, kinds, declaration, counterpart: root, frozen: false });
const rows = [
  ...vocabulary.kinds.map(kind => row(`kind:${kind}`, root, [kind])),
  ...vocabulary.contracts.map(declaration => row(carrierDeclarationId(declaration), declaration)),
];
const signed = new Set(["NATIVE-01"]);
const validate = (selected, selectedVocabulary = vocabulary, opposite = rows) => [
  ...validateCarrierRegistry(selected, selectedVocabulary),
  ...validateCarrierRegistrySymmetry({ rows: selected, vocabulary: selectedVocabulary }, { rows: opposite, vocabulary }, signed),
];

test("carrier vocabulary derives discriminants through actual aliases and interfaces, not a maintained kind list", () => {
  assert.deepEqual(vocabulary.kinds, ["source-primitive", "target-named"]);
  const changed = new Map(source);
  changed.set(model, `${source.get(model)} export type Extended = TargetTypeRef | { readonly kind: "new-native-kind" };`);
  const discovered = deriveCarrierVocabulary(changed, { module: model, symbol: "Extended" });
  assert.deepEqual(discovered.kinds, ["new-native-kind", "source-primitive", "target-named"]);
  assert.equal(validate(rows, discovered).includes("Structural carrier must have one owner: new-native-kind"), true);
});

test("carrier vocabulary follows imported return aliases, constructor calls and arrow factories, not reader names", () => {
  assert.deepEqual(vocabulary.contracts.map(declaration => declaration.symbol).sort(), ["arrow", "named", "outer", "wrapped"]);
  assert.deepEqual(validate(rows), []);
  const changed = new Map(source);
  changed.set(constructors, `${source.get(constructors)}
    export function unrelatedSpelling(value: Ref): Ref { return { kind: "target-named", id: "second-exact-id" }; }
  `);
  const discovered = deriveCarrierVocabulary(changed, root);
  assert.equal(validate(rows, discovered).some(failure => failure.endsWith("#unrelatedSpelling")), true);
});

test("records whose own kind equals a carrier kind are not carrier constructions", () => {
  const changed = new Map(source);
  const module = "src/analysis/records.ts";
  changed.set(module, `import type { TargetTypeRef } from "../target-model/types/model.js";
    export interface Layout { readonly kind: "target-named"; readonly size: number; }
    export type Pattern = { readonly kind: "target-named"; readonly elements: number } | { readonly kind: "object" };
    export function layout(): Layout { return { kind: "target-named", size: 4 }; }
    export function patterns(record: (pattern: Pattern) => void) { record({ kind: "target-named", elements: 2 }); }
    export function carrier(): TargetTypeRef | Layout { return { kind: "target-named", id: "checked:carrier" }; }
    export function untyped() { return { kind: "target-named" as const, id: "checked:untyped" }; }`);
  const symbols = deriveCarrierVocabulary(changed, root).contracts.filter(declaration => declaration.module === module)
    .map(declaration => declaration.symbol).sort();
  assert.deepEqual(symbols, ["carrier", "untyped"],
    "a named non-carrier record and a literal typed by one are not carriers; carrier-typed and untyped literals still are");
});

test("native syntax and record unions that reuse carrier kind names are not carrier results", () => {
  const changed = new Map(source);
  const module = "src/backend/planner/syntax.ts";
  changed.set(module, `import type { TargetTypeRef } from "../../target-model/types/model.js";
    export type NativeSyntax = { readonly kind: "target-named"; readonly path: string } | { readonly kind: "call"; readonly callee: string };
    export type OperationFact = { readonly kind: "source-primitive"; readonly operationId: string } | { readonly kind: "typeof" };
    export function render(carrier: TargetTypeRef): NativeSyntax { return { kind: "call", callee: String(carrier.kind) }; }
    export function nested(carrier: TargetTypeRef): Extract<NativeSyntax, { readonly kind: "call" }> {
      return { kind: "call", callee: render(carrier).kind };
    }
    export function fact(): OperationFact | undefined { return { kind: "typeof" }; }
    export function inline(): { readonly kind: "target-named"; readonly id: string } { return { kind: "target-named", id: "checked:inline" }; }`);
  const symbols = deriveCarrierVocabulary(changed, root).contracts.filter(declaration => declaration.module === module)
    .map(declaration => declaration.symbol);
  assert.deepEqual(symbols, ["inline"],
    "arms of a named syntax or fact union are its own discriminants; an inline carrier literal in the declared type still counts");
});

test("untyped values are carrier contracts only when their checked result is a carrier", () => {
  const changed = new Map(source);
  const module = "src/analysis/untyped.ts";
  changed.set(module, `import type { TargetTypeRef } from "../target-model/types/model.js";
    import { named } from "../target-model/types/carriers/native.js";
    export function handlers(carrier: TargetTypeRef) {
      return { read: () => named(carrier).id, handled: true as const };
    }
    export function rejected(reason: string) { return { kind: "rejected" as const, reason }; }
    export function selected(carrier: TargetTypeRef) { return named(carrier); }
    export const plain = { kind: "source-primitive" as const, name: "int64" };`);
  const symbols = deriveCarrierVocabulary(changed, root).contracts.filter(declaration => declaration.module === module)
    .map(declaration => declaration.symbol).sort();
  assert.deepEqual(symbols, ["plain", "selected"],
    "handler objects and non-carrier records are not contracts; an inferred carrier result and a structural carrier value are");
});

test("passing a received carrier through constructs nothing", () => {
  const changed = new Map(source);
  const module = "src/analysis/normalize.ts";
  changed.set("src/backend/planner/syntax.ts",
    `export type NativeSyntax = { readonly kind: "target-named"; readonly path: string } | { readonly kind: "call"; readonly callee: string };`);
  changed.set(module, `import type { TargetTypeRef } from "../target-model/types/model.js";
    import type { NativeSyntax } from "../backend/planner/syntax.js";
    export function syntaxFor(carrier: TargetTypeRef): NativeSyntax { return { kind: "call", callee: carrier.kind }; }
    export function normalize(carrier: TargetTypeRef, expected: TargetTypeRef | undefined): TargetTypeRef {
      return syntaxFor(carrier).kind === "call" ? expected ?? carrier : carrier;
    }`);
  const symbols = deriveCarrierVocabulary(changed, root).contracts.filter(declaration => declaration.module === module);
  assert.deepEqual(symbols, [], "a carrier-typed function that only returns carriers it receives is not a constructor");
});

test("carrier vocabulary rejects a missing root and syntactically invalid source", () => {
  assert.throws(() => deriveCarrierVocabulary(source, { module: model, symbol: "Missing" }), /root does not exist/u);
  assert.throws(() => deriveCarrierVocabulary(new Map([[model, "export type Broken = @;"]]), root), /invalid syntax/u);
});

test("carrier vocabulary cannot silently discard an unresolved union arm or a recursive alias", () => {
  for (const declaration of ["export type Incomplete = TargetTypeRef | Missing;", "type Loop = Loop; export type Incomplete = TargetTypeRef | Loop;"]) {
    const changed = new Map(source);
    changed.set(model, `${source.get(model)} ${declaration}`);
    assert.throws(() => deriveCarrierVocabulary(changed, { module: model, symbol: "Incomplete" }),
      /unproved structural arm|recursive structural alias/u);
  }
});

test("inferred factory declarations and registry-prefixed modules cannot escape concrete coverage", () => {
  const changed = new Map(source);
  const module = "src/target-model/types/carriers/registry-new-owner.ts";
  changed.set(module, `export const inferred = () => ({ kind: "target-named" as const, id: "checked:new" });`);
  const discovered = deriveCarrierVocabulary(changed, root);
  assert.equal(validate(rows, discovered).includes(`Concrete carrier must have one owner: ${module}#inferred`), true);
});

test("private declarations inside an exported arrow do not become module exports", () => {
  assert.equal(vocabulary.exports.has(`${constructors}#local`), false);
  assert.equal(vocabulary.contracts.some(declaration => declaration.symbol === "local"), false);
  assert.equal(vocabulary.contracts.some(declaration => declaration.symbol === "outer"), true);
});

test("a concrete constructor outside the carriers folder still requires its registry owner", () => {
  const changed = new Map(source);
  const module = "src/target-model/types/another-owner.ts";
  changed.set(module, `import type { TargetTypeRef } from "./model.js";
    export function additional(): TargetTypeRef { return { kind: "target-named", id: "checked:additional" }; }`);
  const discovered = deriveCarrierVocabulary(changed, root);
  assert.equal(validate(rows, discovered).includes(`Concrete carrier must have one owner: ${module}#additional`), true);
});

for (const [name, mutate, message] of [
  ["omitted structural family", selected => selected.filter(entry => entry.id !== "kind:source-primitive"), "Structural carrier must have one owner: source-primitive"],
  ["omitted concrete factory", selected => selected.filter(entry => entry.declaration.symbol !== "named"), `Concrete carrier must have one owner: ${constructors}#named`],
  ["duplicate concrete declaration with another identity", selected => [...selected, { ...selected.find(entry => entry.declaration.symbol === "named"), id: "another-identity" }], `Concrete carrier must have one owner: ${constructors}#named`],
  ["duplicate identity", selected => [...selected, selected[0]], "Duplicate carrier identity: kind:source-primitive"],
  ["unknown discriminant", selected => [{ ...selected[0], kinds: ["imaginary"] }, ...selected.slice(1)], "Unknown carrier discriminant: kind:source-primitive"],
  ["duplicate discriminant", selected => [{ ...selected[0], kinds: ["source-primitive", "source-primitive"] }, ...selected.slice(1)], "Unknown carrier discriminant: kind:source-primitive"],
  ["missing discriminant", selected => [{ ...selected[0], kinds: [] }, ...selected.slice(1)], "Unknown carrier discriminant: kind:source-primitive"],
  ["stale declaration symbol", selected => [{ ...selected[0], declaration: { module: model, symbol: "Missing" } }, ...selected.slice(1)], `Stale carrier declaration: ${model}#Missing`],
  ["unexplained asymmetry", selected => [{ ...selected[0], counterpart: null }, ...selected.slice(1)], "Unexplained one-sided carrier: kind:source-primitive"],
  ["unregistered counterpart", selected => [{ ...selected[0], counterpart: { module: constructors, symbol: "read" } }, ...selected.slice(1)], "Missing carrier counterpart: kind:source-primitive"],
  ["stale counterpart", selected => [{ ...selected[0], counterpart: { module: model, symbol: "Missing" } }, ...selected.slice(1)], "Missing carrier counterpart: kind:source-primitive"],
  ["unsigned native difference", selected => [{ ...selected[0], divergence: { register: "UNSIGNED", reason: "asserted difference" } }, ...selected.slice(1)], "Unproved native carrier difference: kind:source-primitive"],
  ["empty native reason", selected => [{ ...selected[0], divergence: { register: "NATIVE-01", reason: " " } }, ...selected.slice(1)], "Unproved native carrier difference: kind:source-primitive"],
  ["missing frozen classification", selected => [{ ...selected[0], frozen: undefined }, ...selected.slice(1)], "Missing freeze classification: kind:source-primitive"],
  ["a selecting closure instead of declarative data", selected => [{ ...selected[0], select: () => "target-named" }, ...selected.slice(1)], "Invalid carrier row fields: kind:source-primitive"],
]) {
  test(`carrier registry rejects ${name}`, () => {
    assert.equal(validate(mutate(rows)).includes(message), true, name);
  });
}

test("a signed native difference describes the actual boundary without fabricating a counterpart", () => {
  const selected = [{ ...rows[0], counterpart: null,
    divergence: { register: "NATIVE-01", reason: "The selected native language expresses this responsibility in its type qualifier." } }, ...rows.slice(1)];
  assert.deepEqual(validate(selected), []);
});

test("a structural family absent on the counterpart cannot hide behind its generic model declaration", () => {
  const left = { rows, vocabulary };
  const right = { rows, vocabulary: { ...vocabulary, kinds: ["target-named"] } };
  assert.equal(validateCarrierRegistrySymmetry(left, right, signed).includes("Unexplained one-sided carrier: kind:source-primitive"), true);
});

test("an existing registered counterpart with the wrong structural kind is rejected in either direction", () => {
  for (const divergence of [undefined, { register: "NATIVE-01", reason: "A claimed native constraint does not change a known structural kind." }]) {
    const incorrect = rows.map(entry => entry.id === "kind:source-primitive"
      ? { ...entry, counterpart: { module: constructors, symbol: "named" }, ...(divergence === undefined ? {} : { divergence }) } : entry);
    const valid = { rows, vocabulary };
    const invalid = { rows: incorrect, vocabulary };
    for (const [left, right] of [[valid, invalid], [invalid, valid]]) {
      assert.equal(validateCarrierRegistrySymmetry(left, right, signed)
        .includes("Structural carrier counterpart kind mismatch: kind:source-primitive"), true);
    }
  }
});

const registryMetadata = `import type { TargetCarrierRegistryEntry } from "@tsonic/target-api";
import type { TargetTypeRef } from "../model.js";
export const nativeEntries: readonly TargetCarrierRegistryEntry<TargetTypeRef["kind"]>[] = Object.freeze([
  { id: "native#carrier", kinds: ["target-named"], declaration: { module: "native.ts", symbol: "nativeCarrier" },
    counterpart: { module: "native.ts", symbol: "csharpCarrier" },
    divergence: { register: "NATIVE-01", reason: "dotnet has a different native qualifier" }, frozen: false }
]);`;
const inspectMetadata = (text, extra = []) => inspectCarrierRegistrySource(
  new Map([["src/unrestricted-name.ts", text], ...extra]), signed);

test("declared inert counterpart metadata is recognized structurally, not by filename", () => {
  const proof = inspectMetadata(registryMetadata);
  assert.equal(proof.failures.length, 0, proof.failures.join("\n"));
  assert.equal(proof.modules.length, 1, "the actual typed metadata module is proven");
  assert.doesNotMatch(proof.sources.get("src/unrestricted-name.ts"), /csharp|roslyn|dotnet/iu);
  assert.equal(proof.sources.get("src/unrestricted-name.ts").includes('symbol: "nativeCarrier"'), true,
    "own declaration identity remains visible");
});

test("metadata masking preserves authored UTF-16 offsets and never hides leading comments", () => {
  const text = `/* é😀 */\n${registryMetadata.replace('"csharpCarrier"', '/* roslyn */ "csharpCarrier"')}`;
  const proof = inspectMetadata(text);
  assert.equal(proof.failures.length, 0, proof.failures.join("\n"));
  assert.match(proof.sources.get("src/unrestricted-name.ts"), /\/\* roslyn \*\//u);
  assert.doesNotMatch(proof.sources.get("src/unrestricted-name.ts"), /csharpCarrier|dotnet/iu);
  assert.equal(proof.sources.get("src/unrestricted-name.ts").length, text.length, "exact offsets retained");
});

test("type-only aliases retain the same exact shared registry identity", () => {
  const text = registryMetadata.replace("{ TargetCarrierRegistryEntry }", "{ TargetCarrierRegistryEntry as Entry }")
    .replace("readonly TargetCarrierRegistryEntry<", "readonly Entry<");
  const proof = inspectMetadata(text);
  assert.equal(proof.failures.length, 0, proof.failures.join("\n"));
  assert.doesNotMatch(proof.sources.get("src/unrestricted-name.ts"), /csharp|roslyn|dotnet/iu);
});

for (const [name, change] of [
  ["runtime DTO import", text => text.replace("import type { TargetCarrierRegistryEntry }", "import { TargetCarrierRegistryEntry }")],
  ["foreign implementation import", text => `import { select } from "@tsonic/csharp";\n${text}`],
  ["foreign type-only import", text => `import type { Foreign } from "@tsonic/csharp";\n${text}`],
  ["additional executable statement", text => `${text}\nconsole.log("dotnet");`],
  ["mutable registry binding", text => text.replace("export const nativeEntries", "export let nativeEntries")],
  ["a different type operator", text => text.replace("readonly TargetCarrierRegistryEntry", "keyof TargetCarrierRegistryEntry")],
  ["uninitialized declaration", text => text.slice(0, text.indexOf(" = Object.freeze")) + ";"],
  ["unfrozen registry array", text => text.replace("Object.freeze([", "[").replace("\n]);", "\n];")],
  ["plain function instead of freeze", text => text.replace("Object.freeze([", "freeze([")],
  ["indexed freeze access", text => text.replace("Object.freeze([", 'Object["freeze"]([')],
  ["constructor instead of freeze", text => text.replace("Object.freeze([", "new Object([")],
  ["computed counterpart", text => text.replace('symbol: "csharpCarrier"', 'symbol: select("csharp")')],
  ["computed counterpart key", text => text.replace('counterpart: { module:', 'counterpart: { ["module"]:')],
  ["counterpart getter", text => text.replace('symbol: "csharpCarrier"', 'get symbol() { return "csharpCarrier"; }')],
  ["selecting closure", text => text.replace("frozen: false", 'frozen: false, select: () => "csharp"')],
  ["spread row", text => text.replace('id: "native#carrier"', '...selected, id: "native#carrier"')],
  ["computed frozen flag", text => text.replace("frozen: false", "frozen: Boolean(0)")],
  ["duplicate row field", text => text.replace("frozen: false", "frozen: false, frozen: true")],
  ["unknown row field", text => text.replace("frozen: false", "frozen: false, extra: 1")],
  ["unsigned native divergence", text => text.replace('register: "NATIVE-01"', 'register: "UNSIGNED"')],
  ["computed divergence reason", text => text.replace('reason: "dotnet has a different native qualifier"', 'reason: explain("dotnet")')],
  ["empty divergence reason", text => text.replace('reason: "dotnet has a different native qualifier"', 'reason: ""')],
  ["Object binding shadows freeze", text => text.replace("export const nativeEntries", "export const Object")],
]) {
  test(`inert registry proof rejects ${name} without masking any source`, () => {
    const text = change(registryMetadata);
    const proof = inspectMetadata(text);
    assert.equal(proof.failures.length > 0, true, name);
    assert.equal(proof.sources.get("src/unrestricted-name.ts"), text, "invalid source remains fully visible");
  });
}

test("same-spelled local registry types cannot authorize counterpart masking", () => {
  const text = registryMetadata.replace('import type { TargetCarrierRegistryEntry } from "@tsonic/target-api";',
    "type TargetCarrierRegistryEntry<Kind> = { kind: Kind };");
  const proof = inspectMetadata(text);
  assert.equal(proof.modules.length, 0, "no canonical shared declaration");
  assert.match(proof.sources.get("src/unrestricted-name.ts"), /csharp/iu);
});

test("foreign names outside the two admitted metadata fields remain prohibited", () => {
  for (const text of [registryMetadata.replace('id: "native#carrier"', 'id: "dotnet#carrier"'),
    registryMetadata.replace('symbol: "nativeCarrier"', 'symbol: "csharpOwnCarrier"'),
    `${registryMetadata}\n/* roslyn */`]) {
    const proof = inspectMetadata(text);
    assert.equal(proof.failures.length, 0, "literal metadata shape is still inert");
    assert.match(proof.sources.get("src/unrestricted-name.ts"), /csharp|roslyn|dotnet/iu);
  }
});

test("only pure registry aggregation may consume counterpart data", () => {
  const aggregate = `import type { TargetCarrierRegistryEntry } from "@tsonic/target-api";
import type { TargetTypeRef } from "../model.js";
import { nativeEntries } from "./unrestricted-name.js";
export const registry: readonly TargetCarrierRegistryEntry<TargetTypeRef["kind"]>[] = Object.freeze([...nativeEntries]);`;
  const proof = inspectMetadata(registryMetadata, [["src/aggregate.ts", aggregate]]);
  assert.equal(proof.failures.length, 0, proof.failures.join("\n"));
  assert.equal(proof.modules.length, 2, "literal metadata and its non-selecting aggregate");
  const alias = aggregate.replace("{ nativeEntries }", "{ nativeEntries as selectedEntries }")
    .replace("[...nativeEntries]", "[...selectedEntries]");
  const aliased = inspectMetadata(registryMetadata, [["src/aggregate.ts", alias]]);
  assert.equal(aliased.failures.length, 0, aliased.failures.join("\n"));
  for (const invalidAggregate of [
    aggregate.replace("{ nativeEntries }", "{ nativeEntries, nativeEntries as Object }"),
    aggregate.replace("[...nativeEntries]", "[...unboundEntries]"),
    aggregate.replace("{ nativeEntries }", "{ wrongExport as nativeEntries }"),
    aggregate.replace("{ nativeEntries }", "* as nativeEntries"),
    aggregate.replace("{ nativeEntries }", "nativeEntries"),
  ]) {
    const invalid = inspectMetadata(registryMetadata, [["src/aggregate.ts", invalidAggregate]]);
    assert.equal(invalid.failures.length > 0, true, "only the actual imported metadata export can be aggregated");
    assert.equal(invalid.sources.get("src/unrestricted-name.ts"), registryMetadata, "invalid bindings authorize no masking");
  }
  for (const consumer of [
    'import { nativeEntries } from "./unrestricted-name.js"; export const selected = nativeEntries[0].counterpart.symbol;',
    'export { nativeEntries } from "./unrestricted-name.js";',
    'export async function select() { return (await import("./unrestricted-name.js")).nativeEntries[0].counterpart; }',
    'export async function select() { return (await import(`./unrestricted-name.js`)).nativeEntries[0].counterpart; }',
    'export async function select() { return (await import(("./unrestricted-name.js"))).nativeEntries[0].counterpart; }',
    'export async function select() { return (await import(((`./unrestricted-name.js`)))).nativeEntries[0].counterpart; }',
    'export type Counterpart = (typeof import("./unrestricted-name.js"))["nativeEntries"][number]["counterpart"];',
    ...['"./unrestricted-name.js"', '`./unrestricted-name.js`'].flatMap(specifier => [
      `${specifier} as const`, `${specifier} satisfies string`, `${specifier}!`, `<const>${specifier}`,
      `((${specifier} as const) satisfies string)!`,
    ].map(operand => `export async function select() { return (await import(${operand})).nativeEntries[0].counterpart; }`)),
  ]) {
    const invalid = inspectMetadata(registryMetadata, [["src/consumer.ts", consumer]]);
    assert.equal(invalid.failures.includes("Production consumer of carrier registry metadata: src/consumer.ts"), true,
      "ordinary code may neither decide with nor expose the counterpart records");
    assert.equal(invalid.sources.get("src/unrestricted-name.ts"), registryMetadata, "no mask on an invalid graph");
  }
});
