export function validateBoundedTestQueue(tasks, options) {
  for (const value of [options.workers,
    ...Object.values(options.groupWorkerLimits ?? {})]) {
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error("Test queue limits must be finite positive integers.");
  }
  const identifiers = new Set();
  for (const task of tasks) {
    if (identifiers.has(task.id)) throw new Error(`Duplicate test task: ${task.id}`);
    identifiers.add(task.id);
  }
}

export async function runBoundedTestQueue(tasks, options, execute) {
  validateBoundedTestQueue(tasks, options);
  const pending = [...tasks];
  const running = new Map();
  const groupCounts = new Map();
  const results = [];
  const errors = [];
  while (pending.length > 0 || running.size > 0) {
    for (let index = 0; errors.length === 0 && index < pending.length;) {
      if (running.size >= options.workers) break;
      const task = pending[index];
      if (task.exclusive === true && running.size > 0) break;
      const groupCount = groupCounts.get(task.group) ?? 0;
      const groupLimit = options.groupWorkerLimits?.[task.group] ?? options.workers;
      if (groupCount >= groupLimit) {
        index += 1;
        continue;
      }
      pending.splice(index, 1);
      groupCounts.set(task.group, groupCount + 1);
      const completion = Promise.resolve().then(() => execute(task))
        .then(result => results.push(result))
        .catch(error => { errors.push(error); })
        .finally(() => {
          running.delete(task.id);
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
