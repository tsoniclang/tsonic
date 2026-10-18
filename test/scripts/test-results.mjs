import { readFileSync, writeFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { guardReceiptHasOwnedMeasurements, guardScopeResultAccepted } from "./guard-cgroup.mjs";
import { fullTestTrainBanks } from "./suite-definition.mjs";
import { testScopeRepositoryKeys } from "./workspace-layout.mjs";

export function readNodeTestResults(path, cwd, shardFile) {
  const events = readFileSync(path, "utf8").split("\n").filter(line => line !== "").map(line => JSON.parse(line));
  const summaries = events.filter(event => event.kind === "summary");
  if (summaries.length !== 1) throw new Error("Node results require one completed summary.");
  if (events.some(event => event.kind === "test" && event.file === null && shardFile === undefined)) {
    throw new Error("A Node test lacks its source file and has no owning shard file.");
  }
  return { summary: { ...summaries[0], completed: true }, tests: events.filter(event => event.kind === "test").map(event => ({
    ...event, file: event.file === null ? shardFile : normalizedPath(relative(cwd, event.file)),
  })) };
}

export function readDotnetTestResults(text, file) {
  const results = [...text.matchAll(/<UnitTestResult\b([^>]*?)(?:\/>|>)/gu)].map(match => {
    const attributes = xmlAttributes(match[1]);
    if (typeof attributes.testName !== "string" || typeof attributes.outcome !== "string") {
      throw new Error("A .NET result lacks its exact test name or outcome.");
    }
    const status = { Passed: "passed", Failed: "failed", NotExecuted: "skipped" }[attributes.outcome];
    if (status === undefined) throw new Error(`Unfinished .NET outcome: ${attributes.outcome}.`);
    return { kind: "test", file, name: attributes.testName, path: [attributes.testName], nesting: 0,
      type: "test", status, exitCode: null, signal: null };
  });
  const summaries = [...text.matchAll(/<ResultSummary\b([^>]*?)>([\s\S]*?)<\/ResultSummary>/gu)];
  if (summaries.length !== 1 || results.length === 0) throw new Error(".NET results lack one run summary or named tests.");
  const outcome = xmlAttributes(summaries[0][1]).outcome;
  const counters = summaries[0][2].match(/<Counters\b([^>]*?)\/>/u);
  if (counters === null) throw new Error(".NET results lack completed counters.");
  const counts = xmlAttributes(counters[1]);
  if (!/^\d+$/u.test(counts.total ?? "") || Number(counts.total) !== results.length) {
    throw new Error(".NET named results disagree with the complete test count.");
  }
  const runInfos = [...summaries[0][2].matchAll(/<RunInfo\b([^>]*?)>([\s\S]*?)<\/RunInfo>/gu)].map(match => ({
    outcome: xmlAttributes(match[1]).outcome,
    text: match[2].replace(/<[^>]*>/gu, "").slice(0, 65_536),
  }));
  const counterNames = ["total", "executed", "passed", "failed", "error", "timeout", "aborted", "notExecuted", "inProgress"];
  const errors = [];
  const validCounters = counterNames.every(name => /^\d+$/u.test(counts[name] ?? "") && Number.isSafeInteger(Number(counts[name])));
  if (!validCounters) errors.push({ outcome: "Error", text: "The native run lacks valid execution counters." });
  if (validCounters && (Number(counts.total) !== Number(counts.executed) ||
    Number(counts.passed) + Number(counts.failed) !== Number(counts.executed) ||
    Number(counts.passed) !== results.filter(result => result.status === "passed").length ||
    Number(counts.failed) !== results.filter(result => result.status === "failed").length)) {
    errors.push({ outcome: "Error", text: "The native execution counters disagree with the named results." });
  }
  const incompleteCounters = ["error", "timeout", "aborted", "notExecuted", "inProgress",
    "inconclusive", "passedButRunAborted", "notRunnable", "disconnected", "pending"];
  if (incompleteCounters.some(name => counts[name] !== undefined && (!/^\d+$/u.test(counts[name]) || Number(counts[name]) !== 0))) {
    errors.push({ outcome: "Error", text: "The native run contains errors or unfinished execution." });
  }
  if (/<ErrorInfo\b/u.test(summaries[0][2])) errors.push({ outcome: "Error", text: "The native run summary contains error information." });
  const completed = ["Completed", "Passed", "Failed"].includes(outcome) && errors.length === 0;
  return { summary: { completed, outcome, errors, runInfos, success: completed && results.every(result => result.status !== "failed") }, tests: results };
}

export function testResultExecutionIssue(tests) {
  if (!Array.isArray(tests)) return "Test execution lacks its named results.";
  for (const test of tests) {
    if (test.exitCode !== null && (!Number.isSafeInteger(test.exitCode) || test.exitCode < 0) ||
      test.signal !== null && (typeof test.signal !== "string" || test.signal.length === 0 || test.signal.length > 64)) {
      return "A test result has missing or invalid process termination evidence.";
    }
    if (test.signal !== null) return `Inner test process ended by signal ${test.signal}.`;
    if (test.exitCode !== null && ![0, 1].includes(test.exitCode)) return `Abnormal inner test process exit: ${test.exitCode}.`;
    if (test.exitCode === 1 && test.status === "passed") return "A passing test cannot carry a failed inner process exit.";
  }
  return null;
}

export function testTaskExecutionIssue(task) {
  if (task.signal !== null) return `Test task has a signal or unrecorded signal state: ${String(task.signal)}.`;
  if (![0, 1].includes(task.status)) return `Abnormal test task exit: ${String(task.status)}.`;
  if (task.summary?.completed !== true) return "Test task lacks a completed native or Node run summary.";
  const resultIssue = testResultExecutionIssue(task.tests);
  if (resultIssue !== null) return resultIssue;
  const failed = task.tests?.some(test => test.status === "failed");
  if (task.status === 1 && !failed) return "A test task exited 1 without a named assertion failure.";
  if (task.status === 0 && failed || task.summary.success !== (task.status === 0)) {
    return "Test task exit and completed assertion results disagree.";
  }
  return null;
}

export function resultIdentity(test) {
  if (typeof test.scope !== "string" || typeof test.file !== "string" || !Array.isArray(test.path) ||
    test.path.length === 0 || test.path.some(name => typeof name !== "string") ||
    !["passed", "failed", "cancelled", "skipped", "todo"].includes(test.status)) {
    throw new Error("A result lacks its exact scope, file, test-name path or terminal outcome.");
  }
  return JSON.stringify([test.scope, test.file, test.path]);
}

export function collectTestResults(reports) {
  const tests = [];
  const tasks = [];
  const inventories = [];
  const banks = [];
  for (const report of reports) {
    if (!Array.isArray(report.results) || !Array.isArray(report.inventory?.files)) {
      throw new Error("A parallel report lacks task results or its file inventory.");
    }
    inventories.push(...report.inventory.files.map(file => `${file.scope}:${file.path}`));
    banks.push({ bank: report.bank, selection: report.selection, runId: report.runId, createdAt: report.createdAt,
      repos: report.repos, inventory: report.inventory, taskCounts: report.taskCounts, preRuns: report.preRuns });
    for (const task of report.results) {
      tasks.push({ bank: report.bank, id: task.id, scope: task.scope, group: task.group, status: task.status,
        signal: task.signal, summary: task.summary,
        resultError: task.resultError ?? null, log: task.log, resources: task.resources });
      for (const test of task.tests ?? []) tests.push({ ...test, scope: task.scope, taskId: task.id });
    }
  }
  const seen = new Set();
  for (const test of tests) {
    const identity = resultIdentity(test);
    if (seen.has(identity)) throw new Error(`Duplicate exact test identity: ${identity}.`);
    seen.add(identity);
  }
  tests.sort((left, right) => resultIdentity(left).localeCompare(resultIdentity(right)));
  const architecture = tests.filter(test => /(?:^|\/)test\/architecture\//u.test(test.file)).map(test => ({
    scope: test.scope, file: test.file, rule: test.path, status: test.status,
  }));
  return { schemaVersion: 1, banks, inventory: [...new Set(inventories)].sort(), tasks, tests, architecture };
}

export function compareTestResults(before, after) {
  const prior = resultIndex(before.tests);
  const current = resultIndex(after.tests);
  const regressions = [];
  const missing = [];
  const added = [];
  const fixed = [];
  for (const [identity, test] of prior) {
    const next = current.get(identity);
    if (next === undefined) missing.push(test);
    else if (next.status !== "passed" && next.status !== test.status) regressions.push(next);
    else if (test.status !== "passed" && next.status === "passed") fixed.push(next);
  }
  for (const [identity, test] of current) if (!prior.has(identity)) added.push(test);
  const currentFiles = new Set(after.inventory);
  const missingFiles = before.inventory.filter(file => !currentFiles.has(file));
  const infrastructureFailures = after.tasks.filter(task => task.resultError !== null || testTaskExecutionIssue({
    ...task, tests: after.tests.filter(test => test.taskId === task.id && test.scope === task.scope),
  }) !== null ||
    !after.tests.some(test => test.taskId === task.id && test.scope === task.scope));
  const unexplainedTaskFailures = after.tasks.filter(task => task.status !== 0 &&
    !after.tests.some(test => test.taskId === task.id && test.scope === task.scope && test.status === "failed"));
  const newFailures = added.filter(test => test.status !== "passed");
  const cancelled = after.tests.filter(test => test.status === "cancelled");
  return { pass: regressions.length === 0 && missing.length === 0 && missingFiles.length === 0 &&
      infrastructureFailures.length === 0 && unexplainedTaskFailures.length === 0 && newFailures.length === 0 &&
      cancelled.length === 0,
    regressions, missing, added, fixed, newFailures, missingFiles, infrastructureFailures, unexplainedTaskFailures,
    cancelled,
    failures: after.tests.filter(test => test.status === "failed"),
    architectureFailures: after.architecture.filter(rule => rule.status !== "passed") };
}

export function validateTrainInputs(reports, guards) {
  validateCompleteTrainReports(reports);
  if (!Array.isArray(guards) || guards.length !== fullTestTrainBanks.length) throw new Error("A train requires both resource receipts.");
  for (const guard of guards) {
    if (![0, 1].includes(guard.exitCode) || guard.swapMax !== 0 || guard.calibration !== false ||
      !guardScopeResultAccepted(guard) ||
      !guardReceiptHasOwnedMeasurements(guard)) {
      throw new Error("A train requires its complete, drained, own-cgroup resource receipts.");
    }
  }
}

export function validateTrainResults(result) {
  if (result.schemaVersion !== 1 || !Array.isArray(result.banks) || !Array.isArray(result.tasks) ||
    !Array.isArray(result.tests) || !Array.isArray(result.inventory) || !Array.isArray(result.architecture)) {
    throw new Error("A train requires a complete collected result with per-bank provenance.");
  }
  const testsByTask = new Map();
  for (const test of result.tests) {
    const key = JSON.stringify([test.scope, test.taskId]);
    const tests = testsByTask.get(key) ?? [];
    tests.push(test);
    testsByTask.set(key, tests);
  }
  const reports = result.banks.map(bank => ({ ...bank, results: result.tasks.filter(task => task.bank === bank.bank)
    .map(task => ({ ...task, tests: testsByTask.get(JSON.stringify([task.scope, task.id])) ?? [] })) }));
  validateCompleteTrainReports(reports);
  const files = reports.flatMap(report => report.inventory.files.map(file => `${file.scope}:${file.path}`)).sort();
  const inventory = [...result.inventory].sort();
  if (files.length !== inventory.length || files.some((file, index) => file !== inventory[index]) ||
    reports.reduce((total, report) => total + report.results.length, 0) !== result.tasks.length ||
    reports.reduce((total, report) => total + report.results.reduce((count, task) => count + task.tests.length, 0), 0) !== result.tests.length ||
    !compareTestResults(result, result).pass) {
    throw new Error("A train projection has incomplete file, task, test or execution evidence.");
  }
}

function validateCompleteTrainReports(reports) {
  if (!Array.isArray(reports) || reports.length !== fullTestTrainBanks.length) {
    throw new Error("A train requires both complete canonical runner inventories.");
  }
  for (const [index, report] of reports.entries()) {
    const expectedBank = fullTestTrainBanks[index];
    if (report?.bank !== expectedBank.bank || report.selection?.complete !== true ||
      !Array.isArray(report.results) || !Array.isArray(report.inventory?.files) || report.inventory.files.length === 0 ||
      report.inventory.fileCount !== report.inventory.files.length || typeof report.runId !== "string" || report.runId.length === 0 ||
      !Number.isFinite(Date.parse(report.createdAt))) {
      throw new Error("A train requires complete canonical banks, inventories and run provenance.");
    }
    const scopes = new Set(report.inventory.files.map(file => file.scope));
    if (scopes.size !== expectedBank.scopes.length || expectedBank.scopes.some(scope => !scopes.has(scope))) {
      throw new Error("A complete bank must cover every declared native and source scope.");
    }
    for (const scope of ["tsonic", ...expectedBank.scopes]) {
      const repository = report.repos?.[testScopeRepositoryKeys[scope]];
      if (repository?.dirty !== false || typeof repository.path !== "string" || !repository.path.startsWith("/") ||
        !/^[a-f0-9]{40}$/u.test(repository.head ?? "")) {
        throw new Error("A complete bank requires exact clean source repository provenance.");
      }
    }
    const files = new Set(report.inventory.files.map(file => `${file.scope}:${file.path}`));
    const expected = new Set(report.inventory.files.flatMap(file => file.taskIds));
    const actual = new Set(report.results.map(task => task.id));
    if (files.size !== report.inventory.files.length || expected.size !== report.inventory.taskCount ||
      actual.size !== report.results.length || actual.size !== expected.size || report.taskCounts?.total !== actual.size ||
      [...expected].some(id => !actual.has(id)) || report.results.some(task => !scopes.has(task.scope) ||
        !report.inventory.files.some(file => file.scope === task.scope && file.taskIds.includes(task.id)))) {
      throw new Error("The train report omitted or duplicated a scheduled task or file.");
    }
    const preRuns = new Map(report.preRuns?.map(run => [run.id, run]));
    if (preRuns.size === 0 || preRuns.size !== report.preRuns.length || [...preRuns.values()].some(run => run.status !== 0) ||
      report.inventory.files.some(file => !Array.isArray(file.preRunIds) || file.preRunIds.length === 0 ||
        file.preRunIds.some(id => !preRuns.has(id)))) {
      throw new Error("A complete bank requires every declared build prerequisite.");
    }
    for (const task of report.results) {
      if (!Array.isArray(task.tests) || task.tests.length === 0 || task.tests.some(test => test.status === "cancelled")) {
        throw new Error("A train cannot admit cancelled or unfinished test results.");
      }
      if (task.resultError !== null || testTaskExecutionIssue(task) !== null) {
        throw new Error("A complete bank contains abnormal or incomplete execution evidence.");
      }
    }
  }
}

function resultIndex(tests) {
  const index = new Map();
  for (const test of tests) {
    const identity = resultIdentity(test);
    if (index.has(identity)) throw new Error(`Duplicate exact test identity: ${identity}.`);
    index.set(identity, test);
  }
  return index;
}

function xmlAttributes(text) {
  return Object.fromEntries([...text.matchAll(/([A-Za-z_:][A-Za-z0-9_:.-]*)="([^"]*)"/gu)].map(match => [
    match[1], match[2].replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[\da-fA-F]+);/gu, entity => {
      if (entity.startsWith("&#x")) return String.fromCodePoint(Number.parseInt(entity.slice(3, -1), 16));
      if (entity.startsWith("&#")) return String.fromCodePoint(Number(entity.slice(2, -1)));
      return { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" }[entity];
    }),
  ]));
}

function normalizedPath(path) {
  return path.split(sep).join("/");
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, ...paths] = process.argv.slice(2);
  if (command === "collect" && paths.length >= 2) {
    const [output, ...inputs] = paths;
    const result = collectTestResults(inputs.map(path => JSON.parse(readFileSync(path, "utf8"))));
    writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, { flag: "wx" });
  } else if (command === "compare" && paths.length === 2) {
    const result = compareTestResults(...paths.map(path => JSON.parse(readFileSync(path, "utf8"))));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.pass ? 0 : 1;
  } else if (command === "validate-train" && paths.length === 1) {
    validateTrainResults(JSON.parse(readFileSync(paths[0], "utf8")));
  } else if (command === "train" && paths.length === 2) {
    const [previous, directory] = paths;
    const before = JSON.parse(readFileSync(previous, "utf8"));
    validateTrainResults(before);
    const read = name => JSON.parse(readFileSync(resolve(directory, name), "utf8"));
    const reports = [read("host.json"), read("rust.json")];
    validateTrainInputs(reports, [read("host.guard.json"), read("rust.guard.json")]);
    const current = collectTestResults(reports);
    validateTrainResults(current);
    writeFileSync(resolve(directory, "results.json"), `${JSON.stringify(current, null, 2)}\n`, { flag: "wx" });
    const compared = compareTestResults(before, current);
    writeFileSync(resolve(directory, "comparison.json"), `${JSON.stringify(compared, null, 2)}\n`, { flag: "wx" });
    process.stdout.write(`Train comparison: regressions=${compared.regressions.length} missing=${compared.missing.length} ` +
      `infrastructure=${compared.infrastructureFailures.length} newNonPasses=${compared.newFailures.length} ` +
      `cancelled=${compared.cancelled.length} failures=${compared.failures.length}\n`);
    process.exitCode = compared.pass ? 0 : 1;
  } else {
    throw new Error("Usage: test-results.mjs collect <output> <report>... | compare <before> <after> | validate-train <results> | train <previous> <directory>.");
  }
}
