import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { createParallelShardPlan } from "../../scripts/parallel-shards.mjs";
import { requiredParallelPreRuns, runParallelPreRuns } from "../../scripts/parallel-preruns.mjs";
import { createDotnetTestShards } from "../../scripts/parallel-dotnet.mjs";
import { writeParallelReport } from "../../scripts/parallel-report.mjs";
import { readNodeTestResults } from "../../scripts/test-results.mjs";
import { testResultCounts } from "../../scripts/parallel-test-counts.mjs";
import { readTestResourceBudget } from "../../scripts/test-resource-budget.mjs";
import { createParallelSuiteDefinition, createRustParallelSuiteDefinition, selectParallelSuiteDefinition } from "../../scripts/suite-definition.mjs";
import { testRepositoryRoots, tsonicRoot } from "../../scripts/workspace-layout.mjs";

const paths = { tsonicRoot, statusRoot: resolve(tsonicRoot, ".temp/shard-contract-results") };

test("every Host and Rust Node shard has an explicit single-file memory-scoped concurrency", () => {
  for (const definition of [createParallelSuiteDefinition(testRepositoryRoots), createRustParallelSuiteDefinition(testRepositoryRoots)]) {
    const { shards } = createParallelShardPlan(definition, testRepositoryRoots, paths);
    const nodes = shards.filter(shard => shard.resultFormat === "node");
    assert.equal(nodes.length > 0, true, definition.bank);
    for (const shard of nodes) {
      assert.equal(shard.args.filter(argument => argument.startsWith("--test-concurrency")).length, 1, shard.id);
      assert.equal(shard.args.includes("--test-concurrency=1"), true, shard.id);
      assert.equal(shard.files.length, 1, shard.id);
    }
  }
});

test("prerequisites come from suite and file data rather than names of groups", () => {
  const definition = createParallelSuiteDefinition(testRepositoryRoots);
  definition.nodeSuites[0] = { ...definition.nodeSuites[0], group: "renamed-ordinary-group" };
  const { shards } = createParallelShardPlan(definition, testRepositoryRoots, paths);
  const registry = shards.find(shard => shard.file?.endsWith("/keel-node-registry.test.mjs"));
  const ordinary = shards.find(shard => shard.file?.endsWith("/keel-check-contract.test.mjs"));
  assert.equal(registry.group, "renamed-ordinary-group");
  assert.equal(ordinary.group, "renamed-ordinary-group");
  assert.equal(requiredParallelPreRuns(definition, [registry]).some(run => run.id === "rust-nodejs.build"), true);
  assert.equal(requiredParallelPreRuns(definition, [ordinary]).some(run => run.id === "rust-nodejs.build"), false);
  const main = readFileSync(resolve(tsonicRoot, "test/scripts/run-parallel.mjs"), "utf8");
  const shardsSource = readFileSync(resolve(tsonicRoot, "test/scripts/parallel-shards.mjs"), "utf8");
  assert.doesNotMatch(main + shardsSource, /host-keel-inventory|host-carrier-registry|preRunsForTask|resourcesForFile/u);
});

test("bank selection uses declared inventories and rejects cross-bank mixtures", () => {
  assert.equal(selectParallelSuiteDefinition(testRepositoryRoots, new Set()).bank, "host");
  assert.equal(selectParallelSuiteDefinition(testRepositoryRoots, new Set(["tsonic-rust"])).bank, "node");
  assert.throws(() => selectParallelSuiteDefinition(testRepositoryRoots, new Set(["tsonic-rust", "tsonic"])), /separate banks/u);
  assert.throws(() => selectParallelSuiteDefinition(testRepositoryRoots, new Set(["unknown"])), /canonical bank/u);
});

test("extracted modules retain the explicit checkout when a real task has a named failure", () => {
  mkdirSync(paths.statusRoot, { recursive: true });
  const root = mkdtempSync(resolve(paths.statusRoot, "report-"));
  const statusRoot = resolve(root, "status");
  const logRoot = resolve(root, "logs");
  const testRoot = resolve(root, "test");
  for (const directory of [statusRoot, logRoot, testRoot]) mkdirSync(directory);
  writeFileSync(resolve(testRoot, "actual.test.mjs"),
    "import test from 'node:test'; test('actual passing control', () => {}); test('actual failing control', () => { throw new Error('retained task failure'); });\n");
  const definition = {
    bank: "host", preRuns: [{ id: "fixture.prepare", cwd: root, command: process.execPath,
      args: ["-e", "console.log(process.cwd())"] }],
    nodeSuites: [{ scope: "tsonic", group: "explicit-checkout", directory: testRoot, suffix: ".test.mjs",
      preRunIds: ["fixture.prepare"] }], architectureSuites: [], dotnetSuites: [], groupWorkerLimits: {},
  };
  const repos = { tsonic: root };
  const { shards, inventory } = createParallelShardPlan(definition, repos, { statusRoot, tsonicRoot });
  assert.equal(shards.length, 1, "the explicit checkout supplies the task inventory");
  assert.equal(shards[0].cwd, root, "the task executes inside the requested checkout");
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const preRuns = runParallelPreRuns(requiredParallelPreRuns(definition, shards), {
    env, logRoot, runRoot: root, runId: "actual-failed-task", repos, taskCount: shards.length, tsonicRoot: root,
  });
  assert.equal(preRuns[0].status, 0, "the extracted pre-run executes successfully");
  assert.equal(readFileSync(resolve(root, preRuns[0].log), "utf8").trim(), root,
    "pre-run logs use the explicitly supplied checkout rather than the coordinating cwd");
  const startedAt = Date.now();
  const actual = spawnSync(shards[0].command, shards[0].args, {
    cwd: shards[0].cwd, env, encoding: "utf8", timeout: 30_000, maxBuffer: 65_536,
  });
  assert.equal(actual.error === undefined, true, "the real task completes without a launcher error");
  assert.equal(actual.status, 1, "a completed assertion failure retains its native task status");
  assert.equal(actual.signal, null, "the real failed task was not killed");
  const durationMs = Date.now() - startedAt;
  const named = readNodeTestResults(shards[0].resultPath, root, "test/actual.test.mjs");
  assert.equal(named.summary.completed, true, "the failed task retains its completed event summary");
  const logPath = resolve(logRoot, "actual-failed-task.log");
  writeFileSync(logPath, actual.stdout + actual.stderr);
  const suiteReportPath = resolve(root, "published-report.json");
  const report = writeParallelReport({
    options: { withPreruns: false }, runId: "actual-failed-task", tsonicRoot: root,
    resourceBudget: readTestResourceBudget(), suiteDefinition: definition, exclusiveShardCount: 0,
    inventory, progress: {}, repos, preRunResults: preRuns, durationMs, testDurationMs: durationMs,
    results: [{ shard: shards[0], status: actual.status, signal: actual.signal, durationMs, logPath,
      testCounts: testResultCounts(named.tests), tests: named.tests, summary: named.summary,
      resources: null, resultError: null }], runRoot: root, suiteReportPath,
  });
  for (const actualReport of [report, JSON.parse(readFileSync(resolve(root, "report.json"), "utf8")),
    JSON.parse(readFileSync(suiteReportPath, "utf8"))]) {
    assert.equal(actualReport.taskCounts.failed, 1, "the failed task reaches every aggregate report");
    assert.equal(actualReport.testCounts.total, 2, "both actual named outcomes remain in the aggregate");
    assert.equal(actualReport.testCounts.failed, 1, "the real failed assertion remains failed");
    assert.equal(actualReport.testCounts.passed, 1, "the positive control remains passed");
    assert.equal(actualReport.failuresByGroup["explicit-checkout"][0].log, "logs/actual-failed-task.log",
      "failure grouping receives the explicit reporting root");
    assert.equal(actualReport.results[0].tests.find(result => result.status === "failed").name,
      "actual failing control", "failure reporting retains the exact actual test name");
    assert.equal(actualReport.resourceObservations.averageTaskCores, null,
      "this control does not fabricate native process measurements");
  }
});

test("extracted dotnet task modes receive their status directory without a module-global checkout", () => {
  mkdirSync(paths.statusRoot, { recursive: true });
  const root = mkdtempSync(resolve(paths.statusRoot, "dotnet-"));
  const directory = resolve(root, "tests");
  mkdirSync(directory);
  writeFileSync(resolve(directory, "Example.cs"), "namespace Explicit; public class Example { [Fact] public void Check() {} }\n");
  for (const taskMode of ["assembly", "directory"]) {
    const shards = createDotnetTestShards({ scope: "csharp-js", group: "native-fixture", taskMode,
      directory, cwd: root, projectOrSolution: resolve(root, "Fixture.csproj") }, { statusRoot: paths.statusRoot });
    assert.equal(shards.length, 1, taskMode);
    assert.equal(shards[0].cwd, root, `${taskMode}: the native task keeps its own checkout`);
    assert.equal(shards[0].resultPath.startsWith(`${paths.statusRoot}/`), true,
      `${taskMode}: native result paths use the explicit status directory`);
    assert.equal(shards[0].args.some(argument => argument.startsWith("trx;LogFileName=")), true,
      `${taskMode}: the native reporter receives its owned result path`);
  }
});
