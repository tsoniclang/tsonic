import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

export function sampleTaskProcessTree(parentPid, procRoot = "/proc") {
  const pending = children(parentPid);
  const visited = new Set();
  const processes = [];
  for (let index = 0; index < pending.length; index += 1) {
    const pid = pending[index];
    if (visited.has(pid)) continue;
    visited.add(pid);
    try {
      const status = readFileSync(resolve(procRoot, String(pid), "status"), "utf8");
      const stat = readFileSync(resolve(procRoot, String(pid), "stat"), "utf8");
      const start = stat.slice(stat.lastIndexOf(")") + 2).trim().split(/\s+/u)[19];
      const rss = status.match(/^VmRSS:\s+(\d+) kB$/mu);
      const threads = status.match(/^Threads:\s+(\d+)$/mu);
      if (!/^\d+$/u.test(start ?? "") || threads === null) throw new Error("Invalid task process counters.");
      processes.push({ identity: `${pid}:${start}`, rssBytes: rss === null ? 0 : Number(rss[1]) * 1024,
        threads: Number(threads[1]) });
      pending.push(...children(pid));
    } catch (error) {
      if (error.code !== "ENOENT" && error.code !== "ESRCH") throw error;
    }
  }
  return processes;

  function children(pid) {
    try {
      return readdirSync(resolve(procRoot, String(pid), "task")).flatMap(thread => {
        try {
          const text = readFileSync(resolve(procRoot, String(pid), "task", thread, "children"), "utf8").trim();
          if (text === "") return [];
          if (!/^\d+(?:\s+\d+)*$/u.test(text)) throw new Error("Invalid task child-process list.");
          return text.split(/\s+/u).map(Number);
        } catch (error) {
          if (error.code === "ENOENT" || error.code === "ESRCH") return [];
          throw error;
        }
      });
    } catch (error) {
      if (error.code === "ENOENT" || error.code === "ESRCH") return [];
      throw error;
    }
  }
}

export function trackTaskProcesses(pid, { sample = sampleTaskProcessTree, intervalMs = 100 } = {}) {
  const identities = new Set();
  let samples = 0;
  let peakProcesses = 0;
  let peakThreads = 0;
  let peakRssBytes = 0;
  let errorMessage = null;
  const capture = () => {
    try {
      const processes = sample(pid);
      samples += 1;
      for (const process of processes) identities.add(process.identity);
      peakProcesses = Math.max(peakProcesses, processes.length);
      peakThreads = Math.max(peakThreads, processes.reduce((total, process) => total + process.threads, 0));
      peakRssBytes = Math.max(peakRssBytes, processes.reduce((total, process) => total + process.rssBytes, 0));
    } catch (error) {
      errorMessage = error.message;
    }
  };
  capture();
  const timer = setInterval(capture, intervalMs);
  timer.unref();
  return () => {
    clearInterval(timer);
    capture();
    return { method: "sampled-live-process-tree", intervalMs, samples,
      observedProcesses: identities.size, peakObservedProcesses: peakProcesses,
      peakObservedThreads: peakThreads, peakSampledRssBytes: samples === 0 ? null : peakRssBytes,
      mayMissShortLivedProcesses: true, sharedPagesMayBeCountedMoreThanOnce: true,
      mayMissReparentedProcesses: true,
      exactAggregateMemoryPeakBytes: null, permitsAutomaticWeightReduction: false, errorMessage };
  };
}

export function readTaskResourceUsage(path, durationMs, processes, budget) {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const usage = {};
  for (const key of ["userSeconds", "systemSeconds", "maximumResidentKiB"]) {
    if (typeof raw[key] !== "string" || !/^\d+(?:[.,]\d+)?$/u.test(raw[key])) {
      throw new Error(`Invalid task resource usage: ${key}.`);
    }
    usage[key] = Number(raw[key].replace(",", "."));
    if (!Number.isFinite(usage[key]) || usage[key] < 0) throw new Error(`Invalid task resource usage: ${key}.`);
  }
  const cpuSeconds = usage.userSeconds + usage.systemSeconds;
  return { cpu: { method: "wait4-command-and-waited-descendants", userSeconds: usage.userSeconds,
    systemSeconds: usage.systemSeconds, resolutionSeconds: 0.01,
    averageCores: durationMs > 0 ? cpuSeconds * 1000 / durationMs : null },
    memory: { method: "wait4-maximum-individual-process-rss", maximumResidentBytes: usage.maximumResidentKiB * 1024,
      exactAggregateMemoryPeakBytes: null, permitsAutomaticWeightReduction: false },
    processes, workers: 1, childJobs: budget.childJobs,
    memoryAdmission: "outer-job-cgroup-only" };
}

export function timedTaskArguments(path, command, args) {
  return ["--quiet", "--output", path, "--format",
    '{"userSeconds":"%U","systemSeconds":"%S","maximumResidentKiB":"%M"}', "--", command, ...args];
}
