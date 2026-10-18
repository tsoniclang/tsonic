import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function createGuardReport(input) {
  const measurement = input.measurement;
  const memoryMiB = Number(input.memory);
  if (!["explicit", "formula"].includes(input.memorySource) || !Number.isSafeInteger(memoryMiB) || memoryMiB <= 0) {
    throw new Error("A guard report requires its actual outer memory request source and value.");
  }
  return {
    log: input.log, exitCode: Number(input.status), memoryMiB, tasksMax: Number(input.tasks),
    memoryRequest: { source: input.memorySource, valueMiB: memoryMiB },
    timeoutSeconds: Number(input.timeout), logMaxBytes: Number(input.logMax), swapMax: 0,
    oomScope: "owned-cgroup",
    oomBefore: measurement?.oomBefore ?? null,
    oomAfter: measurement?.oomAfter ?? null,
    userSliceOomDiagnostic: {
      before: input.before === "unavailable" ? null : Number(input.before),
      after: input.after === "unavailable" ? null : Number(input.after),
      authoritative: false,
    },
    scopeResult: input.scope || null, calibration: input.calibration !== "",
    scopeDrained: input.drained === "true",
    guardSnapshot: input.guardSnapshot,
    measurement,
    averageCores: measurement === null || !(measurement.durationSeconds > 0) ? null
      : measurement.cpuUsageMicroseconds / 1_000_000 / measurement.durationSeconds,
    admission: input.admission,
    budget: input.budget,
    temporaryDirectory: input.temporaryDirectory,
    temporaryDirectoryRemoved: input.temporaryDirectoryRemoved === "true",
  };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [path, log, status, memory, tasks, timeout, logMax, before, after, scope, calibration, measurementPath, drained] = process.argv.slice(2);
  const measurement = existsSync(measurementPath) ? JSON.parse(readFileSync(measurementPath, "utf8")) : null;
  const budget = JSON.parse(process.env.TSONIC_TEST_RESOURCE_BUDGET);
  const report = createGuardReport({ log, status, memory, tasks, timeout, logMax, before, after, scope, calibration,
    measurement, drained, guardSnapshot: process.env.TSONIC_TEST_GUARD_SNAPSHOT,
    admission: JSON.parse(process.env.TSONIC_TEST_ADMISSION),
    budget, memorySource: budget.memoryRequestSource,
    temporaryDirectory: process.env.TSONIC_TEST_TEMP_DIRECTORY,
    temporaryDirectoryRemoved: process.env.TSONIC_TEST_TEMP_DIRECTORY_REMOVED });
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
}
