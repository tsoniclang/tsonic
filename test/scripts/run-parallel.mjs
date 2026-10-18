#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { readTestResourceBudget, testTaskEnvironment } from "./test-resource-budget.mjs";
import { runBoundedTestQueue, validateBoundedTestQueue } from "./parallel-scheduler.mjs";
import { createProgressTracker } from "./parallel-progress.mjs";
import { selectParallelSuiteDefinition } from "./suite-definition.mjs";
import { readTaskResourceUsage, timedTaskArguments, trackTaskProcesses } from "./parallel-task-resources.mjs";
import { readDotnetTestResults, readNodeTestResults, testTaskExecutionIssue } from "./test-results.mjs";
import { testResultCounts } from "./parallel-test-counts.mjs";
import { createParallelShardPlan, scopeToRepoKey } from "./parallel-shards.mjs";
import { requiredParallelPreRuns, runParallelPreRuns } from "./parallel-preruns.mjs";
import { writeParallelReport } from "./parallel-report.mjs";
import {
  testRepositoryRoots,
  tsonicRoot, testPath, testTaskName,
} from "./workspace-layout.mjs";

const options = parseArgs(process.argv.slice(2));
const repos = { ...testRepositoryRoots };
if (options.repositoryRoot !== undefined) {
  if (options.scopes.size !== 1) throw new Error("--repository-root requires exactly one selected scope.");
  repos[scopeToRepoKey([...options.scopes][0])] = options.repositoryRoot;
}
Object.freeze(repos);
const suiteReportPath = process.env.TSONIC_TEST_SUITE_REPORT;
delete process.env.TSONIC_TEST_SUITE_REPORT;
delete process.env.TSONIC_TEST_COUNT_DIRECTORY;
const resourceBudget = readTestResourceBudget({
  ...process.env,
  ...(options.concurrency === undefined ? {} : { TSONIC_TEST_WORKERS: String(options.concurrency) }),
});
const runId = `parallel-${timestamp()}-${process.pid}`;
const runRoot = resolve(tsonicRoot, ".temp/test-runs/parallel-runs", runId);
const logRoot = resolve(runRoot, "logs");
const statusRoot = resolve(runRoot, "status");
mkdirSync(logRoot, { recursive: true });
mkdirSync(statusRoot, { recursive: true });

const env = {
  ...process.env,
  CARGO_BUILD_JOBS: String(resourceBudget.childJobs),
  DOTNET_PROCESSOR_COUNT: String(resourceBudget.childJobs),
  TSONIC_TEST_RUN_ID: runId,
  NUGET_PACKAGES: process.env.NUGET_PACKAGES ?? resolve(tsonicRoot, ".temp/test-runs/nuget/packages"),
};

const suiteDefinition = selectParallelSuiteDefinition(repos, options.scopes);

const { shards: allShards, inventory } = createParallelShardPlan(suiteDefinition, repos, { statusRoot, tsonicRoot });

const shards = allShards.filter((shard) =>
  (options.scopes.size === 0 || options.scopes.has(shard.scope)) &&
  (options.groupPrefixes.length === 0 || options.groupPrefixes.some((prefix) => shard.group.startsWith(prefix))) &&
  (options.matches.length === 0 || options.matches.some((match) => shard.id.includes(match))) &&
  (options.files.size === 0 || (shard.files ?? [shard.file]).some(file => options.files.has(testPath(file))))
);
const representedRequests = new Set(shards.flatMap(shard => shard.files ?? [shard.file]).map(testPath));
const missingRequests = [...options.files].filter(file => !representedRequests.has(file));
if (missingRequests.length > 0) {
  throw new Error(`Exact requested test files are missing or excluded by selection:\n${missingRequests.join("\n")}`);
}
if (shards.length === 0) {
  console.error("FAIL: no parallel test tasks selected.");
  process.exit(2);
}

if (options.list) {
  console.log(`parallel-run: tasks=${shards.length}`);
  for (const shard of shards) {
    console.log(`${shard.group}\t${shard.scope}\t${shard.exclusive === true ? "exclusive" : "parallel"}\t${shard.id}`);
  }
  process.exit(0);
}
if (options.inventory) {
  await new Promise((completed, failed) => {
    process.stdout.write(`${JSON.stringify(inventory, null, 2)}\n`, error => error ? failed(error) : completed());
  });
  process.exit(0);
}

const exclusiveShardCount = shards.filter((shard) => shard.exclusive === true).length;
validateBoundedTestQueue(shards, { ...resourceBudget, groupWorkerLimits: suiteDefinition.groupWorkerLimits });
console.log(`parallel-run: tasks=${shards.length} concurrency=${resourceBudget.workers} exclusive=${exclusiveShardCount} memoryMiB=${resourceBudget.memoryMiB} childJobs=${resourceBudget.childJobs}`);

const startedAt = Date.now();
const preRunResults = options.withPreruns
  ? runParallelPreRuns(requiredParallelPreRuns(suiteDefinition, shards),
    { env, logRoot, runRoot, runId, repos, taskCount: shards.length, tsonicRoot }) : [];
const testsStartedAt = Date.now();
const progress = createProgressTracker(shards, options.progressIntervalMs);
progress.start();
let results;
try {
  results = await runShards(shards);
} finally {
  progress.stop();
}
const report = writeParallelReport({ options, runId, tsonicRoot, resourceBudget, suiteDefinition, exclusiveShardCount,
  inventory, progress: progress.summary(), repos, preRunResults, durationMs: Date.now() - startedAt,
  testDurationMs: Date.now() - testsStartedAt, results, runRoot, suiteReportPath });

process.exitCode = report.taskCounts.failed === 0 && report.testCountReporting.missing === 0 ? 0 : 1;

async function runShards(allShards) {
  const results = await runBoundedTestQueue(allShards, {
    ...resourceBudget,
    groupWorkerLimits: suiteDefinition.groupWorkerLimits,
  }, runShard);
  return results.sort((left, right) => left.shard.id.localeCompare(right.shard.id));
}

function runShard(shard) {
  return new Promise((resolveResult) => {
    const taskEnvironment = testTaskEnvironment(env, resourceBudget, shard);
    const startedAt = Date.now();
    const shardSafeName = testTaskName(shard.id);
    const logPath = resolve(logRoot, `${shardSafeName}.log`);
    const statusPath = resolve(statusRoot, `${shardSafeName}.json`);
    const usagePath = resolve(statusRoot, `${shardSafeName}.usage.json`);
    const logStream = createWriteStream(logPath, { flags: "w" });
    writeShardStatus(statusPath, {
      id: shard.id,
      group: shard.group,
      scope: shard.scope,
      status: "running",
      startedAt: new Date(startedAt).toISOString(),
      command: shard.command,
      args: shard.args,
      cwd: testPath(shard.cwd),
      log: testPath(relative(tsonicRoot, logPath)),
    });
    progress.startShard(shard, startedAt);
    const child = spawn("/usr/bin/time", timedTaskArguments(usagePath, shard.command, shard.args), {
      cwd: shard.cwd,
      env: taskEnvironment,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const finishProcesses = trackTaskProcesses(child.pid);
    child.stdout.on("data", (chunk) => {
      logStream.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      logStream.write(chunk);
    });
    child.on("error", (error) => {
      const chunk = Buffer.from(`Could not start test task: ${error.message}\n`);
      logStream.write(chunk);
    });
    child.on("close", (status, signal) => {
      const durationMs = Date.now() - startedAt;
      let normalizedStatus = status ?? 1;
      let tests = [];
      let summary = null;
      let testCounts;
      let resources = null;
      let resultError = null;
      const processObservations = finishProcesses();
      try {
        const named = shard.resultFormat === "node"
          ? readNodeTestResults(shard.resultPath, shard.cwd, testPath(relative(shard.cwd, shard.file)))
          : readDotnetTestResults(readFileSync(shard.resultPath, "utf8"), shard.id);
        tests = named.tests;
        summary = named.summary;
        if (summary.completed) testCounts = testResultCounts(tests);
        const executionIssue = testTaskExecutionIssue({ status: normalizedStatus, signal, summary, tests });
        if (executionIssue !== null) throw new Error(executionIssue);
        resources = readTaskResourceUsage(usagePath, durationMs, processObservations,
          { childJobs: Number(taskEnvironment.TSONIC_TEST_CHILD_JOBS), memoryMiB: shard.memoryMiB ?? resourceBudget.workerMemoryMiB });
        if (processObservations.errorMessage !== null) throw new Error(processObservations.errorMessage);
      } catch (error) {
        resultError = error.message;
        logStream.write(`Test result/measurement error: ${resultError}\n`);
        if (normalizedStatus === 0) normalizedStatus = 1;
      }
      writeShardStatus(statusPath, {
        id: shard.id,
        group: shard.group,
        scope: shard.scope,
        status: normalizedStatus === 0 ? "passed" : "failed",
        exitStatus: normalizedStatus,
        startedAt: new Date(startedAt).toISOString(),
        endedAt: new Date().toISOString(),
        durationMs,
        signal,
        command: shard.command,
        args: shard.args,
        cwd: testPath(shard.cwd),
        log: testPath(relative(tsonicRoot, logPath)),
        testCounts,
        tests,
        summary,
        resources,
        resultError,
      });
      console.log(`${normalizedStatus === 0 ? "PASS" : "FAIL"} ${shard.id} ${durationMs}ms`);
      progress.finishShard(shard, normalizedStatus, durationMs);
      logStream.end(() => {
        resolveResult({ shard, status: normalizedStatus, signal, durationMs, logPath, statusPath,
          testCounts, tests, summary, resources, resultError });
      });
    });
  });
}

function writeShardStatus(statusPath, status) {
  writeFileSync(statusPath, `${JSON.stringify(status, null, 2)}\n`);
}

function parseArgs(args) {
  const scopes = new Set();
  const matches = [];
  const groupPrefixes = [];
  const files = new Set();
  let list = false;
  let inventory = false;
  let withPreruns = false;
  let concurrency;
  let repositoryRoot;
  let progressIntervalMs = Number(process.env.TSONIC_TEST_PROGRESS_INTERVAL_MS ?? 180_000);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--concurrency") {
      concurrency = Number(args[++index]);
    } else if (arg === "--progress-interval-ms") {
      progressIntervalMs = Number(args[++index]);
    } else if (arg === "--scope") {
      scopes.add(args[++index]);
    } else if (arg === "--match") {
      matches.push(args[++index]);
    } else if (arg === "--file") {
      const file = args[++index];
      if (file === undefined) throw new Error("--file requires an exact file path.");
      files.add(testPath(resolve(file)));
    } else if (arg === "--repository-root") {
      const root = args[++index];
      if (repositoryRoot !== undefined || root === undefined || !isAbsolute(root)) {
        throw new Error("--repository-root requires one absolute checkout path.");
      }
      repositoryRoot = resolve(root);
    } else if (arg === "--group-prefix") {
      groupPrefixes.push(args[++index]);
    } else if (arg === "--list") {
      list = true;
    } else if (arg === "--inventory") {
      inventory = true;
    } else if (arg === "--with-preruns") {
      withPreruns = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: test/scripts/run-parallel.mjs [--concurrency <n>] [--progress-interval-ms <ms>] [--scope <name>] [--repository-root <absolute-path>] [--group-prefix <prefix>] [--match <task-substring>] [--file <exact-path>] [--list] [--inventory] [--with-preruns]");
      process.exit(0);
    } else {
      console.error(`FAIL: unknown argument: ${arg}`);
      process.exit(2);
    }
  }
  if (concurrency !== undefined && (!Number.isSafeInteger(concurrency) || concurrency <= 0)) throw new Error("--concurrency must be a positive safe integer.");
  if (!Number.isFinite(progressIntervalMs) || progressIntervalMs < 0) {
    progressIntervalMs = 180_000;
  }
  return { concurrency, progressIntervalMs, scopes, groupPrefixes, matches, files, repositoryRoot, list, inventory, withPreruns };
}

function timestamp() {
  const now = new Date();
  return [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
    "-",
    String(now.getUTCHours()).padStart(2, "0"),
    String(now.getUTCMinutes()).padStart(2, "0"),
    String(now.getUTCSeconds()).padStart(2, "0"),
  ].join("");
}
