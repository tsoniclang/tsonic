import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadCarrierRegistry, validateCarrierRegistrySymmetry } from "../helpers/carrier-registry.mjs";

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const registries = [];
for (const repository of ["tsonic-csharp", "tsonic-rust"]) {
  registries.push(await loadCarrierRegistry(path.join(workspace, repository)));
}
const structure = await readFile(new URL("../../docs/architecture/csharp-rust-structure.md", import.meta.url), "utf8");
const signedDifferences = new Set([...structure.matchAll(/^\| (S11-\d+|V-\d+) \|/gmu)].map(match => match[1]));

test("built C# and Rust carrier registries share checked counterparts or signed native constraints", () => {
  assert.equal(signedDifferences.size > 0, true);
  assert.deepEqual(validateCarrierRegistrySymmetry(registries[0], registries[1], signedDifferences), []);
});
