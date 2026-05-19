import os from "node:os";
import type { Result } from "../../types.js";

export type AsyncResultTask = () => Promise<Result<void, string>>;

export const resolveRestoreParallelism = (taskCount: number): number => {
  const configured = Number.parseInt(
    process.env.TSONIC_RESTORE_PARALLELISM ?? "",
    10
  );
  if (Number.isFinite(configured) && configured > 0) {
    return Math.min(configured, taskCount);
  }

  return Math.max(
    1,
    Math.min(os.availableParallelism?.() ?? os.cpus().length, taskCount)
  );
};

export const runResultTasks = async (
  tasks: readonly AsyncResultTask[]
): Promise<Result<void, string>> => {
  if (tasks.length === 0) return { ok: true, value: undefined };

  const queue = [...tasks];
  const failures: string[] = [];
  const parallelism = resolveRestoreParallelism(tasks.length);

  const workers = Array.from({ length: parallelism }, async () => {
    while (queue.length > 0) {
      const task = queue.shift();
      if (!task) return;

      const result = await task();
      if (!result.ok) failures.push(result.error);
    }
  });

  await Promise.all(workers);
  if (failures.length > 0) {
    return { ok: false, error: failures.join("\n\n") };
  }

  return { ok: true, value: undefined };
};
