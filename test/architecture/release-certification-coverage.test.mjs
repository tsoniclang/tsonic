import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { focusedCertificationEntry, requiredCertificationChecks, validateCertificationChecks } from "../../scripts/certification/checks.mjs";
import { sameCertificationInputs, snapshotCertificationInputs } from "../../scripts/certification/inputs.mjs";
import { certifyWave } from "../../scripts/certification/select.mjs";
import { hostRoot, validateWaveManifests } from "../../scripts/release/npm-wave.mjs";
import { createTestWorkspace } from "../scripts/test-workspaces.mjs";

const check = {
  name: "check-documentation",
  paths: [{ repository: "tsonic", path: "docs/" }, { repository: "tsonic", path: "documentation.test.mjs" }],
  tests: [{ repository: "tsonic", path: "documentation.test.mjs" }],
};

test("focused scopes are explicit, nonoverlapping and own their complete test selection", () => {
  const repositories = new Set(["tsonic"]);
  assert(Object.isFrozen(validateCertificationChecks([check], repositories)[0].paths));
  for (const checks of [null, [check, check], [{ ...check, name: "../escape" }],
    [{ ...check, paths: [] }], [{ ...check, tests: [] }],
    [{ ...check, paths: [...check.paths, { repository: "tsonic", path: "docs/nested/" }] }],
    [{ ...check, tests: [{ repository: "tsonic", path: "outside.test.mjs" }] }],
    [{ ...check, tests: [check.tests[0], check.tests[0]] }]]) {
    assert.throws(() => validateCertificationChecks(checks, repositories));
  }
  for (const path of ["*", "../source", "/absolute", ".", "docs/../src", "docs//file", "docs\\file"]) {
    assert.throws(() => validateCertificationChecks([{ ...check, paths: [{ repository: "tsonic", path }] }], repositories));
  }
  assert.throws(() => validateCertificationChecks([{ ...check, paths: [{ repository: "missing", path: "docs/" }] }], repositories));
});

test("only declared documentation paths can reuse a changed tree", () => {
  const fixture = repositoryFixture();
  const before = fixture.snapshot();
  writeFileSync(resolve(fixture.root, "docs/page.md"), "Updated docs\n");
  fixture.commit();
  const after = fixture.snapshot();
  assert(!sameCertificationInputs(before, after));
  assert(sameCertificationInputs(before, after, check.paths));
  assert.deepEqual(requiredCertificationChecks(before, after, [check]), [check.name]);
  const changed = structuredClone(after);
  changed.repositories[0].installedLock = "changed";
  assert(!sameCertificationInputs(before, changed, check.paths));
  changed.repositories[0].installedLock = after.repositories[0].installedLock;
  changed.tools.node = "changed";
  assert(!sameCertificationInputs(before, changed, check.paths));
});

test("independent focused scopes reuse evidence when only another scope changed", () => {
  const fixture = repositoryFixture();
  const before = fixture.snapshot();
  mkdirSync(resolve(fixture.root, "release"));
  writeFileSync(resolve(fixture.root, "release/check.mjs"), "export {};\n");
  fixture.commit();
  const paths = [{ repository: "tsonic", path: "release/" }];
  assert(sameCertificationInputs(before, fixture.snapshot(), paths));
  assert(!sameCertificationInputs(before, fixture.snapshot(), check.paths));
});

for (const operation of ["source", "fixture-markdown", "build", "rename", "delete", "mode"]) {
  test(`${operation} changes cannot masquerade as documentation refreshes`, () => {
    const fixture = repositoryFixture();
    const before = fixture.snapshot();
    if (operation === "rename") renameSync(resolve(fixture.root, "source.ts"), resolve(fixture.root, "docs/source.ts"));
    else if (operation === "delete") unlinkSync(resolve(fixture.root, "source.ts"));
    else if (operation === "mode") fixture.git(["update-index", "--chmod=+x", "source.ts"]);
    else writeFileSync(resolve(fixture.root, operation === "source" ? "source.ts" : operation === "build" ? "package.json" : "fixture.md"), "changed\n");
    fixture.commit(operation !== "mode");
    const after = fixture.snapshot();
    assert(!sameCertificationInputs(before, after, check.paths));
    assert.throws(() => requiredCertificationChecks(before, after, [check]), /full bank/u);
  });
}

test("source reuse waits for a current passing focused check and never reruns the source bank", () => {
  const fixture = orchestrationFixture();
  certifyWave(fixture.wave, { suites: [] }, fixture.services);
  assert.deepEqual(fixture.runs, [check.name]);
  assert(fixture.messages.some(message => /Certified tsonic:.*reused/u.test(message)));
  fixture.runs.length = 0;
  certifyWave(fixture.wave, { suites: [], check: true }, fixture.services);
  assert.deepEqual(fixture.runs, []);
});

test("missing or failed focused evidence cannot authorize publishing or start another bank", () => {
  const missing = orchestrationFixture();
  assert.throws(() => certifyWave(missing.wave, { suites: [], check: true }, missing.services), /never runs tests/u);
  assert.deepEqual(missing.runs, []);
  const failed = orchestrationFixture();
  failed.services.run = () => ({ record: { exitCode: 1 }, reusable: false });
  assert.throws(() => certifyWave(failed.wave, { suites: [] }, failed.services), /failed; no source bank/u);
  assert(!failed.messages.some(message => /Certified tsonic/u.test(message)));
  const dirty = orchestrationFixture();
  dirty.services.snapshot = () => ({ repositories: [{ dirty: true }] });
  assert.throws(() => certifyWave(dirty.wave, { suites: [] }, dirty.services), /clean inputs/u);
  assert.deepEqual(dirty.runs, []);
});

test("release scopes do not cover product, native, fixture or execution-guard inputs", () => {
  const wave = validateWaveManifests();
  for (const scope of wave.checks) assert.doesNotThrow(() => focusedCertificationEntry(scope, wave));
  const fixture = repositoryFixture();
  const before = fixture.snapshot();
  for (const path of ["packages/host/src/compiler.ts", "scripts/build/build.mjs", "test/scripts/bounded-run.sh", "test/fixtures/input.md"]) {
    mkdirSync(resolve(fixture.root, path, ".."), { recursive: true });
    writeFileSync(resolve(fixture.root, path), "new input\n");
  }
  fixture.commit();
  assert.throws(() => requiredCertificationChecks(before, fixture.snapshot(), wave.checks), /full bank/u);
});

function repositoryFixture() {
  const root = createTestWorkspace(resolve(hostRoot, ".temp"), "certification-coverage-");
  const git = args => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: "pipe" });
  git(["init", "--quiet", "-b", "certification-fixture"]);
  mkdirSync(resolve(root, "docs"));
  writeFileSync(resolve(root, "docs/page.md"), "Original docs\n");
  writeFileSync(resolve(root, "source.ts"), "export const answer = 42;\n");
  writeFileSync(resolve(root, "documentation.test.mjs"), "export {};\n");
  const commit = (stage = true) => {
    if (stage) git(["add", "."]);
    git(["-c", "user.name=Certification Test", "-c", "user.email=certification@example.invalid", "commit", "--quiet", "-m", "Fixture"]);
  };
  commit();
  const layout = { repositoryRoots: new Map([["tsonic", root]]) };
  const entry = { repository: "tsonic", inputs: ["tsonic"], tools: ["node"] };
  return { root, git, commit, layout, entry, snapshot: () => snapshotCertificationInputs(entry, layout) };
}

function orchestrationFixture() {
  const fixture = repositoryFixture();
  const before = fixture.snapshot();
  writeFileSync(resolve(fixture.root, "docs/page.md"), "Updated docs\n");
  fixture.commit();
  const current = fixture.snapshot();
  const wave = { certification: [fixture.entry], checks: [check], layout: fixture.layout };
  const runs = [];
  const messages = [];
  let refreshed = false;
  const evidence = { path: "record.json", counts: { passed: 2, skipped: 0 }, record: { after: before }, current };
  const services = {
    snapshot: () => current,
    write: message => messages.push(message),
    inspect: (entry, layout, options) => {
      if (options.name === check.name && !refreshed) throw new Error("Focused evidence missing");
      if (options.name !== check.name) assert.deepEqual(options.coveredPaths, check.paths);
      return evidence;
    },
    run: (entry, layout, options) => {
      assert.equal(options.name, check.name, "unchanged source bank must not run");
      runs.push(options.name);
      refreshed = true;
      return { record: { exitCode: 0 }, reusable: true };
    },
  };
  return { wave, services, runs, messages };
}
