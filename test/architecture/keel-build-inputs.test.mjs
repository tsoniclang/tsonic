import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createParallelSuiteDefinition } from "../scripts/suite-definition.mjs";
import { testRepositoryRoots } from "../scripts/workspace-layout.mjs";
import { runBoundedTestQueue, validateBoundedTestQueue } from "../scripts/parallel-scheduler.mjs";
import { readTestResourceBudget, testResourceBudget, testTaskEnvironment } from "../scripts/test-resource-budget.mjs";

test("the inventory's actual Node registry inputs have ordinary transitive provider build prerequisites", () => {
  const definition = createParallelSuiteDefinition(testRepositoryRoots);
  const preRuns = new Map(definition.preRuns.map(entry => [entry.id, entry]));
  const target = preRuns.get("tsonic-rust.build");
  const provider = preRuns.get("rust-nodejs.build");
  assert.equal(target.cwd, resolve(testRepositoryRoots.tsonicCsharp, "../tsonic-rust"));
  assert.equal(provider.cwd, resolve(testRepositoryRoots.tsonicCsharp, "../rust-nodejs"));
  assert.deepEqual(target.dependsOn, ["tsonic.build", "tsonic-rust.install"]);
  assert.deepEqual(provider.dependsOn, ["tsonic-rust.build", "rust-nodejs.install"]);
  for (const entry of [target, provider]) {
    assert.equal(entry.command, "npm");
    assert.deepEqual(entry.args, ["run", "build"]);
  }
  for (const name of ["tsonic-rust.install", "rust-nodejs.install"]) {
    assert.deepEqual(preRuns.get(name).args, ["ci", "--ignore-scripts", "--no-audit", "--no-fund"]);
  }
});

test("only the inventory and exact registry tasks acquire the Rust provider build; ordinary C# and other host tasks do not", () => {
  const repository = fileURLToPath(new URL("../..", import.meta.url));
  const inventory = JSON.parse(execFileSync(process.execPath, ["test/scripts/run-parallel.mjs", "--inventory"], {
    cwd: repository, encoding: "utf8", timeout: 60_000, maxBuffer: 16 * 1024 * 1024,
  }));
  const affected = inventory.files.filter(entry => entry.preRunIds.includes("rust-nodejs.build"));
  assert.equal(affected.length, 2);
  assert.equal(affected.every(entry => entry.scope === "tsonic"), true);
  assert.deepEqual(affected.map(entry => entry.path).sort(), [
    "test/architecture/keel-node-registry.test.mjs", "test/architecture/keel-violations.test.mjs",
  ]);
  assert.equal(inventory.files.filter(entry => entry.scope === "tsonic-csharp").every(entry =>
    entry.preRunIds.every(id => !id.startsWith("rust-") && !id.startsWith("tsonic-rust."))), true);
  for (const [scope, path] of [
    ["tsonic", "test/fixtures/node-oracle/oracles.test.mjs"],
    ["tsonic-csharp", "test/helpers/compilation-observation.test.mjs"],
    ["tsonic-csharp", "test/helpers/node-oracles.test.mjs"],
  ]) {
    assert.equal(inventory.files.filter(entry => entry.scope === scope && entry.path === path).length, 1,
      `${scope}:${path} has exactly one scheduled owner`);
  }
  const heavy = inventory.files.filter(entry => entry.memoryMiB !== undefined);
  assert.equal(heavy.length, 1);
  assert.equal(heavy[0].path, "test/architecture/keel-violations.test.mjs");
  assert.equal(heavy[0].memoryMiB, 4096);
  assert.equal(heavy[0].heapMiB, 3072);
});

test("the existing queue weights the heavy inventory task without lowering ordinary useful parallelism", async () => {
  const tasks = [
    { id: "inventory", memoryMiB: 4096 }, { id: "simple-one" }, { id: "simple-two" },
  ];
  const budget = { workers: 3, memoryMiB: 6144, workerMemoryMiB: 2048 };
  let current = 0;
  let peak = 0;
  let count = 0;
  let overlap = false;
  const results = await runBoundedTestQueue(tasks, budget, async task => {
    const memory = task.memoryMiB ?? budget.workerMemoryMiB;
    current += memory;
    count += 1;
    peak = Math.max(peak, current);
    overlap ||= count > 1;
    await new Promise(completed => setTimeout(completed, 5));
    current -= memory;
    count -= 1;
    return task.id;
  });
  assert.equal(results.length, 3);
  assert.equal(peak, 6144);
  assert.equal(overlap, true);
  assert.throws(() => validateBoundedTestQueue(tasks, { ...budget, memoryMiB: 3072 }), /cannot fit the memory budget/u);
});

test("one admitted task gets its own finite heap and worker budget while other Node options remain exact", () => {
  const budget = testResourceBudget({ cpus: 8, totalMemoryMiB: 16384, availableMemoryMiB: 16384 }, {
    TSONIC_TEST_CPUS: "8", TSONIC_TEST_MEMORY_MIB: "8192", TSONIC_TEST_WORKERS: "2", TSONIC_TEST_CHILD_JOBS: "2",
  });
  const environment = { NODE_OPTIONS: '--trace-warnings --require "/path with spaces/hook.mjs" --max-old-space-size=1536' };
  const selected = testTaskEnvironment(environment, budget, { id: "inventory", memoryMiB: 4096, heapMiB: 3072 });
  assert.equal(selected.NODE_OPTIONS, '--trace-warnings --require "/path with spaces/hook.mjs" --max-old-space-size=3072');
  const local = readTestResourceBudget(selected);
  assert.equal(local.memoryMiB, 4096);
  assert.equal(local.workerMemoryMiB, 4096);
  assert.equal(local.heapMiB, 3072);
  assert.equal(local.workers, 1);
  assert.equal(local.childJobs, 2);
  assert.equal(testTaskEnvironment(environment, budget, { id: "simple" }) === environment, true);
  assert.throws(() => testTaskEnvironment(environment, budget, { id: "invalid", memoryMiB: 4096, heapMiB: 4096 }), /leave room/u);
  assert.throws(() => testTaskEnvironment({}, budget, { id: "missing-guard", memoryMiB: 4096 }), /guard-owned/u);
});

test("an outer budget below 4 GiB rejects the inventory before any build prerequisite executes", () => {
  const repository = fileURLToPath(new URL("../..", import.meta.url));
  const scratch = resolve(repository, ".temp/keel-architecture");
  mkdirSync(scratch, { recursive: true });
  const root = mkdtempSync(resolve(scratch, "inventory-admission-"));
  try {
    const marker = resolve(root, "build-started");
    writeFileSync(resolve(root, "npm"), `#!/bin/sh\nprintf started > '${marker}'\nexit 91\n`, { mode: 0o755 });
    const budget = testResourceBudget({ cpus: 2, totalMemoryMiB: 2048, availableMemoryMiB: 2048 }, {
      TSONIC_TEST_CPUS: "2", TSONIC_TEST_MEMORY_MIB: "2048", TSONIC_TEST_WORKERS: "1", TSONIC_TEST_CHILD_JOBS: "2",
    });
    const result = spawnSync(process.execPath, [
      "test/scripts/run-parallel.mjs", "--with-preruns", "--scope", "tsonic", "--match", "test/architecture/keel-violations.test.mjs",
    ], {
      cwd: repository, encoding: "utf8", timeout: 60_000,
      env: { ...process.env, PATH: root, TSONIC_TEST_RESOURCE_BUDGET: JSON.stringify(budget), TSONIC_TEST_WORKERS: "1", NODE_OPTIONS: "--max-old-space-size=1536" },
    });
    assert.equal(result.status, 1);
    assert.equal(result.stderr.includes("cannot fit the memory budget"), true);
    assert.equal(existsSync(marker), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
