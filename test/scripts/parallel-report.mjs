import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { availableParallelism, cpus } from "node:os";
import { aggregateTestCounts } from "./parallel-test-counts.mjs";
import { testPath } from "./workspace-layout.mjs";

export function writeParallelReport({ options, runId, tsonicRoot, resourceBudget, suiteDefinition, exclusiveShardCount,
  inventory, progress, repos, preRunResults, durationMs, testDurationMs, results, runRoot, suiteReportPath }) {
  const failures = results.filter((result) => result.status !== 0);
  const testCounts = aggregateTestCounts(results);
  const missingTestCountResults = results.filter((result) => result.testCounts === undefined);
  const measuredCpuSeconds = results.every(result => result.resources !== null)
    ? results.reduce((total, result) => total + result.resources.cpu.userSeconds + result.resources.cpu.systemSeconds, 0) : null;
  const averageTaskCores = measuredCpuSeconds === null || testDurationMs <= 0 ? null : measuredCpuSeconds * 1000 / testDurationMs;
  const report = {
    bank: suiteDefinition.bank,
    selection: { complete: options.withPreruns && results.length === inventory.taskCount },
    runId,
    createdAt: new Date().toISOString(),
    command: {
      cwd: testPath(tsonicRoot),
      argv: process.argv.slice(1),
    },
    host: {
      platform: process.platform,
      arch: process.arch,
      cpus: typeof availableParallelism === "function" ? availableParallelism() : cpus().length,
    },
    resourceBudget,
    resourceObservations: {
      cpuMethod: "sum-wait4-command-and-waited-descendants-over-test-wall", averageTaskCores,
      investigationRequired: testCounts.total >= 24 && averageTaskCores !== null && averageTaskCores < 8,
      limits: { queuedFiles: results.length, workerSlots: resourceBudget.workers, memoryMiB: resourceBudget.memoryMiB,
        groupWorkerLimits: suiteDefinition.groupWorkerLimits, exclusiveFiles: exclusiveShardCount,
        perTaskMemoryReservations: false, heapCapMiB: resourceBudget.heapMiB },
      exactWholeJobCgroupPeak: "available in the outer guard receipt, not a per-task measurement",
    },
    repos: snapshotParallelRepositories(repos),
    inventory,
    progress,
    preRuns: preRunResults,
    durationMs,
    taskCounts: {
      total: results.length,
      passed: results.length - failures.length,
      failed: failures.length,
    },
    testCounts,
    testCountReporting: {
      required: results.length,
      reported: testCounts.reportedShards,
      missing: missingTestCountResults.length,
      missingTasks: missingTestCountResults.map((result) => ({
        id: result.shard.id,
        group: result.shard.group,
        scope: result.shard.scope,
        log: testPath(relative(tsonicRoot, result.logPath)),
      })),
    },
    failuresByGroup: groupFailures(failures, tsonicRoot),
    results: results.map(result => ({
      id: result.shard.id, group: result.shard.group, scope: result.shard.scope,
      status: result.status, signal: result.signal, durationMs: result.durationMs,
      log: testPath(relative(tsonicRoot, result.logPath)),
      resultPath: testPath(relative(tsonicRoot, result.shard.resultPath)),
      resultError: result.resultError, summary: result.summary, tests: result.tests, resources: result.resources,
    })),
    slowestTasks: [...results]
      .sort((left, right) => right.durationMs - left.durationMs)
      .slice(0, 20)
      .map((result) => ({
        id: result.shard.id,
        group: result.shard.group,
        scope: result.shard.scope,
        durationMs: result.durationMs,
        status: result.status,
        log: testPath(relative(tsonicRoot, result.logPath)),
      })),
  };
  writeFileSync(resolve(runRoot, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  if (suiteReportPath !== undefined) {
    writeFileSync(suiteReportPath, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
  }

  console.log(`parallel-run: tasksPassed=${report.taskCounts.passed} tasksFailed=${report.taskCounts.failed} durationMs=${durationMs}`);
  if (testCounts.reportedShards > 0) {
    console.log(`parallel-run: reportedTests=${testCounts.total} passed=${testCounts.passed} failed=${testCounts.failed} skipped=${testCounts.skipped} reportingTasks=${testCounts.reportedShards}`);
  }
  if (missingTestCountResults.length > 0) {
    console.log(`parallel-run: missingTestCountTasks=${missingTestCountResults.length}`);
    for (const result of missingTestCountResults) {
      console.log(`  ${result.shard.id} log=${testPath(relative(tsonicRoot, result.logPath))}`);
    }
  }
  if (failures.length > 0) {
    for (const [group, entries] of Object.entries(report.failuresByGroup)) {
      console.log(`failure-group: ${group}`);
      for (const entry of entries) {
        console.log(`  ${entry.id} status=${entry.status} log=${entry.log}`);
      }
    }
  }
  console.log("slowest-tasks:");
  for (const shard of report.slowestTasks) {
    console.log(`  ${shard.durationMs}ms ${shard.status === 0 ? "PASS" : "FAIL"} ${shard.id} (${shard.log})`);
  }
  console.log(`parallel-run: report=${testPath(relative(tsonicRoot, resolve(runRoot, "report.json")))}`);
  if (suiteDefinition.bank === "node") {
    for (const [name, value] of Object.entries({ tests: testCounts.total, pass: testCounts.passed,
      fail: testCounts.failed, skipped: testCounts.skipped, todo: testCounts.todo, cancelled: testCounts.cancelled })) {
      console.log(`# ${name} ${value}`);
    }
  }

  return report;
}

function groupFailures(failures, tsonicRoot) {
  const groups = {};
  for (const failure of failures) {
    const group = failure.shard.group;
    groups[group] ??= [];
    groups[group].push({
      id: failure.shard.id,
      status: failure.status,
      durationMs: failure.durationMs,
      log: testPath(relative(tsonicRoot, failure.logPath)),
    });
  }
  return groups;
}

export function snapshotParallelRepositories(repos) {
  return Object.fromEntries(Object.entries(repos).map(([name, repoPath]) => [
    name,
    {
      path: testPath(repoPath),
      head: commandOutput(repoPath, "git", ["rev-parse", "HEAD"]),
      branch: commandOutput(repoPath, "git", ["branch", "--show-current"]),
      dirty: (commandOutput(repoPath, "git", ["status", "--porcelain"]) ?? "").length > 0,
    },
  ]));
}

function commandOutput(cwd, command, args) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    return undefined;
  }
  return result.stdout.trim();
}
