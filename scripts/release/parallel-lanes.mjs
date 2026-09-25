import { spawn } from "node:child_process";
import { createWriteStream, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readTestResourceBudget } from "../../test/scripts/test-resource-budget.mjs";
import { runBoundedTestQueue } from "../../test/scripts/parallel-scheduler.mjs";

export function releaseLaneBudget(budget, count) {
  if (!Number.isSafeInteger(count) || count < 1) throw new Error("Release lanes require a positive count.");
  const workers = Math.min(count, budget.workers ?? count, budget.cpuBudget, Math.floor(budget.memoryMiB / 4096));
  if (workers < 1) throw new Error("Release acceptance requires at least 4096 MiB per native lane.");
  return {
    workers, memoryMiB: budget.memoryMiB,
    workerMemoryMiB: Math.floor(budget.memoryMiB / workers),
    childJobs: Math.floor(budget.cpuBudget / workers),
  };
}

export async function runReleaseLanes(lanes, root, execute = runLane, budget = readTestResourceBudget()) {
  const selected = releaseLaneBudget(budget, lanes.length);
  process.stdout.write(`Release acceptance: ${selected.workers} independent lanes, ${selected.childJobs} native jobs per lane, ${selected.workerMemoryMiB} MiB per lane.\n`);
  await runBoundedTestQueue(lanes, selected, lane => execute(lane, {
    root,
    environment: {
      ...process.env,
      CARGO_BUILD_JOBS: String(selected.childJobs),
      RUST_TEST_THREADS: String(selected.childJobs),
      DOTNET_PROCESSOR_COUNT: String(selected.childJobs),
      NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --max-old-space-size=${Math.min(4096, Math.floor(selected.workerMemoryMiB * 0.75))}`.trim(),
    },
  }));
}

function runLane(lane, { root, environment }) {
  const path = resolve(root, `${lane.id}.log`);
  const output = createWriteStream(path, { flags: "wx" });
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(lane.command, lane.args, { cwd: lane.cwd, env: environment, stdio: ["ignore", "pipe", "pipe"] });
    let bytes = 0;
    let failure;
    const write = chunk => {
      bytes += chunk.length;
      if (bytes > 64 * 1024 * 1024) {
        failure = new Error(`Release lane '${lane.id}' exceeded its log ceiling.`);
        child.kill("SIGTERM");
        return;
      }
      output.write(chunk);
    };
    child.stdout.on("data", write);
    child.stderr.on("data", write);
    child.once("error", error => { failure = error; });
    child.once("close", status => output.end(() => {
      process.stdout.write(`Release lane ${lane.id}: ${status === 0 && failure === undefined ? "passed" : "failed"}; ${path}\n`);
      if (status !== 0 || failure !== undefined) {
        const excerpt = readFileSync(path).subarray(-16_384).toString("utf8");
        rejectRun(new Error(`Release lane '${lane.id}' failed (${String(status)}). ${failure?.message ?? ""}\n${excerpt}`));
      } else resolveRun({ id: lane.id, status });
    }));
  });
}
