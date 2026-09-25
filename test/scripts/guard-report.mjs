import { writeFileSync } from "node:fs";

const [path, log, status, memory, tasks, timeout, logMax, before, after, scope, calibration] = process.argv.slice(2);
writeFileSync(path, `${JSON.stringify({
  log, exitCode: Number(status), memoryMiB: Number(memory), tasksMax: Number(tasks),
  timeoutSeconds: Number(timeout), logMaxBytes: Number(logMax), swapMax: 0,
  oomBefore: before === "unavailable" ? null : Number(before),
  oomAfter: after === "unavailable" ? null : Number(after),
  scopeResult: scope || null, calibration: calibration !== "",
  budget: JSON.parse(process.env.TSONIC_TEST_RESOURCE_BUDGET),
}, null, 2)}\n`, { flag: "wx" });
