import assert from "node:assert/strict";
import test from "node:test";
import { testResourceBudget, readTestResourceBudget, testTaskEnvironment } from "../../scripts/test-resource-budget.mjs";
import { runBoundedTestQueue } from "../../scripts/parallel-scheduler.mjs";

const machine = { cpus: 24, availableMemoryMiB: 49_152, totalMemoryMiB: 61_440 };

test("test budgets expose every CPU without per-worker memory reservations", () => {
  const host = testResourceBudget(machine);
  assert.equal(host.cpuBudget, 24);
  assert.equal(host.memoryMiB, 24_576);
  assert.equal(host.workers, 24);
  const rust = testResourceBudget(machine, {}, "rust");
  assert.equal(rust.workers, 24);
  assert.equal(rust.childJobs, 2);
  assert.equal(Object.hasOwn(rust, "workerMemoryMiB"), false);
  const native = testResourceBudget(machine, {}, "native");
  assert.equal(native.workers, 24);
  assert.equal(native.childJobs, 1);
  assert.throws(() => testResourceBudget({ cpus: 2, availableMemoryMiB: 6144, totalMemoryMiB: 8192 }), /memory budget/u,
    "the default group cannot exceed physical memory");
});

test("explicit test budgets remain finite and bounded", () => {
  const budget = testResourceBudget(machine, { TSONIC_TEST_CPUS: "24", TSONIC_TEST_WORKERS: "6", TSONIC_TEST_MEMORY_MIB: "16384", TSONIC_TEST_CHILD_JOBS: "2" });
  assert.equal(budget.workers, 6);
  assert.equal(budget.memoryMiB, 16_384);
  for (const value of ["0", "-1", "NaN", "Infinity", "2.5", "2junk", "9007199254740992"]) {
    assert.throws(() => testResourceBudget(machine, { TSONIC_TEST_WORKERS: value }), /positive/u);
  }
  assert.throws(() => testResourceBudget(machine, { TSONIC_TEST_CPUS: "25" }), /available CPUs/u);
  assert.throws(() => testResourceBudget(machine, { TSONIC_TEST_CPUS: "12" }), /CPU caps/u);
  assert.equal(testResourceBudget(machine, { TSONIC_TEST_WORKERS: "24" }).workers, 24);
  assert.throws(() => testResourceBudget(machine, { TSONIC_TEST_MEMORY_MIB: "65536" }), /memory/u);
  assert.throws(() => testResourceBudget(machine, { TSONIC_TEST_HEAP_MIB: "32768" }), /native memory/u);
  assert.throws(() => testResourceBudget({ ...machine, totalMemoryMiB: NaN }), /total memory/u);
  assert.throws(() => testResourceBudget({ ...machine, availableMemoryMiB: 100_000 }), /total memory/u);
  assert.throws(() => testResourceBudget(machine, {}, "unknown"), /profile/u);
});

test("worker selection does not impose an implicit aggregate CPU quota", () => {
  const budget = testResourceBudget({ ...machine, cpus: 2 }, {
    TSONIC_TEST_MEMORY_MIB: "8192", TSONIC_TEST_WORKERS: "4", TSONIC_TEST_CHILD_JOBS: "3",
  });
  assert.equal(budget.workers, 4);
  assert.equal(budget.childJobs, 3);
  assert.equal(budget.cpuBudget, 2);
});

test("a task inherits every CPU and the one outer group budget without a task reservation", () => {
  const budget = testResourceBudget(machine, { TSONIC_TEST_CHILD_JOBS: "2" });
  const environment = { NODE_OPTIONS: `--max-old-space-size=${budget.heapMiB}`, NODE_TEST_CONTEXT: "child-v8" };
  const selected = testTaskEnvironment(environment, budget, { id: "native", heapMiB: 2048 });
  const inherited = readTestResourceBudget(selected);
  assert.equal(inherited.cpuBudget, 24);
  assert.equal(inherited.childJobs, 2);
  assert.equal(inherited.workers, 1);
  assert.equal(inherited.memoryMiB, budget.memoryMiB);
  assert.equal(inherited.heapMiB, 2048);
  assert.equal(Object.hasOwn(selected, "NODE_TEST_CONTEXT"), false, "an independent test task cannot inherit Node's parent-file context");
});

test("per-task native child counts remain explicit without reducing CPU-selected outer width", () => {
  const budget = testResourceBudget(machine, { TSONIC_TEST_CHILD_JOBS: "1" });
  const selected = testTaskEnvironment({ NODE_OPTIONS: `--max-old-space-size=${budget.heapMiB}` }, budget,
    { id: "measured-native-task", heapMiB: 2048, childJobs: 3 });
  assert.equal(budget.workers, machine.cpus);
  assert.equal(readTestResourceBudget(selected).childJobs, 3);
  for (const name of ["CARGO_BUILD_JOBS", "RUST_TEST_THREADS", "DOTNET_PROCESSOR_COUNT", "TSONIC_TEST_CHILD_JOBS"]) {
    assert.equal(selected[name], "3", name);
  }
  assert.equal(readTestResourceBudget(selected).cpuBudget, 24);
  assert.throws(() => testTaskEnvironment({ NODE_OPTIONS: `--max-old-space-size=${budget.heapMiB}` }, budget,
    { id: "invalid", childJobs: 0 }), /positive/u);
});

test("a guard passes one validated budget without reserving memory twice", () => {
  const budget = testResourceBudget(machine);
  const environment = { TSONIC_TEST_RESOURCE_BUDGET: JSON.stringify(budget) };
  assert.deepEqual(readTestResourceBudget(environment), budget);
  assert.equal(readTestResourceBudget({ ...environment, TSONIC_TEST_WORKERS: "1" }).workers, 1);
  for (const value of [null, [], {}, { ...budget, heapMiB: budget.memoryMiB }, { ...budget, extra: true }]) {
    assert.throws(() => readTestResourceBudget({ TSONIC_TEST_RESOURCE_BUDGET: JSON.stringify(value) }));
  }
});

test("a default job fits the unchanged physical-headroom admission check at the sampled free memory", () => {
  const budget = testResourceBudget(machine);
  assert.equal(budget.memoryMiB + 6144 <= machine.availableMemoryMiB, true,
    "the default does not wait for four GiB more memory than the machine has");
  const selected = testTaskEnvironment({ NODE_OPTIONS: `--max-old-space-size=${budget.heapMiB}` }, budget, { id: "ordinary" });
  const task = readTestResourceBudget(selected);
  assert.equal(task.memoryMiB, budget.memoryMiB, "ordinary files refer to the same outer cgroup, not a task reservation");
  assert.equal(task.workers, 1, "one file cannot inherit every outer queue slot");
  assert.equal(task.availableCpus, 24, "there is no CPU quota on the task");
});

test("one suite fills idle slots across classification groups and collects failures", async () => {
  let completeFirst;
  const first = new Promise(resolve => { completeFirst = resolve; });
  const starts = [];
  const tasks = [{ id: "first", group: "slow" }, { id: "second", group: "independent" }, { id: "third", group: "independent" }];
  const results = await runBoundedTestQueue(tasks, { workers: 2 }, async task => {
    starts.push(task.id);
    if (task.id === "first") await first;
    if (task.id === "third") completeFirst();
    return { id: task.id, status: task.id === "second" ? 1 : 0 };
  });
  assert.deepEqual(starts, ["first", "second", "third"]);
  assert.equal(results.length, 3);
  assert.equal(results.filter(result => result.status !== 0).length, 1);
});

test("test admission preserves exclusive and per-group limits without summing task memory", async () => {
  const active = new Map();
  const tasks = [
    { id: "first", group: "native" },
    { id: "second", group: "native" },
    { id: "third", group: "analysis" },
    { id: "exclusive", group: "network", exclusive: true },
    { id: "last", group: "analysis" },
  ];
  const results = await runBoundedTestQueue(tasks, { workers: 4, groupWorkerLimits: { native: 1 } }, async task => {
    assert(![...active.values()].some(entry => entry.exclusive));
    if (task.exclusive) assert.equal(active.size, 0);
    active.set(task.id, task);
    assert.equal(active.size <= 4, true, "only explicit worker slots limit the queue");
    assert([...active.values()].filter(entry => entry.group === "native").length <= 1);
    await new Promise(resolve => setImmediate(resolve));
    active.delete(task.id);
    return task.id;
  });
  assert.equal(new Set(results).size, tasks.length);
  assert.equal(active.size, 0);
});

test("test admission rejects duplicate tasks and invalid worker limits", async () => {
  const options = { workers: 2 };
  const execute = async task => task.id;
  await assert.rejects(runBoundedTestQueue([{ id: "same" }, { id: "same" }], options, execute), /Duplicate/u);
  const admitted = await runBoundedTestQueue([{ id: "first" }, { id: "second" }], options, execute);
  assert.equal(admitted.length, 2, "a task no longer needs an individual memory declaration");
  await assert.rejects(runBoundedTestQueue([], { ...options, workers: 0 }, execute), /finite positive/u);
});

test("infrastructure errors drain active workers without starting another task", async () => {
  const finished = [];
  await assert.rejects(runBoundedTestQueue([{ id: "failed" }, { id: "active" }, { id: "pending" }],
    { workers: 2 }, async task => {
      if (task.id === "failed") throw new Error("spawn failed");
      await new Promise(resolve => setImmediate(resolve));
      finished.push(task.id);
    }), /active workers were drained/u);
  assert.deepEqual(finished, ["active"]);
  await assert.rejects(runBoundedTestQueue([{ id: "only" }],
    { workers: 1 }, async () => {
      throw new Error("last task failed");
    }), /active workers were drained/u);
});
