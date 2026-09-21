import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { hostRoot } from "../../scripts/release/npm-wave.mjs";
import { npmViewJson } from "../../scripts/release/npm-registry.mjs";
import { packReleasePackage } from "../../scripts/release/package-artifact.mjs";
import { inspectPublishedSource, readSourceProvenance, validateSourceInputs } from "../../scripts/release/source-provenance.mjs";

for (const directory of [".", "packages/example"]) {
  test(`publication source identity includes fixes after the version bump: ${directory}`, () => {
    const entry = fixture(directory);
    const before = readSourceProvenance(entry).provenance;
    writeFileSync(resolve(entry.packageRoot, "src/index.ts"), "export const answer = 43;\n");
    commit(entry.repositoryRoot, "Fix before first publication without changing version");
    const published = readSourceProvenance(entry).provenance;
    assert.notEqual(published.sourceDigest, before.sourceDigest);
    assert.equal(inspectPublishedSource(entry, published).kind, "current");
    assert.equal(inspectPublishedSource(entry, before).kind, "changed");

    const clone = resolve(entry.scratchRoot, "clone");
    git(entry.scratchRoot, ["clone", "--quiet", "--no-local", "--depth", "1", entry.repositoryRoot, clone]);
    const cloned = { ...entry, repositoryRoot: clone, packageRoot: resolve(clone, directory) };
    assert.deepEqual(readSourceProvenance(cloned).provenance, published);
    assert.equal(inspectPublishedSource(cloned, published).kind, "current");

    writeFileSync(resolve(entry.packageRoot, "src/index.ts"), "export const answer = 44;\n");
    assert.equal(inspectPublishedSource(entry, published).kind, "changed");
    commit(entry.repositoryRoot, "Fix after publication, leaving dist stale");
    assert.equal(readFileSync(resolve(entry.packageRoot, "dist/index.js"), "utf8"), "export const answer = 42;\n");
    assert.equal(inspectPublishedSource(entry, published).kind, "changed");
  });

  test(`packed provenance is exact and deterministic without changing source: ${directory}`, () => {
    const entry = fixture(directory);
    const before = readFileSync(resolve(entry.packageRoot, "package.json"), "utf8");
    const packed = packReleasePackage(entry, entry.scratchRoot);
    const manifest = JSON.parse(execFileSync("tar", ["-xOf", packed.tarballPath, "package/package.json"], { encoding: "utf8" }));
    assert.deepEqual(manifest.tsonicRelease, readSourceProvenance(entry).provenance);
    assert.equal(inspectPublishedSource(entry, manifest.tsonicRelease).kind, "current");
    assert.equal(readFileSync(resolve(entry.packageRoot, "package.json"), "utf8"), before);
    assert.equal(git(entry.repositoryRoot, ["status", "--porcelain"]), "");
    assert.equal(packReleasePackage(entry, entry.scratchRoot).integrity, packed.integrity);
    assert.equal(execFileSync("tar", ["-xOf", packed.tarballPath, "package/dist/index.js"], { encoding: "utf8" }), "export const answer = 42;\n");
    git(entry.repositoryRoot, ["-c", "user.name=Release Test", "-c", "user.email=release-test@example.invalid", "commit", "--quiet", "--allow-empty", "-m", "Same tree, different commit"]);
    assert.equal(packReleasePackage(entry, entry.scratchRoot).integrity, packed.integrity);
  });
}

test("nested packages account for shared build inputs, not unrelated host docs", () => {
  const entry = fixture("packages/example");
  const published = readSourceProvenance(entry).provenance;
  writeFileSync(resolve(entry.repositoryRoot, "README.md"), "Unrelated host documentation.\n");
  commit(entry.repositoryRoot, "Documentation only");
  assert.equal(inspectPublishedSource(entry, published).kind, "current");
  writeFileSync(resolve(entry.repositoryRoot, "tsconfig.json"), '{"compilerOptions":{"strict":false}}\n');
  assert.equal(inspectPublishedSource(entry, published).kind, "changed");
  commit(entry.repositoryRoot, "Changed shared compiler configuration");
  assert.equal(inspectPublishedSource(entry, published).kind, "changed");
});

test("untracked inputs and file modes cannot be certified as unchanged", () => {
  const entry = fixture("packages/example");
  const published = readSourceProvenance(entry).provenance;
  writeFileSync(resolve(entry.packageRoot, "src/new.ts"), "export {};\n");
  assert.equal(inspectPublishedSource(entry, published).kind, "changed");
  assert.throws(() => packReleasePackage(entry, entry.scratchRoot), /uncommitted source/u);
  commit(entry.repositoryRoot, "New source");
  const next = readSourceProvenance(entry).provenance;
  chmodSync(resolve(entry.packageRoot, "src/index.ts"), 0o755);
  commit(entry.repositoryRoot, "Changed mode");
  assert.equal(inspectPublishedSource(entry, next).kind, "changed");
});

test("missing, malformed and mismatched provenance never invent a baseline", () => {
  const entry = fixture(".");
  const record = readSourceProvenance(entry).provenance;
  for (const value of [undefined, null, [], "version-commit", {},
    { ...record, schemaVersion: 2 }, { ...record, name: "another-package" },
    { ...record, version: "1.0.1" }, { ...record, repository: "other" },
    { ...record, directory: "../other" }, { ...record, sourceDigest: "HEAD" },
    { ...record, extra: true }]) {
    assert.equal(inspectPublishedSource(entry, value).kind, "unverified");
  }
  const authored = { ...entry.manifest, tsonicRelease: record };
  writeFileSync(resolve(entry.packageRoot, "package.json"), `${JSON.stringify(authored)}\n`);
  assert.throws(() => packReleasePackage({ ...entry, manifest: authored }, entry.scratchRoot), /must not author/u);
});

test("packing rejects a stale selected manifest even when name and version match", () => {
  const entry = fixture(".");
  writeFileSync(resolve(entry.packageRoot, "package.json"), `${JSON.stringify({ ...entry.manifest, engines: { node: ">=22" } })}\n`);
  commit(entry.repositoryRoot, "Changed package contract after release selection");
  assert.throws(() => packReleasePackage(entry, entry.scratchRoot), /manifest changed after release selection/u);
});

test("source selection is explicit, bounded, canonical and fails on missing inputs", () => {
  const entry = fixture("packages/example");
  for (const sourceInputs of [undefined, [], ["." ,"."], ["../other"], ["/outside"],
    ["packages/example", "a/../b"], ["packages/example", ":(glob)*"],
    ["packages/example", "missing"], ["tsconfig.json"],
    Array.from({ length: 65 }, (_, index) => `input-${index}`)]) {
    assert.throws(() => readSourceProvenance({ ...entry, sourceInputs }));
  }
  assert.deepEqual(validateSourceInputs(entry), [...entry.sourceInputs].sort());
  assert.deepEqual(readSourceProvenance({ ...entry, sourceInputs: [...entry.sourceInputs].reverse() }), readSourceProvenance(entry));
});

test("registry JSON reads preserve structured publication metadata", () => {
  const record = { schemaVersion: 1, sourceDigest: "exact" };
  const calls = [];
  assert.deepEqual(npmViewJson("package", "tsonicRelease", "1.0.0", (args) => {
    calls.push(args);
    return { status: 0, stdout: JSON.stringify(record) };
  }), record);
  assert.deepEqual(calls[0].slice(0, 4), ["view", "package@1.0.0", "tsonicRelease", "--json"]);
  assert.throws(() => npmViewJson("package", "tsonicRelease", "1.0.0", () => ({ status: null, stderr: "timeout" })), /npm view failed/u);
});

function fixture(directory) {
  const parent = resolve(hostRoot, ".temp/release-provenance-tests");
  mkdirSync(parent, { recursive: true });
  const scratchRoot = mkdtempSync(resolve(parent, "case-"));
  const repositoryRoot = resolve(scratchRoot, "repo");
  const packageRoot = resolve(repositoryRoot, directory);
  mkdirSync(resolve(packageRoot, "src"), { recursive: true });
  mkdirSync(resolve(packageRoot, "dist"));
  const manifest = { name: "release-proof", version: "1.0.0", type: "module", files: ["dist"] };
  writeFileSync(resolve(packageRoot, "package.json"), `${JSON.stringify(manifest)}\n`);
  writeFileSync(resolve(repositoryRoot, ".gitignore"), "dist/\n");
  writeFileSync(resolve(repositoryRoot, "tsconfig.json"), "{}\n");
  writeFileSync(resolve(packageRoot, "src/index.ts"), "export const answer = 42;\n");
  writeFileSync(resolve(packageRoot, "dist/index.js"), "export const answer = 42;\n");
  git(repositoryRoot, ["init", "--quiet", "-b", "release-fixture"]);
  commit(repositoryRoot, "Version bump");
  return { name: manifest.name, repository: "example", directory, repositoryRoot,
    packageRoot, scratchRoot, manifest,
    sourceInputs: directory === "." ? ["."] : [directory, "tsconfig.json"],
  };
}

function commit(root, message) {
  git(root, ["add", "."]);
  git(root, ["-c", "user.name=Release Test", "-c", "user.email=release-test@example.invalid", "commit", "--quiet", "-m", message]);
}

function git(root, args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30_000 });
}
