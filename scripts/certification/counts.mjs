import { parseTestCounts } from "../../test/scripts/parallel-test-counts.mjs";

export function parseBankCounts(kind, output) {
  if (kind === "cargo") {
    return [...output.matchAll(/^test result: (?:ok|FAILED)\. (\d+) passed; (\d+) failed; (\d+) ignored; (\d+) measured; (\d+) filtered out;(?: finished in .+)?\s*$/gmu)]
      .map(match => ({
        total: Number(match[1]) + Number(match[2]) + Number(match[3]),
        passed: Number(match[1]), failed: Number(match[2]), skipped: Number(match[3]),
        todo: 0, cancelled: 0, filtered: Number(match[4]) + Number(match[5]),
      }));
  }
  if (kind !== "node") throw new Error(`Unknown test bank '${kind}'.`);
  const counts = parseTestCounts(output);
  if (counts === undefined) return [];
  for (const field of ["tests", "pass", "fail", "skipped", "todo", "cancelled"]) {
    if ([...output.matchAll(new RegExp(`^# ${field} (\\d+)\\s*$`, "gmu"))].length !== 1) {
      throw new Error(`Node bank requires one complete '${field}' count.`);
    }
  }
  return [{
    total: counts.total, passed: counts.passed, failed: counts.failed, skipped: counts.skipped,
    todo: Number(output.match(/^# todo (\d+)\s*$/mu)[1]),
    cancelled: Number(output.match(/^# cancelled (\d+)\s*$/mu)[1]), filtered: 0,
  }];
}

export function hostReportCounts(report) {
  if (report.selection?.complete !== true || report.taskCounts?.failed !== 0 ||
      report.taskCounts?.total !== report.taskCounts?.passed || report.taskCounts.total < 1 ||
      report.testCountReporting?.missing !== 0 ||
      report.testCountReporting?.reported !== report.taskCounts.total ||
      !Array.isArray(report.preRuns) || report.preRuns.length === 0 || report.preRuns.some(run => run.status !== 0)) {
    throw new Error("Host report is failed, incomplete or missing test counts.");
  }
  const counts = report.testCounts;
  return [{ total: counts.total, passed: counts.passed, failed: counts.failed, skipped: counts.skipped,
    todo: 0, cancelled: 0, filtered: 0 }];
}
