import { existsSync, readFileSync } from "node:fs";
import { availableParallelism, freemem, totalmem } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const mebibyte = 1024 * 1024;

export function testResourceBudget(machine, environment = {}, profile = "host") {
  if (!["host", "rust", "native"].includes(profile)) throw new Error("Unknown test resource profile.");
  const availableCpus = positiveInteger(machine.cpus, "available CPUs");
  const cpuBudget = configuredInteger(environment.TSONIC_TEST_CPUS, "TSONIC_TEST_CPUS")
    ?? availableCpus;
  if (cpuBudget !== availableCpus) throw new Error("TSONIC_TEST_CPUS must equal available CPUs; CPU caps are not supported.");
  const totalMemoryMiB = positiveInteger(machine.totalMemoryMiB, "total memory");
  const availableMemoryMiB = positiveInteger(machine.availableMemoryMiB, "available memory");
  if (availableMemoryMiB > totalMemoryMiB) throw new Error("Available memory exceeds total memory.");
  const workers = configuredInteger(environment.TSONIC_TEST_WORKERS, "TSONIC_TEST_WORKERS") ?? availableCpus;
  const requestedMemoryMiB = configuredInteger(environment.TSONIC_TEST_MEMORY_MIB, "TSONIC_TEST_MEMORY_MIB");
  const memoryMiB = requestedMemoryMiB ?? Math.min(24_576, workers * 2048 + 2048);
  if (memoryMiB <= 0 || memoryMiB > totalMemoryMiB) {
    throw new Error("The test memory budget must fit physical memory; admission waits for available memory.");
  }
  const childJobs = configuredInteger(environment.TSONIC_TEST_CHILD_JOBS, "TSONIC_TEST_CHILD_JOBS")
    ?? (profile === "rust" ? 2 : 1);
  const heapMiB = configuredInteger(environment.TSONIC_TEST_HEAP_MIB, "TSONIC_TEST_HEAP_MIB")
    ?? Math.min(3072, Math.floor(memoryMiB * 0.75));
  return checkedResourceBudget({ availableCpus, cpuBudget, memoryMiB, childJobs, workers, heapMiB,
    memoryRequestSource: requestedMemoryMiB === undefined ? "formula" : "explicit" });
}

export function readTestHostResources() {
  const cpus = availableParallelism();
  let availableMemoryBytes = freemem();
  if (existsSync("/proc/meminfo")) {
    const available = readFileSync("/proc/meminfo", "utf8").match(/^MemAvailable:\s+(\d+) kB$/mu);
    if (available !== null) availableMemoryBytes = Number(available[1]) * 1024;
  }
  return { cpus, availableMemoryMiB: Math.floor(availableMemoryBytes / mebibyte), totalMemoryMiB: Math.floor(totalmem() / mebibyte) };
}

export function readTestMachineResources() {
  const host = readTestHostResources();
  let availableMemoryBytes = host.availableMemoryMiB * mebibyte;
  if (existsSync("/proc/self/cgroup")) {
    const membership = readFileSync("/proc/self/cgroup", "utf8").match(/^0::(.+)$/mu);
    if (membership !== null) {
      const root = "/sys/fs/cgroup";
      let directory = resolve(root, `.${membership[1]}`);
      while (directory === root || directory.startsWith(`${root}/`)) {
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
  return { ...host, availableMemoryMiB: Math.floor(availableMemoryBytes / mebibyte) };
}

export function readTestResourceBudget(environment = process.env, profile = "host") {
  if (!["host", "rust", "native"].includes(profile)) throw new Error("Unknown test resource profile.");
  if (environment.TSONIC_TEST_RESOURCE_BUDGET === undefined) {
    return testResourceBudget(readTestMachineResources(), environment, profile);
  }
  const selected = JSON.parse(environment.TSONIC_TEST_RESOURCE_BUDGET);
  return checkedResourceBudget({ ...selected,
    workers: configuredInteger(environment.TSONIC_TEST_WORKERS, "TSONIC_TEST_WORKERS") ?? selected?.workers });
}

export function testTaskEnvironment(environment, budget, task) {
  const heapMiB = task.heapMiB ?? budget.heapMiB;
  const childJobs = task.childJobs ?? budget.childJobs;
  const selected = checkedResourceBudget({ ...budget, childJobs, workers: 1, heapMiB });
  const inherited = environment.NODE_OPTIONS ?? "";
  const ownedHeap = `--max-old-space-size=${budget.heapMiB}`;
  if (!inherited.endsWith(ownedHeap)) throw new Error("Task resources require the final guard-owned Node heap option.");
  const childEnvironment = {
    ...environment,
    TSONIC_TEST_RESOURCE_BUDGET: JSON.stringify(selected),
    TSONIC_TEST_CPUS: String(selected.cpuBudget), TSONIC_TEST_MEMORY_MIB: String(selected.memoryMiB),
    TSONIC_TEST_HEAP_MIB: String(selected.heapMiB),
    TSONIC_TEST_CHILD_JOBS: String(selected.childJobs),
    CARGO_BUILD_JOBS: String(selected.childJobs), RUST_TEST_THREADS: String(selected.childJobs),
    DOTNET_PROCESSOR_COUNT: String(selected.childJobs),
    TSONIC_TEST_WORKERS: "1",
    NODE_OPTIONS: `${inherited.slice(0, -ownedHeap.length)}--max-old-space-size=${selected.heapMiB}`,
  };
  delete childEnvironment.NODE_TEST_CONTEXT;
  return childEnvironment;
}

function checkedResourceBudget(selected) {
  const fields = ["availableCpus", "cpuBudget", "memoryMiB", "childJobs", "workers", "heapMiB", "memoryRequestSource"];
  if (selected === null || typeof selected !== "object" || Object.keys(selected).length !== fields.length ||
      Object.keys(selected).some(field => !fields.includes(field)) || !["explicit", "formula"].includes(selected.memoryRequestSource)) {
    throw new Error("Invalid inherited test resource budget.");
  }
  for (const field of fields.filter(field => field !== "memoryRequestSource")) positiveInteger(selected[field], field);
  if (selected.cpuBudget !== selected.availableCpus) throw new Error("CPU caps are not supported.");
  if (selected.heapMiB >= selected.memoryMiB) throw new Error("The heap cap must leave room in the outer group for native memory.");
  return Object.freeze({ ...selected });
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
  const budget = testResourceBudget(readTestHostResources(), process.env, process.argv[2] ?? "host");
  console.log(JSON.stringify(budget));
}
