import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { memoryBoundNodeTestArguments, runGuardCommand } from "../../scripts/guard-command.mjs";
import { guardCgroupPath, guardMeasurementSucceeded, readGuardCounters } from "../../scripts/guard-cgroup.mjs";
import { createGuardReport } from "../../scripts/guard-report.mjs";

mkdirSync(".temp/guard-command-tests", { recursive: true });

test("Node test launches explicitly use the memory-derived worker count", () => {
  assert.deepEqual(memoryBoundNodeTestArguments("node", ["--test", "case.mjs"], 4), ["--test", "--test-concurrency=4", "case.mjs"]);
  assert.deepEqual(memoryBoundNodeTestArguments("/usr/bin/node", ["--test", "--test-concurrency=4", "case.mjs"], 4), ["--test", "--test-concurrency=4", "case.mjs"]);
  assert.throws(() => memoryBoundNodeTestArguments("node", ["--test", "--test-concurrency=1", "case.mjs"], 4), /memory-derived/u);
  assert.throws(() => memoryBoundNodeTestArguments("node", ["--test", "--test-concurrency", "23", "case.mjs"], 4), /memory-derived/u);
  assert.deepEqual(memoryBoundNodeTestArguments("node", ["script.mjs"], 4), ["script.mjs"]);
  assert.deepEqual(memoryBoundNodeTestArguments("node", ["script.mjs", "--test"], 4), ["script.mjs", "--test"]);
  assert.deepEqual(memoryBoundNodeTestArguments("node", ["--", "script.mjs", "--test"], 4), ["--", "script.mjs", "--test"]);
  assert.deepEqual(memoryBoundNodeTestArguments("node", ["--test", "--", "--test-concurrency=1"], 4), ["--test", "--test-concurrency=4", "--", "--test-concurrency=1"]);
  assert.deepEqual(memoryBoundNodeTestArguments("node", ["--import", "hook.mjs", "--test", "case.mjs"], 4), ["--import", "hook.mjs", "--test", "--test-concurrency=4", "case.mjs"]);
});

test("guard membership is a closed cgroup v2 path", () => {
  assert.equal(guardCgroupPath("0::/user.slice/test.scope\n"), "/sys/fs/cgroup/user.slice/test.scope");
  assert.throws(() => guardCgroupPath("1:memory:/test"), /cgroup v2/u);
  assert.throws(() => guardCgroupPath("0::/../../outside"), /Invalid/u);
});

test("guard counters require exact finite kernel measurements", () => {
  const directory = mkdtempSync(resolve(".temp/guard-command-tests/counters-"));
  writeFileSync(resolve(directory, "memory.peak"), "1048576\n");
  writeFileSync(resolve(directory, "memory.swap.current"), "0\n");
  writeFileSync(resolve(directory, "cpu.stat"), "usage_usec 150\nuser_usec 120\nsystem_usec 30\n");
  writeFileSync(resolve(directory, "memory.events"), "oom 0\noom_kill 0\n");
  const measured = readGuardCounters(directory);
  assert.equal(measured.memoryPeakBytes, 1048576);
  assert.equal(measured.swapBytes, 0);
  assert.equal(measured.cpu.usage_usec, 150);
  assert.equal(measured.memoryEvents.oom_kill, 0);
  writeFileSync(resolve(directory, "memory.peak"), "max\n");
  assert.throws(() => readGuardCounters(directory), /Invalid cgroup counter/u);
  writeFileSync(resolve(directory, "memory.peak"), "9007199254740992\n");
  assert.throws(() => readGuardCounters(directory), /Unsafe cgroup counter/u);
});

test("command evidence is captured inside the still-owned bounded scope", async () => {
  const directory = mkdtempSync(resolve(".temp/guard-command-tests/command-"));
  const path = resolve(directory, "measurement.json");
  const status = await runGuardCommand(path, process.execPath, ["-e", "process.exitCode = 0"]);
  const measured = JSON.parse(readFileSync(path, "utf8"));
  assert.equal(status, 0);
  assert.equal(measured.exitCode, 0);
  assert.equal(measured.signal, null);
  assert.equal(measured.swapBytes, 0);
  assert.equal(measured.oomBefore, measured.oomAfter);
  assert.equal(measured.memoryPeakBytes > 0, true, "the kernel supplied a positive group peak");
  assert.equal(measured.durationSeconds > 0, true, "duration uses a monotonic clock");
  assert.equal(measured.cpuUsageMicroseconds >= 0, true, "CPU time is a measured group delta");
  assert.equal(measured.controlGroup.includes("tsonic-"), true, "the test remains inside its bounded guard");
  assert.deepEqual(measured.command, [process.execPath, "-e", "process.exitCode = 0"]);
});

test("a failed child retains its exact exit status and measurement", async () => {
  const directory = mkdtempSync(resolve(".temp/guard-command-tests/failed-"));
  const path = resolve(directory, "measurement.json");
  assert.equal(await runGuardCommand(path, process.execPath, ["-e", "process.exitCode = 23"]), 23);
  assert.equal(JSON.parse(readFileSync(path, "utf8")).exitCode, 23);
});

test("only the owned cgroup can invalidate a bounded command for OOM", () => {
  const measurement = { controlGroup: "/user.slice/owned.scope", swapBytes: 0, oomBefore: 2, oomAfter: 2,
    durationSeconds: 2, cpuUsageMicroseconds: 3_000_000 };
  const report = createGuardReport({ measurement, before: "7", after: "8", status: 0, memory: 4096,
    tasks: 2048, timeout: 60, logMax: 65536, scope: "success", calibration: "", drained: "true", log: "/actual/log" });
  assert.equal(guardMeasurementSucceeded(measurement), true, "a foreign job kill does not change owned counters");
  assert.equal(report.oomBefore, 2, "the canonical receipt starts at the owned counter");
  assert.equal(report.oomAfter, 2, "the canonical receipt ends at the owned counter");
  assert.equal(report.userSliceOomDiagnostic.after, 8, "the foreign observation is retained without authority");
  assert.equal(report.userSliceOomDiagnostic.authoritative, false);
  assert.equal(report.averageCores, 1.5);
  for (const invalid of [null, {}, { ...measurement, oomAfter: 3 }, { ...measurement, oomBefore: null },
    { ...measurement, oomBefore: -1, oomAfter: -1 }, { ...measurement, swapBytes: 1 }]) {
    assert.equal(guardMeasurementSucceeded(invalid), false, "owned OOM, swap and absent proof still fail closed");
  }
  const missing = createGuardReport({ measurement: null, before: "7", after: "7" });
  assert.equal(missing.oomBefore, null, "global counters never substitute for missing own-job evidence");
  assert.equal(missing.oomAfter, null);
});
