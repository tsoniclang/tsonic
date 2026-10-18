import { spawn, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { guardCgroupPath, readGuardCounters } from "./guard-cgroup.mjs";

export function memoryBoundNodeTestArguments(command, arguments_, workers) {
  if (!/(?:^|\/)node(?:js)?$/u.test(command) || !arguments_.includes("--test")) return arguments_;
  const help = spawnSync(process.execPath, ["--help"], { encoding: "utf8", maxBuffer: 1_048_576 });
  if (help.status !== 0) throw new Error("Cannot read the installed Node command-line option contract.");
  const valued = new Set();
  for (const match of help.stdout.matchAll(/^\s+(?:(-[a-zA-Z]),\s+)?(--[a-zA-Z0-9-]+)=/gmu)) {
    if (match[1] !== undefined) valued.add(match[1]);
    valued.add(match[2]);
  }
  let boundary = arguments_.length;
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--" || !argument.startsWith("-") || ["-e", "--eval", "-p", "--print"].includes(argument)) {
      boundary = index;
      break;
    }
    if (valued.has(argument)) index += 1;
  }
  const options = arguments_.slice(0, boundary);
  if (!options.includes("--test")) return arguments_;
  const expected = String(workers);
  let configured = false;
  for (let index = 0; index < options.length; index += 1) {
    const argument = options[index];
    if (argument.startsWith("--test-concurrency=")) {
      configured = true;
      if (argument.slice("--test-concurrency=".length) !== expected) throw new Error("Node test concurrency must equal the selected worker count.");
    } else if (argument === "--test-concurrency") {
      configured = true;
      if (options[index + 1] !== expected) throw new Error("Node test concurrency must equal the selected worker count.");
    }
  }
  if (configured) return arguments_;
  const marker = arguments_.indexOf("--test");
  return [...arguments_.slice(0, marker + 1), `--test-concurrency=${expected}`, ...arguments_.slice(marker + 1)];
}

export async function runGuardCommand(measurementPath, command, arguments_) {
  if (typeof command !== "string" || command.length === 0) throw new Error("A bounded command is required.");
  const group = guardCgroupPath(readFileSync("/proc/self/cgroup", "utf8"));
  const admission = JSON.parse(process.env.TSONIC_TEST_ADMISSION);
  const activate = spawnSync("flock", [process.env.TSONIC_TEST_ADMISSION_LOCK, process.execPath,
    fileURLToPath(new URL("./memory-admission.mjs", import.meta.url)), "activate",
    process.env.TSONIC_TEST_ADMISSION_STATE, admission.unit, process.env.TSONIC_TEST_ADMISSION_OWNER,
  ], { stdio: "inherit" });
  if (activate.status !== 0) throw new Error("The bounded command could not activate its memory reservation.");
  const before = readGuardCounters(group);
  const startedAt = new Date().toISOString();
  const started = process.hrtime.bigint();
  const outcome = await new Promise((resolveOutcome, reject) => {
    const child = spawn(command, arguments_, { stdio: "inherit" });
    child.once("error", reject);
    child.once("close", (code, signal) => resolveOutcome({ code, signal }));
  });
  const finishedAt = new Date().toISOString();
  const durationSeconds = Number(process.hrtime.bigint() - started) / 1_000_000_000;
  const after = readGuardCounters(group);
  writeFileSync(measurementPath, `${JSON.stringify({
    schemaVersion: 1, startedAt, finishedAt, durationSeconds,
    cwd: process.cwd(), command: [command, ...arguments_],
    controlGroup: group.slice("/sys/fs/cgroup".length),
    memoryPeakBytes: after.memoryPeakBytes,
    swapBytes: after.swapBytes,
    cpuUsageMicroseconds: after.cpu.usage_usec - before.cpu.usage_usec,
    oomBefore: before.memoryEvents.oom_kill,
    oomAfter: after.memoryEvents.oom_kill,
    exitCode: outcome.code, signal: outcome.signal,
  }, null, 2)}\n`, { flag: "wx" });
  return outcome.code ?? 1;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [measurementPath, timeoutSeconds, command, ...arguments_] = process.argv.slice(2);
  if (!/^[1-9]\d*$/u.test(timeoutSeconds ?? "")) throw new Error("A positive bounded command timeout is required.");
  const budget = JSON.parse(process.env.TSONIC_TEST_RESOURCE_BUDGET);
  const workers = budget.workers;
  const bounded = memoryBoundNodeTestArguments(command, arguments_, workers);
  process.exitCode = await runGuardCommand(measurementPath, "timeout", [
    "--signal=TERM", "--kill-after=30s", `${timeoutSeconds}s`, command, ...bounded,
  ]);
}
