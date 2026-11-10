import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

export function validateSourceInputs(entry) {
  const inputs = entry.sourceInputs;
  if (!Array.isArray(inputs) || inputs.length === 0 || inputs.length > 64 ||
      inputs.some((path) => typeof path !== "string" || path.length > 512 ||
        (path !== "." && (!/^[A-Za-z0-9_.-][A-Za-z0-9_./-]*$/u.test(path) ||
          path.split("/").some((part) => part === "" || part === "." || part === "..")))) ||
      new Set(inputs).size !== inputs.length ||
      !inputs.some((path) => path === "." || path === entry.directory)) {
    throw new Error(`Package '${entry.name}' requires unique repository-relative source inputs including its package directory.`);
  }
  return Object.freeze([...inputs].sort());
}

export function readSourceProvenance(entry) {
  const inputs = validateSourceInputs(entry);
  for (const path of inputs) {
    git(entry, ["rev-parse", "--verify", path === "." ? "HEAD^{tree}" : `HEAD:${path}`]);
  }
  const records = git(entry, ["ls-tree", "-r", "-z", "--full-tree", "HEAD", "--", ...inputs]);
  if (records.length === 0 || records.split("\0").some((record) =>
    record !== "" && !/^(?:100644|100755|120000) blob [a-f0-9]+\t/u.test(record))) {
    throw new Error(`Package '${entry.name}' source inputs must contain committed files, not submodules.`);
  }
  const identity = {
    schemaVersion: 1,
    name: entry.name,
    version: entry.manifest.version,
    repository: entry.repository,
    directory: entry.directory,
  };
  const sourceDigest = createHash("sha256")
    .update(JSON.stringify({ ...identity, inputs }))
    .update("\0")
    .update(records)
    .digest("hex");
  const dirty = git(entry, [
    "status", "--porcelain=v1", "-z", "--untracked-files=all", "--", ...inputs,
  ]).length !== 0;
  return Object.freeze({
    dirty,
    provenance: Object.freeze({ ...identity, sourceDigest }),
  });
}

export function inspectPublishedSource(entry, published) {
  const keys = ["directory", "name", "repository", "schemaVersion", "sourceDigest", "version"];
  if (published === null || typeof published !== "object" || Array.isArray(published) ||
      Object.keys(published).sort().join("\0") !== keys.join("\0") ||
      published.schemaVersion !== 1 || published.name !== entry.name ||
      published.version !== entry.manifest.version ||
      published.repository !== entry.repository || published.directory !== entry.directory ||
      typeof published.sourceDigest !== "string" || !/^[a-f0-9]{64}$/u.test(published.sourceDigest)) {
    return Object.freeze({ kind: "unverified", reason: "published source provenance is missing or invalid" });
  }
  const local = readSourceProvenance(entry);
  return Object.freeze({ kind: local.dirty || local.provenance.sourceDigest !== published.sourceDigest
    ? "changed"
    : "current" });
}

function git(entry, args) {
  return execFileSync("git", args, {
    cwd: entry.repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 30_000,
    maxBuffer: 16 * 1024 * 1024,
  });
}
