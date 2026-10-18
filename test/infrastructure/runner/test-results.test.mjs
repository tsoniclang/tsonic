import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import reportTestResults from "../../scripts/test-result-reporter.mjs";
import { collectTestResults, compareTestResults, readDotnetTestResults, readNodeTestResults, testResultExecutionIssue,
  testTaskExecutionIssue, validateTrainInputs, validateTrainResults } from "../../scripts/test-results.mjs";
import { capturedBankCounts, parallelReportCounts } from "../../../scripts/certification/counts.mjs";
import { fullTestTrainBanks } from "../../scripts/suite-definition.mjs";
import { testScopeRepositoryKeys } from "../../scripts/workspace-layout.mjs";
import { aggregateTestCounts, testResultCounts } from "../../scripts/parallel-test-counts.mjs";

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
  assert.equal(records[0].exitCode, null, "an ordinary exception supplies no inner process exit");
  assert.equal(records[0].signal, null, "an ordinary exception supplies no inner process signal");
  assert.equal(Object.hasOwn(records[0], "actual"), false, "compiler objects never enter the identity report");
  assert.equal(records[1].type, "suite");
  assert.equal(records[2].kind, "summary");
  const root = mkdtempSync(resolve(".temp/test-result-tests/node-"));
  const path = resolve(root, "results.jsonl");
  writeFileSync(path, records.map(row => JSON.stringify(row)).join("\n") + "\n");
  assert.equal(readNodeTestResults(path, "/repo", "test/shard.mjs").tests[0].file, "test/file.mjs");
  writeFileSync(path, JSON.stringify(records[0]) + "\n");
  assert.throws(() => readNodeTestResults(path, "/repo", "test/shard.mjs"), /completed summary/u);
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
  writeFileSync(file, "import test from 'node:test'; test('parent', context => { context.test('pending work', () => new Promise(() => {})); throw Error('parent stops'); });\n");
  const environment = { ...process.env };
  delete environment.NODE_TEST_CONTEXT;
  const run = spawnSync(process.execPath, ["--test", "--test-concurrency=1",
    `--test-reporter=${resolve("test/scripts/test-result-reporter.mjs")}`, `--test-reporter-destination=${output}`, file],
  { env: environment, encoding: "utf8", timeout: 30_000, maxBuffer: 65_536 });
  assert.equal(run.error === undefined, true, "the explicit parent failure cancels its child without an outer timeout");
  assert.equal(run.status, 1, run.stderr);
  const named = readNodeTestResults(output, process.cwd(), file);
  const pending = named.tests.find(test => test.name === "pending work");
  assert.equal(pending?.status, "cancelled");
  assert.equal(pending?.failureType, "cancelledByParent");
  assert.equal(named.summary.counts.cancelled, 1);
});

test("all native cancellation reasons remain cancelled instead of ordinary baseline failures", async () => {
  async function* events() {
    for (const failureType of ["cancelledByParent", "testAborted", "testTimeoutFailure", "testCodeFailure"]) {
      yield { type: "test:fail", data: { name: failureType, nesting: 0, details: { type: "test", error: { failureType } } } };
    }
  }
  const records = [];
  for await (const line of reportTestResults(events())) records.push(JSON.parse(line));
  assert.deepEqual(records.map(record => record.status), ["cancelled", "cancelled", "cancelled", "failed"]);
});

test("TRX names preserve escaped arguments and all pass, failure and skipped outcomes", () => {
  const text = '<TestRun><Results><UnitTestResult testName="N.Type.value(a: &quot;&lt;x&gt;&amp;&quot;)" outcome="Passed" />' +
    '<UnitTestResult testName="N.Type.fail" outcome="Failed" />' +
    '<UnitTestResult testName="N.Type.skip" outcome="NotExecuted" /></Results>' +
    '<ResultSummary outcome="Failed"><Counters total="3" passed="1" failed="1" notExecuted="1" /></ResultSummary></TestRun>';
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
      signal: null, summary: { completed: true, success: !tests.some(test => ["failed", "cancelled"].includes(test.status)) },
      resultError: null, tests, log: "logs/architecture.log" }] };
}

function result(name, status = "passed") {
  return { file: "test/architecture/rules.test.mjs", name, path: [name], status, nesting: 0, type: "test",
    exitCode: null, signal: null };
}

test("inner termination scalars survive normalization and cannot hide behind a known failure", async () => {
  const baseline = collectTestResults([report([{ ...result("known file error", "failed"), exitCode: 1 }])]);
  assert.equal(compareTestResults(baseline, baseline).pass, true, "an ordinary completed file failure remains comparable");
  const olderProjection = structuredClone(baseline);
  delete olderProjection.tests[0].exitCode;
  delete olderProjection.tests[0].signal;
  const originalOlderProjection = JSON.stringify(olderProjection);
  assert.equal(compareTestResults(olderProjection, baseline).pass, true,
    "older source remains a comparison reference, not newly admitted current execution evidence");
  assert.equal(JSON.stringify(olderProjection), originalOlderProjection, "old evidence is not padded or rewritten");
  for (const termination of [
    { exitCode: 23, signal: null }, { exitCode: 137, signal: null },
    { exitCode: null, signal: "SIGTERM" }, { exitCode: null, signal: "SIGABRT" },
  ]) {
    async function* events() {
      yield { type: "test:fail", data: { name: "known file error", file: "/repo/test/architecture/rules.test.mjs", nesting: 0,
        details: { type: "test", error: { failureType: "testCodeFailure", ...termination } } } };
      yield { type: "test:summary", data: { success: false, counts: { tests: 1, failed: 1 } } };
    }
    const records = [];
    for await (const line of reportTestResults(events())) records.push(JSON.parse(line));
    const file = resolve(mkdtempSync(resolve(".temp/test-result-tests/inner-fields-")), "results.jsonl");
    writeFileSync(file, records.map(record => JSON.stringify(record)).join("\n") + "\n");
    const named = readNodeTestResults(file, "/repo");
    assert.equal(named.tests[0].exitCode, termination.exitCode, "the native inner exit is not replaced by the outer exit1");
    assert.equal(named.tests[0].signal, termination.signal, "the native signal is not replaced by the outer null signal");
    const actual = collectTestResults([{ ...report(named.tests), results: [{ ...report(named.tests).results[0], summary: named.summary }] }]);
    const compared = compareTestResults(baseline, actual);
    assert.equal(compared.regressions.length, 0, "the same failed file identity is deliberately unchanged");
    assert.equal(compared.pass, false, "inner process failure independently blocks acceptance");
    assert.equal(compared.infrastructureFailures.length, 1, "the canonical execution owner detects the inner failure");
    assert.notEqual(testResultExecutionIssue(named.tests), null, "a count projection is not execution admission");
  }
  for (const termination of [{ exitCode: "23" }, { exitCode: -1 }, { signal: {} }, { signal: "x".repeat(65) }]) {
    async function* invalid() {
      yield { type: "test:fail", data: { name: "invalid", nesting: 0, details: { error: termination } } };
    }
    await assert.rejects(async () => {
      for await (const line of reportTestResults(invalid())) JSON.parse(line);
    }, /invalid scalar termination/u);
  }
  assert.notEqual(testResultExecutionIssue([{ ...result("missing fields"), exitCode: undefined }]), null,
    "historical missing process evidence is not rewritten into current explicit absence");
});

test("actual public queue and capture preserve module errors, assertions, exits and inner signals", () => {
  const root = mkdtempSync(resolve(".temp/test-result-tests/real-process-"));
  const directory = resolve(root, "test/infrastructure/runner");
  mkdirSync(directory, { recursive: true });
  const file = resolve(directory, "termination.test.mjs");
  const environment = { ...process.env };
  delete environment.NODE_TEST_CONTEXT;
  delete environment.TSONIC_TEST_SUITE_REPORT;
  delete environment.TSONIC_TEST_COUNT_DIRECTORY;
  const cases = [
    { id: "module", body: "throw new Error('ordinary module load refusal');", status: 1, exitCode: 1, signal: null, abnormal: false },
    { id: "exit1", body: "process.exit(1);", status: 1, exitCode: 1, signal: null, abnormal: false },
    { id: "exit23", body: "process.exit(23);", status: 1, exitCode: 23, signal: null, abnormal: true },
    { id: "signal", body: "process.kill(process.pid, 'SIGTERM');", status: 1, exitCode: null, signal: "SIGTERM", abnormal: true },
    { id: "assertion", body: "import test from 'node:test'; import assert from 'node:assert/strict'; test('ordinary assertion', () => assert.equal(1, 2));",
      status: 1, exitCode: null, signal: null, abnormal: false },
    { id: "passed", body: "import test from 'node:test'; test('ordinary passing control', () => {});",
      status: 0, exitCode: null, signal: null, abnormal: false },
  ];
  let baseline;
  for (const scenario of cases) {
    writeFileSync(file, scenario.body + "\n");
    const suitePath = resolve(root, `${scenario.id}.report.json`);
    const queue = spawnSync(process.execPath,
      ["test/scripts/run-parallel.mjs", "--scope", "tsonic", "--repository-root", root, "--file", file], {
      cwd: process.cwd(), env: { ...environment, TSONIC_TEST_SUITE_REPORT: suitePath },
      encoding: "utf8", timeout: 30_000, maxBuffer: 65_536,
    });
    assert.equal(queue.error === undefined, true, `${scenario.id}: the existing public queue completes`);
    assert.equal(queue.status, scenario.status, `${scenario.id}: the outer Node runner retains its ordinary exit`);
    const actualReport = JSON.parse(readFileSync(suitePath, "utf8"));
    assert.equal(actualReport.results.length, 1, "only the exact fixture task is selected");
    const task = actualReport.results[0];
    assert.equal(task.signal, null, `${scenario.id}: only the inner test process is terminated`);
    assert.equal(task.summary.completed, true, `${scenario.id}: the outer runner completes its summary`);
    assert.equal(task.resultError !== null, scenario.abnormal, `${scenario.id}: abnormal execution is separate from failed assertions`);
    assert.equal(task.tests[0].exitCode, scenario.exitCode, `${scenario.id}: actual inner exit is retained`);
    assert.equal(task.tests[0].signal, scenario.signal, `${scenario.id}: actual inner signal is retained`);
    const collected = collectTestResults([actualReport]);
    if (scenario.id === "module") baseline = collected;
    if (["module", "exit1", "exit23", "signal"].includes(scenario.id)) {
      const compared = compareTestResults(baseline, collected);
      assert.equal(compared.regressions.length, 0, `${scenario.id}: native file identity/status are unchanged`);
      assert.equal(compared.pass, !scenario.abnormal, `${scenario.id}: identical known failures never explain a crash`);
    } else {
      assert.equal(compareTestResults(collected, collected).pass, true,
        `${scenario.id}: ordinary completed assertions or passes remain comparable`);
    }
    const countsRoot = resolve(root, `${scenario.id}-counts`);
    const capture = spawnSync(process.execPath,
      ["scripts/certification/capture-tests.mjs", "node", process.execPath, "--test", file], {
      cwd: process.cwd(), env: { ...environment, TSONIC_TEST_COUNT_DIRECTORY: countsRoot },
      encoding: "utf8", timeout: 30_000, maxBuffer: 65_536,
    });
    assert.equal(capture.error === undefined, true, `${scenario.id}: the direct capture completes`);
    assert.equal(capture.status, scenario.status, `${scenario.id}: the capture never hides its native failure`);
    const paths = readdirSync(countsRoot);
    assert.equal(paths.length, 1, `${scenario.id}: failure evidence is saved rather than discarded before admission`);
    const bank = JSON.parse(readFileSync(resolve(countsRoot, paths[0]), "utf8"));
    assert.equal(bank.exitCode, scenario.status, `${scenario.id}: actual outer exit is retained in bank evidence`);
    assert.equal(bank.signal, null, `${scenario.id}: outer process signal is not fabricated`);
    assert.equal(bank.resultError !== null, scenario.abnormal, `${scenario.id}: both public consumers use one execution owner`);
    assert.equal(bank.tests[0].exitCode, scenario.exitCode, `${scenario.id}: captured inner exit is retained`);
    assert.equal(bank.tests[0].signal, scenario.signal, `${scenario.id}: captured inner signal is retained`);
    assert.equal(bank.counts[0].failed, scenario.status, `${scenario.id}: actual failure counts remain visible`);
    if (scenario.status === 0) assert.doesNotThrow(() => capturedBankCounts(bank));
    else assert.throws(() => capturedBankCounts(bank), /failed|execution/u,
      `${scenario.id}: an unsuccessful capture is not a certificate`);
    assert.equal(testTaskExecutionIssue({ status: bank.exitCode, signal: bank.signal, summary: bank.summary, tests: bank.tests }) !== null,
      scenario.abnormal, `${scenario.id}: admission does not classify every testCodeFailure as abnormal`);
  }
});

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

test("a known named failure cannot conceal an abnormal task exit, signal or native run", () => {
  const baseline = report([result("known failure", "failed")]);
  const before = collectTestResults([baseline]);
  assert.equal(compareTestResults(before, before).pass, true, "completed assertion exit 1 remains ordinary evidence");
  for (const changed of [
    { status: 137 }, { status: 23 }, { status: null },
    { signal: "SIGKILL" }, { signal: "SIGTERM" }, { signal: undefined },
    { summary: { completed: false, success: false, outcome: "Aborted" } },
    { summary: undefined },
  ]) {
    const after = collectTestResults([{ ...baseline, results: [{ ...baseline.results[0], ...changed }] }]);
    const compared = compareTestResults(before, after);
    assert.equal(compared.pass, false, Object.keys(changed).join(","));
    assert.equal(compared.infrastructureFailures.length, 1, "run completion is independent of assertion identity");
    assert.equal(after.tasks[0].signal, Object.hasOwn(changed, "signal") ? changed.signal : baseline.results[0].signal,
      changed.signal === undefined && Object.hasOwn(changed, "signal") ? "unrecorded signal remains visible" : "signal is retained");
  }
});

test("native run-level aborts and errors stay visible beside unchanged failed test identities", () => {
  const trx = '<TestRun><Results><UnitTestResult testName="N.Type.knownFailure" outcome="Failed" /></Results>' +
    '<ResultSummary outcome="Failed"><Counters total="1" executed="1" failed="1" />RUN_INFOS</ResultSummary></TestRun>';
  const nativeReport = named => ({ ...report(named.tests), results: [{ ...report(named.tests).results[0], summary: named.summary }] });
  const before = collectTestResults([nativeReport(readDotnetTestResults(trx.replace("RUN_INFOS", ""), "native"))]);
  assert.equal(compareTestResults(before, before).pass, true);
  for (const text of [
    trx.replace('outcome="Failed"><Counters', 'outcome="Aborted"><Counters').replace("RUN_INFOS", ""),
    trx.replace('outcome="Failed"><Counters', 'outcome="Error"><Counters').replace("RUN_INFOS", ""),
    trx.replace("RUN_INFOS", '<RunInfos><RunInfo outcome="Error"><Text>The testhost crashed.</Text></RunInfo></RunInfos>'),
    trx.replace("RUN_INFOS", "<ErrorInfo><Message>The run failed.</Message></ErrorInfo>"),
  ]) {
    const named = readDotnetTestResults(text, "native");
    assert.equal(named.summary.completed, false);
    const after = collectTestResults([nativeReport(named)]);
    assert.equal(compareTestResults(before, after).pass, false, "identical failed assertions do not excuse native execution failure");
    assert.equal(after.tasks[0].summary.completed, false);
  }
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
  const reports = completeReports();
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
  const cancelled = structuredClone(reports);
  cancelled[1].results[0].tests[0].status = "cancelled";
  assert.throws(() => validateTrainInputs(cancelled, [guard, guard]), /cancelled/u);
  assert.doesNotThrow(() => validateTrainInputs(reports, [guard, { ...guard,
    userSliceOomDiagnostic: { before: 7, after: 8, authoritative: false } }]), "foreign OOM has no admission authority");
});

function completeReports() {
  const repos = Object.fromEntries(Object.values(testScopeRepositoryKeys).map(key => [key,
    { path: `/repos/${key}`, head: "a".repeat(40), dirty: false }]));
  return fullTestTrainBanks.map(({ bank, scopes }) => {
    const results = scopes.map(scope => ({ ...report([result(`${scope} example`)]).results[0], id: `${scope}:example`, scope }));
    const files = results.map(task => ({ scope: task.scope, path: "test/architecture/rules.test.mjs",
      taskIds: [task.id], preRunIds: ["build"] }));
    return { bank, runId: `${bank}-run`, createdAt: "2026-10-18T00:00:00Z", repos, selection: { complete: true },
      taskCounts: { total: results.length }, inventory: { fileCount: files.length, taskCount: results.length, files },
      preRuns: [{ id: "build", status: 0 }], results };
  });
}

test("complete train validation retains and checks bank provenance, inventory and execution on both sides", () => {
  const reports = completeReports();
  const collected = collectTestResults(reports);
  assert.doesNotThrow(() => validateTrainResults(collected));
  assert.equal(collected.banks[0].selection.complete, true);
  assert.deepEqual(collected.banks[1].inventory, reports[1].inventory);
  for (const mutate of [
    current => { current.banks = []; },
    current => { current.banks[0].selection.complete = false; },
    current => { current.banks[1].selection.complete = false; },
    current => { current.banks[0].repos.tsonic.head = "unknown"; },
    current => { current.banks[1].repos.tsonicRust.dirty = true; },
    current => { delete current.banks[0].runId; },
    current => { current.banks[0].inventory.files.pop(); },
    current => { current.banks[1].preRuns = []; },
    current => { current.tasks.pop(); },
    current => { current.tasks[0].status = 137; },
    current => { current.tests[0].exitCode = 23; },
    current => { current.tests[0].signal = "SIGTERM"; },
    current => { delete current.tests[0].exitCode; },
    current => { current.tests.pop(); },
    current => { current.inventory.pop(); },
  ]) {
    const current = structuredClone(collected);
    mutate(current);
    assert.throws(() => validateTrainResults(current), /train|bank|provenance|execution|task|prerequisite/u);
  }
  const partial = collectTestResults([{ ...reports[0], selection: { complete: false } }]);
  assert.equal(compareTestResults(partial, partial).pass, true, "owner-level partial comparisons remain legitimate");
  assert.throws(() => validateTrainResults(partial), /complete/u, "a partial owner proof is not a whole-train baseline");
  assert.throws(() => validateTrainResults({ schemaVersion: 1, inventory: [], tasks: [], tests: [], architecture: [] }), /provenance/u);
});

test("one parallel count contract covers Host and Rust without losing cancellation or todo", () => {
  const counts = { total: 2, passed: 2, failed: 0, skipped: 0, todo: 0, cancelled: 0 };
  const base = { selection: { complete: true }, taskCounts: { total: 1, passed: 1, failed: 0 },
    testCountReporting: { missing: 0, reported: 1 }, testCounts: counts,
    results: [{ status: 0, signal: null, resultError: null, summary: { completed: true, success: true },
      tests: [result("one"), result("two")] }] };
  assert.equal(parallelReportCounts({ ...base, bank: "host", preRuns: [{ status: 0 }] })[0].total, 2);
  assert.equal(parallelReportCounts({ ...base, bank: "node", preRuns: [] })[0].total, 2);
  assert.throws(() => parallelReportCounts({ ...base, bank: "host", preRuns: [] }), /incomplete/u);
  assert.throws(() => parallelReportCounts({ ...base, bank: "node", selection: { complete: false }, preRuns: [] }), /incomplete/u);
  for (const results of [undefined, [], [...base.results, ...base.results]]) {
    assert.throws(() => parallelReportCounts({ ...base, bank: "node", preRuns: [], results }), /incomplete/u,
      "summary-only, missing and duplicated task results are not a complete Node bank");
  }
  const changedTests = [result("cancelled", "cancelled"), result("todo", "todo")];
  const actual = parallelReportCounts({ ...base, bank: "node", preRuns: [], testCounts: testResultCounts(changedTests),
    results: [{ ...base.results[0], tests: changedTests }] });
  assert.equal(actual[0].cancelled, 1, "certification receives rather than erases a cancelled result");
  assert.equal(actual[0].todo, 1);
  assert.deepEqual(aggregateTestCounts(base.results), { reportedShards: 1, ...counts });
  assert.throws(() => parallelReportCounts({ ...base, bank: "node", preRuns: [], testCounts: { ...counts, passed: 1 } }), /per-test/u);
});
