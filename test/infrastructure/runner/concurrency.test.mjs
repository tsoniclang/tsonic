import assert from "node:assert/strict";
import test from "node:test";
import { testResourceBudget, readTestResourceBudget } from "../../scripts/test-resource-budget.mjs";
import { runBoundedTestQueue } from "../../scripts/parallel-scheduler.mjs";

const machine = { cpus: 24, availableMemoryMiB: 49_152, totalMemoryMiB: 61_440 };

test("test budgets use effective CPUs, memory reserves and native child costs", () => {
  const host = testResourceBudget(machine);
  assert.equal(host.cpuBudget, 20);
  assert.equal(host.memoryMiB, 36_864);
  assert.equal(host.workers, 18);
  const rust = testResourceBudget(machine, {}, "rust");
  assert.equal(rust.workers, 9);
  assert.equal(rust.childJobs, 2);
  assert(rust.workers * rust.childJobs <= rust.cpuBudget);
  assert(rust.workers * rust.workerMemoryMiB <= rust.memoryMiB);
  const native = testResourceBudget(machine, {}, "native");
  assert.equal(native.workers, 1);
  assert.equal(native.childJobs, native.cpuBudget);
  assert.equal(testResourceBudget({ cpus: 2, availableMemoryMiB: 6144, totalMemoryMiB: 8192 }).workers, 1);
});

test("explicit test budgets remain finite and bounded", () => {
  const budget = testResourceBudget(machine, { TSONIC_TEST_CPUS: "12", TSONIC_TEST_WORKERS: "6", TSONIC_TEST_MEMORY_MIB: "16384", TSONIC_TEST_CHILD_JOBS: "2" });
  assert.equal(budget.workers, 6);
  assert.equal(budget.memoryMiB, 16_384);
  for (const value of ["0", "-1", "NaN", "Infinity", "2.5", "2junk", "9007199254740992"]) {
    assert.throws(() => testResourceBudget(machine, { TSONIC_TEST_WORKERS: value }), /positive/u);
  }
  assert.throws(() => testResourceBudget(machine, { TSONIC_TEST_CPUS: "25" }), /available CPUs/u);
  assert.throws(() => testResourceBudget(machine, { TSONIC_TEST_WORKERS: "24" }), /capacity/u);
  assert.throws(() => testResourceBudget(machine, { TSONIC_TEST_MEMORY_MIB: "65536" }), /memory/u);
  assert.throws(() => testResourceBudget(machine, { TSONIC_TEST_HEAP_MIB: "2048" }), /native memory/u);
  assert.throws(() => testResourceBudget({ ...machine, totalMemoryMiB: NaN }), /total memory/u);
  assert.throws(() => testResourceBudget({ ...machine, availableMemoryMiB: 100_000 }), /total memory/u);
  assert.throws(() => testResourceBudget(machine, {}, "unknown"), /profile/u);
});

test("a guard passes one validated budget without reserving memory twice", () => {
  const budget = testResourceBudget(machine);
  const environment = { TSONIC_TEST_RESOURCE_BUDGET: JSON.stringify(budget) };
  assert.deepEqual(readTestResourceBudget(environment), budget);
  assert.equal(readTestResourceBudget({ ...environment, TSONIC_TEST_WORKERS: "1" }).workers, 1);
  for (const value of [null, [], {}, { ...budget, heapMiB: budget.workerMemoryMiB }, { ...budget, extra: true }]) {
    assert.throws(() => readTestResourceBudget({ TSONIC_TEST_RESOURCE_BUDGET: JSON.stringify(value) }));
  }
});

test("one suite fills idle slots across classification groups and collects failures", async () => {
  let completeFirst;
  const first = new Promise(resolve => { completeFirst = resolve; });
  const starts = [];
  const tasks = [{ id: "first", group: "slow" }, { id: "second", group: "independent" }, { id: "third", group: "independent" }];
  const results = await runBoundedTestQueue(tasks, { workers: 2, memoryMiB: 2, workerMemoryMiB: 1 }, async task => {
    starts.push(task.id);
    if (task.id === "first") await first;
    if (task.id === "third") completeFirst();
    return { id: task.id, status: task.id === "second" ? 1 : 0 };
  });
  assert.deepEqual(starts, ["first", "second", "third"]);
  assert.equal(results.length, 3);
  assert.equal(results.filter(result => result.status !== 0).length, 1);
});

test("test admission preserves exclusive, memory and per-group limits", async () => {
  const active = new Map();
  const tasks = [
    { id: "first", group: "native", memoryMiB: 2 },
    { id: "second", group: "native", memoryMiB: 2 },
    { id: "third", group: "analysis", memoryMiB: 1 },
    { id: "exclusive", group: "network", memoryMiB: 1, exclusive: true },
    { id: "last", group: "analysis", memoryMiB: 1 },
  ];
  const results = await runBoundedTestQueue(tasks, { workers: 4, memoryMiB: 3, workerMemoryMiB: 1, groupWorkerLimits: { native: 1 } }, async task => {
    assert(![...active.values()].some(entry => entry.exclusive));
    if (task.exclusive) assert.equal(active.size, 0);
    active.set(task.id, task);
    assert([...active.values()].reduce((total, entry) => total + entry.memoryMiB, 0) <= 3);
    assert([...active.values()].filter(entry => entry.group === "native").length <= 1);
    await new Promise(resolve => setImmediate(resolve));
    active.delete(task.id);
    return task.id;
  });
  assert.equal(new Set(results).size, tasks.length);
  assert.equal(active.size, 0);
});

test("test admission rejects duplicate and unbudgetable tasks", async () => {
  const options = { workers: 2, memoryMiB: 2, workerMemoryMiB: 1 };
  const execute = async task => task.id;
  await assert.rejects(runBoundedTestQueue([{ id: "same" }, { id: "same" }], options, execute), /Duplicate/u);
  await assert.rejects(runBoundedTestQueue([{ id: "large", memoryMiB: 3 }], options, execute), /memory budget/u);
  await assert.rejects(runBoundedTestQueue([], { ...options, workers: 0 }, execute), /finite positive/u);
});

test("infrastructure errors drain active workers without starting another task", async () => {
  const finished = [];
  await assert.rejects(runBoundedTestQueue([{ id: "failed" }, { id: "active" }, { id: "pending" }],
    { workers: 2, memoryMiB: 2, workerMemoryMiB: 1 }, async task => {
      if (task.id === "failed") throw new Error("spawn failed");
      await new Promise(resolve => setImmediate(resolve));
      finished.push(task.id);
    }), /active workers were drained/u);
  assert.deepEqual(finished, ["active"]);
  await assert.rejects(runBoundedTestQueue([{ id: "only" }],
    { workers: 1, memoryMiB: 1, workerMemoryMiB: 1 }, async () => {
      throw new Error("last task failed");
    }), /active workers were drained/u);
});
