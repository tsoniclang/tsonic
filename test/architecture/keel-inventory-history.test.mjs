import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { createKeelViolationInventory } from "./tooling/keel-certification-checks.mjs";
import { keelFinding } from "./tooling/keel-contract.mjs";
import {
  evaluateCommittedKeelInventory, keelViolationInventoryPath, readCommittedKeelInventory,
  readKeelRoleObligations, readKeelToolingDigest, validateKeelInventoryHistory, validateKeelWorkspaceInventory,
} from "./tooling/keel-inventory.mjs";
import { keelWorkspaceRepositories } from "./tooling/keel-workspace.mjs";

function sampleInventory(findings) {
  return createKeelViolationInventory(findings, {
    pins: Object.fromEntries(keelWorkspaceRepositories.map(repo => [repo, "a".repeat(40)])),
    manifestSha256: "b".repeat(64),
    sourceDigests: Object.fromEntries(keelWorkspaceRepositories.map(repo => [repo, "c".repeat(64)])),
    declarationsSha256: "d".repeat(64), toolingSha256: "e".repeat(64), status: "recovery-not-certification",
    roleObligations: { "tsonic-csharp": [], "tsonic-rust": [] },
  });
}

const first = keelFinding("AC1", "tsonic-rust", "src/analysis/operations/provider/selection.ts", "selectRustCheckedIteration", "Wrong owner");
const second = keelFinding("AC7", "tsonic-rust", "src/analysis/operations/provider", "analysis/operations/provider", "Removed responsibility");

test("committed inventory provenance pins every repository, all actual source hashes, declarations and the enforcing rules", () => {
  const inventory = sampleInventory([first, second]);
  assert.doesNotThrow(() => validateKeelWorkspaceInventory(inventory));
  for (const origin of [
    { ...inventory.origin, status: "accepted" },
    { ...inventory.origin, pins: { tsonic: "a".repeat(40) } },
    { ...inventory.origin, sourceDigests: { tsonic: "c".repeat(64) } },
    { ...inventory.origin, declarationsSha256: undefined },
    { ...inventory.origin, toolingSha256: "not-a-digest" },
  ]) assert.throws(() => validateKeelWorkspaceInventory({ ...inventory, origin }), /provenance/u);
});

test("every historical inventory transition only removes exact obligations, with no restored earlier allowances", () => {
  const initial = sampleInventory([first, second]);
  const shrunk = sampleInventory([first]);
  const history = [{ inventory: initial }, { inventory: shrunk }];
  assert.doesNotThrow(() => validateKeelInventoryHistory(history, sampleInventory([])));
  assert.throws(() => validateKeelInventoryHistory(history, initial), /may only shrink/u);
  assert.throws(() => validateKeelInventoryHistory([...history, { inventory: initial }], initial), /may only shrink/u);
  const changed = keelFinding("AC1", first.repo, first.file, first.subject, first.reason, { bodySha256: "f".repeat(64) });
  assert.throws(() => validateKeelInventoryHistory(history, sampleInventory([changed])), /may only shrink/u);
  assert.throws(() => validateKeelInventoryHistory(history, {
    ...shrunk, origin: { ...shrunk.origin, manifestSha256: "f".repeat(64) },
  }), /immutable/u);
  assert.throws(() => validateKeelInventoryHistory([], initial), /committed immutable origin/u);
  assert.throws(() => validateKeelInventoryHistory([...history, { inventory: undefined }], shrunk), /restored/u);
});

test("missing inventories and final certification always reject all current violations instead of waiving them", () => {
  const actual = { findings: [first, second] };
  const repository = new URL("../../.temp/no-keel-inventory", import.meta.url).pathname;
  assert.equal(evaluateCommittedKeelInventory(actual, repository).newViolations.length, 2);
  assert.equal(evaluateCommittedKeelInventory(actual, repository, { final: true }).newViolations.length, 2);
  assert.equal(evaluateCommittedKeelInventory({ findings: [] }, repository, { final: true }).newViolations.length, 0);
});

test("the real Git origin blocks later allowance restoration even after it is committed and subsequently hidden", () => {
  const scratch = new URL("../../.temp/keel-architecture", import.meta.url).pathname;
  mkdirSync(scratch, { recursive: true });
  const repository = mkdtempSync(resolve(scratch, "inventory-history-"));
  const git = arguments_ => execFileSync("git", arguments_, { cwd: repository, encoding: "utf8" });
  const commit = message => {
    git(["add", "."]);
    git(["-c", "user.name=Keel test", "-c", "user.email=keel-test@example.invalid", "commit", "--quiet", "-m", message]);
  };
  try {
    mkdirSync(resolve(repository, "test/architecture/tooling"), { recursive: true });
    writeFileSync(resolve(repository, "test/architecture/tooling/rule.mjs"), "export const active = true;\n");
    git(["init", "--quiet", "--initial-branch=keel-history"]);
    commit("Install rules");
    const inventory = sampleInventory([first, second]);
    const origin = { ...inventory.origin, toolingSha256: readKeelToolingDigest(repository),
      roleObligations: { "tsonic-csharp": [], "tsonic-rust": [{
        file: first.file, symbol: first.subject, role: "selection", bodySha256: "f".repeat(64),
      }] },
    };
    const initial = { ...inventory, origin };
    const shrunk = { ...sampleInventory([first]), origin };
    const write = value => writeFileSync(resolve(repository, keelViolationInventoryPath), JSON.stringify(value));
    write(initial);
    assert.throws(() => readCommittedKeelInventory(repository), /committed immutable origin/u);
    commit("Record initial obligations");
    assert.equal(readCommittedKeelInventory(repository).violations.length, 2);
    assert.equal(readKeelRoleObligations(repository)["tsonic-rust"][0].role, "selection");
    assert.equal(evaluateCommittedKeelInventory({ findings: [first, second] }, repository).newViolations.length, 0);
    assert.equal(evaluateCommittedKeelInventory({ findings: [first] }, repository, { final: true }).newViolations.length, 1);
    write(shrunk);
    assert.equal(evaluateCommittedKeelInventory({ findings: [first, second] }, repository).newViolations.length, 1);
    commit("Remove completed obligation");
    write(initial);
    assert.throws(() => readCommittedKeelInventory(repository), /may only shrink/u);
    commit("Attempt to restore an allowance");
    write(shrunk);
    commit("Hide restoration behind a later edit");
    assert.throws(() => readCommittedKeelInventory(repository), /may only shrink/u);
    rmSync(resolve(repository, keelViolationInventoryPath));
    commit("Delete the transitional violation inventory");
    assert.equal(readKeelRoleObligations(repository)["tsonic-rust"][0].role, "selection");
    assert.equal(evaluateCommittedKeelInventory({ findings: [first] }, repository, { final: true }).newViolations.length, 1);
  } finally {
    rmSync(repository, { recursive: true, force: true });
  }
});
