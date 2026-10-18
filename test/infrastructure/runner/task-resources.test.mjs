import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { readTaskResourceUsage, sampleTaskProcessTree, timedTaskArguments, trackTaskProcesses } from "../../scripts/parallel-task-resources.mjs";

mkdirSync(".temp/task-resource-tests", { recursive: true });

test("task sampling visits every thread's children once and preserves process start identity", () => {
  const root = mkdtempSync(resolve(".temp/task-resource-tests/proc-"));
  const process = (pid, start, rss, threads, children) => {
    mkdirSync(resolve(root, String(pid), "task", String(pid)), { recursive: true });
    writeFileSync(resolve(root, String(pid), "task", String(pid), "children"), children.join(" "));
    writeFileSync(resolve(root, String(pid), "status"), `VmRSS:\t${rss} kB\nThreads:\t${threads}\n`);
    const fields = Array(22).fill("0");
    fields[19] = String(start);
    writeFileSync(resolve(root, String(pid), "stat"), `${pid} (a process (name)) ${fields.join(" ")}\n`);
  };
  process(10, 100, 1, 1, [11]);
  process(11, 101, 20, 2, [12]);
  process(12, 102, 30, 1, []);
  mkdirSync(resolve(root, "11/task/111"));
  writeFileSync(resolve(root, "11/task/111/children"), "12 13");
  process(13, 103, 40, 1, []);
  const observed = sampleTaskProcessTree(10, root);
  assert.deepEqual(observed.map(row => row.identity), ["11:101", "12:102", "13:103"]);
  assert.equal(observed.reduce((total, row) => total + row.rssBytes, 0), 90 * 1024);
  assert.deepEqual(sampleTaskProcessTree(999, root), [], "an already-exited task has no fabricated sample");
});

test("sampled RSS and counts are never represented as an exact cgroup peak", () => {
  let reads = 0;
  const finish = trackTaskProcesses(123, { intervalMs: 1_000_000, sample: () => reads++ === 0
    ? [{ identity: "1:10", rssBytes: 50, threads: 1 }, { identity: "2:20", rssBytes: 70, threads: 2 }]
    : [{ identity: "1:11", rssBytes: 40, threads: 1 }] });
  const observed = finish();
  assert.equal(observed.observedProcesses, 3, "a reused PID is a distinct observed process");
  assert.equal(observed.peakObservedProcesses, 2);
  assert.equal(observed.peakObservedThreads, 3);
  assert.equal(observed.peakSampledRssBytes, 120);
  assert.equal(observed.exactAggregateMemoryPeakBytes, null);
  assert.equal(observed.mayMissShortLivedProcesses, true);
  assert.equal(observed.sharedPagesMayBeCountedMoreThanOnce, true);
  assert.equal(observed.permitsAutomaticWeightReduction, false);
});

test("wait4 records CPU and maximum individual RSS without claiming aggregate peak", () => {
  const root = mkdtempSync(resolve(".temp/task-resource-tests/usage-"));
  const path = resolve(root, "usage.json");
  writeFileSync(path, JSON.stringify({ userSeconds: "1.20", systemSeconds: "0,30", maximumResidentKiB: "2048" }));
  const measured = readTaskResourceUsage(path, 1000, { peakObservedProcesses: 3 }, { childJobs: 4, memoryMiB: 4096 });
  assert.equal(measured.cpu.averageCores, 1.5);
  assert.equal(measured.memory.maximumResidentBytes, 2_097_152);
  assert.equal(measured.memory.exactAggregateMemoryPeakBytes, null);
  assert.equal(measured.memory.permitsAutomaticWeightReduction, false);
  assert.equal(measured.childJobs, 4);
  assert.equal(Object.hasOwn(measured, "reservedMemoryMiB"), false);
  assert.equal(measured.memoryAdmission, "outer-job-cgroup-only");
  writeFileSync(path, JSON.stringify({ userSeconds: null, systemSeconds: "0.0", maximumResidentKiB: "1" }));
  assert.throws(() => readTaskResourceUsage(path, 1000, {}, {}), /Invalid task resource usage/u);
});

test("a real timed child retains failed status, literal arguments and resource evidence", async () => {
  const root = mkdtempSync(resolve(".temp/task-resource-tests/real-"));
  const path = resolve(root, "usage.json");
  const child = spawn("/usr/bin/time", timedTaskArguments(path, process.execPath,
    ["-e", 'if(process.argv[1] !== "$not-expanded") throw Error("literal argument lost");process.exitCode=23;', "$not-expanded"]),
  { stdio: "pipe" });
  const finish = trackTaskProcesses(child.pid);
  const status = await new Promise((completed, failed) => { child.once("error", failed); child.once("close", completed); });
  assert.equal(status, 23);
  const measured = readTaskResourceUsage(path, 1000, finish(), { childJobs: 1, memoryMiB: 2048 });
  assert.equal(measured.memory.maximumResidentBytes > 0, true, "the actual child supplied native wait4 memory");
  assert.equal(readFileSync(path, "utf8").trim().startsWith("{"), true, "failure diagnostics do not corrupt usage JSON");
});
