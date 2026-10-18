import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import reportTestResults from "../../scripts/test-result-reporter.mjs";
import { collectTestResults, compareTestResults, readDotnetTestResults, readNodeTestResults, validateTrainInputs } from "../../scripts/test-results.mjs";
import { parallelReportCounts } from "../../../scripts/certification/counts.mjs";

mkdirSync(".temp/test-result-tests", { recursive: true });

test("the Node adapter retains exact nested names and only scalar failure evidence", async () => {
  async function* events() {
    yield { type: "test:start", data: { name: "parent", nesting: 0 } };
    yield { type: "test:start", data: { name: 'child $ "quoted"', nesting: 1 } };
    yield { type: "test:fail", data: { name: 'child $ "quoted"', nesting: 1, file: "/repo/test/file.mjs", line: 5,
      details: { type: "test", duration_ms: 1, error: { message: "precise refusal", actual: { circular: null } } } } };
    yield { type: "test:fail", data: { name: "parent", nesting: 0, file: "/repo/test/file.mjs",
      details: { type: "suite", duration_ms: 2, error: { message: "subtest failed" } } } };
    yield { type: "test:summary", data: { success: false, counts: { tests: 1, failed: 1 } } };
  }
  const records = [];
  for await (const line of reportTestResults(events())) records.push(JSON.parse(line));
  assert.deepEqual(records[0].path, ["parent", 'child $ "quoted"']);
  assert.equal(records[0].message, "precise refusal");
  assert.equal(Object.hasOwn(records[0], "actual"), false, "compiler objects never enter the identity report");
  assert.equal(records[1].type, "suite");
  assert.equal(records[2].kind, "summary");
  const root = mkdtempSync(resolve(".temp/test-result-tests/node-"));
  const path = resolve(root, "results.jsonl");
  writeFileSync(path, records.map(row => JSON.stringify(row)).join("\n") + "\n");
  assert.equal(readNodeTestResults(path, "/repo", "test/fallback.mjs").tests[0].file, "test/file.mjs");
  writeFileSync(path, JSON.stringify(records[0]) + "\n");
  assert.throws(() => readNodeTestResults(path, "/repo", "test/fallback.mjs"), /completed summary/u);
});

test("empty skip and todo reasons never become passing identities", async () => {
  async function* events() {
    yield { type: "test:pass", data: { name: "skip", nesting: 0, skip: "", details: { type: "test" } } };
    yield { type: "test:pass", data: { name: "todo", nesting: 0, todo: "", details: { type: "test" } } };
  }
  const records = [];
  for await (const line of reportTestResults(events())) records.push(JSON.parse(line));
  assert.deepEqual(records.map(row => row.status), ["skipped", "todo"]);
});

test("real Node cancellation is a distinct terminal identity and never an unchanged baseline failure", () => {
  const root = mkdtempSync(resolve(".temp/test-result-tests/cancelled-"));
  const file = resolve(root, "cancelled.test.mjs");
  const output = resolve(root, "results.jsonl");
  writeFileSync(file, "import test from 'node:test'; test('parent', context => { context.test('pending work', () => new Promise(() => {})); });\n");
  const environment = { ...process.env };
  delete environment.NODE_TEST_CONTEXT;
  const run = spawnSync(process.execPath, ["--test", "--test-concurrency=1",
    `--test-reporter=${resolve("test/scripts/test-result-reporter.mjs")}`, `--test-reporter-destination=${output}`, file],
  { env: environment, encoding: "utf8", timeout: 30_000, maxBuffer: 65_536 });
  assert.equal(run.error, undefined, "the explicit parent completion cancels its child without an outer timeout");
  assert.equal(run.status, 1, run.stderr);
  const named = readNodeTestResults(output, process.cwd(), file);
  const pending = named.tests.find(test => test.name === "pending work");
  assert.equal(pending?.status, "cancelled");
  assert.equal(pending?.failureType, "cancelledByParent");
  assert.equal(named.summary.counts.cancelled, 1);
});

test("TRX names preserve escaped arguments and all pass, failure and skipped outcomes", () => {
  const text = '<TestRun><Results><UnitTestResult testName="N.Type.value(a: &quot;&lt;x&gt;&amp;&quot;)" outcome="Passed" />' +
    '<UnitTestResult testName="N.Type.fail" outcome="Failed" />' +
    '<UnitTestResult testName="N.Type.skip" outcome="NotExecuted" /></Results>' +
    '<ResultSummary><Counters total="3" passed="1" failed="1" notExecuted="1" /></ResultSummary></TestRun>';
  const result = readDotnetTestResults(text, "dotnet:net");
  assert.equal(result.tests[0].name, 'N.Type.value(a: "<x>&")');
  assert.deepEqual(result.tests.map(row => row.status), ["passed", "failed", "skipped"]);
  assert.throws(() => readDotnetTestResults(text.replace('total="3"', 'total="4"'), "dotnet:net"), /disagree/u);
  assert.throws(() => readDotnetTestResults(text.replace('outcome="Passed"', 'outcome="InProgress"'), "dotnet:net"), /Unfinished/u);
});

function report(tests) {
  return { bank: "host", selection: { complete: true }, taskCounts: { total: 1 },
    inventory: { taskCount: 1, files: [{ scope: "tsonic", path: "test/architecture/rules.test.mjs", taskIds: ["architecture"] }] },
    results: [{ id: "architecture", group: "architecture", scope: "tsonic", status: tests.some(row => ["failed", "cancelled"].includes(row.status)) ? 1 : 0,
      resultError: null, tests, log: "logs/architecture.log" }] };
}

function result(name, status = "passed") {
  return { file: "test/architecture/rules.test.mjs", name, path: [name], status, nesting: 0, type: "test" };
}

test("comparisons distinguish baseline failures, lost passes, missing tests and architecture rule/file pairs", () => {
  const before = collectTestResults([report([result("stays"), result("already failed", "failed"), result("lost")])]);
  const same = collectTestResults([report([result("stays"), result("already failed", "failed"), result("lost")])]);
  assert.equal(compareTestResults(before, same).pass, true, "named pre-existing failures are not silently repaired or dropped");
  const after = collectTestResults([report([result("stays", "failed"), result("already failed"), result("added", "failed")])]);
  const compared = compareTestResults(before, after);
  assert.equal(compared.pass, false);
  assert.deepEqual(compared.regressions.map(row => row.name), ["stays"]);
  assert.deepEqual(compared.missing.map(row => row.name), ["lost"]);
  assert.deepEqual(compared.fixed.map(row => row.name), ["already failed"]);
  assert.deepEqual(compared.added.map(row => row.name), ["added"]);
  assert.deepEqual(compared.architectureFailures.map(row => [row.file, row.rule]), [
    ["test/architecture/rules.test.mjs", ["added"]], ["test/architecture/rules.test.mjs", ["stays"]],
  ]);
  assert.throws(() => collectTestResults([report([result("duplicate"), result("duplicate")])]), /Duplicate exact/u);
  assert.equal(compareTestResults(before, collectTestResults([report([
    result("stays"), result("already failed", "failed"), result("lost"), result("new broken test", "failed"),
  ])])).pass, false, "a newly added failure has no baseline waiver");
});

test("infrastructure failures, omitted files and unaccounted task exits cannot pass name comparison", () => {
  const before = collectTestResults([report([result("original")])]);
  const currentReport = report([result("original")]);
  currentReport.results[0].resultError = "missing measurement";
  assert.equal(compareTestResults(before, collectTestResults([currentReport])).pass, false);
  currentReport.results[0].resultError = null;
  currentReport.results[0].status = 137;
  assert.equal(compareTestResults(before, collectTestResults([currentReport])).pass, false);
  currentReport.results[0].status = 0;
  currentReport.inventory.files = [];
  assert.equal(compareTestResults(before, collectTestResults([currentReport])).pass, false);
});

test("every new failure and incomplete outcome blocks comparison without erasing known failures", () => {
  for (const status of ["passed", "skipped", "todo"]) {
    const before = collectTestResults([report([result("baseline failure", "failed"), result("changed", status)])]);
    const after = collectTestResults([report([result("baseline failure", "failed"), result("changed", "failed")])]);
    const compared = compareTestResults(before, after);
    assert.equal(compared.pass, false, `${status} becoming failed is a new failure`);
    assert.deepEqual(compared.regressions.map(test => test.name), ["changed"]);
  }
  const before = collectTestResults([report([result("changed", "failed")])]);
  for (const status of ["skipped", "todo", "cancelled"]) {
    const after = collectTestResults([report([result("changed", status)])]);
    assert.equal(compareTestResults(before, after).pass, false, `a known failure cannot disappear as ${status}`);
  }
  const cancelled = collectTestResults([report([result("unfinished", "cancelled")])]);
  assert.equal(compareTestResults(cancelled, cancelled).pass, false, "even an unchanged cancellation is not complete evidence");
  assert.throws(() => collectTestResults([report([result("unknown", "running")])]), /terminal outcome/u);
});

test("a train requires both complete banks and exact drained own-cgroup measurements", () => {
  const reports = [report([result("one")]), { ...report([result("two")]), bank: "node" }];
  const measurement = { controlGroup: "/user.slice/owned.scope", swapBytes: 0, oomBefore: 0, oomAfter: 0, exitCode: 0 };
  const guard = { exitCode: 0, scopeDrained: true, swapMax: 0, calibration: false, scopeResult: "success",
    oomScope: "owned-cgroup",
    oomBefore: 0, oomAfter: 0, measurement, memoryMiB: 4096, budget: { memoryMiB: 4096 },
    admission: { admitted: true, requestedMiB: 4096, unit: "owned.scope" } };
  assert.doesNotThrow(() => validateTrainInputs(reports, [guard, guard]));
  for (const changed of [{ scopeDrained: false }, { exitCode: 137 }, { swapMax: 1 }, { oomAfter: 1 },
    { measurement: { ...measurement, oomAfter: 1 } }, { measurement: null }]) {
    assert.throws(() => validateTrainInputs(reports, [guard, { ...guard, ...changed }]), /own-cgroup/u);
  }
  assert.throws(() => validateTrainInputs([{ ...reports[0], selection: { complete: false } }, reports[1]], [guard, guard]), /complete/u);
  assert.throws(() => validateTrainInputs([reports[0], reports[0]], [guard, guard]), /complete/u);
  assert.throws(() => validateTrainInputs([reports[0], { ...reports[1], results: [] }], [guard, guard]), /scheduled task/u);
  assert.throws(() => validateTrainInputs([reports[0], { ...report([result("unfinished", "cancelled")]), bank: "node" }],
    [guard, guard]), /cancelled/u);
  assert.doesNotThrow(() => validateTrainInputs(reports, [guard, { ...guard,
    userSliceOomDiagnostic: { before: 7, after: 8, authoritative: false } }]), "foreign OOM has no admission authority");
});

test("one parallel count contract covers Host and Rust without losing cancellation or todo", () => {
  const counts = { total: 2, passed: 2, failed: 0, skipped: 0, todo: 0, cancelled: 0 };
  const base = { selection: { complete: true }, taskCounts: { total: 1, passed: 1, failed: 0 },
    testCountReporting: { missing: 0, reported: 1 }, testCounts: counts };
  assert.equal(parallelReportCounts({ ...base, bank: "host", preRuns: [{ status: 0 }] })[0].total, 2);
  assert.equal(parallelReportCounts({ ...base, bank: "node", preRuns: [] })[0].total, 2);
  assert.throws(() => parallelReportCounts({ ...base, bank: "host", preRuns: [] }), /incomplete/u);
  assert.throws(() => parallelReportCounts({ ...base, bank: "node", selection: { complete: false }, preRuns: [] }), /incomplete/u);
  const actual = parallelReportCounts({ ...base, bank: "node", preRuns: [], testCounts: { ...counts, cancelled: 1, todo: 1 } });
  assert.equal(actual[0].cancelled, 1, "certification receives rather than erases a cancelled result");
  assert.equal(actual[0].todo, 1);
});
