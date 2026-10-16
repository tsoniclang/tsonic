import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function guardCgroupPath(membership) {
  const selected = membership.match(/^0::(\/.*)$/mu);
  if (selected === null) throw new Error("The bounded command requires its cgroup v2 membership.");
  const root = "/sys/fs/cgroup";
  const path = resolve(root, `.${selected[1]}`);
  if (path !== root && !path.startsWith(`${root}/`)) throw new Error("Invalid bounded command cgroup.");
  return path;
}

export function readGuardCounters(group) {
  const integer = (file) => {
    const text = readFileSync(resolve(group, file), "utf8").trim();
    if (!/^\d+$/u.test(text)) throw new Error(`Invalid cgroup counter ${file}.`);
    const value = Number(text);
    if (!Number.isSafeInteger(value)) throw new Error(`Unsafe cgroup counter ${file}.`);
    return value;
  };
  const fields = (file) => Object.fromEntries(readFileSync(resolve(group, file), "utf8").trim().split("\n").map(line => {
    const [key, text] = line.trim().split(/\s+/u);
    const value = Number(text);
    if (key === undefined || !/^\d+$/u.test(text ?? "") || !Number.isSafeInteger(value)) {
      throw new Error(`Invalid cgroup fields ${file}.`);
    }
    return [key, value];
  }));
  return {
    memoryPeakBytes: integer("memory.peak"),
    swapBytes: integer("memory.swap.current"),
    cpu: fields("cpu.stat"),
    memoryEvents: fields("memory.events"),
  };
}

export async function runGuardCommand(measurementPath, command, arguments_) {
  if (typeof command !== "string" || command.length === 0) throw new Error("A bounded command is required.");
  const group = guardCgroupPath(readFileSync("/proc/self/cgroup", "utf8"));
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
  const [measurementPath, command, ...arguments_] = process.argv.slice(2);
  process.exitCode = await runGuardCommand(measurementPath, command, arguments_);
}
