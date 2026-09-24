export async function runBoundedTestQueue(tasks, options, execute) {
  for (const value of [options.workers, options.memoryMiB, options.workerMemoryMiB,
    ...Object.values(options.groupWorkerLimits ?? {})]) {
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error("Test queue limits must be finite positive integers.");
  }
  const pending = [...tasks];
  const running = new Map();
  const groupCounts = new Map();
  const results = [];
  const errors = [];
  const identifiers = new Set();
  let memoryMiB = 0;
  for (const task of tasks) {
    if (identifiers.has(task.id)) throw new Error(`Duplicate test task: ${task.id}`);
    identifiers.add(task.id);
    const memory = task.memoryMiB ?? options.workerMemoryMiB;
    if (!Number.isSafeInteger(memory) || memory <= 0 || memory > options.memoryMiB) {
      throw new Error(`Test task ${task.id} cannot fit the memory budget.`);
    }
  }
  while (pending.length > 0 || running.size > 0) {
    for (let index = 0; errors.length === 0 && index < pending.length;) {
      if (running.size >= options.workers) break;
      const task = pending[index];
      if (task.exclusive === true && running.size > 0) break;
      const memory = task.memoryMiB ?? options.workerMemoryMiB;
      const groupCount = groupCounts.get(task.group) ?? 0;
      const groupLimit = options.groupWorkerLimits?.[task.group] ?? options.workers;
      if (memoryMiB + memory > options.memoryMiB || groupCount >= groupLimit) {
        index += 1;
        continue;
      }
      pending.splice(index, 1);
      memoryMiB += memory;
      groupCounts.set(task.group, groupCount + 1);
      const completion = Promise.resolve().then(() => execute(task))
        .then(result => results.push(result))
        .catch(error => { errors.push(error); })
        .finally(() => {
          running.delete(task.id);
          memoryMiB -= memory;
          groupCounts.set(task.group, groupCounts.get(task.group) - 1);
        });
      running.set(task.id, completion);
      if (task.exclusive === true) break;
    }
    if (running.size === 0 && errors.length > 0) throw new AggregateError(errors, "Test infrastructure failed; active workers were drained.");
    if (running.size === 0 && pending.length > 0) throw new Error("The test queue cannot make progress.");
    if (running.size > 0) await Promise.race(running.values());
  }
  if (errors.length > 0) throw new AggregateError(errors, "Test infrastructure failed; active workers were drained.");
  return results;
}
