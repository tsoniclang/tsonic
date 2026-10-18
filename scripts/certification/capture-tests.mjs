import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync } from "node:fs";
import { resolve } from "node:path";
import { writeImmutableJson } from "./records.mjs";
import { parseCargoBankCounts, nodeReportCounts } from "./counts.mjs";
import { readNodeTestResults, testTaskExecutionIssue } from "../../test/scripts/test-results.mjs";
import { memoryBoundNodeTestArguments } from "../../test/scripts/guard-command.mjs";
import { readTestResourceBudget } from "../../test/scripts/test-resource-budget.mjs";

const [kind, command, ...args] = process.argv.slice(2);
if (!["node", "cargo"].includes(kind) || command === undefined) throw new Error("Expected a test bank kind and command.");
const environment = { ...process.env };
delete environment.TSONIC_TEST_COUNT_DIRECTORY;
let arguments_ = args;
let resultPath;
if (kind === "node") {
  if (!/(?:^|\/)node(?:js)?$/u.test(command) || !args.includes("--test") ||
    args.some(argument => argument.startsWith("--test-reporter"))) {
    throw new Error("Node capture owns its event and display reporters; pass one Node --test command without reporter options.");
  }
  const temporaryRoot = process.env.TMPDIR ?? resolve(".temp");
  mkdirSync(temporaryRoot, { recursive: true });
  resultPath = resolve(mkdtempSync(resolve(temporaryRoot, "node-capture-")), "results.jsonl");
  const marker = args.indexOf("--test");
  arguments_ = memoryBoundNodeTestArguments(command, [
    ...args.slice(0, marker + 1), "--test-reporter=tap", "--test-reporter-destination=stdout",
    `--test-reporter=${resolve(import.meta.dirname, "../../test/scripts/test-result-reporter.mjs")}`,
    `--test-reporter-destination=${resultPath}`, ...args.slice(marker + 1),
  ], readTestResourceBudget().workers);
}
const child = spawn(command, arguments_, { stdio: ["ignore", "pipe", "pipe"], env: environment });
const lines = [];
let pending = "";
child.stdout.on("data", bytes => {
  process.stdout.write(bytes);
  pending += bytes.toString("utf8");
  const complete = pending.split("\n");
  pending = complete.pop();
  for (const line of complete) {
    if (kind === "cargo" && /^test result:/u.test(line)) lines.push(line);
  }
  if (pending.length > 1024 * 1024 || lines.length > 100_000) child.kill("SIGTERM");
});
child.stderr.pipe(process.stderr);
const outcome = await new Promise((resolveStatus, rejectStatus) => {
  child.once("error", rejectStatus);
  child.once("close", (code, signal) => resolveStatus({ code, signal }));
});
const named = kind === "node" ? readNodeTestResults(resultPath, process.cwd()) : undefined;
const counts = kind === "node" ? nodeReportCounts(named) : parseCargoBankCounts(lines.join("\n"));
if (counts.length === 0) throw new Error(`${kind} did not report complete test counts.`);
const resultError = kind === "node" ? testTaskExecutionIssue({ status: outcome.code, signal: outcome.signal,
  summary: named.summary, tests: named.tests }) : outcome.signal === null ? null : `Native test bank ended by signal ${outcome.signal}.`;
if (process.env.TSONIC_TEST_COUNT_DIRECTORY !== undefined) {
  mkdirSync(process.env.TSONIC_TEST_COUNT_DIRECTORY, { recursive: true });
  writeImmutableJson(resolve(process.env.TSONIC_TEST_COUNT_DIRECTORY, `${kind}-${randomUUID()}.json`), {
    kind, command: [command, ...arguments_], exitCode: outcome.code, signal: outcome.signal, resultError, counts,
    ...(named === undefined ? {} : { tests: named.tests, summary: named.summary }),
  });
}
if (resultError !== null) process.stderr.write(`Test execution error: ${resultError}\n`);
process.exitCode = outcome.code === 0 && resultError !== null ? 1 : outcome.code ?? 1;
