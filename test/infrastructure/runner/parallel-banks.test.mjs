import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { createParallelSuiteDefinition, createRustParallelSuiteDefinition } from "../../scripts/suite-definition.mjs";
import { testRepositoryRoots } from "../../scripts/workspace-layout.mjs";

test("Rust explicitly selects the same weighted queue without entering the Host default bank", () => {
  const host = createParallelSuiteDefinition(testRepositoryRoots);
  const rust = createRustParallelSuiteDefinition(testRepositoryRoots);
  assert.equal(host.nodeSuites.some(suite => suite.scope === "tsonic-rust"), false);
  assert.equal(rust.nodeSuites.length, 1);
  assert.equal(rust.nodeSuites[0].scope, "tsonic-rust");
  assert.equal(rust.preRuns.length, 0, "the public Rust worker already built once");
  assert.deepEqual(rust.nodeSuites[0].resourcesForFile("a.test.mjs"), { memoryMiB: 4096, heapMiB: 3072 });
  assert.deepEqual(rust.nodeSuites[0].nodeArguments,
    ["--import", resolve(testRepositoryRoots.tsonicRust, "scripts/register-tsonic-root-loader.mjs")]);
  const inventory = spawnSync(process.execPath, ["test/scripts/run-parallel.mjs", "--scope", "tsonic-rust", "--inventory"],
    { encoding: "utf8", timeout: 60_000, maxBuffer: 16 * 1024 * 1024 });
  assert.equal(inventory.status, 0, inventory.stderr);
  const actual = JSON.parse(inventory.stdout);
  assert.equal(actual.files.length > 0, true);
  assert.equal(actual.files.every(file => file.scope === "tsonic-rust" && file.memoryMiB === 4096 &&
    file.preRunIds.length === 0), true, "every Rust file gets the one existing memory-weighted owner");
});

test("the complete train refuses malformed previous evidence before builds or output creation", () => {
  mkdirSync(".temp/train-entry-tests", { recursive: true });
  const root = mkdtempSync(resolve(".temp/train-entry-tests/case-"));
  const before = resolve(root, "before.json");
  const output = resolve(root, "new-run");
  writeFileSync(before, "{}");
  const run = spawnSync("bash", ["test/scripts/run-all.sh", "--train", before, output], {
    encoding: "utf8", timeout: 60_000, maxBuffer: 65_536,
  });
  assert.equal(run.status !== 0, true);
  assert.equal(existsSync(output), false, "bad evidence never starts a train");
  assert.doesNotMatch(run.stdout, /PRERUN/u);
  const source = readFileSync("test/scripts/run-all.sh", "utf8");
  assert.match(source, /bash test\/scripts\/run-parallel\.sh --with-preruns/u);
  assert.match(source, /bash scripts\/test\.sh "\$\{rust_files\[@\]\}"/u);
  assert.match(source, /node test\/scripts\/test-results\.mjs train/u);
});
