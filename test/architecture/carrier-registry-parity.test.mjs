import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadCarrierRegistry, productCarrierRegistryReferences, readCarrierDivergenceRegister,
  readCarrierRegistrySourceFiles, validateCarrierParity, validateCarrierRegistry } from "../helpers/carrier-registry.mjs";
import { carrierParityDifferences } from "./carrier-parity.mjs";
import { readArchitectureTypeScript } from "./tooling/typescript-source.mjs";

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const repositories = { csharp: "tsonic-csharp", rust: "tsonic-rust" };
const registries = {};
for (const [target, repository] of Object.entries(repositories)) {
  registries[target] = await loadCarrierRegistry(path.join(workspace, repository));
}
const signedDifferences = await readCarrierDivergenceRegister();
const parity = (selected = registries, differences = carrierParityDifferences) =>
  validateCarrierParity(selected, differences, signedDifferences);
const withoutDifference = (target, responsibility) => carrierParityDifferences.filter(entry =>
  !(entry.target === target && entry.responsibility === responsibility));

test("carrier registries are test data: no product module carries or reads them", async () => {
  for (const repository of Object.values(repositories)) {
    const files = await readCarrierRegistrySourceFiles(path.join(workspace, repository));
    assert.deepEqual(productCarrierRegistryReferences(files), [], `${repository} product source`);
    const carriers = await readdir(path.join(workspace, repository, "src/target-model/types/carriers"));
    assert.deepEqual(carriers.filter(name => name.startsWith("registry")), [], `${repository} ships no registry module`);
  }
});

test("neither compiler's registry names the other compiler; pairing lives only in the shared tree", async () => {
  for (const [target, pattern] of [["rust", /csharp|c#|clr|dotnet|roslyn/iu], ["csharp", /rust|cargo/iu]]) {
    const directory = path.join(workspace, repositories[target], "test/target-model/types/carriers/registry");
    for (const name of await readdir(directory)) {
      assert.doesNotMatch(await readFile(path.join(directory, name), "utf8"), pattern, `${target} ${name}`);
    }
  }
});

test("both registries cover their own carrier vocabulary", () => {
  for (const [target, registry] of Object.entries(registries)) {
    assert.deepEqual(validateCarrierRegistry(registry.rows, registry.vocabulary), [], target);
  }
});

test("the registries pair by responsibility; one-sided responsibilities have signed native differences", () => {
  assert.equal(signedDifferences.size > 0, true);
  assert.deepEqual(parity(), []);
});

test("the native trait constructor pairs with the named-contract owner and preserves native arguments", async () => {
  const { rustNativeTraitRef } = await import("../../../tsonic-rust/dist/target-model/types/carriers/native.js");
  const { csharpTargetNamedType } = await import("../../../tsonic-csharp/dist/target-model/types/factories.js");
  const value = { kind: "source-primitive", name: "int64" };
  const lifetime = { kind: "parameter", identity: "checked:lifetime", name: "scope" };
  const extent = { kind: "integer", value: "9007199254740993" };
  const arguments_ = [{ kind: "type", type: value }, { kind: "lifetime", lifetime }, { kind: "const", value: extent }];
  const native = rustNativeTraitRef("checked::Contract", arguments_);
  assert.equal(native.kind, "trait-ref");
  assert.equal(native.genericArguments === arguments_, true, "exact native arguments, without reclassification");
  assert.equal(native.genericArguments[0].type === value, true);
  assert.equal(native.genericArguments[1].lifetime === lifetime, true);
  assert.equal(native.genericArguments[2].value === extent, true);
  assert.equal(native.associatedConstraints.length, 0, "the actual constructor does not invent associated bindings");
  const named = csharpTargetNamedType("checked.Contract`1", [value], undefined, { allowsRefLikeTypeArguments: [false] });
  assert.equal(named.kind, "target-named");
  assert.equal(named.typeArguments[0] === value, true, "the CLR native named contract preserves its type argument");
  const rustRow = registries.rust.rows.find(entry => entry.declaration.symbol === "rustNativeTraitRef");
  const csharpRow = registries.csharp.rows.find(entry => !entry.id.startsWith("kind:") && entry.declaration.symbol === "csharpTargetNamedType");
  assert.equal(rustRow !== undefined && csharpRow !== undefined, true, "both concrete constructors have one registry owner");
  assert.deepEqual(rustRow.kinds, ["trait-ref"]);
  assert.equal(rustRow.responsibility, csharpRow.responsibility, "paired by one neutral responsibility");
});

test("the structural native difference is pinned to fixed arrays and never replaces the concrete row's proof", async () => {
  const { rustFixedArrayTargetType, rustFixedArrayCarrierValue } =
    await import("../../../tsonic-rust/dist/target-model/types/carriers/native.js");
  const { rustTypeFromCarrier } = await import("../../../tsonic-rust/dist/backend/planner/types/render.js");
  const element = { kind: "source-primitive", name: "int64" };
  const extent = { kind: "integer", value: "9007199254740993" };
  const carrier = rustFixedArrayTargetType(element, extent);
  assert.equal(carrier.kind, "target-specific", "the structural arm contains the actual native fixed-array alternative");
  const fixed = rustFixedArrayCarrierValue(carrier);
  assert.equal(fixed !== undefined, true, "the actual fixed-array owner recognizes its carrier");
  assert.equal(fixed.element === element, true, "the original native element is retained");
  assert.equal(fixed.length === extent, true, "the exact type-level extent is retained");
  const rendered = rustTypeFromCarrier(carrier);
  assert.equal(rendered?.kind, "fixed-array", "native array syntax, not a manufactured CLR carrier");
  assert.equal(rendered.length.value, 9007199254740993n, "native extent never rounds through a number");
  const structural = carrierParityDifferences.find(entry => entry.target === "rust" && entry.responsibility === "kinds/target-specific");
  assert.equal(structural?.register, "S11-11", "only the signed native fixed-array constraint");
  const concrete = registries.rust.rows.find(row => row.declaration.symbol === "rustFixedArrayTargetType");
  for (const responsibility of ["kinds/target-specific", concrete.responsibility]) {
    assert.equal(parity(registries, withoutDifference("rust", responsibility))
      .includes(`Unexplained one-sided carrier responsibility: rust:${responsibility}`), true,
    "neither the umbrella nor the concrete carrier can borrow the other's native-constraint proof");
  }
});

test("a structural kind row cannot be keyed to another responsibility", () => {
  const rows = registries.csharp.rows.map(row => row.id === "kind:array" ? { ...row, responsibility: "vocabulary/string" } : row);
  assert.equal(validateCarrierRegistry(rows, registries.csharp.vocabulary)
    .includes("Structural carrier responsibility must be kinds/array: kind:array"), true);
});

test("native const and associated-type rows fail strict parity without their exact proven register entries", () => {
  for (const [symbol, register] of [["rustFixedArrayTargetType", "S11-11"], ["rustIndexedFieldTrait", "S11-12"],
    ["rustIndexedFieldProjection", "S11-12"]]) {
    const actual = registries.rust.rows.find(row => row.declaration.symbol === symbol);
    const entry = carrierParityDifferences.find(candidate => candidate.target === "rust" &&
      candidate.responsibility === actual?.responsibility);
    assert.equal(entry?.register, register, symbol);
    assert.equal(registries.csharp.rows.some(row => row.responsibility === actual.responsibility), false, symbol);
    assert.equal(parity(registries, withoutDifference("rust", actual.responsibility))
      .includes(`Unexplained one-sided carrier responsibility: rust:${actual.responsibility}`), true, symbol);
  }
});

test("a difference for a responsibility its target lacks, or without a signed register, is rejected", () => {
  const stale = [...carrierParityDifferences, { responsibility: "vocabulary/never-present", target: "csharp",
    symbol: "csharpNeverPresent", register: "S11-01", reason: "stale" }];
  assert.equal(parity(registries, stale).includes("Stale carrier difference: csharp:vocabulary/never-present"), true);
  const unsigned = carrierParityDifferences.map((entry, index) => index === 0 ? { ...entry, register: "S99-99" } : entry);
  assert.equal(parity(registries, unsigned).some(failure => failure.startsWith("Unproved native carrier difference:")), true);
});

test("native memory item names have mirrored pure name owners and never manufacture a value carrier or syntax node", async () => {
  const files = new Map();
  for (const repo of ["tsonic-csharp", "tsonic-rust"]) {
    const file = `${repo}/src/target-model/names/native-memory.ts`;
    files.set(file, await readFile(path.join(workspace, file), "utf8"));
  }
  const checked = readArchitectureTypeScript(files);
  let strings = 0;
  const visit = node => {
    const kind = checked.ast.kindName(node);
    assert.equal(["KindImportDeclaration", "KindImportType", "KindFunctionDeclaration", "KindArrowFunction",
      "KindFunctionExpression", "KindNewExpression"].includes(kind), false, kind);
    if (kind === "KindCallExpression") {
      const call = checked.ast.as.AsCallExpression(node);
      const property = checked.ast.as.AsPropertyAccessExpression(call.Expression);
      assert.equal(property !== undefined, true, "literal-name constructor");
      assert.equal(checked.ast.text(property.Expression), "Object");
      assert.equal(checked.ast.text(checked.ast.name(call.Expression)), "freeze");
    }
    if (kind === "KindStringLiteral") strings += 1;
    checked.ast.forEachChild(node, visit);
  };
  for (const file of checked.sourceFiles) visit(file);
  assert.equal(strings, 7);
  assert.equal(registries.csharp.rows.some(row => row.declaration.symbol === "csharpRuntimeNativeLocationTargetType"), false);
});
