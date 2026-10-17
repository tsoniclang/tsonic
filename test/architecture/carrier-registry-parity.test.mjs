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

test("built C# and Rust carrier registries share checked counterparts or signed native constraints", () => {
  assert.equal(signedDifferences.size > 0, true);
  assert.deepEqual(validateCarrierRegistrySymmetry(registries[0], registries[1], signedDifferences), []);
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
