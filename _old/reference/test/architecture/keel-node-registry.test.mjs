import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { keelOwnedNodeModules } from "./tooling/keel-node-contracts.mjs";
import { readKeelNodeModuleRegistry } from "./tooling/keel-node-registry.mjs";

const workspace = resolve(fileURLToPath(new URL("../../..", import.meta.url)));

for (const repository of ["csharp-nodejs", "rust-nodejs"]) {
  test(`${repository}: exact built registry matches the independently maintained provider scope`, () => {
    const actual = readKeelNodeModuleRegistry(workspace, repository);
    const expected = keelOwnedNodeModules[repository].filter(row => row.exposed).map(row => row.module).toSorted();
    assert.deepEqual(actual.modules, expected);
    assert.match(actual.artifact.sha256, /^[a-f0-9]{64}$/u);
    assert.equal(new Set(actual.modules).size, actual.modules.length);
  });
}
