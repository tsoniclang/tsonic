import assert from "node:assert/strict";
import test from "node:test";
import { carrierDeclarationId, deriveCarrierVocabulary, productCarrierRegistryReferences,
  validateCarrierParity, validateCarrierRegistry } from "../helpers/carrier-registry.mjs";

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
const responsibilityFor = (id, declaration) => id.startsWith("kind:") ? `kinds/${id.slice("kind:".length)}`
  : `vocabulary/${declaration.symbol.replace(/([a-z0-9])([A-Z])/gu, "$1-$2").toLowerCase()}`;
const row = (id, declaration, kinds = ["target-named"]) =>
  ({ id, kinds, declaration, responsibility: responsibilityFor(id, declaration), frozen: false });
const rows = [
  ...vocabulary.kinds.map(kind => row(`kind:${kind}`, root, [kind])),
  ...vocabulary.contracts.map(declaration => row(carrierDeclarationId(declaration), declaration)),
];
const signed = new Set(["NATIVE-01"]);
const parity = (left, right = rows, differences = []) =>
  validateCarrierParity({ left: { rows: left, roles: [] }, right: { rows: right, roles: [] } }, differences, signed);
const validate = (selected, selectedVocabulary = vocabulary, opposite = rows) => [
  ...validateCarrierRegistry(selected, selectedVocabulary),
  ...parity(selected, opposite),
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

test("destructuring reads fields and constructs nothing; a rest binding builds a new carrier", () => {
  const changed = new Map(source);
  const module = "src/analysis/receivers.ts";
  changed.set(module, `import type { TargetTypeRef } from "../target-model/types/model.js";
    type Scope = { readonly receiver: TargetTypeRef; readonly fallback: TargetTypeRef };
    export function selectReceiver(scope: Scope, useFallback: boolean): TargetTypeRef {
      const { receiver, fallback } = scope;
      return useFallback ? fallback : receiver;
    }
    export function withoutId(carrier: TargetTypeRef & { readonly id?: string }): TargetTypeRef {
      const { id: _id, ...rest } = carrier;
      return rest;
    }`);
  const symbols = deriveCarrierVocabulary(changed, root).contracts.filter(declaration => declaration.module === module)
    .map(declaration => declaration.symbol);
  assert.deepEqual(symbols, ["withoutId"]);
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
  ["a structural row keyed to another responsibility", selected => [{ ...selected[0], responsibility: "vocabulary/named" }, ...selected.slice(1)], "Structural carrier responsibility must be kinds/source-primitive: kind:source-primitive"],
  ["a responsibility that names a target", selected => selected.map(entry => entry.id === "src/target-model/types/carriers/native.ts#named" ? { ...entry, responsibility: "vocabulary/rust-named" } : entry), "Carrier responsibility is not a neutral key: src/target-model/types/carriers/native.ts#named"],
  ["a responsibility that is not a family/name key", selected => selected.map(entry => entry.id === "src/target-model/types/carriers/native.ts#named" ? { ...entry, responsibility: "Named Carrier" } : entry), "Carrier responsibility is not a neutral key: src/target-model/types/carriers/native.ts#named"],
  ["an unexplained one-sided responsibility", selected => selected.map(entry => entry.id === "src/target-model/types/carriers/native.ts#named" ? { ...entry, responsibility: "vocabulary/only-here" } : entry), "Unexplained one-sided carrier responsibility: left:vocabulary/only-here"],
  ["missing frozen classification", selected => [{ ...selected[0], frozen: undefined }, ...selected.slice(1)], "Missing freeze classification: kind:source-primitive"],
  ["a counterpart naming the other target's declaration", selected => [{ ...selected[0], counterpart: root }, ...selected.slice(1)], "Invalid carrier row fields: kind:source-primitive"],
  ["a selecting closure instead of declarative data", selected => [{ ...selected[0], select: () => "target-named" }, ...selected.slice(1)], "Invalid carrier row fields: kind:source-primitive"],
]) {
  test(`carrier registry rejects ${name}`, () => {
    assert.equal(validate(mutate(rows)).includes(message), true, name);
  });
}

// The left target has one responsibility the right target lacks.
const oneSided = [...rows, { id: "native-qualifier", kinds: ["target-named"], declaration: { module: constructors, symbol: "named" },
  responsibility: "vocabulary/native-qualifier", frozen: false }];

test("a signed shared difference explains a one-sided responsibility without a cross-target reference", () => {
  const difference = { responsibility: "vocabulary/native-qualifier", target: "left", symbol: "named", register: "NATIVE-01",
    reason: "The selected native language expresses this responsibility in its type qualifier." };
  assert.deepEqual(parity(oneSided, rows, [difference]), []);
});

for (const [name, difference, message] of [
  ["an unsigned native difference", { register: "UNSIGNED", reason: "asserted difference" }, "Unproved native carrier difference: left:vocabulary/native-qualifier"],
  ["an empty native reason", { register: "NATIVE-01", reason: " " }, "Unproved native carrier difference: left:vocabulary/native-qualifier"],
]) {
  test(`shared carrier parity rejects ${name}`, () => {
    assert.equal(parity(oneSided, rows, [{ responsibility: "vocabulary/native-qualifier", target: "left", symbol: "named", ...difference }])
      .includes(message), true);
  });
}

test("a shared difference for a responsibility its target does not have is stale", () => {
  const difference = { responsibility: "vocabulary/native-qualifier", target: "right", symbol: "named", register: "NATIVE-01", reason: "stale" };
  assert.equal(parity(oneSided, rows, [difference]).includes("Stale carrier difference: right:vocabulary/native-qualifier"), true);
});

test("a structural family absent on the other target is a one-sided responsibility", () => {
  const right = rows.filter(entry => entry.id !== "kind:source-primitive");
  assert.equal(parity(rows, right).includes("Unexplained one-sided carrier responsibility: left:kinds/source-primitive"), true);
});

test("product source that carries or reads registry data is reported", () => {
  const files = new Map([
    ["src/target-model/types/carriers/registry-native.ts", `import type { TargetCarrierRegistryEntry } from "@tsonic/target-api";`],
    ["src/analysis/reader.ts", `import { carrierRegistry } from "../target-model/types/carriers/registry.js";`],
    ["src/analysis/ordinary.ts", `export const registryPatch = "crates-io";`],
  ]);
  assert.deepEqual(productCarrierRegistryReferences(files),
    ["src/target-model/types/carriers/registry-native.ts", "src/analysis/reader.ts"]);
});
