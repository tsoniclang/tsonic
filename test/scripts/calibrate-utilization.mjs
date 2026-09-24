import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";

export function cpuUtilization(cpuSeconds, elapsedSeconds, cpuBudget) {
  if (![cpuSeconds, elapsedSeconds, cpuBudget].every(Number.isFinite)
    || cpuSeconds < 0 || elapsedSeconds <= 0 || cpuBudget <= 0) {
    throw new Error("CPU utilization requires finite valid measurements.");
  }
  return { cores: cpuSeconds / elapsedSeconds, percent: cpuSeconds / elapsedSeconds / cpuBudget * 100 };
}

export function calibrationSettings(environment) {
  const duration = Number(environment.TSONIC_TEST_CALIBRATION_SECONDS);
  const warmup = Number(environment.TSONIC_TEST_CALIBRATION_WARMUP_SECONDS ?? 60);
  const target = Number(environment.TSONIC_TEST_MIN_CPU_PERCENT ?? 60);
  if (!Number.isSafeInteger(duration) || duration <= 0 || !Number.isSafeInteger(warmup) || warmup < 0
    || !Number.isFinite(target) || target <= 0 || target > 100) {
    throw new Error("Invalid test calibration duration, warmup or CPU target.");
  }
  return { duration, warmup, target };
}

async function calibrate(unit, runnerPid, logFile) {
  const budget = JSON.parse(process.env.TSONIC_TEST_RESOURCE_BUDGET);
  const { duration, warmup, target } = calibrationSettings(process.env);
  let group;
  while (isRunning(runnerPid)) {
    const result = spawnSync("systemctl", ["--user", "show", unit, "--property=ControlGroup", "--value"], { encoding: "utf8" });
    if (result.status === 0 && result.stdout.trim() !== "") {
      group = resolve("/sys/fs/cgroup", `.${result.stdout.trim()}`);
      break;
    }
    await setTimeout(250);
  }
  if (group === undefined) return;
  const start = performance.now();
  let sample;
  while (isRunning(runnerPid) && existsSync(resolve(group, "cpu.stat"))) {
    const elapsed = (performance.now() - start) / 1000;
    const usage = readFileSync(resolve(group, "cpu.stat"), "utf8").match(/^usage_usec (\d+)$/mu);
    if (usage === null) throw new Error("The test cgroup has no CPU accounting.");
    const cpuSeconds = Number(usage[1]) / 1_000_000;
    if (elapsed >= warmup && sample === undefined) sample = { elapsed, cpuSeconds };
    if (sample !== undefined && elapsed - sample.elapsed >= duration) {
      const measured = cpuUtilization(cpuSeconds - sample.cpuSeconds, elapsed - sample.elapsed, budget.cpuBudget);
      const result = { kind: "calibration", certified: false, targetPercent: target, cpuBudget: budget.cpuBudget,
        elapsedSeconds: elapsed - sample.elapsed, ...measured, targetMet: measured.percent >= target };
      writeFileSync(`${logFile}.calibration.json`, `${JSON.stringify(result, null, 2)}\n`);
      console.log(`calibration: ${measured.cores.toFixed(2)} CPUs; ${measured.percent.toFixed(1)}% of ${budget.cpuBudget}; target ${target}%; ${result.targetMet ? "met" : "not met"}. Stopping this noncertification run.`);
      const stopped = spawnSync("systemctl", ["--user", "stop", unit], { stdio: "inherit" });
      if (stopped.status !== 0) throw new Error("Could not stop the calibration scope.");
      return;
    }
    await setTimeout(1000);
  }
}

function isRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") return false;
    throw error;
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === "--validate") calibrationSettings(process.env);
  else await calibrate(process.argv[2], Number(process.argv[3]), process.argv[4]);
}
