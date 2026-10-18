import { existsSync, lstatSync, readFileSync, readdirSync, readlinkSync, realpathSync, rmSync } from "node:fs";
import { isAbsolute, resolve, sep } from "node:path";

export function taskTimeoutsFromBaseline(baseline) {
  if (!Array.isArray(baseline.results)) throw new Error("A file timeout baseline requires task results.");
  const timeouts = new Map();
  for (const task of baseline.results) {
    if (typeof task.id !== "string" || task.id.length === 0 || timeouts.has(task.id) ||
        !Number.isFinite(task.durationMs) || task.durationMs < 0) {
      throw new Error("File timeout baselines require unique task identities and measured file wall times.");
    }
    timeouts.set(task.id, Math.max(300_000, Math.ceil(task.durationMs * 10)));
  }
  return timeouts;
}

export function taskTimeoutMilliseconds(task, timeouts = new Map()) {
  return timeouts.get(task.id) ?? 1_800_000;
}

export function activeWorkspaceReferences(directories, procRoot = "/proc") {
  const active = new Set();
  const within = (path, root) => path === root || path.startsWith(`${root}${sep}`);
  for (const entry of readdirSync(procRoot)) {
    if (!/^\d+$/u.test(entry) || Number(entry) === process.pid) continue;
    const root = resolve(procRoot, entry);
    try {
      const status = readFileSync(resolve(root, "status"), "utf8");
      if (Number(status.match(/^Uid:\s+(\d+)/mu)?.[1]) !== process.getuid()) continue;
      const paths = [readlinkSync(resolve(root, "cwd")), readlinkSync(resolve(root, "exe")),
        ...readFileSync(resolve(root, "cmdline"), "utf8").split("\0")];
      for (const directory of directories) {
        if (paths.some(path => within(path, directory))) active.add(directory);
      }
    } catch (error) {
      if (["ENOENT", "ESRCH"].includes(error.code)) continue;
      throw error;
    }
  }
  return active;
}

export function cleanupFinishedCargoTargets(manifestPath, taskGroup, options = {}) {
  const result = { removed: [], retained: [], issue: null };
  if (!existsSync(manifestPath)) return result;
  if (taskGroup?.drained !== true) return { ...result, issue: "Task descendants are not proven drained; Cargo binaries retained." };
  const workspaces = readFileSync(manifestPath, "utf8").split("\n").filter(Boolean).map(line => JSON.parse(line));
  for (const entry of workspaces) {
    if (typeof entry.directory !== "string" || !isAbsolute(entry.directory) ||
        !entry.directory.split(sep).some(part => part === ".temp" || part === ".tests") ||
        !/^\d+$/u.test(entry.dev ?? "") || !/^\d+$/u.test(entry.ino ?? "")) throw new Error("Invalid task-owned workspace identity.");
  }
  const active = options.activePaths ?? activeWorkspaceReferences(workspaces.map(entry => entry.directory));
  for (const entry of workspaces) {
    if (!existsSync(entry.directory)) continue;
    const actual = lstatSync(entry.directory, { bigint: true });
    if (!actual.isDirectory() || String(actual.dev) !== entry.dev || String(actual.ino) !== entry.ino ||
        realpathSync(entry.directory) !== entry.directory || active.has(entry.directory)) {
      result.retained.push(entry.directory);
      continue;
    }
    visit(entry.directory);
  }
  return result;

  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (!entry.isDirectory() || entry.name === "node_modules" || entry.name === ".git") continue;
      if (entry.name === "target") {
        if (!existsSync(resolve(directory, "Cargo.toml"))) continue;
        for (const profile of ["debug", "release"]) {
          const profilePath = resolve(path, profile);
          if (!existsSync(profilePath) || !lstatSync(profilePath).isDirectory() || realpathSync(profilePath) !== profilePath) continue;
          for (const leaf of ["deps", "incremental"]) {
            const binary = resolve(profilePath, leaf);
            if (!existsSync(binary) || !lstatSync(binary).isDirectory() || realpathSync(binary) !== binary) continue;
            rmSync(binary, { recursive: true });
            result.removed.push(binary);
          }
        }
      } else visit(path);
    }
  }
}

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
