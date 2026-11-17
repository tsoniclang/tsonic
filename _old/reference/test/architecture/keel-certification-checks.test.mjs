import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  createKeelViolationInventory, evaluateKeelDeterminism, evaluateKeelSafety,
  evaluateKeelViolationInventory, guardSucceeded, validateKeelViolationInventory,
} from "./tooling/keel-certification-checks.mjs";
import { keelCheckIds, keelFinding } from "./tooling/keel-contract.mjs";
import { keelDigest } from "./tooling/keel-source-analysis.mjs";
import { keelFixtureGeneration, keelFixtureGuard, keelFixtureHas, keelFixtureModel } from "./tooling/keel-test-fixtures.mjs";
import { evaluateKeelLayers } from "./tooling/keel-layer-checks.mjs";
import { keelBasePins, keelOwnedNativeUnsafeReviews } from "./tooling/keel-owned-contracts.mjs";
import { keelNativeUnsafeSites } from "./tooling/keel-native-tokens.mjs";

test("AC11 covers both targets and complete independent artifact sets with guarded provenance", () => {
  const { programs, samples } = keelFixtureGeneration();
  assert.equal(evaluateKeelDeterminism(samples, programs).length, 0);
  for (const changed of [
    { ...samples[0], second: new Map([["source.txt", Buffer.from("different source")]]) },
    { ...samples[0], second: new Map([...samples[0].second, ["extra.txt", Buffer.from("extra")]]) },
    { ...samples[0], first: new Map() },
    { ...samples[0], sourceDigest: "0".repeat(64) },
    { ...samples[0], pins: { tsonic: "c".repeat(40) } },
    { ...samples[0], firstGuard: undefined },
    { ...samples[0], first: samples[0].second },
    { ...samples[0], secondGuard: samples[0].firstGuard },
    { ...samples[0], secondGuard: { ...samples[0].secondGuard, scopeDrained: false } },
  ]) assert.equal(keelFixtureHas(evaluateKeelDeterminism([changed, ...samples.slice(1)], programs), "AC11"), true);
  assert.equal(keelFixtureHas(evaluateKeelDeterminism(samples.slice(1), programs), "AC11", "missing"), true);
  assert.equal(keelFixtureHas(evaluateKeelDeterminism([], []), "AC11", "empty coverage"), true);
  assert.throws(() => evaluateKeelDeterminism([...samples, samples[0]], programs), /duplicate/u);
  assert.throws(() => evaluateKeelDeterminism(samples, [...programs, programs[0]]), /duplicate/u);
  assert.throws(() => evaluateKeelDeterminism([{ ...samples[0], first: new Map([["../escape", Buffer.from("x")]]) }], programs), /path/u);
});

test("AC11 distinguishes actual guarded runs even when copied receipts have different log names", () => {
  const { programs, samples } = keelFixtureGeneration();
  const sample = samples[0];
  assert.notEqual(sample.firstGuard.admission.unit, sample.secondGuard.admission.unit);
  assert.notEqual(sample.firstGuard.measurement.controlGroup, sample.secondGuard.measurement.controlGroup);
  for (const secondGuard of [
    { ...sample.firstGuard, log: sample.secondGuard.log },
    { ...sample.firstGuard, log: sample.secondGuard.log,
      measurement: { ...sample.firstGuard.measurement,
        controlGroup: `/another.slice/${sample.firstGuard.admission.unit}` } },
  ]) {
    assert.equal(guardSucceeded(secondGuard), true, "the copied receipt is individually valid");
    assert.equal(keelFixtureHas(evaluateKeelDeterminism([{ ...sample, secondGuard }, ...samples.slice(1)], programs),
      "AC11", "distinct admitted units"), true, "renaming a log or parent cgroup does not create a second run");
  }
});

test("AC11 guard proof requires finite aggregate limits, zero swap, no OOM and a drained scope", () => {
  assert.equal(guardSucceeded(keelFixtureGuard()), true);
  const owned = keelFixtureGuard();
  assert.equal(guardSucceeded(keelFixtureGuard({ log: "/home/gorge/workspace/.temp/test-runs/actual.log", oomBefore: 1, oomAfter: 1,
    measurement: { ...owned.measurement, oomBefore: 1, oomAfter: 1 },
    userSliceOomDiagnostic: { before: 7, after: 8, authoritative: false } })), true);
  for (const overrides of [
    { exitCode: 1 }, { swapMax: 1 }, { calibration: true }, { scopeDrained: false },
    { scopeResult: "oom-kill" }, { oomAfter: 1 }, { oomBefore: null },
    { memoryMiB: Infinity }, { timeoutSeconds: 0 }, { tasksMax: -1 },
    { logMaxBytes: Number.MAX_VALUE }, { budget: { workers: 1, childJobs: 2, cpuBudget: 3, memoryMiB: 1 } },
    { budget: { workers: 0, childJobs: 2, cpuBudget: 3, memoryMiB: 7168 } },
    { measurement: undefined }, { admission: undefined }, { oomScope: undefined },
    { measurement: { ...owned.measurement, oomAfter: 1 } },
    { measurement: { ...owned.measurement, swapBytes: 1 } },
    { measurement: { ...owned.measurement, controlGroup: "/user.slice/foreign.scope" } },
    { admission: { ...owned.admission, requestedMiB: 4096 } },
  ]) assert.equal(guardSucceeded(keelFixtureGuard(overrides)), false, Object.keys(overrides).join(","));
});

test("AC11 retains exact unavailable-surface controls without treating native failures as rejection evidence", () => {
  const { programs, samples } = keelFixtureGeneration();
  const diagnostic = { code: "TSTS_DIAGNOSTIC", category: "error", message: "Required JS API is unavailable.",
    evidence: ["tsts.code=TS2339"], sourceSpan: { fileName: "index.ts", line: 1, column: 1, endLine: 1, endColumn: 4 } };
  const observation = { stage: "source", nativeProgramCompilationInvoked: false,
    publishedArtifacts: [], diagnostics: [diagnostic] };
  const requirement = { ...programs[0], expectation: { kind: "source-rejected", diagnosticCodes: ["TS2339"] } };
  const proof = { ...samples[0], first: new Map(), second: new Map(),
    firstRejection: observation, secondRejection: { ...observation },
    firstGuard: { ...samples[0].firstGuard, exitCode: 1, scopeResult: "exit-code",
      measurement: { ...samples[0].firstGuard.measurement, exitCode: 1 } },
    secondGuard: { ...samples[0].secondGuard, exitCode: 1, scopeResult: "exit-code",
      measurement: { ...samples[0].secondGuard.measurement, exitCode: 1 } } };
  const check = candidate => evaluateKeelDeterminism([candidate, ...samples.slice(1)], [requirement, ...programs.slice(1)]);
  assert.equal(check(proof).length, 0);
  for (const changed of [
    { ...proof, first: samples[0].first },
    { ...proof, firstRejection: undefined },
    { ...proof, secondRejection: { ...observation, nativeProgramCompilationInvoked: true } },
    { ...proof, secondRejection: { ...observation, diagnostics: [{ ...diagnostic, message: "Changed diagnostic." }] } },
    { ...proof, firstGuard: undefined },
    { ...proof, firstGuard: { ...proof.firstGuard, exitCode: 0 } },
    { ...proof, secondGuard: { ...proof.firstGuard, log: proof.secondGuard.log } },
  ]) assert.equal(keelFixtureHas(check(changed), "AC11"), true);
  assert.equal(keelFixtureHas(evaluateKeelDeterminism([proof, ...samples.slice(1)], programs), "AC11", "nonempty"), true);
});

test("AC12 uses checked assertion/directive syntax, preserves existing occurrences, and counts additions", () => {
  const file = "src/analysis/program/value.ts";
  const previous = "export function value(input: unknown): unknown { return input as any; }";
  const baseModel = keelFixtureModel([[file, previous]]);
  const common = { repo: "tsonic", trackedFiles: [], currentSources: new Map(), baseSources: new Map(), baseModel };
  assert.equal(evaluateKeelSafety({ ...common, currentModel: baseModel }).length, 0);
  const changed = `${previous}\nexport function extra(input: unknown): unknown { return input as any; }`;
  assert.equal(evaluateKeelSafety({ ...common, currentModel: keelFixtureModel([[file, changed]]) }).filter(row => row.check === "AC12").length, 1);
  for (const source of [
    'const text = "as any @ts-ignore"; export function value(input: unknown): unknown { return input; }',
    '/* an example of as any */ export function value(input: unknown): unknown { return input; }',
  ]) assert.equal(evaluateKeelSafety({ ...common, currentModel: keelFixtureModel([[file, source]]) }).length, 0);
  const suppressed = "// @ts-ignore\nexport const value: number = 'not a number';";
  assert.equal(keelFixtureHas(evaluateKeelSafety({ ...common, currentModel: keelFixtureModel([[file, suppressed]]) }), "AC12", "suppression"), true);
  const preserved = keelFixtureModel([[file, suppressed]]);
  assert.equal(evaluateKeelSafety({ ...common, baseModel: preserved, currentModel: preserved }).length, 0);
  assert.equal(keelFixtureHas(evaluateKeelSafety({ ...common, trackedFiles: [".analysis/private.json"], currentModel: baseModel }), "AC12", "ignored and untracked"), true);
});

for (const [repo, file] of [["rust-runtime", "src/lib.rs"], ["csharp-runtime", "src/Runtime.cs"]]) {
  test(`${repo}: AC12 rejects added unsafe sites and does not mistake literal/comment text for unsafe`, () => {
    const previous = "unsafe { existing(); }";
    const sources = { repo, trackedFiles: [], currentSources: new Map([[file, previous]]), baseSources: new Map([[file, previous]]) };
    assert.equal(evaluateKeelSafety(sources).length, 0);
    sources.currentSources.set(file, `${previous}\nunsafe { additional(); }`);
    assert.equal(keelFixtureHas(evaluateKeelSafety(sources), "AC12", "unsafe site"), true);
    sources.currentSources.set(file, '/* unsafe { not_code(); } */ const text = "unsafe";');
    assert.equal(evaluateKeelSafety(sources).length, 0);
  });
  test(`${repo}: AC12 preserves moved unchanged safety tokens and rejects a copied duplicate`, () => {
    const previous = "unsafe { existing(); }";
    const moved = file.replace("src/", "src/owned/");
    const sources = { repo, trackedFiles: [], currentSources: new Map([[moved, previous]]), baseSources: new Map([[file, previous]]) };
    assert.equal(evaluateKeelSafety(sources).length, 0);
    sources.currentSources.set(file, previous);
    assert.equal(evaluateKeelSafety(sources).filter(row => row.check === "AC12").length, 1);
  });
}

test("AC12 admits only the exact reviewed nine-site native allocator boundary after the unchanged seven-site baseline", () => {
  const [review] = keelOwnedNativeUnsafeReviews;
  const workspace = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const source = readFileSync(resolve(workspace, review.repo, review.file), "utf8");
  const baseFile = "tests/helpers/error_allocations.rs";
  const before = execFileSync("git", ["show", `${keelBasePins[review.repo]}:${baseFile}`], {
    cwd: resolve(workspace, review.repo), encoding: "utf8", timeout: 30_000, maxBuffer: 1024 * 1024,
  });
  const common = { repo: review.repo, trackedFiles: [], currentSources: new Map([[review.file, source]]),
    baseSources: new Map([[baseFile, before]]) };
  assert.equal(keelDigest(source), review.sourceSha256, "the actual entire helper is the reviewed source");
  assert.equal(keelNativeUnsafeSites(before).length, 7, "seven inherited native unsafe sites");
  assert.equal(keelNativeUnsafeSites(source).length, 9, "nine actual current native unsafe sites");
  const unmatched = evaluateKeelSafety(common);
  assert.equal(unmatched.length, 8, "eight changed token contexts, not eight new unsafe operations");
  const originalIds = new Set([
    "0da8a98e1dedc0e650c18da21cb194b82eb5d62774ffdbb12edcf148c65c625e",
    "23904f4f5dd776952f73a1771f3ff3ea327e5b5cec8dd198a4a1181d47c32571",
    "3149fd51d56ff0db1f69ec08bee6082751e92ca113f46e7148c5d7034b144549",
    "48ead374943ee8990195eeb48d7af3ec25603c753cafc9bff68463199bd13650",
    "508e1aaf67f67a29272fe120e2ce844101fb5b8fb8a7a54f587334481427f755",
    "55784d7dfab6eaea7bc056482620623b582de5aee983965ea370979d2af10ca3",
    "5c85ef3ceef018f6eda9a7d23ca17bcfe0fd69c2e140870abdec6a1924ad204a",
    "9b74f853ab22d8415cfac1d65f5d0dc08f3d6203b8d4e4f3f215bc33a91ad300",
  ]);
  for (const finding of unmatched) assert.equal(originalIds.has(finding.id), true, `original native safety finding ${finding.id}`);
  assert.equal(evaluateKeelSafety({ ...common, nativeUnsafeReviews: [review] }).length, 0,
    "the exact reviewed current multiset is admitted without changing baseline consumption");
  const unmatchedSites = new Set(unmatched.map(finding => finding.evidence.bodySha256));
  for (const omitted of review.sites) {
    const partial = { ...review, sites: review.sites.filter(site => site !== omitted) };
    assert.equal(evaluateKeelSafety({ ...common, nativeUnsafeReviews: [partial] }).length,
      unmatchedSites.has(omitted.bodySha256) ? 1 : 0, `${omitted.bodySha256}: baseline is consumed before site allowances`);
  }
  for (const [label, currentSources, repo] of [
    ["changed enclosing source", new Map([[review.file, `${source}\n`]]), review.repo],
    ["extra unsafe site", new Map([[review.file, `${source}\nunsafe { unreviewed(); }`]]), review.repo],
    ["changed native operation", new Map([[review.file, source.replace("System.alloc(layout)", "System.alloc_zeroed(layout)")]]), review.repo],
    ["copied helper", new Map([["tests/helpers/copied.rs", source]]), review.repo],
    ["production placement", new Map([["src/allocation_counts.rs", source]]), review.repo],
    ["another repository", common.currentSources, "rust-js"],
  ]) assert.equal(keelFixtureHas(evaluateKeelSafety({ ...common, repo, currentSources, nativeUnsafeReviews: [review] }),
    "AC12", "unsafe site"), true, `${label}: no whole-file or repository waiver`);
  assert.equal(evaluateKeelSafety({ ...common, currentSources: common.baseSources, nativeUnsafeReviews: [review] }).length, 0,
    "unchanged baseline native safety still needs no review allowance");
});

test("AC12 consumes each exact reviewed token occurrence once and rejects malformed or duplicate review data", () => {
  const file = "tests/helpers/counter.rs";
  const fragment = "let before = (1 + 2 + 3); unsafe { operation(); } let after = (4 + 5 + 6);";
  const source = `${fragment}\n${fragment}`;
  const sites = keelNativeUnsafeSites(source);
  assert.equal(sites.length, 2, "the fixture contains two actual native unsafe occurrences");
  assert.equal(sites[0], sites[1], "the two unsafe token contexts are deliberately identical");
  const site = { bodySha256: keelDigest(sites[0]), count: 1, reason: "Exact native forwarding fixture.",
    nativeEvidence: "Native GlobalAlloc unsafe boundary control." };
  const review = { repo: "rust-runtime", file, sourceSha256: keelDigest(source), sites: [site] };
  const common = { repo: review.repo, trackedFiles: [], currentSources: new Map([[file, source]]), baseSources: new Map() };
  assert.equal(evaluateKeelSafety({ ...common, nativeUnsafeReviews: [review] }).length, 1,
    "one reviewed occurrence cannot admit a second identical token context");
  assert.equal(evaluateKeelSafety({ ...common, nativeUnsafeReviews: [{ ...review, sites: [{ ...site, count: 2 }] }] }).length, 0,
    "only the explicitly reviewed multiplicity is admitted");
  for (const invalid of [
    null, {}, { ...review, repo: "unknown" }, { ...review, file: "tests/**/counter.rs" },
    { ...review, file: "src/counter.rs" }, { ...review, sourceSha256: "not-a-digest" },
    { ...review, sites: [] }, { ...review, sites: [site, site] },
    ...[0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1].map(count => ({ ...review, sites: [{ ...site, count }] })),
    { ...review, sites: [{ ...site, reason: "" }] }, { ...review, sites: [{ ...site, nativeEvidence: "" }] },
    { ...review, sites: [{ ...site, bodySha256: "not-a-digest" }] },
  ]) assert.throws(() => evaluateKeelSafety({ ...common, nativeUnsafeReviews: [invalid] }), /[Nn]ative safety/u);
  assert.throws(() => evaluateKeelSafety({ ...common, nativeUnsafeReviews: [review, review] }), /Duplicate native safety/u);
  assert.throws(() => evaluateKeelSafety({ ...common, nativeUnsafeReviews: null }), /Native safety/u);
});

test("AC12 native review data does not admit unchecked assertions, suppressions or tracked analysis", () => {
  const file = "src/analysis/value.ts";
  const model = keelFixtureModel([[file, "export function value(input: unknown): unknown { return input as any; }"]]);
  const result = evaluateKeelSafety({ repo: "rust-runtime", trackedFiles: ["nested/.analysis/notes.json"],
    currentSources: new Map([["tests/helpers/other.rs", "// @ts-ignore\nunsafe { extra(); }"]]),
    baseSources: new Map(), currentModel: model, nativeUnsafeReviews: keelOwnedNativeUnsafeReviews });
  for (const reason of ["unchecked any", "suppression", "ignored and untracked", "unsafe site"]) {
    assert.equal(keelFixtureHas(result, "AC12", reason), true, `${reason}: the exact native contract changes no other safety gate`);
  }
});

test("AC12 assertion lineage is exact and counted within a repo, not inferred from physical filenames", () => {
  const source = "export function value(input: unknown): unknown { return input as any; }";
  const base = "src/source/value.ts";
  const moved = "src/analysis/value.ts";
  const common = { repo: "tsonic", trackedFiles: [], currentSources: new Map(), baseSources: new Map(),
    baseModel: keelFixtureModel([[base, source]]) };
  assert.equal(evaluateKeelSafety({ ...common, currentModel: keelFixtureModel([[moved, source]]) }).length, 0);
  assert.equal(evaluateKeelSafety({ ...common, currentModel: keelFixtureModel([[base, source], [moved, source]]) }).length, 1);
});

test("the exact violation baseline shrinks monotonically and cannot hide new, renamed or tampered findings", () => {
  const origin = { manifestSha256: keelDigest("owned contracts"), pins: { tsonic: "a".repeat(40) } };
  const first = keelFinding("AC2", "tsonic-rust", "src/backend/planner/expressions/plan.ts", "plan", "Known boundary", { offset: 10 });
  const second = keelFinding("AC3", "tsonic-csharp", "src/backend/planner/expressions/plan.ts", "plan", "Known mutation", { offset: 20 });
  const inventory = createKeelViolationInventory([first, second], origin);
  const initial = evaluateKeelViolationInventory([first, second], inventory, origin.manifestSha256);
  assert.equal(initial.newViolations.length, 0);
  const shrunk = evaluateKeelViolationInventory([first], inventory);
  assert.deepEqual(shrunk.removedViolations.map(row => row.id), [second.id]);
  assert.deepEqual(shrunk.inventory.violations.map(row => row.id), [first.id]);
  assert.equal(evaluateKeelViolationInventory([first, second], shrunk.inventory).newViolations.length, 1);
  const mutated = keelFinding("AC2", "tsonic-rust", first.file, first.subject, first.reason, { offset: 11 });
  assert.equal(evaluateKeelViolationInventory([mutated], inventory).newViolations.length, 1);
  assert.throws(() => evaluateKeelViolationInventory([first], inventory, keelDigest("changed contracts")), /contracts changed/u);
  for (const changed of [
    { ...inventory, rules: keelCheckIds.slice(1) },
    { ...inventory, origin: { ...origin, manifestSha256: "invalid" } },
    { ...inventory, violations: [first, first] },
    { ...inventory, violations: [{ ...first, file: "src/*" }] },
    { ...inventory, violations: [{ ...first, reason: "A broad new waiver" }] },
  ]) assert.throws(() => validateKeelViolationInventory(changed), /Invalid|fingerprint/u);
});

function diagnosticFindings(repo, source) {
  const producer = "src/analysis/program/diagnostics.ts";
  const planner = "src/backend/planner/expressions/plan.ts";
  const model = keelFixtureModel([
    [producer, "export function diagnostic(value: string): void {} export function otherDiagnostic(value: string): void {}"],
    ["src/backend/planner/expressions/marker.ts", "export const marker = 1;"],
    [planner, source],
  ]);
  return evaluateKeelLayers(repo, model, {
    diagnosticCalls: ["diagnostic", "otherDiagnostic"].map(symbol => ({ file: producer, symbol })),
  }).filter(finding => finding.check === "AC4");
}

for (const repo of ["tsonic-csharp", "tsonic-rust"]) {
  const source = 'import { diagnostic } from "../../../analysis/program/diagnostics.js";\nexport function plan(): void { diagnostic("known"); }';
  const origin = { manifestSha256: keelDigest("owned contracts"), pins: { [repo]: "a".repeat(40) } };

  test(`${repo}: checked-site relocation preserves exact original allowances after unrelated comments and imports`, () => {
    const previous = diagnosticFindings(repo, source);
    assert.equal(previous.length, 1);
    assert.equal(previous[0].evidence.kind, "call");
    assert.match(previous[0].evidence.bodySha256, /^[a-f0-9]{64}$/u);
    const inventory = createKeelViolationInventory(previous, origin);
    for (const prefix of ["// An unrelated comment.\n", 'import { marker } from "./marker.js";\n']) {
      const current = diagnosticFindings(repo, prefix + source);
      assert.equal(current.length, 1);
      assert.notEqual(current[0].id, previous[0].id);
      assert.notEqual(current[0].evidence.offset, previous[0].evidence.offset);
      assert.equal(current[0].evidence.bodySha256, previous[0].evidence.bodySha256);
      assert.equal(current[0].evidence.target, previous[0].evidence.target);
      const comparison = evaluateKeelViolationInventory(current, inventory);
      assert.equal(comparison.newViolations.length, 0);
      assert.equal(comparison.removedViolations.length, 0);
      assert.deepEqual(comparison.relocatedViolations, [{ originalId: previous[0].id, currentId: current[0].id }]);
      assert.equal(comparison.inventory.violations[0] === inventory.violations[0], true);
      assert.equal(comparison.inventory.origin === origin, true);
      assert.deepEqual(comparison.inventory, inventory);
      assert.equal(evaluateKeelViolationInventory(current, comparison.inventory).newViolations.length, 0);
      const retired = evaluateKeelViolationInventory([], comparison.inventory).inventory;
      assert.equal(evaluateKeelViolationInventory(current, retired).newViolations.length, 1);
    }
  });

  test(`${repo}: checked-site accounting consumes every original once and reserves exact matches before relocations`, () => {
    const duplicated = source.replace('diagnostic("known");', 'diagnostic("known"); diagnostic("known");');
    const previous = diagnosticFindings(repo, duplicated);
    assert.equal(previous.length, 2);
    assert.equal(previous[0].evidence.bodySha256, previous[1].evidence.bodySha256);
    const exactAllowance = createKeelViolationInventory([previous[1]], origin);
    for (const current of [previous, [...previous].reverse()]) {
      const comparison = evaluateKeelViolationInventory(current, exactAllowance);
      assert.deepEqual(comparison.newViolations.map(finding => finding.id), [previous[0].id]);
      assert.equal(comparison.relocatedViolations.length, 0);
      assert.equal(comparison.inventory.violations[0] === previous[1], true);
    }
    const inventory = createKeelViolationInventory(previous, origin);
    const relocated = diagnosticFindings(repo, "// Moved together.\n" + duplicated);
    const retained = evaluateKeelViolationInventory(relocated, inventory);
    assert.equal(retained.newViolations.length, 0);
    assert.equal(retained.relocatedViolations.length, 2);
    assert.equal(new Set(retained.relocatedViolations.map(entry => entry.originalId)).size, 2);
    assert.equal(new Set(retained.relocatedViolations.map(entry => entry.currentId)).size, 2);
    const extra = diagnosticFindings(repo, "// Moved together.\n" + duplicated.replace('diagnostic("known");', 'diagnostic("known"); diagnostic("known");'));
    assert.equal(extra.length, 3);
    const added = evaluateKeelViolationInventory(extra, inventory);
    assert.equal(added.newViolations.length, 1);
    assert.equal(added.relocatedViolations.length, 2);
    assert.equal(added.inventory.violations.length, 2);
  });

  test(`${repo}: checked anonymous callable relocations preserve every exact obligation once`, () => {
    const anonymous = 'import { diagnostic } from "../../../analysis/program/diagnostics.js";\n' +
      'export function plan(): void { [1, 2].forEach(() => { diagnostic("known"); }); }';
    const previous = diagnosticFindings(repo, anonymous);
    assert.equal(previous.length, 1);
    assert.match(previous[0].subject, /<ArrowFunction@[0-9]+>/u);
    const inventory = createKeelViolationInventory(previous, origin);
    const current = diagnosticFindings(repo, "// An unrelated import-sized prefix.\n" + anonymous);
    assert.notEqual(current[0].subject, previous[0].subject);
    assert.equal(current[0].evidence.bodySha256, previous[0].evidence.bodySha256);
    const comparison = evaluateKeelViolationInventory(current, inventory);
    assert.equal(comparison.newViolations.length, 0);
    assert.equal(comparison.relocatedViolations.length, 1);
    assert.equal(comparison.inventory.violations[0] === previous[0], true);
    const duplicated = diagnosticFindings(repo, "// Same exact syntax, but two obligations.\n" +
      anonymous.replace('[1, 2].forEach(() => { diagnostic("known"); });',
        '[1, 2].forEach(() => { diagnostic("known"); }); [1, 2].forEach(() => { diagnostic("known"); });'));
    const added = evaluateKeelViolationInventory(duplicated, inventory);
    assert.equal(added.relocatedViolations.length, 1);
    assert.equal(added.newViolations.length, 1);
    for (const changed of [anonymous.replace("function plan", "function other"),
      anonymous.replace('"known"', '"changed"'),
      anonymous.replace("{ diagnostic }", "{ otherDiagnostic as diagnostic }")]) {
      assert.equal(evaluateKeelViolationInventory(diagnosticFindings(repo, changed), inventory).newViolations.length, 1);
    }
  });

  test(`${repo}: changed checked syntax, target and lexical owner remain new obligations`, () => {
    const previous = diagnosticFindings(repo, source);
    const inventory = createKeelViolationInventory(previous, origin);
    for (const currentSource of [
      source.replace('"known"', '"changed"'),
      source.replace("{ diagnostic }", "{ otherDiagnostic as diagnostic }"),
      source.replace("function plan", "function renamedPlan"),
    ]) {
      const current = diagnosticFindings(repo, "// Changed source.\n" + currentSource);
      assert.equal(current.length, 1);
      const comparison = evaluateKeelViolationInventory(current, inventory);
      assert.equal(comparison.newViolations.length, 1);
      assert.equal(comparison.relocatedViolations.length, 0);
      assert.equal(comparison.removedViolations.length, 1);
      assert.equal(comparison.inventory.violations.length, 0);
    }
  });
}

test("site relocation requires valid exact syntax proof and retains every non-offset identity and evidence field", () => {
  const origin = { manifestSha256: keelDigest("owned contracts"), pins: { tsonic: "a".repeat(40) } };
  const evidence = { bodySha256: keelDigest("checked site"), offset: 10, kind: "call", target: "src/owner.ts#read", role: "syntax", proof: { scope: "closed" } };
  const previous = keelFinding("AC4", "tsonic-rust", "src/backend/planner/plan.ts", "plan", "Known boundary", evidence);
  const inventory = createKeelViolationInventory([previous], origin);
  for (const changed of [
    { ...evidence, bodySha256: undefined }, { ...evidence, bodySha256: "f".repeat(63) },
    { ...evidence, bodySha256: "g".repeat(64) }, { ...evidence, bodySha256: 1 },
    { ...evidence, bodySha256: keelDigest("changed site") },
    { ...evidence, target: undefined }, { ...evidence, target: "src/other.ts#read" },
    { ...evidence, kind: undefined }, { ...evidence, kind: "access" },
    { ...evidence, role: "analysis" }, { ...evidence, proof: { scope: "open" } },
    { ...evidence, offset: undefined }, { ...evidence, offset: -1 }, { ...evidence, offset: 1.5 },
    { ...evidence, offset: Number.MAX_SAFE_INTEGER + 1 },
  ]) {
    const current = keelFinding(previous.check, previous.repo, previous.file, previous.subject, previous.reason,
      { ...changed, ...(changed.offset === evidence.offset ? { offset: 20 } : {}) });
    assert.equal(evaluateKeelViolationInventory([current], inventory).newViolations.length, 1);
  }
  for (const changes of [
    { check: "AC2" }, { repo: "tsonic-csharp" }, { file: "src/backend/planner/other.ts" },
    { subject: "other" }, { reason: "Changed boundary" },
  ]) {
    const changed = { ...previous, ...changes };
    const current = keelFinding(changed.check, changed.repo, changed.file, changed.subject, changed.reason, { ...evidence, offset: 20 });
    assert.equal(evaluateKeelViolationInventory([current], inventory).newViolations.length, 1);
  }
  const offsetOnly = keelFinding(previous.check, previous.repo, previous.file, previous.subject, previous.reason, { offset: 10 });
  const offsetOnlyMoved = keelFinding(previous.check, previous.repo, previous.file, previous.subject, previous.reason, { offset: 20 });
  assert.equal(evaluateKeelViolationInventory([offsetOnlyMoved], createKeelViolationInventory([offsetOnly], origin)).newViolations.length, 1);
  for (const unproven of [
    { ...evidence, bodySha256: undefined }, { ...evidence, bodySha256: "not-a-digest" },
    { ...evidence, offset: undefined }, { ...evidence, offset: -1 },
  ]) {
    const original = keelFinding(previous.check, previous.repo, previous.file, previous.subject, previous.reason, unproven);
    const current = keelFinding(previous.check, previous.repo, previous.file, previous.subject, previous.reason, { ...unproven, offset: 20 });
    assert.equal(evaluateKeelViolationInventory([current], createKeelViolationInventory([original], origin)).newViolations.length, 1);
  }
  assert.throws(() => evaluateKeelViolationInventory([{ ...previous, reason: "Tampered without fingerprint" }], inventory), /fingerprint/u);
  assert.throws(() => evaluateKeelViolationInventory([previous, previous], inventory), /duplicate/u);
});
