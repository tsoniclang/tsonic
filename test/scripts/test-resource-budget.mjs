import { existsSync, readFileSync } from "node:fs";
import { availableParallelism, freemem, totalmem } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const mebibyte = 1024 * 1024;

export function testResourceBudget(machine, environment = {}, profile = "host") {
  if (profile !== "host" && profile !== "rust") throw new Error("Unknown test resource profile.");
  const availableCpus = positiveInteger(machine.cpus, "available CPUs");
  const cpuBudget = configuredInteger(environment.TSONIC_TEST_CPUS, "TSONIC_TEST_CPUS")
    ?? Math.max(1, Math.floor(availableCpus * 0.85));
  if (cpuBudget > availableCpus) throw new Error("TSONIC_TEST_CPUS exceeds available CPUs.");
  const totalMemoryMiB = positiveInteger(machine.totalMemoryMiB, "total memory");
  const availableMemoryMiB = positiveInteger(machine.availableMemoryMiB, "available memory");
  if (availableMemoryMiB > totalMemoryMiB) throw new Error("Available memory exceeds total memory.");
  const reserveMiB = Math.min(12_288, Math.max(512, Math.floor(totalMemoryMiB / 5)));
  const memoryMiB = configuredInteger(environment.TSONIC_TEST_MEMORY_MIB, "TSONIC_TEST_MEMORY_MIB")
    ?? Math.min(40_960, availableMemoryMiB - reserveMiB);
  if (memoryMiB <= 0 || memoryMiB > availableMemoryMiB) {
    throw new Error("The test memory budget must fit currently available memory.");
  }
  const workerMemoryMiB = configuredInteger(environment.TSONIC_TEST_WORKER_MEMORY_MIB, "TSONIC_TEST_WORKER_MEMORY_MIB")
    ?? (profile === "rust" ? 4096 : 2048);
  const childJobs = configuredInteger(environment.TSONIC_TEST_CHILD_JOBS, "TSONIC_TEST_CHILD_JOBS")
    ?? (profile === "rust" ? Math.min(2, cpuBudget) : 1);
  const capacity = Math.min(Math.floor(cpuBudget / childJobs), Math.floor(memoryMiB / workerMemoryMiB));
  if (capacity < 1) throw new Error("The CPU/memory budget cannot admit one test worker.");
  const workers = configuredInteger(environment.TSONIC_TEST_WORKERS, "TSONIC_TEST_WORKERS") ?? capacity;
  if (workers > capacity) throw new Error(`Requested ${workers} test workers exceed the CPU/memory capacity ${capacity}.`);
  const heapMiB = configuredInteger(environment.TSONIC_TEST_HEAP_MIB, "TSONIC_TEST_HEAP_MIB")
    ?? Math.min(4096, Math.floor(workerMemoryMiB * 0.75));
  if (heapMiB >= workerMemoryMiB) throw new Error("The worker heap must leave room for native memory.");
  return Object.freeze({ availableCpus, cpuBudget, memoryMiB, workerMemoryMiB, childJobs, workers, heapMiB });
}

export function readTestMachineResources() {
  let cpus = availableParallelism();
  let availableMemoryBytes = freemem();
  if (existsSync("/proc/meminfo")) {
    const available = readFileSync("/proc/meminfo", "utf8").match(/^MemAvailable:\s+(\d+) kB$/mu);
    if (available !== null) availableMemoryBytes = Number(available[1]) * 1024;
  }
  if (existsSync("/proc/self/cgroup")) {
    const membership = readFileSync("/proc/self/cgroup", "utf8").match(/^0::(.+)$/mu);
    if (membership !== null) {
      const root = "/sys/fs/cgroup";
      let directory = resolve(root, `.${membership[1]}`);
      while (directory === root || directory.startsWith(`${root}/`)) {
        const quotaFile = resolve(directory, "cpu.max");
        if (existsSync(quotaFile)) {
          const [quota, period] = readFileSync(quotaFile, "utf8").trim().split(/\s+/u);
          if (quota !== "max") cpus = Math.min(cpus, Math.max(1, Math.floor(Number(quota) / Number(period))));
        }
        const limitFile = resolve(directory, "memory.max");
        if (existsSync(limitFile)) {
          const limit = readFileSync(limitFile, "utf8").trim();
          if (limit !== "max") {
            const current = Number(readFileSync(resolve(directory, "memory.current"), "utf8"));
            const reclaimable = readFileSync(resolve(directory, "memory.stat"), "utf8").match(/^inactive_file (\d+)$/mu);
            availableMemoryBytes = Math.min(availableMemoryBytes, Number(limit) - current + Number(reclaimable?.[1] ?? 0));
          }
        }
        if (directory === root) break;
        directory = dirname(directory);
      }
    }
  }
  return { cpus, availableMemoryMiB: Math.floor(availableMemoryBytes / mebibyte), totalMemoryMiB: Math.floor(totalmem() / mebibyte) };
}

export function readTestResourceBudget(environment = process.env, profile = "host") {
  if (environment.TSONIC_TEST_RESOURCE_BUDGET === undefined) {
    return testResourceBudget(readTestMachineResources(), environment, profile);
  }
  const selected = JSON.parse(environment.TSONIC_TEST_RESOURCE_BUDGET);
  const fields = ["availableCpus", "cpuBudget", "memoryMiB", "workerMemoryMiB", "childJobs", "workers", "heapMiB"];
  if (selected === null || typeof selected !== "object" || Object.keys(selected).length !== fields.length) {
    throw new Error("Invalid inherited test resource budget.");
  }
  for (const field of fields) positiveInteger(selected[field], field);
  return testResourceBudget({ cpus: selected.availableCpus, totalMemoryMiB: selected.memoryMiB, availableMemoryMiB: selected.memoryMiB }, {
    TSONIC_TEST_CPUS: String(selected.cpuBudget),
    TSONIC_TEST_MEMORY_MIB: String(selected.memoryMiB),
    TSONIC_TEST_WORKER_MEMORY_MIB: String(selected.workerMemoryMiB),
    TSONIC_TEST_CHILD_JOBS: String(selected.childJobs),
    TSONIC_TEST_WORKERS: environment.TSONIC_TEST_WORKERS ?? String(selected.workers),
    TSONIC_TEST_HEAP_MIB: String(selected.heapMiB),
  }, profile);
}

function configuredInteger(value, name) {
  if (value === undefined) return undefined;
  if (!/^[1-9]\d*$/u.test(String(value))) throw new Error(`${name} must be a positive integer.`);
  return positiveInteger(Number(value), name);
}

function positiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive safe integer.`);
  return value;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const budget = testResourceBudget(readTestMachineResources(), process.env, process.argv[2] ?? "host");
  console.log(JSON.stringify(budget));
}
