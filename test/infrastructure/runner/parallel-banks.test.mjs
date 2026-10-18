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
  assert.deepEqual(rust.preRuns.map(run => run.id), ["tsonic-rust.build", "tsonic-rust.installed-layout"],
    "the existing queue validates selection before its one build and installed layout");
  assert.deepEqual(rust.nodeSuites[0].resourcesForFile("a.test.mjs"), { memoryMiB: 4096, heapMiB: 3072 });
  assert.deepEqual(rust.nodeSuites[0].nodeArguments,
    ["--import", resolve(testRepositoryRoots.tsonicRust, "scripts/register-tsonic-root-loader.mjs")]);
  const inventory = spawnSync(process.execPath, ["test/scripts/run-parallel.mjs", "--scope", "tsonic-rust", "--inventory"],
    { encoding: "utf8", timeout: 60_000, maxBuffer: 16 * 1024 * 1024 });
  assert.equal(inventory.status, 0, inventory.stderr);
  const actual = JSON.parse(inventory.stdout);
  assert.equal(actual.files.length > 0, true);
  assert.equal(actual.files.every(file => file.scope === "tsonic-rust" && file.memoryMiB === 4096 &&
    file.preRunIds.includes("tsonic-rust.installed-layout")), true, "every Rust file gets the one existing memory-weighted owner");
});

test("exact file selection works for the Host default and mixed Node and dotnet scope", () => {
  const execute = args => spawnSync(process.execPath, ["test/scripts/run-parallel.mjs", ...args],
    { encoding: "utf8", timeout: 60_000, maxBuffer: 16 * 1024 * 1024 });
  const host = execute(["--file", "test/infrastructure/runner/test-results.test.mjs", "--list"]);
  assert.equal(host.status, 0, host.stderr);
  assert.match(host.stdout, /tasks=1\n/u);
  assert.match(host.stdout, /tsonic:test\/infrastructure\/runner\/test-results\.test\.mjs/u);
  const inventory = execute(["--scope", "csharp-nodejs", "--inventory"]);
  assert.equal(inventory.status, 0, inventory.stderr);
  const files = JSON.parse(inventory.stdout).files.filter(file => file.scope === "csharp-nodejs");
  for (const runner of ["node", "dotnet"]) {
    const file = files.find(file => file.runner === runner);
    assert.notEqual(file, undefined, `the mixed scope contains ${runner} source files`);
    const selected = execute(["--scope", "csharp-nodejs", "--file", resolve(testRepositoryRoots.csharpNodejs, file.path), "--list"]);
    assert.equal(selected.status, 0, selected.stderr);
    assert.match(selected.stdout, /tasks=1\n/u);
  }
});

test("every exact requested file must be represented before any prerequisite or test runs", () => {
  for (const args of [
    ["--file", "test/infrastructure/runner/test-results.test.mjs", "--file", "test/infrastructure/runner/missing.test.mjs"],
    ["--scope", "tsonic-rust", "--file", resolve(testRepositoryRoots.tsonicRust, "test/architecture/parity-inventory.test.mjs"),
      "--file", resolve(testRepositoryRoots.tsonicRust, "test/architecture/missing.test.mjs")],
    ["--scope", "tsonic-rust", "--file", "test/infrastructure/runner/test-results.test.mjs"],
  ]) {
    const run = spawnSync(process.execPath, ["test/scripts/run-parallel.mjs", ...args, "--with-preruns"],
      { encoding: "utf8", timeout: 60_000, maxBuffer: 65_536 });
    assert.equal(run.status !== 0, true);
    assert.match(run.stderr, /Exact requested test files are missing or excluded/u);
    assert.doesNotMatch(run.stdout, /PRERUN|START /u, "a partial match cannot hide a miss or start builds");
  }
});

test("a selected nonstandard Rust checkout keeps its own inventory, loader and build with a separate Host", () => {
  mkdirSync(".temp/parallel-root-tests", { recursive: true });
  const root = mkdtempSync(resolve(".temp/parallel-root-tests/selected-target-"));
  mkdirSync(resolve(root, "test"));
  mkdirSync(resolve(root, "scripts"));
  writeFileSync(resolve(root, "test/selected.test.mjs"), "export {};\n");
  writeFileSync(resolve(root, "scripts/register-tsonic-root-loader.mjs"), "export {};\n");
  const run = spawnSync(process.execPath, ["test/scripts/run-parallel.mjs", "--scope", "tsonic-rust",
    "--repository-root", root, "--file", resolve(root, "test/selected.test.mjs"), "--inventory"],
  { encoding: "utf8", timeout: 60_000, maxBuffer: 65_536,
    env: { ...process.env, TSONIC_ROOT: testRepositoryRoots.tsonic, TSONICLANG_WORKSPACE_ROOT: resolve(root, "unrelated-workspace") } });
  assert.equal(run.status, 0, run.stderr);
  const inventory = JSON.parse(run.stdout);
  assert.equal(inventory.fileCount, 1);
  assert.equal(inventory.files[0].path, "test/selected.test.mjs");
  assert.equal(inventory.preRuns.every(run => run.cwd === root), true);
  assert.equal(inventory.preRuns.filter(run => run.command === "npm").length, 1, "the actual selected checkout builds once");
  assert.equal(inventory.preRuns[1].args[1], resolve(root, "scripts/register-tsonic-root-loader.mjs"));
  const worker = readFileSync(resolve(testRepositoryRoots.tsonicRust, "scripts/test-worker.sh"), "utf8");
  assert.match(worker, /--repository-root "\$PWD"/u);
  assert.match(worker, /--with-preruns/u);
  assert.doesNotMatch(worker, /npm run build/u, "the queue is the sole prerequisite owner");
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
