import { existsSync, readFileSync, writeFileSync } from "node:fs";

const [path, log, status, memory, tasks, timeout, logMax, before, after, scope, calibration, measurementPath, drained] = process.argv.slice(2);
const measurement = existsSync(measurementPath) ? JSON.parse(readFileSync(measurementPath, "utf8")) : null;
writeFileSync(path, `${JSON.stringify({
  log, exitCode: Number(status), memoryMiB: Number(memory), tasksMax: Number(tasks),
  timeoutSeconds: Number(timeout), logMaxBytes: Number(logMax), swapMax: 0,
  oomBefore: before === "unavailable" ? null : Number(before),
  oomAfter: after === "unavailable" ? null : Number(after),
  scopeResult: scope || null, calibration: calibration !== "",
  scopeDrained: drained === "true",
  guardSnapshot: process.env.TSONIC_TEST_GUARD_SNAPSHOT,
  measurement,
  admission: JSON.parse(process.env.TSONIC_TEST_ADMISSION),
  budget: JSON.parse(process.env.TSONIC_TEST_RESOURCE_BUDGET),
}, null, 2)}\n`, { flag: "wx" });
