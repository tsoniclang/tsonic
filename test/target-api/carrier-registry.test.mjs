import assert from "node:assert/strict";
import test from "node:test";
import { carrierDeclarationId, deriveCarrierVocabulary, validateCarrierRegistry, validateCarrierRegistrySymmetry } from "../helpers/carrier-registry.mjs";

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
