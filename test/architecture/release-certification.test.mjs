import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { readCertificationOptions, validateCertificationEntry } from "../../scripts/certification/contract.mjs";
import { hostReportCounts, parseBankCounts } from "../../scripts/certification/counts.mjs";
import { snapshotCertificationInputs, sameCertificationInputs } from "../../scripts/certification/inputs.mjs";
import { describeEvidence, latestCertification, validateCertification, writeImmutableJson } from "../../scripts/certification/records.mjs";
import { selectCertification } from "../../scripts/certification/select.mjs";
import { hostRoot, loadNpmWave } from "../../scripts/release/npm-wave.mjs";
import { createTestWorkspace } from "../scripts/test-workspaces.mjs";

const entry = validateCertificationEntry({
  repository: "tsonic", command: ["npm", "test"], worker: ["node", "test.mjs"],
  inputs: ["tsonic"], tools: ["node"], profile: "host", banks: ["node"], skipped: 0,
});
const count = { total: 2, passed: 2, failed: 0, skipped: 0, todo: 0, cancelled: 0, filtered: 0 };

test("certification options cannot bypass tests or disguise manifest validation", () => {
  assert.deepEqual(readCertificationOptions([]), { reuse: false, force: false, validate: false, suites: [] });
  assert.equal(readCertificationOptions(["--reuse-certification", "--force"]).force, true);
  assert.equal(readCertificationOptions(["--validate"], { publisher: true }).validate, true);
  assert.deepEqual(readCertificationOptions(["--suite", "rust-js"]).suites, ["rust-js"]);
  for (const args of [["--force"], ["--verify-only"], ["--skip-tests"], ["--suite"],
    ["--reuse-certification", "--reuse-certification"], ["--suite", "a", "--suite", "a"]]) {
    assert.throws(() => readCertificationOptions(args));
  }
  assert.throws(() => readCertificationOptions(["--validate", "--reuse-certification"], { publisher: true }));
  assert.throws(() => readCertificationOptions(["--suite", "rust-js"], { publisher: true }));
});

test("all release banks explicitly close over their real sibling dependencies", () => {
  const entries = loadNpmWave().certification;
  for (const suite of entries) assert.doesNotThrow(() => validateCertificationEntry(suite));
  assert.deepEqual(entries.find(suite => suite.repository === "tsonic").inputs,
    ["tsonic", "tsonic-csharp", "csharp-runtime", "csharp-js", "csharp-nodejs"]);
  for (const repository of ["tsonic-rust", "rust-nodejs"]) {
    assert.deepEqual(entries.find(suite => suite.repository === repository).inputs,
      ["tsonic", "tsonic-rust", "rust-runtime", "rust-js", "rust-nodejs"]);
  }
  for (const invalid of [{ ...entry, inputs: [] }, { ...entry, inputs: ["../outside"] },
    { ...entry, tools: ["guess"] }, { ...entry, command: [] }, { ...entry, skipped: -1 },
    { ...entry, banks: ["node", "node"] }, { ...entry, extra: true }]) {
    assert.throws(() => validateCertificationEntry(invalid));
  }
});

test("reuse preflight rejects any missing bank; force reruns only invalid banks", () => {
  const entries = [entry, { ...entry, repository: "rust-js" }];
  const inspect = selected => {
    if (selected.repository === "rust-js") throw new Error("stale");
    return { passed: true };
  };
  assert.throws(() => selectCertification(entries, { reuse: true, force: false }, inspect), /rust-js: stale/u);
  assert.deepEqual(selectCertification(entries, { reuse: true, force: true }, inspect).map(item => item.action), ["reuse", "run"]);
  assert.deepEqual(selectCertification(entries, { reuse: false }, () => assert.fail("not reuse mode")).map(item => item.action), ["run", "run"]);
});

test("exact clean trees survive a different commit but not source, dependency or tool changes", () => {
  const fixture = makeFixture();
  assert.deepEqual(validate(fixture), { total: 2, passed: 2, skipped: 0 });
  const merged = structuredClone(fixture.current);
  merged.repositories[0].head = "b".repeat(40);
  assert.doesNotThrow(() => validate(fixture, fixture.record, merged));
  for (const mutate of [
    current => { current.repositories[0].tree = "c".repeat(40); },
    current => { current.repositories[0].dirty = true; },
    current => { current.repositories[0].installedLock = "d".repeat(64); },
    current => { current.tools.node = "different"; },
    current => { current.environment = { RUSTFLAGS: "different" }; },
    current => { current.architecture = "different"; },
    current => { current.repositories.pop(); },
  ]) {
    const current = structuredClone(fixture.current);
    mutate(current);
    assert.throws(() => validate(fixture, fixture.record, current));
  }
});

test("every incomplete, unsafe, malformed and mutated certification is rejected", () => {
  const fixture = makeFixture();
  for (const mutate of [
    record => { record.schemaVersion = 2; },
    record => { record.suite.command.push("--filter"); },
    record => { record.before.repositories[0].dirty = true; },
    record => { record.before.repositories[0].tree = "f".repeat(40); },
    record => { record.after.repositories[0].dirty = true; },
    record => { record.exitCode = 137; },
    record => { record.complete = false; },
    record => { record.finishedAt = "tomorrow"; },
    record => { record.finishedAt = "2999-01-01T00:00:00.000Z"; },
    record => { record.startedAt = "2026-01-02T00:00:00.000Z"; },
    record => { record.counts = []; },
    record => { record.counts[0].total = 3; },
    record => { record.counts[0].filtered = 1; },
    record => { record.counts[0].todo = 1; },
    record => { record.counts[0].cancelled = 1; },
    record => { record.counts[0].failed = 1; },
    record => { record.counts[0].passed = NaN; },
    record => { record.guard.oomAfter = 1; },
    record => { record.guard.oomBefore = null; },
    record => { record.guard.scopeResult = "oom-kill"; },
    record => { record.guard.calibration = true; },
    record => { record.guard.swapMax = 1024; },
    record => { record.guard.memoryMiB = 0; },
    record => { record.guard.timeoutSeconds = Infinity; },
    record => { record.evidence.pop(); },
    record => { record.evidence.push(record.evidence[0]); },
    record => { record.evidence[0].sha256 = "0".repeat(64); },
    record => { record.evidence[0].path = resolve(fixture.root, "..", "guard.json"); },
  ]) {
    const record = structuredClone(fixture.record);
    mutate(record);
    assert.throws(() => validate(fixture, record));
  }
  writeFileSync(fixture.record.guard.log, "changed\n");
  assert.throws(() => validate(fixture), /evidence changed/u);
});

test("count adapters reject truncation and retain ignored or filtered native tests", () => {
  const output = "# tests 2\n# pass 2\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n";
  assert.deepEqual(parseBankCounts("node", output), [count]);
  assert.throws(() => parseBankCounts("node", output.replace("# todo 0\n", "")), /complete/u);
  assert.throws(() => parseBankCounts("node", output + output), /complete/u);
  const cargo = parseBankCounts("cargo", "test result: ok. 2 passed; 0 failed; 1 ignored; 0 measured; 3 filtered out; finished in 0.00s\n");
  assert.deepEqual(cargo, [{ ...count, total: 3, skipped: 1, filtered: 3 }]);
  assert.deepEqual(parseBankCounts("cargo", "running 3 tests\n"), []);
  assert.throws(() => hostReportCounts({ taskCounts: { total: 2, passed: 2, failed: 0 } }), /incomplete/u);
});

test("a newer incomplete or malformed run never falls back to an older success", () => {
  const root = createTestWorkspace(resolve(hostRoot, ".temp"), "certification-latest-");
  assert.throws(() => latestCertification(root), /No certification/u);
  const older = resolve(root, "20260101T000000000Z-00000000-0000-0000-0000-000000000000");
  mkdirSync(older);
  writeImmutableJson(resolve(older, "record.json"), { success: true });
  assert.equal(latestCertification(root).record.success, true);
  assert.throws(() => writeImmutableJson(resolve(older, "record.json"), {}), /EEXIST/u);
  const newer = resolve(root, "20260101T000000001Z-00000000-0000-0000-0000-000000000000");
  mkdirSync(newer);
  assert.throws(() => latestCertification(root), /did not finish/u);
  writeFileSync(resolve(newer, "record.json"), "not JSON");
  assert.throws(() => latestCertification(root), /JSON/u);
});

test("real repository snapshots identify merges, dirty inputs and dependency mutations", () => {
  const root = createTestWorkspace(resolve(hostRoot, ".temp"), "certification-inputs-");
  const git = args => execFileSync("git", args, { cwd: root, stdio: "pipe" });
  git(["init", "--quiet", "-b", "certification-fixture"]);
  writeFileSync(resolve(root, ".gitignore"), "node_modules/\n");
  writeFileSync(resolve(root, "source.ts"), "export {};\n");
  git(["add", "."]);
  const commit = ["-c", "user.name=Certification Test", "-c", "user.email=certification@example.invalid", "commit", "--quiet", "--allow-empty", "-m", "Fixture"];
  git(commit);
  const layout = { repositoryRoots: new Map([["tsonic", root]]) };
  const before = snapshotCertificationInputs(entry, layout);
  git(commit);
  const merged = snapshotCertificationInputs(entry, layout);
  assert.notEqual(before.repositories[0].head, merged.repositories[0].head);
  assert(sameCertificationInputs(before, merged));
  mkdirSync(resolve(root, "node_modules"));
  writeFileSync(resolve(root, "node_modules/.package-lock.json"), "{}\n");
  assert(!sameCertificationInputs(before, snapshotCertificationInputs(entry, layout)));
  writeFileSync(resolve(root, "source.ts"), "export const changed = 1;\n");
  assert(snapshotCertificationInputs(entry, layout).repositories[0].dirty);
});

test("new test captures produce structured counts and preserve failure status", () => {
  const root = createTestWorkspace(resolve(hostRoot, ".temp"), "certification-capture-");
  const environment = { ...process.env, TSONIC_TEST_COUNT_DIRECTORY: resolve(root, "counts") };
  delete environment.NODE_TEST_CONTEXT;
  for (const passes of [true, false]) {
    const path = resolve(root, `${passes}.test.mjs`);
    writeFileSync(path, `import test from 'node:test'; import assert from 'node:assert/strict'; test('case', () => assert.equal(${passes}, true));\n`);
    const result = spawnSync(process.execPath, ["scripts/certification/capture-tests.mjs", "node", process.execPath,
      "--test", "--test-reporter=tap", path], { cwd: hostRoot, env: environment, encoding: "utf8", timeout: 30_000 });
    assert.equal(result.status, passes ? 0 : 1, result.stdout + result.stderr);
  }
});

function makeFixture() {
  const workspace = createTestWorkspace(resolve(hostRoot, ".temp"), "certification-record-");
  const root = resolve(workspace, "record");
  mkdirSync(resolve(root, "counts"), { recursive: true });
  mkdirSync(resolve(workspace, ".temp/test-runs"), { recursive: true });
  const log = resolve(workspace, ".temp/test-runs/20260101T000000Z-1.log");
  writeFileSync(log, "completed tests\n");
  const current = { repositories: [{ repository: "tsonic", root: workspace, head: "a".repeat(40), tree: "a".repeat(40), dirty: false, installedLock: null }],
    tools: { node: "test" }, environment: {}, platform: "linux", architecture: "x64" };
  const guard = { log, exitCode: 0, calibration: false, swapMax: 0, oomBefore: 0, oomAfter: 0,
    scopeResult: "success", memoryMiB: 4096, tasksMax: 2048, timeoutSeconds: 60, logMaxBytes: 65536,
    budget: { availableCpus: 2, cpuBudget: 2, memoryMiB: 4096, workerMemoryMiB: 2048, childJobs: 1, workers: 2, heapMiB: 1536 } };
  const guardPath = resolve(root, "guard.json");
  const countsPath = resolve(root, "counts/node-00000000-0000-0000-0000-000000000000.json");
  writeFileSync(guardPath, JSON.stringify(guard));
  writeFileSync(countsPath, JSON.stringify({ kind: "node", exitCode: 0, counts: [count] }));
  const record = { schemaVersion: 1, suite: entry, before: current, after: current,
    startedAt: "2026-01-01T00:00:00.000Z", finishedAt: "2026-01-01T00:00:01.000Z",
    exitCode: 0, complete: true, counts: [count], guard,
    evidence: [describeEvidence(guardPath, "guard"), describeEvidence(log, "log"), describeEvidence(countsPath, "counts")] };
  return { root, record, current };
}

function validate(fixture, record = fixture.record, current = fixture.current) {
  return validateCertification(record, entry, current, fixture.root);
}
