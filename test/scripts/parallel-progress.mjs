import { readFileSync } from "node:fs";

export function createProgressTracker(allShards, progressIntervalMs) {
  const running = new Map();
  const samples = [];
  const cpuSampler = createCpuSampler();
  const state = {
    total: allShards.length,
    completed: 0,
    passed: 0,
    failed: 0,
    startedAt: Date.now(),
  };
  let interval;
  return {
    start() {
      emitProgress("start");
      if (progressIntervalMs > 0) {
        interval = setInterval(() => emitProgress("interval"), progressIntervalMs);
      }
    },
    stop() {
      if (interval !== undefined) {
        clearInterval(interval);
      }
      emitProgress("final");
    },
    startShard(shard, startedAt) {
      running.set(shard.id, {
        id: shard.id,
        group: shard.group,
        scope: shard.scope,
        startedAt,
      });
      console.log(`START ${shard.id}`);
    },
    finishShard(shard, status) {
      running.delete(shard.id);
      state.completed += 1;
      if (status === 0) {
        state.passed += 1;
      } else {
        state.failed += 1;
      }
    },
    summary() {
      return {
        intervalMs: progressIntervalMs,
        samples,
      };
    },
  };

  function emitProgress(reason) {
    const now = Date.now();
    const cpu = cpuSampler.sample();
    const runningShards = [...running.values()]
      .map((entry) => ({
        id: entry.id,
        group: entry.group,
        scope: entry.scope,
        elapsedMs: now - entry.startedAt,
      }))
      .sort((left, right) => right.elapsedMs - left.elapsedMs);
    const sample = {
      reason,
      timestamp: new Date(now).toISOString(),
      elapsedMs: now - state.startedAt,
      total: state.total,
      completed: state.completed,
      passed: state.passed,
      failed: state.failed,
      running: runningShards.length,
      queued: Math.max(0, state.total - state.completed - runningShards.length),
      cpuAllCoresPercent: cpu?.allCoresPercent,
      longestRunning: runningShards.slice(0, 10),
    };
    samples.push(sample);
    const cpuText = sample.cpuAllCoresPercent === undefined
      ? "unknown"
      : `${sample.cpuAllCoresPercent.toFixed(1)}%`;
    console.log(
      `parallel-progress: reason=${reason} completed=${sample.completed}/${sample.total} ` +
        `passed=${sample.passed} failed=${sample.failed} running=${sample.running} queued=${sample.queued} ` +
        `cpu=${cpuText} elapsedMs=${sample.elapsedMs}`,
    );
    for (const shard of runningShards.slice(0, 5)) {
      console.log(`  running ${shard.elapsedMs}ms ${shard.id}`);
    }
  }
}

function createCpuSampler() {
  let previous = readCpuSnapshot();
  return {
    sample() {
      const current = readCpuSnapshot();
      if (previous === undefined || current === undefined) {
        previous = current;
        return undefined;
      }
      const totalDelta = current.total - previous.total;
      const idleDelta = current.idle - previous.idle;
      previous = current;
      if (totalDelta <= 0) {
        return undefined;
      }
      return {
        allCoresPercent: (1 - idleDelta / totalDelta) * 100,
      };
    },
  };
}

function readCpuSnapshot() {
  try {
    const cpuLine = readFileSync("/proc/stat", "utf8").split("\n")[0]?.trim();
    if (cpuLine === undefined || !cpuLine.startsWith("cpu ")) {
      return undefined;
    }
    const values = cpuLine.split(/\s+/u).slice(1).map((value) => Number(value));
    if (values.some((value) => !Number.isFinite(value))) {
      return undefined;
    }
    const idle = (values[3] ?? 0) + (values[4] ?? 0);
    const total = values.reduce((sum, value) => sum + value, 0);
    return { idle, total };
  } catch {
    return undefined;
  }
}
