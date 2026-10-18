import { readFileSync, writeFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { guardMeasurementSucceeded } from "./guard-cgroup.mjs";

export function readNodeTestResults(path, cwd, fallbackFile) {
  const events = readFileSync(path, "utf8").split("\n").filter(line => line !== "").map(line => JSON.parse(line));
  const summaries = events.filter(event => event.kind === "summary");
  if (summaries.length !== 1) throw new Error("Node results require one completed summary.");
  return { summary: summaries[0], tests: events.filter(event => event.kind === "test").map(event => ({
    ...event, file: event.file === null ? fallbackFile : normalizedPath(relative(cwd, event.file)),
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
      type: "test", status };
  });
  const counters = text.match(/<Counters\b([^>]*?)\/>/u);
  if (counters === null || results.length === 0) throw new Error(".NET results lack completed counters or named tests.");
  const counts = xmlAttributes(counters[1]);
  if (!/^\d+$/u.test(counts.total ?? "") || Number(counts.total) !== results.length) {
    throw new Error(".NET named results disagree with the complete test count.");
  }
  return { summary: { success: results.every(result => result.status === "passed") }, tests: results };
}

export function resultIdentity(test) {
  if (typeof test.scope !== "string" || typeof test.file !== "string" || !Array.isArray(test.path) ||
    test.path.length === 0 || test.path.some(name => typeof name !== "string")) {
    throw new Error("A result lacks its exact scope, file or test-name path.");
  }
  return JSON.stringify([test.scope, test.file, test.path]);
}

export function collectTestResults(reports) {
  const tests = [];
  const tasks = [];
  const inventories = [];
  for (const report of reports) {
    if (!Array.isArray(report.results) || !Array.isArray(report.inventory?.files)) {
      throw new Error("A parallel report lacks task results or its file inventory.");
    }
    inventories.push(...report.inventory.files.map(file => `${file.scope}:${file.path}`));
    for (const task of report.results) {
      tasks.push({ id: task.id, scope: task.scope, group: task.group, status: task.status,
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
  return { schemaVersion: 1, inventory: [...new Set(inventories)].sort(), tasks, tests, architecture };
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
    else if (test.status === "passed" && next.status !== "passed") regressions.push(next);
    else if (test.status !== "passed" && next.status === "passed") fixed.push(next);
  }
  for (const [identity, test] of current) if (!prior.has(identity)) added.push(test);
  const currentFiles = new Set(after.inventory);
  const missingFiles = before.inventory.filter(file => !currentFiles.has(file));
  const infrastructureFailures = after.tasks.filter(task => task.resultError !== null ||
    !after.tests.some(test => test.taskId === task.id && test.scope === task.scope));
  const unexplainedTaskFailures = after.tasks.filter(task => task.status !== 0 &&
    !after.tests.some(test => test.taskId === task.id && test.scope === task.scope && test.status === "failed"));
  const newFailures = added.filter(test => test.status !== "passed");
  return { pass: regressions.length === 0 && missing.length === 0 && missingFiles.length === 0 &&
      infrastructureFailures.length === 0 && unexplainedTaskFailures.length === 0 && newFailures.length === 0,
    regressions, missing, added, fixed, newFailures, missingFiles, infrastructureFailures, unexplainedTaskFailures,
    failures: after.tests.filter(test => test.status === "failed"),
    architectureFailures: after.architecture.filter(rule => rule.status !== "passed") };
}

export function validateTrainInputs(reports, guards) {
  if (reports.length !== 2 || guards.length !== 2 || reports[0]?.bank !== "host" || reports[1]?.bank !== "node" ||
    reports.some(report => report.selection?.complete !== true)) {
    throw new Error("A train requires both complete canonical runner inventories.");
  }
  for (const guard of guards) {
    if (![0, 1].includes(guard.exitCode) || guard.scopeDrained !== true || guard.swapMax !== 0 ||
      guard.calibration !== false || ![null, "success", "exit-code"].includes(guard.scopeResult) ||
      !guardMeasurementSucceeded(guard.measurement) || guard.oomBefore !== guard.measurement.oomBefore ||
      guard.oomAfter !== guard.measurement.oomAfter || guard.budget?.memoryMiB !== guard.memoryMiB ||
      guard.admission?.requestedMiB !== guard.memoryMiB || typeof guard.admission?.unit !== "string" ||
      !guard.measurement.controlGroup.endsWith(`/${guard.admission.unit}`)) {
      throw new Error("A train requires its complete, drained, own-cgroup resource receipts.");
    }
  }
  for (const report of reports) {
    const expected = new Set(report.inventory.files.flatMap(file => file.taskIds));
    const actual = new Set(report.results.map(task => task.id));
    if (expected.size !== report.inventory.taskCount || actual.size !== report.results.length ||
      actual.size !== expected.size || report.taskCounts.total !== actual.size ||
      [...expected].some(id => !actual.has(id))) {
      throw new Error("The train report omitted or duplicated a scheduled task.");
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
  } else if (command === "train" && paths.length === 2) {
    const [previous, directory] = paths;
    const read = name => JSON.parse(readFileSync(resolve(directory, name), "utf8"));
    const reports = [read("host.json"), read("rust.json")];
    validateTrainInputs(reports, [read("host.guard.json"), read("rust.guard.json")]);
    const current = collectTestResults(reports);
    writeFileSync(resolve(directory, "results.json"), `${JSON.stringify(current, null, 2)}\n`, { flag: "wx" });
    const compared = compareTestResults(JSON.parse(readFileSync(previous, "utf8")), current);
    writeFileSync(resolve(directory, "comparison.json"), `${JSON.stringify(compared, null, 2)}\n`, { flag: "wx" });
    process.stdout.write(`Train comparison: regressions=${compared.regressions.length} missing=${compared.missing.length} ` +
      `infrastructure=${compared.infrastructureFailures.length} failures=${compared.failures.length}\n`);
    process.exitCode = compared.pass ? 0 : 1;
  } else {
    throw new Error("Usage: test-results.mjs collect <output> <report>... | compare <before> <after> | train <previous> <directory>.");
  }
}
