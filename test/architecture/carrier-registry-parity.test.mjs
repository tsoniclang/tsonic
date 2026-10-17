import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { inspectCarrierRegistrySource, loadCarrierRegistry, readCarrierDivergenceRegister,
  readCarrierRegistrySourceFiles, validateCarrierRegistrySymmetry } from "../helpers/carrier-registry.mjs";
import { readArchitectureTypeScript } from "./tooling/typescript-source.mjs";

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const registries = [];
for (const repository of ["tsonic-csharp", "tsonic-rust"]) {
  registries.push(await loadCarrierRegistry(path.join(workspace, repository)));
}
const signedDifferences = await readCarrierDivergenceRegister();

test("both target registries are inert declared data without production consumers", async () => {
  for (const repository of ["tsonic-csharp", "tsonic-rust"]) {
    const files = await readCarrierRegistrySourceFiles(path.join(workspace, repository));
    const proof = inspectCarrierRegistrySource(files, signedDifferences);
    assert.equal(proof.modules.length, 5, `${repository} has four literal registries and their pure aggregate`);
    assert.equal(proof.failures.length, 0, proof.failures.join("\n"));
  }
});

test("the native trait constructor has its actual named-contract counterpart and preserves native arguments", async () => {
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
  const counterpart = csharpTargetNamedType("checked.Contract`1", [value], undefined,
    { allowsRefLikeTypeArguments: [false], valueType: false });
  assert.equal(counterpart.kind, "target-named");
  assert.equal(counterpart.typeArguments[0] === value, true, "the CLR native named contract preserves its type argument");
  const row = registries[1].rows.find(entry => entry.declaration.symbol === "rustNativeTraitRef");
  assert.equal(row !== undefined, true, "the concrete native constructor must have one registry owner");
  assert.equal(row.kinds.length, 1);
  assert.equal(row.kinds[0], "trait-ref");
  assert.equal(row.counterpart.module, "src/target-model/types/factories.ts");
  assert.equal(row.counterpart.symbol, "csharpTargetNamedType");
});

test("built C# and Rust carrier registries share checked counterparts or signed native constraints", () => {
  assert.equal(signedDifferences.size > 0, true);
  assert.deepEqual(validateCarrierRegistrySymmetry(registries[0], registries[1], signedDifferences), []);
});

test("the structural native difference is pinned to fixed arrays and never replaces concrete counterpart proof", async () => {
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
  const [csharp, rust] = registries;
  const structural = rust.rows.find(row => row.id === "kind:target-specific");
  assert.equal(structural?.divergence?.register, "S11-11", "only the signed native fixed-array constraint");
  for (const actual of [structural, rust.rows.find(row => row.declaration.symbol === "rustFixedArrayTargetType")]) {
    assert.equal(actual !== undefined, true, "both structural and concrete rows are required");
    const rows = rust.rows.map(row => {
      if (row !== actual) return row;
      const { divergence, ...unsigned } = row;
      return unsigned;
    });
    assert.equal(validateCarrierRegistrySymmetry(csharp, { ...rust, rows }, signedDifferences)
      .includes(`Unexplained one-sided carrier: ${actual.id}`), true,
    "neither the umbrella nor the concrete carrier can borrow the other's native-constraint proof");
  }
});

test("an existing built native primitive constructor cannot masquerade as the structural array counterpart", () => {
  const [current, counterpart] = registries;
  const incorrect = counterpart.rows.find(row => !row.id.startsWith("kind:") &&
    row.kinds.length === 1 && row.kinds[0] === "source-primitive");
  assert.equal(incorrect !== undefined, true);
  const rows = current.rows.map(row => row.id === "kind:array" ? { ...row, counterpart: incorrect.declaration } : row);
  assert.equal(validateCarrierRegistrySymmetry({ ...current, rows }, counterpart, signedDifferences)
    .includes("Structural carrier counterpart kind mismatch: kind:array"), true);
});

test("native const and associated-type rows fail strict parity without their exact proven register entries", () => {
  const [csharp, rust] = registries;
  for (const [symbol, register] of [["rustFixedArrayTargetType", "S11-11"], ["rustIndexedFieldTrait", "S11-12"],
    ["rustIndexedFieldProjection", "S11-12"]]) {
    const actual = rust.rows.find(row => row.declaration.symbol === symbol);
    assert.equal(actual?.divergence?.register, register, symbol);
    assert.equal(actual.counterpart, null, symbol);
    const rows = rust.rows.map(row => {
      if (row !== actual) return row;
      const { divergence, ...unsigned } = row;
      return unsigned;
    });
    assert.equal(validateCarrierRegistrySymmetry(csharp, { ...rust, rows }, signedDifferences)
      .includes(`Unexplained one-sided carrier: ${actual.id}`), true, symbol);
  }
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
  const csharp = registries[0];
  assert.equal(csharp.rows.some(row => row.declaration.symbol === "csharpRuntimeNativeLocationTargetType"), false);
});
