import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { runOomRetryQueue } from "../../scripts/parallel-scheduler.mjs";
import { createTaskCgroup, drainTaskCgroup, guardMeasurementSucceeded, readTaskCgroup, verifyOomRecoveries } from "../../scripts/guard-cgroup.mjs";

test("only a kernel-proved single-file victim is retried once at half width; raw failures survive", async () => {
  const tasks = ["victim", "assertion", "sigkill", "abort", "unfinished", "unavailable"].map(id => ({ id, file: `${id}.test.mjs` }));
  const calls = [];
  const results = await runOomRetryQueue(tasks, { workers: 8 }, async (shard, attempt, workers) => {
    calls.push(`${shard.id}:${attempt}:${workers}`);
    return { shard, status: attempt === 2 ? 0 : 1, signal: shard.id === "sigkill" ? "SIGKILL" : shard.id === "abort" ? "SIGABRT" : null,
      raw: `${shard.id}-${attempt}`, cgroup: { drained: true, oomKills: shard.id === "victim" && attempt === 1 ? 1 : null } };
  });
  assert.equal(calls.length, 7, "six original files and exactly one retry");
  assert.equal(calls.includes("victim:2:4"), true, "retry width is half the original width");
  for (const id of ["assertion", "sigkill", "abort", "unfinished", "unavailable"]) {
    assert.equal(calls.some(call => call.startsWith(`${id}:2:`)), false, `${id}: no heuristic retry`);
  }
  const victim = results.find(result => result.shard.id === "victim");
  assert.equal(victim.status, 0, "the final file result comes from its passing retry");
  assert.equal(victim.attempts[0].raw, "victim-1", "the original failed outcome remains intact");
  assert.equal(victim.attempts[0].status, 1, "the first attempt is never rewritten");
});

test("a failed retry is not retried again, and a multi-file process cannot identify an exact file victim", async () => {
  let count = 0;
  const tasks = [{ id: "file", files: ["one.test.mjs"] }, { id: "assembly", files: ["one.cs", "two.cs"] }];
  const results = await runOomRetryQueue(tasks, { workers: 1 }, async (shard, attempt, workers) => {
    count += 1;
    assert.equal(workers, 1, "half width never becomes zero");
    return { shard, status: 1, attempt, cgroup: { drained: true, oomKills: 1 } };
  });
  assert.equal(count, 3, "only the exact single-file task retries once");
  assert.equal(results.every(result => result.status === 1), true, "the failures stay failures");
});

test("unavailable delegation is explicit and cannot create OOM authority", () => {
  const child = createTaskCgroup(undefined, `task-${randomUUID()}`);
  assert.equal(child.path, null);
  assert.match(child.issue, /OOM victim attribution unavailable/u);
  assert.equal(guardMeasurementSucceeded({ controlGroup: "/scope", swapBytes: 0, oomBefore: 0, oomAfter: 1 }), false);
});

test("child kernel accounting validates every recovery against the original and retry groups", () => {
  mkdirSync(".temp/oom-accounting", { recursive: true });
  const root = mkdtempSync(resolve(".temp/oom-accounting/case-"));
  const make = (name, kills) => {
    const group = resolve(root, name);
    mkdirSync(group);
    writeFileSync(resolve(group, "memory.events.local"), `oom_kill ${kills}\n`);
    writeFileSync(resolve(group, "memory.peak"), "123456\n");
    writeFileSync(resolve(group, "cgroup.events"), "populated 0\n");
    return group;
  };
  const firstGroup = make("task-first", 1);
  const retryGroup = make("task-retry", 0);
  const path = resolve(root, "recoveries.jsonl");
  const incident = { firstGroup, retryGroup, retryStatus: 0, retryCompleted: true, retryTests: 3 };
  writeFileSync(path, `${JSON.stringify(incident)}\n`);
  const valid = verifyOomRecoveries(root, path, 1);
  assert.equal(valid.verified, true, "every owned kill is exactly accounted for");
  assert.equal(valid.accountedKills, 1);
  assert.equal(readTaskCgroup(firstGroup).memoryPeakBytes, 123456, "kernel peak is not sampled RSS");
  assert.equal(guardMeasurementSucceeded({ controlGroup: "/scope", swapBytes: 0, oomBefore: 0, oomAfter: 1, oomRecovery: valid }), true);
  for (const change of [{ retryStatus: 1 }, { retryCompleted: false }, { retryGroup: firstGroup },
    { firstGroup: resolve(root, "../foreign") }]) {
    writeFileSync(path, `${JSON.stringify({ ...incident, ...change })}\n`);
    assert.equal(verifyOomRecoveries(root, path, 1).verified, false, "wrong, foreign or nonpassing proof is refused");
  }
  writeFileSync(path, `${JSON.stringify(incident)}\n`);
  assert.equal(verifyOomRecoveries(root, path, 2).verified, false, "unattributed owned kills cannot be waived");
});

test("real delegated child accounting has no child memory cap and records a drained native peak", async () => {
  const root = process.env.TSONIC_TEST_TASK_CGROUP_ROOT;
  assert.equal(typeof root, "string", "the actual bounded scope delegates a memory controller");
  const child = createTaskCgroup(root, `task-${randomUUID()}`);
  assert.equal(child.issue, null, "the actual kernel creates the unbounded child");
  const command = 'printf "%s" "$$" > "$1/cgroup.procs" || exit 125; shift; exec "$@"';
  const result = spawnSync("/bin/sh", ["-c", command, "child", child.path, process.execPath, "-e", "const bytes=Buffer.alloc(8*1024*1024,1);console.log(bytes.length);"],
    { encoding: "utf8", timeout: 15_000, maxBuffer: 65_536 });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(resolve(child.path, "memory.max"), "utf8").trim(), "max", "only the outer group limits memory");
  const measured = await drainTaskCgroup(child.path);
  assert.equal(measured.drained, true);
  assert.equal(measured.oomKills, 0);
  assert.equal(measured.memoryPeakBytes > 0, true, "actual kernel accounting includes the child workload");
});

test("an actual bounded OOM victim retries once without rewriting the first attempt or guard counters", { timeout: 90_000 }, () => {
  mkdirSync(".temp/oom-native-proof", { recursive: true });
  const root = mkdtempSync(resolve(".temp/oom-native-proof/case-"));
  const repository = resolve(root, "native-fixture");
  mkdirSync(resolve(repository, "test"), { recursive: true });
  mkdirSync(resolve(repository, "scripts"));
  writeFileSync(resolve(repository, "scripts/register-tsonic-root-loader.mjs"), "export {};\n");
  const marker = resolve(root, "first-attempt-marker");
  writeFileSync(resolve(repository, "test/native.test.mjs"), `
import assert from "node:assert/strict";
import { existsSync, writeFileSync } from "node:fs";
import test from "node:test";
test("actual native victim control", () => {
  if (!existsSync(${JSON.stringify(marker)})) {
    writeFileSync(${JSON.stringify(marker)}, "first");
    writeFileSync("/proc/self/oom_score_adj", "1000");
    const bytes = Buffer.alloc(512 * 1024 * 1024, 1);
    assert.equal(bytes.length, 512 * 1024 * 1024);
  }
  assert.equal(2 + 2, 4);
});
`);
  const guardPath = resolve(root, "guard.json");
  const reportPath = resolve(root, "report.json");
  const run = spawnSync("bash", ["test/scripts/bounded-run.sh", "host", process.execPath, "test/scripts/run-parallel.mjs",
    "--scope", "tsonic-rust", "--repository-root", repository, "--file", resolve(repository, "test/native.test.mjs"), "--concurrency", "2"],
  { encoding: "utf8", timeout: 85_000, maxBuffer: 131_072,
    env: { ...process.env, TSONIC_TEST_GUARD_REPORT: guardPath, TSONIC_TEST_SUITE_REPORT: reportPath,
      TSONIC_TEST_MEMORY_MIB: "256", TSONIC_TEST_HEAP_MIB: "32", TSONIC_TEST_WORKERS: "2",
      TSONIC_TEST_CHILD_JOBS: "1", TSONIC_TEST_TIMEOUT_SECONDS: "75", NODE_OPTIONS: "" } });
  assert.equal(run.error === undefined, true, "the small deliberate-OOM control terminates");
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  const guard = JSON.parse(readFileSync(guardPath, "utf8"));
  assert.equal(report.results.length, 1, "only the exact original file is represented");
  const result = report.results[0];
  assert.equal(result.attempts.length, 2, "one original and one half-width retry");
  assert.equal(result.attempts[0].cgroup.oomKills > 0, true, "the kernel identifies the actual victim child");
  assert.equal(result.attempts[0].workers, 2);
  assert.equal(result.attempts[1].workers, 1);
  assert.equal(result.attempts[0].status !== 0, true, "the original failed attempt is retained");
  assert.equal(result.attempts[0].log !== result.attempts[1].log, true, "raw logs are not overwritten");
  assert.equal(result.attempts[0].resultPath !== result.attempts[1].resultPath, true, "raw named results are not overwritten");
  assert.equal(result.tests.length, 1);
  assert.equal(result.tests[0].status, "passed", "the final file result uses the completed passing retry");
  assert.equal(guard.oomAfter > guard.oomBefore, true, "the raw outer guard counters are unchanged");
  assert.equal(guard.measurement.oomRecovery.verified, true, "only exact accounted recovery permits success");
  assert.equal(guard.scopeDrained, true);
});
