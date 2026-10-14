import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { evaluateCommittedKeelInventory } from "./tooling/keel-inventory.mjs";
import { keelDefaultManifest } from "./tooling/keel-owned-contracts.mjs";
import { defaultKeelWorkspace, evaluateKeelWorkspace } from "./tooling/keel-workspace.mjs";

test("the complete current Keel architecture census introduces no obligation beyond the committed shrinking inventory", () => {
  const actual = evaluateKeelWorkspace(defaultKeelWorkspace(), keelDefaultManifest());
  const compared = evaluateCommittedKeelInventory(actual, fileURLToPath(new URL("../..", import.meta.url)));
  assert.equal(compared.newViolations.length, 0, compared.newViolations.slice(0, 12).map(entry =>
    `${entry.check} ${entry.repo}:${entry.file}#${entry.subject}: ${entry.reason}`).join("\n"));
});
