import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { readSourceInventory } from "./file-inventory.mjs";
import {
  createKeelViolationInventory, evaluateKeelViolationInventory, validateKeelViolationInventory,
} from "./keel-certification-checks.mjs";
import { keelDigest } from "./keel-source-analysis.mjs";
import { keelRoles, keelTargetNames, keelWorkspaceRepositories, validPath } from "./keel-contract.mjs";

export const keelViolationInventoryPath = "test/architecture/keel-violations.json";
const toolingPath = "test/architecture/tooling";

export function createKeelWorkspaceInventory(actual, manifestText, repository) {
  const inventory = createKeelViolationInventory(actual.findings, {
    pins: actual.pins,
    manifestSha256: keelDigest(manifestText),
    sourceDigests: actual.sourceDigests,
    declarationsSha256: actual.declarationsSha256,
    toolingSha256: readKeelToolingDigest(repository),
    roleObligations: Object.fromEntries(keelTargetNames.map(target => [target, JSON.parse(manifestText).targets[target].functions])),
    status: "recovery-not-certification",
  });
  validateKeelWorkspaceInventory(inventory);
  return inventory;
}

export function validateKeelWorkspaceInventory(inventory) {
  validateKeelViolationInventory(inventory);
  const repositories = [...keelWorkspaceRepositories].sort();
  if (inventory.origin.status !== "recovery-not-certification" ||
    !isDeepStrictEqual(Object.keys(inventory.origin.pins).sort(), repositories) ||
    !isDeepStrictEqual(Object.keys(inventory.origin.sourceDigests ?? {}).sort(), repositories) ||
    !isDeepStrictEqual(Object.keys(inventory.origin.roleObligations ?? {}).sort(), [...keelTargetNames].sort()) ||
    Object.values(inventory.origin.sourceDigests).some(value => !isDigest(value)) ||
    !isDigest(inventory.origin.declarationsSha256) || !isDigest(inventory.origin.toolingSha256)) {
    throw new Error("The committed Keel inventory needs its complete immutable source, declaration and rule provenance; it is not certification.");
  }
  for (const entries of Object.values(inventory.origin.roleObligations)) {
    if (!Array.isArray(entries) || entries.some(entry => !validPath(entry.file) ||
      typeof entry.symbol !== "string" || entry.symbol.length === 0 || !keelRoles.includes(entry.role) || !isDigest(entry.bodySha256))) {
      throw new Error("The Keel origin must retain exact reviewed semantic-role obligations.");
    }
  }
}

export function readKeelRoleObligations(repository) {
  requireFullHistory(repository);
  const revisions = git(repository, [
    "log", "--first-parent", "--reverse", "--format=%H", "--", keelViolationInventoryPath,
  ]).trim().split("\n").filter(Boolean);
  if (revisions.length === 0) return {};
  const origin = JSON.parse(git(repository, ["show", `${revisions[0]}:${keelViolationInventoryPath}`]));
  validateKeelWorkspaceInventory(origin);
  return origin.origin.roleObligations;
}

export function validateKeelInventoryHistory(history, current) {
  if (!Array.isArray(history) || history.length === 0 || history[0].inventory === undefined) {
    throw new Error("The Keel inventory must have a committed immutable origin.");
  }
  const origin = history[0].inventory;
  validateKeelWorkspaceInventory(origin);
  let previous = origin;
  let deleted = false;
  for (const entry of [...history.slice(1), { inventory: current }]) {
    const inventory = entry.inventory;
    if (inventory === undefined) {
      deleted = true;
      continue;
    }
    if (deleted) throw new Error("A deleted Keel inventory cannot be restored or rebaselined.");
    validateKeelWorkspaceInventory(inventory);
    if (!isDeepStrictEqual(inventory.origin, origin.origin)) {
      throw new Error("The committed Keel inventory origin is immutable; a later commit cannot replace its provenance.");
    }
    const allowed = new Set(previous.violations.map(finding => finding.id));
    if (inventory.violations.some(finding => !allowed.has(finding.id))) {
      throw new Error("The committed Keel inventory may only shrink; new, changed and restored obligations cannot be added.");
    }
    previous = inventory;
  }
}

export function readCommittedKeelInventory(repository) {
  requireFullHistory(repository);
  const revisions = git(repository, [
    "log", "--first-parent", "--reverse", "--format=%H", "--", keelViolationInventoryPath,
  ]).trim().split("\n").filter(Boolean);
  const history = revisions.map(revision => ({
    revision,
    inventory: git(repository, ["ls-tree", "--name-only", revision, "--", keelViolationInventoryPath]).trim() === ""
      ? undefined : JSON.parse(git(repository, ["show", `${revision}:${keelViolationInventoryPath}`])),
  }));
  const file = resolve(repository, keelViolationInventoryPath);
  const current = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : undefined;
  validateKeelInventoryHistory(history, current);
  if (history[0].inventory.origin.toolingSha256 !== readKeelToolingDigest(repository, history[0].revision)) {
    throw new Error("The Keel origin's rule fingerprint does not match the rules committed with that inventory.");
  }
  return current;
}

export function evaluateCommittedKeelInventory(actual, repository, { final = false } = {}) {
  const file = resolve(repository, keelViolationInventoryPath);
  if (final || !existsSync(file)) {
    return Object.freeze({ mode: "unconditional", newViolations: actual.findings, remaining: actual.findings.length });
  }
  const inventory = readCommittedKeelInventory(repository);
  const comparison = evaluateKeelViolationInventory(actual.findings, inventory);
  return Object.freeze({
    mode: "shrinking-baseline-not-certification", newViolations: comparison.newViolations,
    remaining: actual.findings.length, removedViolations: comparison.removedViolations,
    relocatedViolations: comparison.relocatedViolations,
  });
}

export function readKeelToolingDigest(repository, revision) {
  const entries = revision === undefined
    ? [...readSourceInventory(resolve(repository, toolingPath), { extensions: [".mjs"] })]
      .map(([file, source]) => [`${toolingPath}/${file}`, source])
    : git(repository, ["ls-tree", "-r", "--name-only", revision, "--", toolingPath]).trim().split("\n")
      .filter(file => file.endsWith(".mjs")).map(file => [file, git(repository, ["show", `${revision}:${file}`])]);
  return keelDigest(JSON.stringify(entries.sort(([left], [right]) => left.localeCompare(right))));
}

function isDigest(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function requireFullHistory(repository) {
  if (git(repository, ["rev-parse", "--is-shallow-repository"]).trim() !== "false") {
    throw new Error("Keel inventory and semantic-role proofs require complete non-shallow Git history; fetch --unshallow before checking.");
  }
}

function git(repository, arguments_) {
  return execFileSync("git", arguments_, { cwd: repository, encoding: "utf8", timeout: 30_000, maxBuffer: 64 * 1024 * 1024 });
}
