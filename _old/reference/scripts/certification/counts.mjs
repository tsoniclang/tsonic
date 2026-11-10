import { aggregateTestCounts, testResultCounts } from "../../test/scripts/parallel-test-counts.mjs";
import { testTaskExecutionIssue } from "../../test/scripts/test-results.mjs";

export function parseCargoBankCounts(output) {
  return [...output.matchAll(/^test result: (?:ok|FAILED)\. (\d+) passed; (\d+) failed; (\d+) ignored; (\d+) measured; (\d+) filtered out;(?: finished in .+)?\s*$/gmu)]
    .map(match => ({
      total: Number(match[1]) + Number(match[2]) + Number(match[3]),
      passed: Number(match[1]), failed: Number(match[2]), skipped: Number(match[3]),
      todo: 0, cancelled: 0, filtered: Number(match[4]) + Number(match[5]),
    }));
}

export function nodeReportCounts(named) {
  if (named.summary?.completed !== true) throw new Error("Node counts require one complete event summary.");
  return [{ ...testResultCounts(named.tests), filtered: 0 }];
}

export function capturedBankCounts(bank) {
  if (!["node", "cargo"].includes(bank.kind) || bank.exitCode !== 0 || bank.signal !== null ||
    bank.resultError !== null || !Array.isArray(bank.counts) || bank.counts.length === 0) {
    throw new Error("Captured test bank has failed or incomplete execution evidence.");
  }
  if (bank.kind === "node") {
    const issue = testTaskExecutionIssue({ status: bank.exitCode, signal: bank.signal,
      summary: bank.summary, tests: bank.tests });
    if (issue !== null) throw new Error(`Captured Node test bank has abnormal execution evidence: ${issue}`);
    if (JSON.stringify(nodeReportCounts(bank)) !== JSON.stringify(bank.counts)) {
      throw new Error("Captured Node counts disagree with its complete per-test results.");
    }
  }
  return bank.counts;
}

export function parallelReportCounts(report) {
  if (!["host", "node"].includes(report.bank) || report.selection?.complete !== true || report.taskCounts?.failed !== 0 ||
      report.taskCounts?.total !== report.taskCounts?.passed || report.taskCounts.total < 1 ||
      report.testCountReporting?.missing !== 0 ||
      report.testCountReporting?.reported !== report.taskCounts.total ||
      !Array.isArray(report.results) || report.results.length !== report.taskCounts.total ||
      report.results.some(task => task.resultError !== null || testTaskExecutionIssue(task) !== null) ||
      !Array.isArray(report.preRuns) || report.bank === "host" && report.preRuns.length === 0 ||
      report.preRuns.some(run => run.status !== 0)) {
    throw new Error("Parallel report is failed, incomplete or missing test counts.");
  }
  const counts = aggregateTestCounts(report.results);
  if (counts.reportedShards !== report.taskCounts.total || ["total", "passed", "failed", "skipped", "todo", "cancelled"]
    .some(field => report.testCounts?.[field] !== counts[field])) {
    throw new Error("Parallel counts must equal the complete per-test results.");
  }
  return [{ total: counts.total, passed: counts.passed, failed: counts.failed, skipped: counts.skipped,
    todo: counts.todo, cancelled: counts.cancelled, filtered: 0 }];
}
