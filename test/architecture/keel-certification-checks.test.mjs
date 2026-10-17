import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  createKeelViolationInventory, evaluateKeelDeterminism, evaluateKeelSafety,
  evaluateKeelViolationInventory, guardSucceeded, validateKeelViolationInventory,
} from "./tooling/keel-certification-checks.mjs";
import { keelCheckIds, keelFinding, keelWorkspaceRepositories } from "./tooling/keel-contract.mjs";
import { keelDigest } from "./tooling/keel-source-analysis.mjs";
import { keelNativeTokens, keelNativeUnsafeSites } from "./tooling/keel-native-tokens.mjs";
import { keelFixtureGeneration, keelFixtureGuard, keelFixtureHas, keelFixtureModel } from "./tooling/keel-test-fixtures.mjs";
import { evaluateKeelLayers } from "./tooling/keel-layer-checks.mjs";

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

test("AC11 guard proof requires finite aggregate limits, zero swap, no OOM and a drained scope", () => {
  assert.equal(guardSucceeded(keelFixtureGuard()), true);
  assert.equal(guardSucceeded(keelFixtureGuard({ log: "/home/gorge/workspace/.temp/test-runs/actual.log", oomBefore: 1, oomAfter: 1 })), true);
  for (const overrides of [
    { exitCode: 1 }, { swapMax: 1 }, { calibration: true }, { scopeDrained: false },
    { scopeResult: "oom-kill" }, { oomAfter: 1 }, { oomBefore: null },
    { memoryMiB: Infinity }, { timeoutSeconds: 0 }, { tasksMax: -1 },
    { logMaxBytes: Number.MAX_VALUE }, { budget: { workers: 1, childJobs: 2, cpuBudget: 3, memoryMiB: 1 } },
    { budget: { workers: 0, childJobs: 2, cpuBudget: 3, memoryMiB: 7168 } },
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
    firstGuard: { ...samples[0].firstGuard, exitCode: 1, scopeResult: "exit-code" },
    secondGuard: { ...samples[0].secondGuard, exitCode: 1, scopeResult: "exit-code" } };
  const check = candidate => evaluateKeelDeterminism([candidate, ...samples.slice(1)], [requirement, ...programs.slice(1)]);
  assert.equal(check(proof).length, 0);
  for (const changed of [
    { ...proof, first: samples[0].first },
    { ...proof, firstRejection: undefined },
    { ...proof, secondRejection: { ...observation, nativeProgramCompilationInvoked: true } },
    { ...proof, secondRejection: { ...observation, diagnostics: [{ ...diagnostic, message: "Changed diagnostic." }] } },
    { ...proof, firstGuard: undefined },
    { ...proof, firstGuard: { ...proof.firstGuard, exitCode: 0 } },
  ]) assert.equal(keelFixtureHas(check(changed), "AC11"), true);
  assert.equal(keelFixtureHas(evaluateKeelDeterminism([proof, ...samples.slice(1)], programs), "AC11", "nonempty"), true);
});

test("AC12 uses checked assertion/directive syntax, preserves existing occurrences, and counts additions", () => {
  const file = "src/analysis/program/value.ts";
  const previous = "export function value(input: unknown): unknown { return input as any; }";
  const baseModel = keelFixtureModel([[file, previous]]);
  const common = { repo: "tsonic", trackedFiles: [], currentSources: new Map(), baseSources: new Map(), baseModel, workspaceInputs: nativeBoundaryInputs() };
  assert.equal(evaluateKeelSafety({ ...common, currentModel: baseModel }).findings.length, 0);
  const changed = `${previous}\nexport function extra(input: unknown): unknown { return input as any; }`;
  assert.equal(evaluateKeelSafety({ ...common, currentModel: keelFixtureModel([[file, changed]]) }).findings.filter(row => row.check === "AC12").length, 1);
  for (const source of [
    'const text = "as any @ts-ignore"; export function value(input: unknown): unknown { return input; }',
    '/* an example of as any */ export function value(input: unknown): unknown { return input; }',
  ]) assert.equal(evaluateKeelSafety({ ...common, currentModel: keelFixtureModel([[file, source]]) }).findings.length, 0);
  const suppressed = "// @ts-ignore\nexport const value: number = 'not a number';";
  assert.equal(keelFixtureHas(evaluateKeelSafety({ ...common, currentModel: keelFixtureModel([[file, suppressed]]) }).findings, "AC12", "suppression"), true);
  const preserved = keelFixtureModel([[file, suppressed]]);
  assert.equal(evaluateKeelSafety({ ...common, baseModel: preserved, currentModel: preserved }).findings.length, 0);
  assert.equal(keelFixtureHas(evaluateKeelSafety({ ...common, trackedFiles: [".analysis/private.json"], currentModel: baseModel }).findings, "AC12", "ignored and untracked"), true);
});

for (const [repo, file] of [["rust-runtime", "src/lib.rs"], ["csharp-runtime", "src/Runtime.cs"]]) {
  test(`${repo}: AC12 rejects added unsafe sites and does not mistake literal/comment text for unsafe`, () => {
    const previous = "unsafe { existing(); }";
    const sources = { repo, trackedFiles: [], currentSources: new Map([[file, previous]]), baseSources: new Map([[file, previous]]), workspaceInputs: nativeBoundaryInputs() };
    assert.equal(evaluateKeelSafety(sources).findings.length, 0);
    sources.currentSources.set(file, `${previous}\nunsafe { additional(); }`);
    assert.equal(keelFixtureHas(evaluateKeelSafety(sources).findings, "AC12", "unsafe site"), true);
    sources.currentSources.set(file, '/* unsafe { not_code(); } */ const text = "unsafe";');
    assert.equal(evaluateKeelSafety(sources).findings.length, 0);
  });
  test(`${repo}: AC12 preserves moved unchanged safety tokens and rejects a copied duplicate`, () => {
    const previous = "unsafe { existing(); }";
    const moved = file.replace("src/", "src/owned/");
    const sources = { repo, trackedFiles: [], currentSources: new Map([[moved, previous]]), baseSources: new Map([[file, previous]]), workspaceInputs: nativeBoundaryInputs() };
    assert.equal(evaluateKeelSafety(sources).findings.length, 0);
    sources.currentSources.set(file, previous);
    assert.equal(evaluateKeelSafety(sources).findings.filter(row => row.check === "AC12").length, 1);
  });
}

test("AC12 assertion lineage is exact and counted within a repo, not inferred from physical filenames", () => {
  const source = "export function value(input: unknown): unknown { return input as any; }";
  const base = "src/source/value.ts";
  const moved = "src/analysis/value.ts";
  const common = { repo: "tsonic", trackedFiles: [], currentSources: new Map(), baseSources: new Map(),
    baseModel: keelFixtureModel([[base, source]]), workspaceInputs: nativeBoundaryInputs() };
  assert.equal(evaluateKeelSafety({ ...common, currentModel: keelFixtureModel([[moved, source]]) }).findings.length, 0);
  assert.equal(evaluateKeelSafety({ ...common, currentModel: keelFixtureModel([[base, source], [moved, source]]) }).findings.length, 1);
});

function nativeBoundaryInputs() {
  const inputs = new Map(keelWorkspaceRepositories.map(repo => [repo, new Map()]));
  inputs.get("rust-runtime").set("tests/helpers/allocation_counts.rs", safetyFile(readFileSync(
    new URL("../../../rust-runtime/tests/helpers/allocation_counts.rs", import.meta.url), "utf8")));
  inputs.get("tsonic-rust").set("test/helpers/native-ownership-cost.mjs", safetyFile(readFileSync(
    new URL("../../../tsonic-rust/test/helpers/native-ownership-cost.mjs", import.meta.url), "utf8")));
  inputs.get("rust-runtime").set("Cargo.toml", safetyFile('[[test]]\nname = "control"\npath = "tests/control.rs"\n'));
  inputs.get("rust-runtime").set("tests/control.rs", safetyFile('#[path = "helpers/allocation_counts.rs"] mod allocation_counts;'));
  return inputs;
}

function safetyFile(text, tracked = true) {
  return Object.freeze({ kind: "file", tracked, mode: "100644", sha256: keelDigest(text), text });
}

function boundarySafety(workspaceInputs = nativeBoundaryInputs(), currentSources, baseSources) {
  const path = "tests/helpers/allocation_counts.rs";
  const text = nativeBoundaryInputs().get("rust-runtime").get(path).text;
  let inherited = text;
  const sites = keelNativeTokens(text).filter(token => token.kind === "identifier" && token.text === "unsafe");
  for (const [index, token] of [...sites.entries()].reverse()) {
    if (index !== 7) inherited = inherited.slice(0, token.offset) + inherited.slice(token.offset + token.text.length);
  }
  return evaluateKeelSafety({ repo: "rust-runtime", trackedFiles: [path], workspaceInputs,
    currentSources: currentSources ?? new Map([[path, workspaceInputs.get("rust-runtime")?.get(path)?.text ?? text]]),
    baseSources: baseSources ?? new Map([["tests/old-observer.rs", inherited]]),
  });
}

test("NS-T01: C67 pins the full module and nine windows, accounting exactly eight original raw findings", () => {
  const result = boundarySafety();
  assert.equal(result.findings.length, 0);
  const boundary = result.nativeAllocationBoundary;
  assert.equal(boundary === undefined, false, "canonical boundary exists");
  assert.equal(boundary.approvalId, "C-0067/Q-109");
  assert.equal(boundary.boundaryId, "TEST-ALLOCATOR");
  assert.equal(boundary.repo, "rust-runtime");
  assert.equal(boundary.path, "tests/helpers/allocation_counts.rs");
  assert.equal(boundary.sourceSha256, "51b161241b9b6d49690154c9ab0506b671d1546075a7a81c5ee45335f9b48dc5");
  assert.equal(boundary.reviewedUnsafeCount, 9);
  const source = nativeBoundaryInputs().get("rust-runtime").get(boundary.path).text;
  const expected = keelNativeUnsafeSites(source).filter((_site, index) => index !== 7).map(site =>
    keelFinding("AC12", "rust-runtime", boundary.path, "native safety", "A new native unsafe site is forbidden.", { bodySha256: keelDigest(site) }).id);
  assert.equal(boundary.accountedAdditions.length, 8);
  assert.deepEqual(boundary.accountedAdditions.map(finding => finding.id).sort(), expected.sort());
  assert.equal(Object.isFrozen(boundary) && Object.isFrozen(boundary.accountedAdditions), true);
  assert.match(boundary.workspaceInputsSha256, /^[a-f0-9]{64}$/u);
});

test("NS-T02: an unsafe addition anywhere in the exact module grants zero approved additions", () => {
  const inputs = nativeBoundaryInputs();
  const path = "tests/helpers/allocation_counts.rs";
  inputs.get("rust-runtime").set(path, safetyFile(`${inputs.get("rust-runtime").get(path).text}\nunsafe fn unreviewed() {}\n`));
  const result = boundarySafety(inputs);
  assert.equal(result.nativeAllocationBoundary === undefined, true, "extra unsafe invalidates approval");
  assert.equal(keelFixtureHas(result.findings, "AC12", "nine reviewed"), true);
  assert.equal(result.findings.filter(finding => finding.subject === "native safety").length, 9);
});

test("NS-T03: forwarding changes fail the complete digest even when the nine unsafe windows match", () => {
  const path = "tests/helpers/allocation_counts.rs";
  const original = nativeBoundaryInputs().get("rust-runtime").get(path).text;
  const changed = original.replace("System.realloc(pointer, layout, size)", "System.realloc(pointer, layout, size + 1)");
  assert.equal(changed !== original, true, "the actual forwarding argument is changed");
  assert.deepEqual(keelNativeUnsafeSites(changed), keelNativeUnsafeSites(original));
  const inputs = nativeBoundaryInputs();
  inputs.get("rust-runtime").set(path, safetyFile(changed));
  const result = boundarySafety(inputs);
  assert.equal(result.nativeAllocationBoundary === undefined, true, "forwarding is fully pinned");
  assert.equal(result.findings.filter(finding => finding.subject === "native safety").length, 8);
});

test("NS-T04: second tracked implementations and symlink aliases never acquire canonical permission", () => {
  for (const [repo, path, symlink] of [
    ["rust-runtime", "tests/copy.rs", false], ["rust-js", "tests/copied.rs", false],
    ["tsonic-rust", "src/copy.bin", false], ["rust-runtime", "tests/alias.rs", true],
    ["rust-js", "src/alias.rs", true],
  ]) {
    const inputs = nativeBoundaryInputs();
    const source = inputs.get("rust-runtime").get("tests/helpers/allocation_counts.rs");
    inputs.get(repo).set(path, symlink ? Object.freeze({ kind: "symlink", mode: "120000", tracked: true,
      target: repo === "rust-runtime" ? "helpers/allocation_counts.rs" : "../../rust-runtime/tests/helpers/allocation_counts.rs" }) : source);
    const result = boundarySafety(inputs);
    assert.equal(result.nativeAllocationBoundary === undefined, true, `${repo}/${path}`);
    assert.equal(keelFixtureHas(result.findings, "AC12", symlink ? "symlink" : "second tracked"), true, `${repo}/${path}`);
  }
});

test("NS-T05: unchanged direct, cross-repo, package and computed first-party test entries fail closed", () => {
  const cases = [
    [["rust-runtime", "src/lib.rs", '#[path = "../tests/helpers/allocation_counts.rs"] mod allocator;']],
    [["csharp-runtime", "src/Emitter.cs", 'class Emitter { string Source() { return System.IO.File.ReadAllText("../../rust-runtime/tests/helpers/allocation_counts.rs"); } }']],
    [["rust-js", "src/lib.rs", 'include!("../../rust-runtime/tests/helpers/allocation_counts.rs");']],
    [["rust-runtime", "lib.rs", 'mod tests;'], ["rust-runtime", "tests/mod.rs", '#[path = "helpers/allocation_counts.rs"] mod observed;']],
    [["rust-runtime", "src/lib.rs", 'include!("/native-workspace/rust-runtime/tests/helpers/allocation_counts.rs");']],
    [["rust-runtime", "Cargo.toml", '[lib]\npath = "tests/control.rs"']],
    [["rust-runtime", "Cargo.toml", '[package]\nname = "control"\nbuild = "tests/control.rs"']],
    [["tsonic-rust", "src/emitter.mjs", 'import { nativeAllocationSupport } from "../test/helpers/native-ownership-cost.mjs";']],
    [["rust-js", "src/bridge.mjs", 'export { nativeAllocationSupport } from "../../tsonic-rust/test/helpers/native-ownership-cost.mjs";'],
      ["tsonic-rust", "src/emitter.mjs", 'import { nativeAllocationSupport } from "../../rust-js/src/bridge.mjs";']],
    [["rust-js", "package.json", '{"name":"@control/bridge","exports":{".":"./test/bridge.mjs"}}']],
    [["rust-js", "package.json", '{"name":"@control/bridge","exports":{"./*":"./*"}}'],
      ["rust-js", "test/bridge.mjs", 'export const bridge = 1;']],
    [["tsonic-rust", "src/emitter.mjs", 'const suffix = process.env.SUFFIX; const path = new URL("../test/" + suffix, import.meta.url);']],
    [["tsonic-rust", "src/emitter.mjs", 'const encoded = process.env.ENTRY; const path = new URL(encoded, import.meta.url);']],
    [["rust-runtime", "src/lib.rs", 'include!(concat!(env!("CARGO_MANIFEST_DIR"), "/tests/control.rs"));']],
    [["rust-runtime", "src/lib.rs", '#[cfg(test)] #[path = "../tests/helpers/allocation_counts.rs"] mod observed;\n#[path = "../tests/helpers/allocation_counts.rs"] mod product;']],
    [["rust-runtime", "src/lib.rs", '#[cfg(test)] mod tests { #[path = "../tests/helpers/allocation_counts.rs"] mod observed; }\ninclude!("../tests/helpers/allocation_counts.rs");']],
  ];
  for (const [index, entries] of cases.entries()) {
    const inputs = nativeBoundaryInputs();
    for (const [repo, path, source] of entries) inputs.get(repo).set(path, safetyFile(source));
    const result = boundarySafety(inputs);
    assert.equal(result.nativeAllocationBoundary === undefined, true, `unchanged entry ${index}`);
    assert.equal(keelFixtureHas(result.findings, "AC12", "test-only cut"), true, `unchanged entry ${index}`);
    assert.equal(result.findings.filter(finding => finding.subject === "native safety").length, 8, `raw findings retained ${index}`);
  }
  for (const source of [
    '#[cfg(test)] #[path = "../tests/helpers/allocation_counts.rs"] mod observed; fn ordinary() {}',
    '#[cfg(test)] mod tests { { let value = 1; } #[path = "../tests/helpers/allocation_counts.rs"] mod observed; } fn ordinary() {}',
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("rust-runtime").set("src/lib.rs", safetyFile(source));
    assert.equal(boundarySafety(inputs).findings.length, 0, "genuine lexical cfg(test) enclosure");
  }
  const external = nativeBoundaryInputs();
  external.get("tsonic").set("packages/host/src/plugin.mjs", safetyFile(
    'import { pathToFileURL } from "node:url"; export async function load(entryPath) { return import(pathToFileURL(entryPath).href); }'));
  const result = boundarySafety(external);
  assert.equal(result.findings.length, 0);
  assert.equal(result.nativeAllocationBoundary.externalDynamicEntries.length, 1);
  assert.match(result.nativeAllocationBoundary.staticEntryCut, /arbitrary external dynamic IO is not proven/u);
});

test("NS-T06: complete inputs and the fixed source, owner and copy-writer identities are mandatory", () => {
  for (const kind of ["missing-source", "wrong-repo", "wrong-path", "untracked", "wrong-writer"]) {
    const inputs = nativeBoundaryInputs();
    const file = "tests/helpers/allocation_counts.rs";
    const source = inputs.get("rust-runtime").get(file);
    if (kind === "untracked") inputs.get("rust-runtime").set(file, { ...source, tracked: false });
    else if (kind === "wrong-writer") inputs.get("tsonic-rust").set("test/helpers/native-ownership-cost.mjs", safetyFile("export const wrong = 1;"));
    else {
      inputs.get("rust-runtime").delete(file);
      if (kind !== "missing-source") inputs.get(kind === "wrong-repo" ? "rust-js" : "rust-runtime")
        .set(kind === "wrong-path" ? "tests/wrong.rs" : file, source);
    }
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, kind);
  }
  assert.throws(() => boundarySafety(new Map()), /all 15 repositories/u);
  const incomplete = nativeBoundaryInputs();
  incomplete.get("rust-js").set("src/bridge.mjs", { kind: "file", tracked: true, mode: "100644", sha256: "0".repeat(64) });
  assert.throws(() => boundarySafety(incomplete), /Incomplete or inconsistent/u);
  const forged = nativeBoundaryInputs();
  forged.get("rust-runtime").set("tests/helpers/allocation_counts.rs", { ...forged.get("rust-runtime").get("tests/helpers/allocation_counts.rs"), text: "forged" });
  assert.throws(() => boundarySafety(forged), /Incomplete or inconsistent/u);
  const mismatch = boundarySafety(nativeBoundaryInputs(), new Map([["tests/helpers/allocation_counts.rs", "unsafe fn unreviewed() {}"]]));
  assert.equal(mismatch.nativeAllocationBoundary === undefined, true, "changed and complete source must agree");
  assert.equal(keelFixtureHas(mismatch.findings, "AC12", "snapshot"), true);
});

test("NS-T07: both physical-wait production unsafe blocks remain forbidden alongside C67", () => {
  const inputs = nativeBoundaryInputs();
  const result = evaluateKeelSafety({ repo: "rust-nodejs", trackedFiles: [], workspaceInputs: inputs,
    currentSources: new Map([["rust/crates/node/src/worker/physical_child.rs", "unsafe { unix_wait(); }\nunsafe { windows_wait(); }"]]),
    baseSources: new Map(),
  });
  assert.equal(result.findings.length, 2);
  assert.equal(result.findings.every(finding => finding.subject === "native safety"), true);
  assert.equal(result.nativeAllocationBoundary === undefined, true, "no product boundary");
  const removed = evaluateKeelSafety({ repo: "rust-nodejs", trackedFiles: [], workspaceInputs: inputs,
    currentSources: new Map([["rust/crates/node/src/worker/physical_child.rs", "safe_wait();"]]), baseSources: new Map() });
  assert.equal(removed.findings.length, 0);
  assert.equal(boundarySafety(inputs).nativeAllocationBoundary.accountedAdditions.length, 8);
});

test("NS-T08: unsafe text is not executable evidence, but canonical comments are still exact-source pinned", () => {
  const inputs = nativeBoundaryInputs();
  inputs.get("rust-runtime").set("tests/unrelated.rs", safetyFile('/* unsafe fn example() {} */ const TEXT: &str = "unsafe { demo(); }";'));
  assert.equal(boundarySafety(inputs).findings.length, 0);
  const path = "tests/helpers/allocation_counts.rs";
  const text = inputs.get("rust-runtime").get(path).text;
  inputs.get("rust-runtime").set(path, safetyFile(`${text}\n// Same executable allocator; changed immutable source.\n`));
  assert.deepEqual(keelNativeUnsafeSites(inputs.get("rust-runtime").get(path).text), keelNativeUnsafeSites(text));
  assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "canonical comments are pinned");
});

test("NS-T09: an ignored private test copy is not a second maintained source; a tracked copy is", () => {
  const inputs = nativeBoundaryInputs();
  const before = boundarySafety(inputs);
  const copy = inputs.get("rust-runtime").get("tests/helpers/allocation_counts.rs");
  inputs.get("tsonic-rust").set(".temp/private-test/allocation_counts.rs", { ...copy, tracked: false });
  const temporary = boundarySafety(inputs);
  assert.equal(temporary.findings.length, 0);
  assert.equal(temporary.nativeAllocationBoundary.sourceSha256, before.nativeAllocationBoundary.sourceSha256);
  inputs.get("tsonic-rust").set(".temp/private-test/allocation_counts.rs", copy);
  assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "a tracked copy is maintained");
});

test("NS-T10: full nine-window review does not grant a ninth or duplicated inherited credit", () => {
  const inputs = nativeBoundaryInputs();
  const path = "tests/helpers/allocation_counts.rs";
  const source = inputs.get("rust-runtime").get(path).text;
  const noCredit = boundarySafety(inputs, new Map([[path, source]]), new Map());
  assert.equal(noCredit.nativeAllocationBoundary.accountedAdditions.length, 8);
  assert.equal(noCredit.findings.length, 1);
  assert.equal(noCredit.findings[0].evidence.bodySha256, keelDigest(keelNativeUnsafeSites(source)[7]));
  const duplicate = "dealloc(pointer, layout) } } unsafe fn realloc(&self, pointer: *mut u8) {}";
  assert.equal(keelNativeUnsafeSites(duplicate)[0], keelNativeUnsafeSites(source)[7]);
  const spent = boundarySafety(inputs, new Map([["tests/duplicate-declaration.rs", duplicate], [path, source]]));
  assert.equal(spent.nativeAllocationBoundary.accountedAdditions.length, 8);
  assert.equal(spent.findings.length, 1);
  assert.equal(spent.findings[0].file, path);
  assert.equal(spent.findings[0].evidence.bodySha256, noCredit.findings[0].evidence.bodySha256);
  inputs.get("rust-runtime").set(path, safetyFile(source.replace("unsafe fn realloc", "fn realloc")));
  assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "missing ninth window invalidates proof");
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
