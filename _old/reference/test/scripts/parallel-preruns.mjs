import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { testPath, testTaskName } from "./workspace-layout.mjs";
import { snapshotParallelRepositories } from "./parallel-report.mjs";

export function requiredParallelPreRuns(suiteDefinition, shardsToRun) {
  const byId = new Map(suiteDefinition.preRuns.map((preRun) => [preRun.id, preRun]));
  const required = new Set();
  for (const shard of shardsToRun) {
    for (const id of shard.preRunIds ?? []) {
      addWithDependencies(id);
    }
  }
  return suiteDefinition.preRuns.filter((preRun) => required.has(preRun.id));

  function addWithDependencies(id) {
    if (required.has(id)) {
      return;
    }
    const preRun = byId.get(id);
    if (preRun === undefined) {
      throw new Error(`Unknown pre-run id: ${id}`);
    }
    for (const dependency of preRun.dependsOn ?? []) {
      addWithDependencies(dependency);
    }
    required.add(id);
  }
}

export function runParallelPreRuns(preRuns, { env, logRoot, runRoot, runId, repos, taskCount, tsonicRoot }) {
  const results = [];
  for (const preRun of preRuns) {
    const startedAt = Date.now();
    const logPath = resolve(logRoot, `${testTaskName(`prerun:${preRun.id}`)}.log`);
    console.log(`PRERUN ${preRun.id}`);
    const result = spawnSync(preRun.command, preRun.args, {
      cwd: preRun.cwd,
      env: { ...env, ...(preRun.env ?? {}) },
      encoding: "utf8",
    });
    writeFileSync(logPath, `${result.stdout ?? ""}${result.stderr ?? ""}`);
    const durationMs = Date.now() - startedAt;
    const status = result.status ?? 1;
    const entry = {
      id: preRun.id,
      status,
      durationMs,
      command: preRun.command,
      args: preRun.args,
      cwd: testPath(preRun.cwd),
      log: testPath(relative(tsonicRoot, logPath)),
    };
    results.push(entry);
    console.log(`${status === 0 ? "PRERUN PASS" : "PRERUN FAIL"} ${preRun.id} ${durationMs}ms log=${entry.log}`);
    if (status !== 0) {
      writeFileSync(resolve(runRoot, "report.json"), `${JSON.stringify({
        runId,
        createdAt: new Date().toISOString(),
        command: {
          cwd: testPath(tsonicRoot),
          argv: process.argv.slice(1),
        },
        repos: snapshotParallelRepositories(repos),
        preRuns: results,
        taskCounts: {
          total: taskCount,
          passed: 0,
          failed: taskCount,
        },
      }, null, 2)}\n`);
      process.exit(status);
    }
  }
  return results;
}
