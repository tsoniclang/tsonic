import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { globSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join, posix } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createKeelViolationInventory, evaluateKeelDeterminism, evaluateKeelSafety,
  evaluateKeelViolationInventory, guardSucceeded, validateKeelViolationInventory,
} from "./tooling/keel-certification-checks.mjs";
import { keelSafetyBuiltModuleEntries, keelSafetyNativeTestGlobs } from "./tooling/keel-native-allocation-boundary.mjs";
import { captureKeelPackageOwners, createKeelPackageExposures, keelPackageBuildResources } from "./tooling/keel-package-exposures.mjs";
import { scriptSourceReferences } from "./tooling/keel-script-entries.mjs";
import { readKeelNodeArguments } from "./tooling/keel-node-executions.mjs";
import { keelCheckIds, keelFinding, keelWorkspaceRepositories, validLiteralFilePath, validPath } from "./tooling/keel-contract.mjs";
import { keelDigest } from "./tooling/keel-source-analysis.mjs";
import { keelNativeTokens, keelNativeUnsafeSites } from "./tooling/keel-native-tokens.mjs";
import { keelFixtureGeneration, keelFixtureGuard, keelFixtureHas, keelFixtureModel } from "./tooling/keel-test-fixtures.mjs";
import { evaluateKeelLayers } from "./tooling/keel-layer-checks.mjs";
import { readKeelNodeModuleRegistry } from "./tooling/keel-node-registry.mjs";

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
  for (const [label, entries] of [
    ["two-hop alias", [["src/first.rs", "../tests/second.rs"], ["tests/second.rs", "helpers/allocation_counts.rs"]]],
    ["directory alias", [["src/alias", "../tests/helpers"]]],
    ["cycle", [["src/first.rs", "second.rs"], ["src/second.rs", "first.rs"]]],
    ["growing cycle", [["src/alias", "alias/nested"]]],
    ["missing target", [["src/first.rs", "missing.rs"]]],
    ["outside snapshot", [["src/first.rs", "../../../outside.rs"]]],
    ["absolute target", [["src/first.rs", "/outside.rs"]]],
  ]) {
    const inputs = nativeBoundaryInputs();
    for (const [path, target] of entries) inputs.get("rust-runtime").set(path,
      Object.freeze({ kind: "symlink", mode: "120000", tracked: true, target }));
    const result = boundarySafety(inputs);
    assert.equal(result.nativeAllocationBoundary === undefined, true, label);
    assert.equal(keelFixtureHas(result.findings, "AC12", "symlink"), true, label);
  }
});

test("NS-T05: unchanged direct, cross-repo, package and computed first-party test entries fail closed", () => {
  const cases = [
    [["rust-runtime", "src/lib.rs", '#[path = "../tests/helpers/allocation_counts.rs"] mod allocator;']],
    [["rust-js", "src/lib.rs", 'include!("../../rust-runtime/tests/helpers/allocation_counts.rs");']],
    [["rust-runtime", "lib.rs", 'mod tests;'], ["rust-runtime", "tests/mod.rs", '#[path = "helpers/allocation_counts.rs"] mod observed;']],
    [["rust-runtime", "src/lib.rs", 'include!("/native-workspace/rust-runtime/tests/helpers/allocation_counts.rs");']],
    [["rust-runtime", "Cargo.toml", '[lib]\npath = "tests/control.rs"']],
    [["rust-runtime", "Cargo.toml", '[package]\nname = "control"\nbuild = "tests/control.rs"']],
    [["tsonic-rust", "src/emitter.mjs", 'import { nativeAllocationSupport } from "../test/helpers/native-ownership-cost.mjs";']],
    [["rust-js", "src/bridge.mjs", 'export { nativeAllocationSupport } from "../../tsonic-rust/test/helpers/native-ownership-cost.mjs";'],
      ["tsonic-rust", "src/emitter.mjs", 'import { nativeAllocationSupport } from "../../rust-js/src/bridge.mjs";']],
    [["tsonic-rust", "package.json", '{"name":"@control/bridge","exports":{".":"./test/bridge.test.mjs"}}'],
      ["tsonic-rust", "test/bridge.test.mjs", 'import test from "node:test"; import { nativeAllocationSupport } from "./helpers/native-ownership-cost.mjs"; test("cost", () => nativeAllocationSupport("private"));']],
    [["tsonic-rust", "package.json", '{"name":"@control/bridge","exports":{"./*":"./*"}}'],
      ["tsonic-rust", "test/bridge.test.mjs", 'import test from "node:test"; import { nativeAllocationSupport } from "./helpers/native-ownership-cost.mjs"; test("cost", () => nativeAllocationSupport("private"));']],
    [["tsonic-rust", "src/emitter.mjs", 'const suffix = process.env.SUFFIX; await import(new URL("../test/" + suffix, import.meta.url).href);']],
    [["tsonic-rust", "src/emitter.mjs", 'const encoded = process.env.ENTRY; await import(new URL(encoded, import.meta.url).href);']],
    [["tsonic-rust", "src/emitter.mjs", 'export const incomplete = ;']],
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
  const declaration = nativeBoundaryInputs();
  declaration.get("tsts-legacy").set("packages/tsts/tools/accepted.d.ts", safetyFile(
    'Generated declaration baseline\nexport declare const value: number;\nfile.ts(1,1): error TS0000: expected diagnostic transcript.'));
  assert.equal(boundarySafety(declaration).findings.length, 0, "formal declaration inputs do not execute source includes or IO");
});

test("QRC-07: the existing physical edges close transitive test bridges before every incoming promotion", () => {
  const chainInputs = (cycle = false, reverse = false) => {
    const inputs = nativeBoundaryInputs();
    const entries = [
      ["test/observed.test.mjs", 'import test from "node:test"; export { nativeAllocationSupport } from "./helpers/native-ownership-cost.mjs";'],
      ["test/bridge.test.mjs", 'import test from "node:test"; export { nativeAllocationSupport } from "./observed.test.mjs";'],
    ];
    if (cycle) entries[0][1] += '\nimport "./bridge.test.mjs";';
    for (const [path, source] of reverse ? entries.toReversed() : entries) inputs.get("tsonic-rust").set(path, safetyFile(source));
    return inputs;
  };
  for (const cycle of [false, true]) {
    for (const reverse of [false, true]) {
      const accepted = boundarySafety(chainInputs(cycle, reverse));
      assert.equal(accepted.findings.length, 0, `test-only chain, cycle=${cycle}, reverse=${reverse}`);
      assert.equal(accepted.nativeAllocationBoundary.consumers.filter(consumer => consumer.kind === "Node test writer consumer").length,
        1, "transitive closure does not invent another direct writer consumer");
      const product = chainInputs(cycle, reverse);
      product.get("tsonic-rust").set("src/product.mjs", safetyFile('import { nativeAllocationSupport } from "../test/bridge.test.mjs"; export function prepare(root) { return nativeAllocationSupport(root); }'));
      const result = boundarySafety(product);
      assert.equal(result.nativeAllocationBoundary === undefined, true, `product chain, cycle=${cycle}, reverse=${reverse}`);
      assert.equal(result.findings.some(finding => finding.file === "src/product.mjs" && finding.reason.includes("module inclusion")),
        true, "the actual incoming product edge is rejected, not merely an unrelated fixture");
      assert.equal(result.findings.filter(finding => finding.subject === "native safety").length, 8, "transitive promotion grants no unsafe credit");
    }
  }
  for (const source of [
    'export * from "../test/bridge.test.mjs";',
    'await import("../test/bridge.test.mjs");',
    'const root = new URL("../test/", import.meta.url); const load = entry => import(new URL(entry, root).href); load("bridge.test.mjs");',
    'import { createRequire } from "node:module"; const require = createRequire(import.meta.url); require("../test/bridge.test.mjs");',
    'import { Worker } from "node:worker_threads"; new Worker(new URL("../test/bridge.test.mjs", import.meta.url));',
    'import { fork } from "node:child_process"; fork(new URL("../test/bridge.test.mjs", import.meta.url), [], { execArgv: [] });',
    'import { spawn } from "node:child_process"; spawn(process.execPath, [new URL("../test/bridge.test.mjs", import.meta.url).href]);',
  ]) {
    const inputs = chainInputs();
    inputs.get("tsonic-rust").set("src/promotion.mjs", safetyFile(source));
    const result = boundarySafety(inputs);
    assert.equal(result.nativeAllocationBoundary === undefined, true, source);
    assert.equal(result.findings.some(finding => finding.file === "src/promotion.mjs" && finding.reason.includes("test-only cut")), true, source);
  }
  for (const metadata of [
    { main: "./test/bridge.test.mjs" }, { bin: { control: "./test/bridge.test.mjs" } },
    { exports: { ".": "./test/bridge.test.mjs" } }, { exports: { "./*": "./test/*" } },
    { imports: { "#entry": "./test/bridge.test.mjs" } },
  ]) {
    const inputs = chainInputs();
    inputs.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({ name: "@control/bridge", ...metadata })));
    const result = boundarySafety(inputs);
    assert.equal(result.nativeAllocationBoundary === undefined, true, JSON.stringify(metadata));
    assert.equal(result.findings.some(finding => finding.file === "package.json" && finding.reason.includes("package entry")), true,
      "metadata promotion is checked after transitive closure");
  }
  const crossRepo = chainInputs();
  crossRepo.get("tsonic-csharp").set("test/bridge.test.mjs", safetyFile('import test from "node:test"; export { nativeAllocationSupport } from "../../tsonic-rust/test/bridge.test.mjs";'));
  assert.equal(boundarySafety(crossRepo).findings.length, 0, "a real test-only cross-repository bridge stays test-only");
  crossRepo.get("tsonic").set("src/product.mjs", safetyFile('import { nativeAllocationSupport } from "../../tsonic-csharp/test/bridge.test.mjs";'));
  assert.equal(boundarySafety(crossRepo).findings.some(finding => finding.repo === "tsonic" && finding.file === "src/product.mjs"), true,
    "the same destination authority crosses repositories");
  const alias = chainInputs();
  alias.get("tsonic-rust").set("src/alias.mjs", Object.freeze({ kind: "symlink", tracked: true, mode: "120000", target: "../test/bridge.test.mjs" }));
  assert.equal(boundarySafety(alias).findings.some(finding => finding.file === "src/alias.mjs" && finding.reason.includes("symlink")), true,
    "an indirect restricted bridge cannot be promoted by a physical alias");
  const native = chainInputs();
  native.get("rust-runtime").set("src/lib.rs", safetyFile('include!("../../tsonic-rust/test/bridge.test.mjs");'));
  assert.equal(boundarySafety(native).findings.some(finding => finding.file === "src/lib.rs" && finding.reason.includes("native source inclusion")), true,
    "native incoming inclusion uses the same transitive restricted set");
  const nativeChain = nativeBoundaryInputs();
  nativeChain.get("rust-runtime").set("tests/control.rs", safetyFile('#[path = "observed.rs"] mod observed;'));
  nativeChain.get("rust-runtime").set("tests/observed.rs", safetyFile('#[path = "helpers/allocation_counts.rs"] mod allocation_counts;'));
  assert.equal(boundarySafety(nativeChain).findings.length, 0, "the real Cargo test root retains its directly attached observer module");
  nativeChain.get("rust-runtime").set("src/lib.rs", safetyFile('#[path = "../tests/control.rs"] mod promoted;'));
  assert.equal(boundarySafety(nativeChain).findings.some(finding => finding.file === "src/lib.rs" && finding.reason.includes("native source inclusion")), true,
    "native Cargo test bridges cannot be promoted into product");
  const ordinary = nativeBoundaryInputs();
  ordinary.get("tsonic-rust").set("src/ordinary.mjs", safetyFile("export const value = 1;"));
  ordinary.get("tsonic-rust").set("src/bridge.mjs", safetyFile('export { value } from "./ordinary.mjs";'));
  ordinary.get("tsonic-rust").set("src/product.mjs", safetyFile('import { value } from "./bridge.mjs";'));
  assert.equal(boundarySafety(ordinary).findings.length, 0, "ordinary static module chains acquire no observer restriction");
});

test("canonical consumers require actual test entries and forbid incoming product promotions", () => {
  const entry = 'import test from "node:test"; import { nativeAllocationSupport } from "./helpers/native-ownership-cost.mjs"; test("cost", () => nativeAllocationSupport("private"));';
  const inputs = nativeBoundaryInputs();
  inputs.get("tsonic-rust").set("test/cost.test.mjs", safetyFile(entry));
  const accepted = boundarySafety(inputs);
  assert.equal(accepted.findings.length, 0, "a direct discovered Node test uses the fixed writer");
  assert.equal(accepted.nativeAllocationBoundary.consumers.filter(consumer => consumer.kind === "Node test writer consumer").length, 1);
  for (const [path, source] of [
    ["src/promote.mjs", 'import "../test/cost.test.mjs";'],
    ["test/helper.mjs", 'export { nativeAllocationSupport } from "./helpers/native-ownership-cost.mjs";'],
    ["src/not-an-entry.test.mjs", entry.replace('./helpers/', '../test/helpers/')],
    ["test/not-a-node-entry.test.mjs", 'import { nativeAllocationSupport } from "./helpers/native-ownership-cost.mjs";'],
  ]) {
    const changed = new Map([...inputs].map(([repo, files]) => [repo, new Map(files)]));
    changed.get("tsonic-rust").set(path, safetyFile(source));
    assert.equal(boundarySafety(changed).nativeAllocationBoundary === undefined, true, path);
  }
  const computed = nativeBoundaryInputs();
  computed.get("tsonic-csharp").set("test/computed.test.mjs", safetyFile('import test from "node:test"; const name = process.env.ENTRY; test("entry", () => import(new URL(name, import.meta.url)));'));
  assert.equal(boundarySafety(computed).findings.length, 0, "the symmetric C# Node test entry is genuinely test-only");
  computed.get("tsonic-csharp").set("src/promote.mjs", safetyFile('import "../test/computed.test.mjs";'));
  assert.equal(boundarySafety(computed).nativeAllocationBoundary === undefined, true, "a computed-source test entry also has an incoming product cut");
  const nested = nativeBoundaryInputs();
  nested.get("rust-runtime").set("tests/control.rs", safetyFile('#[path = "nested.rs"] mod nested;'));
  nested.get("rust-runtime").set("tests/nested.rs", safetyFile('#[path = "helpers/allocation_counts.rs"] mod counts;'));
  const child = boundarySafety(nested);
  assert.equal(child.findings.length, 0, "one actual Cargo test-module parent is sufficient");
  assert.equal(child.nativeAllocationBoundary.consumers[0].parent, "rust-runtime/tests/control.rs");
  nested.get("rust-runtime").set("src/lib.rs", safetyFile('#[path = "../tests/control.rs"] mod promoted;'));
  assert.equal(boundarySafety(nested).nativeAllocationBoundary === undefined, true, "Cargo test parent cannot become a product module");
  const guarded = nativeBoundaryInputs();
  guarded.get("rust-runtime").set("tests/control.rs", safetyFile("fn main() {}"));
  guarded.get("rust-runtime").set("src/lib.rs", safetyFile('#[cfg(test)] #[path = "nested.rs"] mod nested;'));
  guarded.get("rust-runtime").set("src/nested.rs", safetyFile('#[path = "../tests/helpers/allocation_counts.rs"] mod counts;'));
  assert.equal(boundarySafety(guarded).findings.length, 0, "a directly attached cfg(test) parent proves its child");
  guarded.get("rust-runtime").set("src/lib.rs", safetyFile('#[cfg(test)] #[path = "nested.rs"] mod nested; include!("nested.rs");'));
  assert.equal(boundarySafety(guarded).nativeAllocationBoundary === undefined, true, "the cfg(test) parent does not cover its product sibling");
});

test("only actual source and observer-read effects cross the cut, with known API roots or explicit refusal", () => {
  for (const [label, source] of [
    ["known URL root", 'import { readFileSync } from "node:fs"; readFileSync(new URL("../../rust-runtime/tests/helpers/allocation_counts.rs", import.meta.url));'],
    ["unknown cwd", 'import { readFileSync } from "node:fs"; readFileSync("rust-runtime/tests/helpers/allocation_counts.rs");'],
    ["relative cwd is not the module", 'import { readFileSync } from "node:fs"; readFileSync("../../rust-runtime/tests/helpers/allocation_counts.rs");'],
    ["aliased root", 'import { readFileSync as read } from "node:fs"; import { fileURLToPath } from "node:url"; const target = fileURLToPath(new URL("../../rust-runtime/tests/helpers/allocation_counts.rs", import.meta.url)); const alias = target; read(alias);'],
    ["obfuscated first-party import", 'const encoded = process.env.ENTRY; const target = new URL(encoded, import.meta.url); const alias = target; await import(alias.href);'],
    ["obfuscated actual observer reader", 'import { readFileSync } from "node:fs"; const encoded = process.env.ENTRY; readFileSync(new URL("../../rust-runtime/tests/helpers/" + encoded, import.meta.url));'],
    ["literal observer through URL base", 'import { readFileSync } from "node:fs"; const root = new URL("../../rust-runtime/tests/helpers/", import.meta.url); readFileSync(new URL("allocation_counts.rs", root));'],
    ["unknown observer through URL base", 'import { readFileSync } from "node:fs"; const root = new URL("../../rust-runtime/tests/helpers/", import.meta.url); readFileSync(new URL(process.env.ENTRY, root));'],
    ["literal observer copy through URL base", 'import { copyFileSync } from "node:fs"; const root = new URL("../../rust-runtime/tests/helpers/", import.meta.url); copyFileSync(new URL("allocation_counts.rs", root), process.env.DESTINATION);'],
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/emitter.mjs", safetyFile(source));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, label);
  }
  const data = nativeBoundaryInputs();
  data.get("tsonic-rust").set("src/data.mjs", safetyFile('import { readFileSync } from "node:fs"; const name = process.env.PACKAGE; const address = new URL(`../packages/${name}/tsonic.json`, import.meta.url); export const config = JSON.parse(readFileSync(address, "utf8")); const unused = new URL(process.env.UNUSED, import.meta.url);'));
  data.get("tsonic-rust").set("scripts/tooling.mjs", safetyFile('import { pathToFileURL } from "node:url"; import { resolve } from "node:path"; await import(pathToFileURL(resolve(process.env.HOST, "test/scripts/proof-scenarios.mjs")).href);'));
  data.get("tsonic-rust").set("test/scripts/proof-scenarios.mjs", safetyFile("export const unrelated = true;"));
  data.get("tsonic-rust").set("package.json", safetyFile('{"exports":{".":"./test/scripts/proof-scenarios.mjs"}}'));
  data.get("tsonic-rust").set("src/fluent.mjs", safetyFile('export const values = [1, 2].map(value => value + 1).filter(value => value > 1);'));
  data.get("tsonic-rust").set("src/byte-reader.mjs", safetyFile('import { readFileSync } from "node:fs"; export function readData(path) { return readFileSync(new URL(path, import.meta.url)); }'));
  data.get("tsonic-rust").set("src/base-data.mjs", safetyFile('import { readFileSync } from "node:fs"; const root = new URL("../packages/", import.meta.url); readFileSync(new URL(process.env.JSON, root));'));
  const ordinary = boundarySafety(data);
  assert.equal(ordinary.findings.length, 0, "unrelated data and tool modules are not canonical-source promotions");
  assert.equal(ordinary.nativeAllocationBoundary.externalDynamicEntries.some(entry => entry.path === "tsonic-rust/scripts/tooling.mjs"), true,
    "an unknown external filesystem root is recorded outside the static guarantee, not proved harmless");
  data.get("tsonic-rust").set("test/cost.test.mjs", safetyFile('import test from "node:test"; import { nativeAllocationSupport } from "./helpers/native-ownership-cost.mjs";'));
  for (const expression of [
    'import(pathToFileURL(resolve(process.env.HOST, "test/cost.test.mjs")).href)',
    'import(resolve(process.env.HOST, "test/cost.test.mjs"))',
    'new Worker(pathToFileURL(resolve(process.env.HOST, "test/cost.test.mjs")))',
    'fork(pathToFileURL(resolve(process.env.HOST, "test/cost.test.mjs")))',
    'register(pathToFileURL(resolve(process.env.HOST, "test/cost.test.mjs")))',
  ]) {
    data.get("tsonic-rust").set("src/promote.mjs", safetyFile(`import { pathToFileURL } from "node:url"; import { resolve } from "node:path"; import { Worker } from "node:worker_threads"; import { fork } from "node:child_process"; import { register } from "node:module"; ${expression};`));
    assert.equal(boundarySafety(data).nativeAllocationBoundary === undefined, true, `actual protected source evidence denies an unproved external root: ${expression}`);
  }
});

test("literal URL loaders publish ordinary targets only after a complete private binding proof", () => {
  for (const base of ["../test/helpers/", "../test/helpers/base.mjs"]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/loader.mjs", safetyFile(`
const root = new URL(${JSON.stringify(base)}, import.meta.url);
const load = (entry) => import(new URL(entry, root).href);
load("unrelated.mjs");
load("second.mjs?query=one#fragment");
`));
    inputs.get("tsonic-rust").set("test/helpers/unrelated.mjs", safetyFile("export const value = 1;"));
    inputs.get("tsonic-rust").set("test/helpers/second.mjs", safetyFile("export const value = 2;"));
    const result = boundarySafety(inputs);
    assert.equal(result.findings.length, 0, base);
    assert.equal(Array.isArray(result.nativeAllocationBoundary.literalUrlLoaders), true, "closed loaders publish their proof");
    assert.equal(result.nativeAllocationBoundary.literalUrlLoaders.length, 1, base);
    const loader = result.nativeAllocationBoundary.literalUrlLoaders[0];
    assert.equal(loader.name, "load");
    assert.deepEqual(loader.targets, ["tsonic-rust/test/helpers/unrelated.mjs", "tsonic-rust/test/helpers/second.mjs"]);
    assert.equal(result.nativeAllocationBoundary.externalDynamicEntries.length, 0, "first-party targets are not labelled external");
    assert.equal(Object.isFrozen(loader) && Object.isFrozen(loader.targets), true);
  }
});

test("literal URL loaders refuse every nonliteral, escape, mutation, shadow and unsupported body", () => {
  const source = 'const root = new URL("../test/helpers/", import.meta.url); const load = (entry) => import(new URL(entry, root).href); load("unrelated.mjs");';
  for (const [label, changed] of [
    ["nonliteral", source.replace('load("unrelated.mjs")', "load(process.env.ENTRY)")],
    ["one unsettled caller", `${source} load(process.env.ENTRY);`],
    ["numeric caller", source.replace('load("unrelated.mjs")', "load(1)")],
    ["missing argument", source.replace('load("unrelated.mjs")', "load()")],
    ["extra argument", source.replace('load("unrelated.mjs")', 'load("unrelated.mjs", "extra")')],
    ["spread", source.replace('load("unrelated.mjs")', 'load(...["unrelated.mjs"])')],
    ["optional call", source.replace('load("unrelated.mjs")', 'load?.("unrelated.mjs")')],
    ["exported loader", source.replace("const load", "export const load")],
    ["exported loader reference", `${source} export { load };`],
    ["escaping loader", `${source} const alias = load;`],
    ["callback escape", `${source} accept(load);`],
    ["shadowed loader", `${source} function shadow(load) { return load; }`],
    ["mutable loader", source.replace("const load", "let load")],
    ["mutable URL base", source.replace("const root", "let root")],
    ["base URL mutation", `${source} root.pathname = "/keel/tsonic-rust/test/helpers/";`],
    ["escaping URL base", `${source} const alias = root;`],
    ["exported URL base", source.replace("const root", "export const root")],
    ["shadowed URL base", `${source} function shadow(root) { return root; }`],
    ["computed URL base", source.replace('"../test/helpers/"', "process.env.ROOT")],
    ["unknown root", source.replace("import.meta.url", "process.env.BASE")],
    ["wrong root", source.replace('"../test/helpers/"', '"file:///outside/"')],
    ["wrong URL scheme", source.replace('"../test/helpers/"', '"https://example.invalid/"')],
    ["shadowed URL constructor", `function URL(...values) { return values[0]; } ${source}`],
    ["async loader", source.replace("(entry) =>", "async (entry) =>")],
    ["extra body effect", source.replace("=> import", "=> (observe(), import").replace(".href);", ".href));")],
    ["block body", source.replace("=> import", "=> { return import").replace(".href);", ".href); };")],
    ["computed parameter", source.replace("new URL(entry, root)", 'new URL(entry + ".mjs", root)')],
    ["malformed literal target", source.replace('load("unrelated.mjs")', 'load("%ZZ.mjs")')],
    ["encoded separator", source.replace('load("unrelated.mjs")', 'load("nested%2Funrelated.mjs")')],
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/loader.mjs", safetyFile(changed));
    const result = boundarySafety(inputs);
    assert.equal(result.nativeAllocationBoundary === undefined, true, label);
    assert.equal(keelFixtureHas(result.findings, "AC12", "literal URL loader"), true, label);
    assert.equal(result.findings.filter(finding => finding.subject === "native safety").length, 8, label);
  }
});

test("literal URL targets traverse canonical writer and bridge entries with native URL semantics", () => {
  for (const target of ["native-ownership-cost.mjs", "%6eative-ownership-cost.mjs", "native-ownership-cost.mjs?unit=cost#entry"]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/loader.mjs", safetyFile(`const root = new URL("../test/helpers/base.mjs", import.meta.url); const load = (entry) => import(new URL(entry, root).href); load(${JSON.stringify(target)});`));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, target);
  }
  const bridge = nativeBoundaryInputs();
  bridge.get("tsonic-rust").set("src/loader.mjs", safetyFile('const root = new URL("./", import.meta.url); const load = (entry) => import(new URL(entry, root).href); load("bridge.mjs");'));
  bridge.get("tsonic-rust").set("src/bridge.mjs", safetyFile('export { nativeAllocationSupport } from "../test/helpers/native-ownership-cost.mjs";'));
  const rejected = boundarySafety(bridge);
  assert.equal(rejected.nativeAllocationBoundary === undefined, true, "the actual target's bridge to the writer is forbidden");
  assert.equal(rejected.findings.some(finding => finding.file === "src/bridge.mjs" && finding.subject === "canonical native allocation boundary"), true);
  const entry = nativeBoundaryInputs();
  entry.get("tsonic-rust").set("test/cost.test.mjs", safetyFile('import test from "node:test"; const root = new URL("./helpers/", import.meta.url); const load = (entry) => import(new URL(entry, root).href); test("cost", () => load("native-ownership-cost.mjs"));'));
  assert.equal(boundarySafety(entry).findings.length, 0, "the exact same proof may serve a genuine test entry");
  entry.get("tsonic-rust").set("src/promote.mjs", safetyFile('import "../test/cost.test.mjs";'));
  assert.equal(boundarySafety(entry).nativeAllocationBoundary === undefined, true, "test-only incoming promotion remains forbidden");
});

test("C114-F1: explicit Cargo tests never bless implicit or declared product/build targets", () => {
  for (const path of ["src/lib.rs", "src/main.rs", "src/bin/tool.rs", "src/bin/tool/main.rs", "build.rs",
    "examples/tool.rs", "examples/tool/main.rs", "benches/tool.rs", "benches/tool/main.rs"]) {
    const inputs = nativeBoundaryInputs();
    const ordinary = '[package]\nname = "control"\n[[test]]\nname = "control"\npath = "tests/control.rs"\n';
    inputs.get("rust-runtime").set("Cargo.toml", safetyFile(ordinary));
    inputs.get("rust-runtime").set(path, safetyFile("fn main() {}"));
    assert.equal(boundarySafety(inputs).findings.length, 0, `ordinary target ${path}`);
    inputs.get("rust-runtime").set("Cargo.toml", safetyFile(`${ordinary}[[test]]\nname = "promoted"\npath = "${path}"\n`));
    inputs.get("rust-runtime").set(path, safetyFile(`#[path = "${posix.relative(posix.dirname(path), "tests/helpers/allocation_counts.rs")}"] mod observed;`));
    const rejected = boundarySafety(inputs);
    assert.equal(rejected.nativeAllocationBoundary === undefined, true, path);
    assert.equal(keelFixtureHas(rejected.findings, "AC12", "implicit Cargo product/build target"), true, path);
    assert.equal(rejected.findings.filter(finding => finding.subject === "native safety").length, 8, path);
  }
  for (const [path, flags] of [["src/main.rs", "autobins = false"], ["build.rs", "build = false"],
    ["src/lib.rs", "autolib = false"], ["examples/tool.rs", "autoexamples = false"], ["benches/tool.rs", "autobenches = false"],
    ["src/test_control.rs", ""]]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("rust-runtime").set("Cargo.toml", safetyFile(`[package]\nname = "control"\n${flags}\n[[test]]\nname = "control"\npath = "${path}"\n`));
    inputs.get("rust-runtime").delete("tests/control.rs");
    inputs.get("rust-runtime").set(path, safetyFile(`#[path = "${posix.relative(posix.dirname(path), "tests/helpers/allocation_counts.rs")}"] mod observed;`));
    assert.equal(boundarySafety(inputs).findings.length, 0, `genuine test, product disabled: ${path}`);
  }
});

test("C114-F2: nested inline module path attributes need genuine lexical test evidence", () => {
  for (const body of [
    'mod inner { #[path = "../../tests/helpers/allocation_counts.rs"] mod observed; }',
    'mod outer { mod inner { #[path = "../../../tests/helpers/allocation_counts.rs"] mod observed; } }',
    '#[cfg(test)] mod tests {} mod product { #[path = "../../tests/helpers/allocation_counts.rs"] mod observed; }',
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("rust-runtime").set("src/lib.rs", safetyFile(body));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, body);
  }
  for (const body of [
    '#[cfg(test)] mod inner { #[path = "../../tests/helpers/allocation_counts.rs"] mod observed; }',
    'mod inner { #[cfg(test)] #[path = "../../tests/helpers/allocation_counts.rs"] mod observed; }',
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("rust-runtime").set("src/lib.rs", safetyFile(body));
    assert.equal(boundarySafety(inputs).findings.length, 0, body);
  }
  const nestedFile = nativeBoundaryInputs();
  nestedFile.get("rust-runtime").set("src/units.rs", safetyFile('#[cfg(test)] mod inner { #[path = "../../../tests/helpers/allocation_counts.rs"] mod observed; }'));
  const nestedResult = boundarySafety(nestedFile);
  assert.equal(nestedResult.findings.length, 0, "test-only path attributes retain non-mod.rs and inline module directories");
  assert.equal(nestedResult.nativeAllocationBoundary.consumers.some(consumer => consumer.path === "rust-runtime/src/units.rs" && consumer.kind === "cfg(test)"), true);
});

test("QW01-QW04: native lexical and explicit target owners retain every real product entry", () => {
  for (const [kind, flag, path] of [["bin", "autobins", "src/bin/control.rs"],
    ["example", "autoexamples", "examples/control.rs"], ["bench", "autobenches", "benches/control.rs"], ["lib", "autolib", "src/lib.rs"]]) {
    const inputs = nativeBoundaryInputs();
    const target = kind === "lib" ? "[lib]" : `[[${kind}]]`;
    const cargo = `[package]\nname = "control"\n${flag} = false\n${target}\nname = "control"\n[[test]]\nname = "original"\npath = "tests/control.rs"\n[[test]]\nname = "shared"\npath = "${path}"\n`;
    inputs.get("rust-runtime").set("Cargo.toml", safetyFile(cargo));
    inputs.get("rust-runtime").set(path, safetyFile("fn main() {}"));
    assert.equal(boundarySafety(inputs).findings.length, 0, `ordinary explicit ${kind}`);
    inputs.get("rust-runtime").set(path, safetyFile(`#[path = "${posix.relative(posix.dirname(path), "tests/helpers/allocation_counts.rs")}"] mod counts; fn main() {}`));
    const rejected = boundarySafety(inputs);
    assert.equal(rejected.nativeAllocationBoundary === undefined, true, kind);
    assert.equal(keelFixtureHas(rejected.findings, "AC12", "default path"), true, kind);
  }
  for (const body of ['mod tests { mod helpers { mod allocation_counts; } }',
    '#[cfg_attr(feature = "observer", path = "tests/helpers/allocation_counts.rs")] mod counts;']) {
    const inputs = nativeBoundaryInputs();
    inputs.get("rust-runtime").set("Cargo.toml", safetyFile('[package]\nname = "control"\n[lib]\npath = "lib.rs"\n[[test]]\nname = "original"\npath = "tests/control.rs"\n'));
    inputs.get("rust-runtime").set("lib.rs", safetyFile(body));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, body);
    inputs.get("rust-runtime").set("lib.rs", safetyFile(`#[cfg(test)] ${body}`));
    assert.equal(boundarySafety(inputs).findings.length, 0, `genuine lexical test: ${body}`);
  }
  const link = nativeBoundaryInputs();
  link.get("rust-runtime").set("tests/bridge", Object.freeze({ kind: "symlink", tracked: true, mode: "120000", target: "helpers/inner" }));
  link.get("rust-runtime").set("tests/helpers/inner/ordinary.rs", safetyFile("pub fn ordinary() {}"));
  link.get("rust-runtime").set("src/lib.rs", safetyFile('#[path = "../tests/bridge/../allocation_counts.rs"] mod observed;'));
  assert.equal(boundarySafety(link).nativeAllocationBoundary === undefined, true, "raw native filesystem follows a symlink before its parent component");
});

test("QW02: module URLs share one physical identity without rewriting raw file or require paths", () => {
  for (const body of [
    'await import(new URL("../test/helpers/%6eative-ownership-cost.mjs", import.meta.url));',
    'await import(new URL("../test/helpers/native-ownership-cost.mjs?unit=cost#entry", import.meta.url).href);',
    'import "../test/helpers/native-ownership-cost.mjs?unit=cost#entry";',
    'export { value } from "../test/helpers/%6eative-ownership-cost.mjs#entry";',
    'import { Worker } from "node:worker_threads"; new Worker(new URL("../test/helpers/%6eative-ownership-cost.mjs?x", import.meta.url));',
    'import { register } from "node:module"; register("./helpers/%6eative-ownership-cost.mjs?x", new URL("../test/", import.meta.url));',
    'import { createRequire } from "node:module"; const load = createRequire(new URL("../test/", import.meta.url)); load("./helpers/native-ownership-cost.mjs");',
    'function Loader() { return import(new URL("./native-ownership-cost.mjs", new.target.url)); } Loader.url = new URL("../test/helpers/", import.meta.url).href; new Loader();',
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/entry.mjs", safetyFile(body));
    const result = boundarySafety(inputs);
    assert.equal(result.nativeAllocationBoundary === undefined, true, body);
    assert.equal(result.findings.filter(finding => finding.subject === "native safety").length, 8, body);
  }
  for (const body of [
    'await import(new URL("./%6frdinary.mjs?unit=cost#entry", import.meta.url));',
    'import { register } from "node:module"; register("../src/ordinary.mjs", new URL("../test/", import.meta.url));',
    'import { createRequire } from "node:module"; const load = createRequire(new URL("../test/", import.meta.url)); load("../src/ordinary.mjs");',
    'import { createRequire } from "node:module"; const load = createRequire(import.meta.url); load("../test/helpers/native-ownership-cost.mjs#literal");',
    'import { readFileSync } from "node:fs"; import { fileURLToPath } from "node:url"; readFileSync(fileURLToPath(new URL("../test/helpers/native-ownership-cost.mjs%23literal", import.meta.url)));',
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/entry.mjs", safetyFile(body));
    inputs.get("tsonic-rust").set("src/ordinary.mjs", safetyFile("export const value = 1;"));
    inputs.get("tsonic-rust").set("test/helpers/native-ownership-cost.mjs#literal", safetyFile("module.exports = {};"));
    assert.equal(boundarySafety(inputs).findings.length, 0, body);
  }
});

test("C114-F3: every nonliteral native inclusion fails closed without filename heuristics", () => {
  for (const macro of ["include", "include_str", "include_bytes"]) {
    for (const expression of ['concat!(env!("OUT_DIR"), "/observer.rs")', 'concat!("ordinary", ".rs")', "computed"]) {
      const inputs = nativeBoundaryInputs();
      inputs.get("rust-runtime").set("src/lib.rs", safetyFile(`${macro}!(${expression});`));
      const rejected = boundarySafety(inputs);
      assert.equal(rejected.nativeAllocationBoundary === undefined, true, `${macro}: ${expression}`);
      assert.equal(keelFixtureHas(rejected.findings, "AC12", "computed native source inclusion"), true, macro);
      inputs.get("rust-runtime").set("src/lib.rs", safetyFile(`#[cfg(test)] mod tests { ${macro}!(${expression}); }`));
      assert.equal(boundarySafety(inputs).findings.length, 0, `lexical test ${macro}: ${expression}`);
    }
    for (const [opening, closing] of [["(", ")"], ["[", "]"], ["{", "}"]]) {
      const inputs = nativeBoundaryInputs();
      inputs.get("rust-runtime").set("src/lib.rs", safetyFile(`${macro}!${opening}"ordinary.rs",${closing};`));
      assert.equal(boundarySafety(inputs).findings.length, 0, `literal ${macro} ${opening}`);
    }
  }
});

test("C114-F4: package imports and hash specifiers are actual entries, unknown hashes refuse", () => {
  for (const imports of [
    { "#alloc": "./test/helpers/native-ownership-cost.mjs" },
    { "#alloc": { node: "./test/helpers/native-ownership-cost.mjs", default: "./src/ordinary.mjs" } },
    { "#helpers/*": "./test/helpers/*.mjs" },
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({ name: "control", imports })));
    inputs.get("tsonic-rust").set("src/emitter.mjs", safetyFile('import "#alloc";'));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, JSON.stringify(imports));
  }
  for (const source of ['import "#unresolved";', 'export { value } from "#unresolved";', 'await import("#unresolved");', 'require("#unresolved");']) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/emitter.mjs", safetyFile(source));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, source);
  }
  for (const [imports, specifier] of [[{ "#safe": "./src/ordinary.mjs" }, "#safe"],
    [{ "#safe/*": "./src/*.mjs" }, "#safe/ordinary"]]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({ name: "control", imports })));
    inputs.get("tsonic-rust").set("src/emitter.mjs", safetyFile(`import "${specifier}";`));
    inputs.get("tsonic-rust").set("src/ordinary.mjs", safetyFile("export const value = 1;"));
    assert.equal(boundarySafety(inputs).findings.length, 0, specifier);
  }
  const external = nativeBoundaryInputs();
  external.get("tsonic-rust").set("package.json", safetyFile('{"imports":{"#external":"node:fs"}}'));
  external.get("tsonic-rust").set("src/emitter.mjs", safetyFile('import "#external";'));
  const result = boundarySafety(external);
  assert.equal(result.findings.length, 0, "declared external package import remains outside the tracked-source proof");
  assert.equal(result.nativeAllocationBoundary.externalDynamicEntries.length, 1);
});

test("unresolved first-party source entries refuse without guessing from a filename suffix", () => {
  for (const source of ['import("./" + key + "/ordinary.mjs");', 'import(`./${key}/ordinary.mjs`);']) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/entry.mjs", safetyFile(source));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, source);
    inputs.get("tsonic-rust").delete("src/entry.mjs");
    inputs.get("tsonic-rust").set("test/entry.test.mjs", safetyFile(`import test from "node:test"; ${source}`));
    assert.equal(boundarySafety(inputs).findings.length, 0, `actual Node test: ${source}`);
  }
});

test("C114-F5: createRequire module loads retain their actual origin and cannot escape", () => {
  for (const [prefix, call] of [
    ['import { createRequire } from "node:module"; const require = createRequire(import.meta.url);', 'require("../test/helpers/native-ownership-cost.mjs")'],
    ['import { createRequire as factory } from "node:module"; const load = factory(import.meta.url);', 'load("../test/helpers/native-ownership-cost.mjs")'],
    ['import * as module from "node:module"; const load = module.createRequire(import.meta.url);', 'load("../test/helpers/native-ownership-cost.mjs")'],
    ['import { createRequire } from "node:module"; const load = createRequire(new URL("../test/entry.mjs", import.meta.url));', 'load("./helpers/native-ownership-cost.mjs")'],
    ['import { createRequire } from "node:module"; const load = createRequire(process.env.ROOT);', 'load("../test/helpers/native-ownership-cost.mjs")'],
    ['import { createRequire } from "node:module"; const load = createRequire(import.meta.url); const alias = load;', 'alias("../test/helpers/native-ownership-cost.mjs")'],
    ['import { createRequire } from "node:module"; const factory = createRequire; const load = factory(import.meta.url);', 'load("../test/helpers/native-ownership-cost.mjs")'],
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/emitter.mjs", safetyFile(`${prefix} ${call};`));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, call);
  }
  for (const source of [
    'import { createRequire } from "node:module"; const require = createRequire(import.meta.url); require.resolve("../test/helpers/native-ownership-cost.mjs");',
    'import { createRequire } from "node:module"; const load = createRequire(import.meta.url); load("./ordinary.mjs");',
    'import { createRequire } from "node:module"; const load = createRequire(new URL("../test/entry.mjs", import.meta.url)); load("../src/ordinary.mjs");',
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/emitter.mjs", safetyFile(source));
    inputs.get("tsonic-rust").set("src/ordinary.mjs", safetyFile("export const value = 1;"));
    assert.equal(boundarySafety(inputs).findings.length, 0, source);
  }
});

test("C119-G2: only the detached native resolver crosses storage and call boundaries", () => {
  for (const body of [
    'const resolve = createRequire(import.meta.url).resolve; consume(resolve);',
    'const resolve = createRequire(import.meta.url).resolve; const alias = resolve; alias("package");',
    'const values = [createRequire(import.meta.url).resolve]; for (const resolve of values) resolve("package");',
    'function factory() { return createRequire(import.meta.url).resolve; }',
    'const state = { resolve: createRequire(import.meta.url).resolve };',
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/resolve.mjs", safetyFile(`import { createRequire } from "node:module"; ${body}`));
    assert.equal(boundarySafety(inputs).findings.length, 0, body);
  }
});

test("C119-R1-R4: loader values never cross parameters, loops or unproven member uses", () => {
  const prefix = 'import { createRequire } from "node:module"; ';
  const denied = [
    'const require = createRequire(import.meta.url); function load(require) { require.resolve("package"); } load(require);',
    'const first = createRequire(import.meta.url); const second = createRequire(import.meta.url); for (const resolver of [first, second]) resolver.resolve("package");',
    'createRequire(import.meta.url).cache;', 'createRequire(import.meta.url).main;',
    'createRequire(import.meta.url)["resolve"];', 'createRequire(import.meta.url)?.resolve;',
    'createRequire(import.meta.url);', 'const unused = createRequire(import.meta.url);',
    'consume(createRequire(import.meta.url));', 'function load() { return createRequire(import.meta.url); }',
    'const { resolve } = createRequire(import.meta.url);',
    'let bound = createRequire(import.meta.url); bound.resolve("package");',
    'const bound = createRequire(import.meta.url); function child() { const bound = createRequire(import.meta.url); bound.resolve("package"); } bound.resolve("package");',
    ...['bound = replacement;', 'bound.resolve;', 'bound.resolve.call(null, "package");',
      'bound.resolve.apply(null, ["package"]);', 'bound.resolve.bind(null);', 'bound?.resolve("package");',
      'bound.resolve?.("package");', 'bound["resolve"]("package");', 'bound.resolve.paths("package");',
      'const alias = bound;', 'consume(bound);', 'export { bound };']
      .map(body => `const bound = createRequire(import.meta.url); ${body}`),
  ];
  for (const body of denied) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/resolve.mjs", safetyFile(`${prefix}${body}`));
    const result = boundarySafety(inputs);
    assert.equal(result.nativeAllocationBoundary === undefined, true, body);
    assert.equal(result.findings.filter(finding => finding.subject === "native safety").length, 8, body);
  }
});

test("QRC-12: bound loader non-loading reads share the native root predicate without admitting escape or mutation", () => {
  const prefix = 'import { createRequire } from "node:module"; const bound = createRequire(import.meta.url); ';
  for (const body of ["void bound;", "typeof bound;", "void (bound);", "typeof (bound);", "void await (bound);"]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/non-loading.mjs", safetyFile(`${prefix}${body}`));
    assert.equal(boundarySafety(inputs).findings.length, 0, body);
  }
  for (const body of ["", "void (bound = replacement);", "typeof (bound = replacement);", "void consume(bound);",
    "void (bound.resolve = replacement);", "void ({ loader: bound });", "void (() => bound)();", "void [bound];"]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/non-loading.mjs", safetyFile(`${prefix}${body}`));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true,
      `${body}: the unused-binding, all-use and immutable-binding contracts remain required`);
  }
});

test("QRC-12: both Tsumo helper producers transport only the actual non-executing native options", () => {
  for (const repo of ["tsumo-rust", "tsumo-csharp"]) {
    const inputs = nativeBoundaryInputs();
    const source = readFileSync(new URL(`../../../${repo}/test/helpers.mjs`, import.meta.url), "utf8");
    inputs.get(repo).set("test/helpers.mjs", safetyFile(source));
    if (repo === "tsumo-csharp") inputs.get(repo).set("scripts/project-framework.mjs", safetyFile(
      readFileSync(new URL("../../../tsumo-csharp/scripts/project-framework.mjs", import.meta.url), "utf8")));
    const result = boundarySafety(inputs);
    assert.equal(result.findings.length, 0, `${repo}: actual helper source, including its native module dependency`);
    assert.equal(result.nativeAllocationBoundary.externalDynamicEntries.some(entry =>
      entry.path === `${repo}/test/helpers.mjs` && entry.environment === "external-process"), true,
      `${repo}: opaque native execution remains explicitly unproved, not declared safe`);
  }
  for (const body of [
    'import { spawnSync } from "node:child_process"; spawnSync(binary(), args, { ...options });',
    'import { spawn } from "node:child_process"; spawn(binary(), args, { shell: true });',
    'import { spawnSync } from "node:child_process"; spawnSync(process.execPath, args, { ...options });',
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsumo-rust").set("test/helpers.mjs", safetyFile(body));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true,
      `${body}: no foreign unknown-shell or native-Node option waiver`);
  }
});

test("QRC-12: native Node profiling operands and literal producer entry paths preserve actual argument behavior", () => {
  const bench = new URL("../../../tsts-legacy/packages/tsts/tools/profiling/bench.mjs", import.meta.url);
  const directory = fileURLToPath(new URL(".", bench));
  assert.equal(fileURLToPath(new URL("../../dist/src/cli/index.js", bench)),
    join(directory, "../../../..", "packages/tsts/dist/src/cli/index.js"), "CLI producer path remains identical");
  assert.equal(fileURLToPath(new URL("./attribute.mjs", bench)), join(directory, "attribute.mjs"),
    "profile attribution producer path remains identical");
  const temporary = new URL("../../.temp/", import.meta.url);
  mkdirSync(temporary, { recursive: true });
  const root = mkdtempSync(fileURLToPath(new URL("q109-native-profile-", temporary)));
  const entry = join(root, "entry.mjs");
  writeFileSync(entry, 'process.stdout.write(JSON.stringify(process.argv.slice(2)));\n');
  const data = ["ordinary data #?%", "--import=not-a-node-option-after-the-entry"];
  for (const kind of ["cpu", "heap"]) {
    const name = `literal #?% ${kind}.${kind}profile`;
    for (const spelling of ["joined", "separate"]) {
      const output = join(root, `${kind}-${spelling} #?%`);
      mkdirSync(output);
      const options = spelling === "joined" ? [`--${kind}-prof-dir=${output}`, `--${kind}-prof-name=${name}`]
        : [`--${kind}-prof-dir`, output, `--${kind}-prof-name`, name];
      const child = spawnSync(process.execPath, [`--${kind}-prof`, ...options, entry, ...data], { encoding: "utf8" });
      assert.equal(child.status, 0, `${kind}/${spelling}: ${child.stderr}`);
      assert.deepEqual(JSON.parse(child.stdout), data, `${kind}/${spelling}: post-entry arguments are data`);
      assert.deepEqual(readdirSync(output), [name], `${kind}/${spelling}: native output path and filename are literal operands`);
      const profile = JSON.parse(readFileSync(join(output, name), "utf8"));
      assert.equal(kind === "cpu" ? Array.isArray(profile.nodes) : typeof profile.head === "object", true,
        `${kind}/${spelling}: the actual native profiler wrote its expected format`);
    }
  }
});

test("C119-R6: dynamic builtin-module routes are refused in products and explicit computed test entries", () => {
  for (const [body, consumerKind] of [
    ['const { createRequire } = await import("node:module"); const load = createRequire(import.meta.url); load("../test/helpers/native-ownership-cost.mjs");', "Node test writer consumer"],
    ['const load = (await import("node:module")).createRequire(import.meta.url); load("../test/helpers/native-ownership-cost.mjs");', "Node test computed source entry"],
    ['const load = process.getBuiltinModule("node:module").createRequire(import.meta.url); load("../test/helpers/native-ownership-cost.mjs");', "Node test computed source entry"],
    ['process.getBuiltinModule("node:module")._load("/workspace/tsonic-rust/test/helpers/native-ownership-cost.mjs");', "Node test computed source entry"],
    ['import { getBuiltinModule as get } from "node:process"; const load = get("node:module").createRequire(import.meta.url); load("../test/helpers/native-ownership-cost.mjs");', "Node test computed source entry"],
    ['const load = (await import("module")).createRequire(import.meta.url); load("../test/helpers/native-ownership-cost.mjs");', "Node test computed source entry"],
  ]) {
    const product = nativeBoundaryInputs();
    product.get("tsonic-rust").set("src/resolve.mjs", safetyFile(body));
    assert.equal(boundarySafety(product).nativeAllocationBoundary === undefined, true, body);
    const testInputs = nativeBoundaryInputs();
    const path = "test/computed-loader.test.mjs";
    testInputs.get("tsonic-rust").set(path, safetyFile(`import test from "node:test"; ${body}`));
    const accepted = boundarySafety(testInputs);
    assert.equal(accepted.findings.length, 0, body);
    assert.equal(accepted.nativeAllocationBoundary.consumers.some(consumer => consumer.path === `tsonic-rust/${path}` && consumer.kind === consumerKind), true, body);
  }
});

test("QFINAL: the entire builtin getter and observer-root class requires positive direct uses", () => {
  const load = '.createRequire(import.meta.url)("../test/helpers/native-ownership-cost.mjs")';
  const read = '(new URL("../../rust-runtime/tests/helpers/allocation_counts.rs", import.meta.url))';
  const cases = [
    ['global literal getter', `process["getBuiltinModule"]("node:module")${load};`],
    ['global computed getter', `process["get" + "BuiltinModule"]("node:module")${load};`],
    ['global process alias', `const owner = process; owner.getBuiltinModule("module")${load};`],
    ['global process argument', `consume(process);`],
    ['global process valueOf', 'const owner = process.valueOf();'],
    ['global-object valueOf', 'const owner = globalThis.valueOf();'],
    ['global process binding', `const { getBuiltinModule: get } = process; get("module")${load};`],
    ['global-object process', `globalThis["process"]["getBuiltinModule"]("module")${load};`],
    ['global-object alias', `const owner = globalThis; owner.process.getBuiltinModule("module")${load};`],
    ['global process write', 'globalThis.process = replacement;'],
    ['global process delete', 'delete globalThis["process"];'],
    ['unknown global property', 'const owner = globalThis[process.env.ROOT];'],
    ['default process', `import processOwner from "process"; processOwner["getBuiltinModule"]("module")${load};`],
    ['namespace process', `import * as processOwner from "node:process"; const get = processOwner.getBuiltinModule; get("module")${load};`],
    ['named getter', `import { getBuiltinModule as get } from "process"; const alias = get; alias("module")${load};`],
    ['reader alias', `import { readFileSync } from "node:fs"; const read = readFileSync; read${read};`],
    ['reader callback', 'import { readFileSync } from "fs"; consume(readFileSync);'],
    ['reader export', 'import { readFileSync } from "fs"; export { readFileSync };'],
    ['reader object escape', 'import { readFileSync } from "fs"; const readers = { read: readFileSync };'],
    ['namespace reader', `import * as fs from "fs"; fs["readFileSync"]${read};`],
    ['namespace reader alias', `import fs from "node:fs"; const read = fs.readFileSync; read${read};`],
    ['namespace destructure', `import fs from "fs"; const { readFileSync: read } = fs; read${read};`],
    ['namespace alias', 'import * as fs from "fs"; const alias = fs;'],
    ['namespace escape', 'import fs from "fs"; consume(fs);'],
    ['namespace valueOf', 'import fs from "fs"; const alias = fs.valueOf();'],
    ['namespace computed member', `import fs from "fs"; fs[process.env.READER]${read};`],
    ['namespace reader write', 'import fs from "fs"; fs.readFileSync = replacement;'],
    ['namespace promises', `import fs from "fs"; await fs.promises["readFile"]${read};`],
    ['named promises', `import { promises as fs } from "fs"; const read = fs.readFile; read${read};`],
    ['default-as namespace', `import { default as fs } from "fs"; const read = fs.copyFileSync; read${read};`],
    ['dynamic reader selection', `const { readFileSync: read } = await import("fs"); read${read};`],
    ['dynamic namespace', `const fs = await import("node:fs"); fs.readFileSync${read};`],
    ['dynamic direct member', `const read = (await import("fs"))["readFileSync"]; read${read};`],
    ['require direct member', `const read = require("fs").readFileSync; read${read};`],
    ['require alias', 'const load = require; load("../test/helpers/native-ownership-cost.mjs");'],
    ['require Module', 'const Module = require("module"); Module._load("../test/helpers/native-ownership-cost.mjs");'],
    ['dynamic namespace default', `const { default: fs } = await import("fs"); fs.readFileSync${read};`],
    ['dynamic nested promises', `const { promises: fs } = await import("fs"); fs.readFile${read};`],
    ['dynamic rest', 'const { writeFile, ...rest } = await import("fs/promises"); consume(rest);'],
    ['dynamic computed selection', 'const { [process.env.READER]: read } = await import("fs/promises");'],
    ['dynamic process', `const { getBuiltinModule: get } = await import("process"); get("module")${load};`],
    ['require reader', `const { readFileSync: read } = require("fs"); read${read};`],
    ['dynamic Worker', 'const { Worker } = await import("worker_threads"); new Worker("../test/helpers/native-ownership-cost.mjs");'],
    ['dynamic fork', 'const { fork } = require("child_process"); fork("../test/helpers/native-ownership-cost.mjs");'],
  ];
  for (const [label, body] of cases) {
    const product = nativeBoundaryInputs();
    product.get("tsonic-rust").set("src/emitter.mjs", safetyFile(body));
    assert.equal(boundarySafety(product).nativeAllocationBoundary === undefined, true, label);
    const testInputs = nativeBoundaryInputs();
    const path = "test/computed-root.test.mjs";
    testInputs.get("tsonic-rust").set(path, safetyFile(`import test from "node:test"; ${body}`));
    const result = boundarySafety(testInputs);
    assert.equal(result.findings.length, 0, `${label}: genuine test entry remains contained`);
    assert.equal(result.nativeAllocationBoundary.consumers.some(consumer => consumer.path === `tsonic-rust/${path}`), true,
      `${label}: actual effect or computed root is recorded, not ignored`);
    testInputs.get("tsonic-rust").set("src/promote.mjs", safetyFile(`import "../${path}";`));
    assert.equal(boundarySafety(testInputs).nativeAllocationBoundary === undefined, true, `${label}: product promotion still denies`);
  }
});

test("QFINAL: erased declarations and type parameters never hide native runtime roots", () => {
  for (const body of [
    'type process = {}; process["getBuiltinModule"]("module");',
    'interface process {} process["getBuiltinModule"]("module");',
    'function start<process>() { process["getBuiltinModule"]("module"); }',
    'declare const process: { getBuiltinModule(value: string): unknown }; process["getBuiltinModule"]("module");',
    'declare function require(path: string): unknown; const load = require; load("../test/helpers/native-ownership-cost.mjs");',
    'import fs = require("node:fs"); const read = fs.readFileSync; read(new URL("../../rust-runtime/tests/helpers/allocation_counts.rs", import.meta.url));',
    'import fs = require("node:fs"); fs.readFileSync(new URL("../../rust-runtime/tests/helpers/allocation_counts.rs", import.meta.url));',
    'import owner = process; owner.getBuiltinModule("module");',
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/ambient.ts", safetyFile(body));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, body);
  }
});

test("QFINAL: static non-reader selections and ordinary data uses retain native behavior", () => {
  for (const body of [
    'const { mkdtemp, writeFile: writeFileAsync, rm } = await import("node:fs/promises"); await writeFileAsync("data.txt", "data");',
    'const { existsSync, mkdirSync, writeFileSync } = await import("fs"); writeFileSync("data.txt", "data");',
    'const { mkdtemp, writeFile, rm } = require("fs/promises");',
    'import fs from "node:fs/promises"; const { writeFile: write } = fs; write("data", "bytes");',
    'import { readFileSync as read } from "fs"; const value = read(new URL("./data.json", import.meta.url));',
    'import * as fs from "node:fs"; fs["readFileSync"](new URL("./data.json", import.meta.url));',
    'import { promises as fs } from "node:fs"; await fs.readFile(new URL("./data.json", import.meta.url));',
    'import { default as fs } from "fs"; fs.writeFileSync("data", "bytes");',
    'process.cwd(); const env = process.env; const args = globalThis.process.argv;',
    'const nativeTypes = [typeof process, typeof globalThis];',
    'process.exitCode = 1; process.env = replacement; process.title += "-worker";',
    'import { default as processOwner } from "process"; processOwner["exitCode"] = 2; processOwner?.argv?.slice(2);',
    'const args = globalThis.process?.argv?.slice(2) ?? [];',
    'import fs from "fs"; fs.observerMetadata = {}; const metadata = fs?.constants;',
    'globalThis.observerMetadata = {}; delete globalThis.observerMetadata;',
    'const maps = new WeakMap<object, globalThis.Map<string, string>>();',
    'function local<process, globalThis>() { return 1; }',
    'const { process: localProcess, global: localGlobal } = input; consume(localProcess, localGlobal);',
    'import { readFileSync } from "fs"; const kind = typeof readFileSync; void readFileSync;',
    'import { getBuiltinModule } from "process"; const kind = typeof getBuiltinModule; void getBuiltinModule;',
    'const kind = typeof require;',
    'import * as processOwner from "process"; processOwner.cwd();',
    'const process = { getBuiltinModule: value => value }; const alias = process;',
    'function local(process) { const alias = process; return alias; }',
    'function local({ process }) { const alias = process; return alias; }',
    'function local(global) { return global; }',
    'const self = { value: 1 }; consume(self);',
    'class process {} const alias = process;',
    'namespace process { export const value = 1; } const alias = process;',
    'enum process { Value = 1 } const alias = process;',
    'const object = { get process() { return 1; }, set global(value) {} };',
    'import processOwner = require("node:process"); processOwner.exitCode = 1;',
    'import { readFileSync } from "fs"; function local(readFileSync) { return readFileSync; }',
    'import type { readFileSync } from "fs"; type Reader = typeof readFileSync;',
    'import { readFileSync } from "fs"; type Reader = typeof readFileSync;',
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/data.ts", safetyFile(body));
    const result = boundarySafety(inputs);
    assert.equal(result.findings.length, 0, body);
    assert.equal(result.nativeAllocationBoundary.externalDynamicEntries.some(entry => entry.path === "tsonic-rust/src/data.ts"), false,
      `${body}: a proven non-reader selection is not relabelled as an unproved external entry`);
  }
  const external = nativeBoundaryInputs();
  external.get("tsonic-rust").set("src/external.ts", safetyFile(
    'const { execFileSync } = await import("child_process"); execFileSync("ordinary-program");'));
  const externalResult = boundarySafety(external);
  assert.equal(externalResult.findings.length, 0, "foreign process has no proven first-party source entry");
  assert.equal(externalResult.nativeAllocationBoundary.externalDynamicEntries.some(entry =>
    entry.path === "tsonic-rust/src/external.ts" && entry.environment === "external-process"), true,
  "foreign executable remains explicitly outside the source proof");
  const nativeNode = nativeBoundaryInputs();
  nativeNode.get("tsonic-rust").set("src/launch.ts", safetyFile(
    'const { execFileSync } = await import("child_process"); execFileSync(process.execPath, ["../test/helpers/native-ownership-cost.mjs"]);'));
  assert.equal(boundarySafety(nativeNode).nativeAllocationBoundary === undefined, true,
    "the same native API with a known Node writer entry is not foreign process data");
});

test("C135-Q3: the complete 97 pinned root-use, entry and ordinary-native forms have explicit dispositions", () => {
  const OBS = 'new URL("../../rust-runtime/tests/helpers/allocation_counts.rs", import.meta.url)';
  const OBSH = 'new URL("../../../rust-runtime/tests/helpers/allocation_counts.rs", import.meta.url)';
  const OBSP = '"../../rust-runtime/tests/helpers/allocation_counts.rs"';
  const WR = '"../test/helpers/native-ownership-cost.mjs"';
  const WRU = `new URL(${WR}, import.meta.url)`;
  const LOAD = `.createRequire(import.meta.url); export const w = r(${WR});`;
  const productEntries = (text, path = "src/x.mjs") => [["tsonic-rust", path, text]];
  const helperEntries = text => [["tsonic-rust", "test/helpers/h.mjs", text]];
  const testEntries = text => [["tsonic-rust", "test/x.test.mjs", `import test from "node:test"; ${text}`]];
  const pairedEntries = (helper, user) => [["tsonic-rust", "src/fsx.mjs", helper], ["tsonic-rust", "src/x.mjs", user]];
  const cases = [
    ["c1", "deny", "direct readFileSync(observer)", productEntries(`import { readFileSync } from "node:fs"; readFileSync(${OBS});`)],
    ["c2", "deny", "direct process.getBuiltinModule(\"node:module\")", productEntries(`const r = process.getBuiltinModule("node:module")${LOAD}`)],
    ["c3", "deny", "CJS require(writer)", productEntries(`require(${WR});`, "src/x.cjs")],
    ["c4", "deny", "named import getBuiltinModule from node:process", productEntries(`import { getBuiltinModule } from "node:process"; const r = getBuiltinModule("node:module")${LOAD}`)],
    ["c5", "deny", "node:fs/promises readFile(observer)", productEntries(`import { readFile } from "node:fs/promises"; await readFile(${OBS});`)],
    ["c6", "deny", "static import of the writer from .ts", productEntries(`import w from ${WR}; export default w;`, "src/x.ts")],
    ["c7", "deny", "test-tree helper (not an entry) direct readFileSync(observer)", helperEntries(`import { readFileSync } from "node:fs"; readFileSync(${OBSH});`)],
    ["c8", "deny", "aliased address helper with literal evidence", productEntries(`import { readFileSync } from "node:fs"; import { join } from "node:path"; const j = join; readFileSync(j(process.cwd(), ${OBSP}));`)],
    ["c9", "deny", "Worker eval code string", productEntries(`import { Worker } from "node:worker_threads"; new Worker("import(" + JSON.stringify(${WR}) + ")", { eval: true });`)],
    ["c10", "deny", "await import(\"node:module\") (W1)", productEntries(`const { createRequire: c } = await import("node:module"); const r = c(import.meta.url); r(${WR});`)],
    ["c11", "deny", "process.getBuiltinModule(\"node:fs\").readFileSync (getter recognized)", productEntries(`process.getBuiltinModule("node:fs").readFileSync(${OBS});`)],
    ["c12", "deny", "direct import(writer)", productEntries(`await import(${WR});`)],
    ["c13", "info", "test entry: aliased observer read (allowed position)", testEntries(`import { readFileSync } from "node:fs"; const read = readFileSync; read(new URL("../../rust-runtime/tests/helpers/allocation_counts.rs", import.meta.url));`)],
    ["A1", "class", "K-0118 process[\"getBuiltinModule\"]", productEntries(`const r = process["getBuiltinModule"]("node:module")${LOAD}`)],
    ["A1h", "class", "K-0118 process[\"getBuiltinModule\"] in a test-tree helper", helperEntries(`const r = process["getBuiltinModule"]("node:module").createRequire(import.meta.url); export const w = r("./native-ownership-cost.mjs");`)],
    ["A2", "class", "process[`getBuiltinModule`]", productEntries(`const r = process[\`getBuiltinModule\`]("node:module")${LOAD}`)],
    ["A3", "class", "process[\"getBuiltin\" + \"Module\"] (computed key)", productEntries(`const r = process["getBuiltin" + "Module"]("node:module")${LOAD}`)],
    ["A4", "class", "globalThis.process.getBuiltinModule", productEntries(`const r = globalThis.process.getBuiltinModule("node:module")${LOAD}`)],
    ["A5", "class", "global.process.getBuiltinModule", productEntries(`const r = global.process.getBuiltinModule("node:module")${LOAD}`)],
    ["A6", "class", "globalThis[\"process\"].getBuiltinModule", productEntries(`const r = globalThis["process"].getBuiltinModule("node:module")${LOAD}`)],
    ["A7", "class", "const g = process.getBuiltinModule; g(...)", productEntries(`const g = process.getBuiltinModule; const r = g("node:module")${LOAD}`)],
    ["A8", "class", "const { getBuiltinModule } = process", productEntries(`const { getBuiltinModule } = process; const r = getBuiltinModule("node:module")${LOAD}`)],
    ["A9", "class", "const { getBuiltinModule: g } = process", productEntries(`const { getBuiltinModule: g } = process; const r = g("node:module")${LOAD}`)],
    ["A10", "class", "process.getBuiltinModule.call(process, ...)", productEntries(`const r = process.getBuiltinModule.call(process, "node:module")${LOAD}`)],
    ["A11", "class", "Reflect.get(process, \"getBuiltinModule\")", productEntries(`const r = Reflect.get(process, "getBuiltinModule")("node:module")${LOAD}`)],
    ["A12", "class", "process passed as a value: (q => q.getBuiltinModule(...))(process)", productEntries(`const r = (q => q.getBuiltinModule("node:module"))(process)${LOAD}`)],
    ["A13", "class", "const process = globalThis.process; process.getBuiltinModule (local alias disables the recognizer)", productEntries(`const process = globalThis.process; const r = process.getBuiltinModule("node:module")${LOAD}`)],
    ["A14", "class", "import proc from \"node:process\"; proc[\"getBuiltinModule\"]", productEntries(`import proc from "node:process"; const r = proc["getBuiltinModule"]("node:module")${LOAD}`)],
    ["A15", "class", "import * as ns from \"node:process\"; ns[\"getBuiltinModule\"]", productEntries(`import * as ns from "node:process"; const r = ns["getBuiltinModule"]("node:module")${LOAD}`)],
    ["A16", "class", "bare import process from \"process\"; process.getBuiltinModule", productEntries(`import process from "process"; const r = process.getBuiltinModule("node:module")${LOAD}`)],
    ["A17", "class", "bare import { getBuiltinModule } from \"process\"", productEntries(`import { getBuiltinModule } from "process"; const r = getBuiltinModule("node:module")${LOAD}`)],
    ["A18", "class", "(await import(\"node:process\")).default.getBuiltinModule", productEntries(`const ns = await import("node:process"); const r = ns.default.getBuiltinModule("node:module")${LOAD}`)],
    ["A19", "class", "process?.[\"getBuiltinModule\"]", productEntries(`const r = process?.["getBuiltinModule"]("node:module")${LOAD}`)],
    ["A20", "class", "CJS with (process) getBuiltinModule(...)", productEntries(`with (process) { const r = getBuiltinModule("node:module").createRequire(__filename); r(${WR}); }`, "src/x.cjs")],
    ["B1", "class", "K-0118 const read = readFileSync; read(observer)", productEntries(`import { readFileSync } from "node:fs"; const read = readFileSync; read(${OBS});`)],
    ["B1h", "class", "K-0118 alias read in a test-tree helper", helperEntries(`import { readFileSync } from "node:fs"; const read = readFileSync; read(${OBSH});`)],
    ["B2", "class", "const { readFileSync } = fs namespace", productEntries(`import * as fs from "node:fs"; const { readFileSync } = fs; readFileSync(${OBS});`)],
    ["B3", "class", "fs[\"readFileSync\"](observer)", productEntries(`import * as fs from "node:fs"; fs["readFileSync"](${OBS});`)],
    ["B4", "class", "const f2 = fs; f2.readFileSync(observer)", productEntries(`import * as fs from "node:fs"; const f2 = fs; f2.readFileSync(${OBS});`)],
    ["B5", "class", "readFileSync.call(null, observer)", productEntries(`import { readFileSync } from "node:fs"; readFileSync.call(null, ${OBS});`)],
    ["B6", "class", "readFileSync.apply(null, [observer])", productEntries(`import { readFileSync } from "node:fs"; readFileSync.apply(null, [${OBS}]);`)],
    ["B7", "class", "readFileSync.bind(null)(observer)", productEntries(`import { readFileSync } from "node:fs"; readFileSync.bind(null)(${OBS});`)],
    ["B8", "class", "Reflect.apply(readFileSync, null, [observer])", productEntries(`import { readFileSync } from "node:fs"; Reflect.apply(readFileSync, null, [${OBS}]);`)],
    ["B9", "class", "[observer].map(readFileSync)", productEntries(`import { readFileSync } from "node:fs"; [${OBS}].map(readFileSync);`)],
    ["B10", "class", "fs.promises.readFile(observer)", productEntries(`import * as fs from "node:fs"; await fs.promises.readFile(${OBS});`)],
    ["B11", "class", "import { promises } from \"node:fs\"; promises.readFile", productEntries(`import { promises } from "node:fs"; await promises.readFile(${OBS});`)],
    ["B12", "class", "import { default as fs } from \"node:fs\"; fs.readFileSync", productEntries(`import { default as fs } from "node:fs"; fs.readFileSync(${OBS});`)],
    ["B13", "class", "import * as fs; fs.default.readFileSync", productEntries(`import * as fs from "node:fs"; fs.default.readFileSync(${OBS});`)],
    ["B14", "class", "bare import { readFileSync } from \"fs\"", productEntries(`import { readFileSync } from "fs"; readFileSync(${OBS});`)],
    ["B15", "class", "bare import { readFile } from \"fs/promises\"", productEntries(`import { readFile } from "fs/promises"; await readFile(${OBS});`)],
    ["B16", "class", "const fs = await import(\"node:fs\"); fs.readFileSync", productEntries(`const fs = await import("node:fs"); fs.readFileSync(${OBS});`)],
    ["B17", "class", "const { readFileSync } = await import(\"node:fs\")", productEntries(`const { readFileSync } = await import("node:fs"); readFileSync(${OBS});`)],
    ["B18", "class", "createRequire binding r(\"node:fs\").readFileSync", productEntries(`import { createRequire } from "node:module"; const r = createRequire(import.meta.url); const fs = r("node:fs"); fs.readFileSync(${OBS});`)],
    ["B19", "class", "local module: export { readFileSync as read } from \"node:fs\"", pairedEntries('export { readFileSync as read } from "node:fs";', `import { read } from "./fsx.mjs"; read(${OBS});`)],
    ["B20", "class", "local module: export const read = readFileSync", pairedEntries('import { readFileSync } from "node:fs"; export const read = readFileSync;', `import { read } from "./fsx.mjs"; read(${OBS});`)],
    ["B21", "class", "local module: export * from \"node:fs\"", pairedEntries('export * from "node:fs";', `import { readFileSync } from "./fsx.mjs"; readFileSync(${OBS});`)],
    ["B22", "class", "TypeScript import fs = require(\"node:fs\")", productEntries(`import fs = require("node:fs"); fs.readFileSync(${OBS});`, "src/x.cts")],
    ["B23", "class", "CJS require(\"node:fs\").readFileSync", productEntries(`require("node:fs").readFileSync(${OBSP});`, "src/x.cjs")],
    ["B24", "class", "CJS const { readFileSync } = require(\"node:fs\")", productEntries(`const { readFileSync } = require("node:fs"); readFileSync(${OBSP});`, "src/x.cjs")],
    ["B25", "class", "const copy = copyFileSync; copy(observer, dest)", productEntries(`import { copyFileSync } from "node:fs"; const copy = copyFileSync; copy(${OBS}, process.env.D);`)],
    ["B26", "class", "fs.readFileSync.call(fs, observer) (namespace member)", productEntries(`import * as fs from "node:fs"; fs.readFileSync.call(fs, ${OBS});`)],
    ["C1", "class", "CJS module.require(writer)", productEntries(`module.require(${WR});`, "src/x.cjs")],
    ["C2", "class", "CJS require.call(null, writer)", productEntries(`require.call(null, ${WR});`, "src/x.cjs")],
    ["C3", "class", "CJS const r = require; r(writer)", productEntries(`const r = require; r(${WR});`, "src/x.cjs")],
    ["C4", "class", "CJS require.main.require(writer)", productEntries(`require.main.require(${WR});`, "src/x.cjs")],
    ["C5", "class", "CJS process.mainModule.require(writer)", productEntries(`process.mainModule.require(${WR});`, "src/x.cjs")],
    ["C6", "class", "CJS module.constructor._load(writer) (no prefilter keyword)", productEntries(`module.constructor._load(${WR});`, "src/x.cjs")],
    ["C7", "class", "CJS const M = require(\"node:module\"); M.createRequire(...)(writer)", productEntries(`const M = require("node:module"); const r = M.createRequire(__filename); r(${WR});`, "src/x.cjs")],
    ["C8", "class", "createRequire binding r(\"node:module\").createRequire(...)(writer)", productEntries(`import { createRequire } from "node:module"; const r = createRequire(import.meta.url); const M = r("node:module"); const r2 = M.createRequire(import.meta.url); r2(${WR});`)],
    ["C9", "class", "TypeScript import w = require(writer) (static entry form)", productEntries(`import w = require(${WR}); export default w;`, "src/x.cts")],
    ["C10", "class", "TypeScript import M = require(\"node:module\")", productEntries(`import M = require("node:module"); const r = M.createRequire(__filename); r(${WR});`, "src/x.cts")],
    ["D1", "class", "eval(\"import(writer)\")", productEntries(`await eval("import(" + JSON.stringify(${WR}) + ")");`)],
    ["D2", "class", "new Function(\"return import(writer)\")", productEntries(`await new Function("return import(" + JSON.stringify(${WR}) + ")")();`)],
    ["D3", "class", "Function(\"return import(writer)\") without new", productEntries(`await Function("return import(" + JSON.stringify(${WR}) + ")")();`)],
    ["D4", "class", "vm.runInThisContext(code naming the writer)", productEntries(`import vm from "node:vm"; vm.runInThisContext("import(" + JSON.stringify(${WR}) + ")");`)],
    ["D5", "class", "spawn(process.execPath, [writer])", productEntries(`import { spawn } from "node:child_process"; spawn(process.execPath, [${WR}]);`)],
    ["D6", "class", "spawnSync(process.execPath, [\"--import\", writer, \"-e\", \"0\"])", productEntries(`import { spawnSync } from "node:child_process"; spawnSync(process.execPath, ["--import", ${WR}, "-e", "0"]);`)],
    ["D7", "class", "execFileSync(\"cp\", [observer, dest])", productEntries(`import { execFileSync } from "node:child_process"; execFileSync("cp", [${OBSP}, process.env.D]);`)],
    ["E1", "class", "cpSync(observer directory, dest)", productEntries(`import { cpSync } from "node:fs"; cpSync(new URL("../../rust-runtime/tests/helpers/", import.meta.url), process.env.D, { recursive: true });`)],
    ["E2", "class", "symlinkSync(observer, dest)", productEntries(`import { symlinkSync } from "node:fs"; symlinkSync(${OBS}, process.env.D);`)],
    ["E3", "class", "linkSync(observer, dest)", productEntries(`import { linkSync } from "node:fs"; linkSync(${OBS}, process.env.D);`)],
    ["E4", "class", "createReadStream(observer)", productEntries(`import { createReadStream } from "node:fs"; createReadStream(${OBS});`)],
    ["E5", "class", "openSync + readSync(observer)", productEntries(`import { openSync, readSync } from "node:fs"; const fd = openSync(${OBS}, "r"); readSync(fd, Buffer.alloc(8));`)],
    ["E6", "class", "openAsBlob(observer)", productEntries(`import { openAsBlob } from "node:fs"; await openAsBlob(${OBS});`)],
    ["E7", "class", "fs/promises cp(observer, dest)", productEntries(`import { cp } from "node:fs/promises"; await cp(${OBS}, process.env.D);`)],
    ["E8", "class", "fs/promises open(observer).readFile()", productEntries(`import { open } from "node:fs/promises"; await (await open(${OBS})).readFile();`)],
    ["E9", "class", "renameSync(observer, dest)", productEntries(`import { renameSync } from "node:fs"; renameSync(${OBS}, process.env.D);`)],
    ["P1", "allow", "globalThis.process?.argv dot read (tsts go/flag shape)", productEntries(`export const a = globalThis.process?.argv?.slice(2) ?? [];`)],
    ["P2", "allow", "fs.constants member read", productEntries(`import * as fs from "node:fs"; fs.accessSync(process.cwd(), fs.constants.R_OK);`)],
    ["P3", "allow", "realpathSync.native", productEntries(`import { realpathSync } from "node:fs"; export const r = realpathSync.native(process.cwd());`)],
    ["P4", "allow", "non-entry const { mkdtemp, writeFile, rm } = await import(\"node:fs/promises\")", productEntries(`const { mkdtemp, writeFile, rm } = await import("node:fs/promises"); await rm(await mkdtemp("x"), { recursive: true }); await writeFile("y", "");`)],
    ["P5", "allow", "process.env read", productEntries(`export const v = process.env.HOME;`)],
    ["P6", "allow", "test entry const { readFileSync } = await import(\"node:fs\") on a data file", testEntries(`const { readFileSync } = await import("node:fs"); readFileSync(new URL("./data.json", import.meta.url));`)],
    ["P7", "allow", "test fixture non-entry new Function(...names, body) (census site)", [["tsonic-rust", "test/fixtures/f.mjs", `export const make = (names, entry) => new Function(...names, entry.body);`]]],
    ["P8", "allow", "non-entry spawnSync(process.execPath, [\"--test\", ...files]) (census shape)", productEntries(`import { spawnSync } from "node:child_process"; export const run = files => spawnSync(process.execPath, ["--test", "--test-concurrency=1", ...files]);`)],
    ["P9", "edit", "test-tree helper re-exports readFile (census site; rule denies, consumers edit)", [["tsonic-rust", "test/helpers/h.mjs", `import { readFile } from "node:fs/promises"; export { readFile };`], ["tsonic-rust", "test/x.test.mjs", `import test from "node:test"; import { readFile } from "./helpers/h.mjs"; await readFile(new URL("./data.json", import.meta.url));`]]],
    ["F1", "info", "wrapper const load = s => import(s); load(writer) (listed external dynamic entry)", productEntries(`const load = (s) => import(s); load(${WR});`)],
  ];

  assert.equal(cases.length, 97, "all reviewer control and member programs are retained");
  for (const [id, expectation, label, entries] of cases) {
    const inputs = nativeBoundaryInputs();
    for (const [repo, file, text] of entries) inputs.get(repo).set(file, safetyFile(text));
    const result = boundarySafety(inputs);
    const denied = ["deny", "class", "edit"].includes(expectation) && id !== "D7";
    assert.equal(result.nativeAllocationBoundary === undefined, denied, `${id}: ${label}`);
    if (denied) {
      assert.equal(result.findings.filter(finding => finding.subject === "native safety").length, 8, `${id}: no unproved allocator credits`);
    } else {
      assert.equal(result.findings.length, 0, `${id}: ordinary native and genuine test uses stay admitted`);
      if (id === "D7") {
        assert.equal(result.nativeAllocationBoundary.externalDynamicEntries.some(entry => entry.environment === "external-process"), true, "non-Node external dynamic IO is explicitly unproved, not a sandbox claim");
      }
      if (id === "F1" || id === "P7" || id === "P8") assert.equal(result.nativeAllocationBoundary.externalDynamicEntries.length > 0, true, `${id}: the non-static entry is recorded, never silently proven`);
    }
  }
});


test("C135-Q3: native Node executable identities, entry arguments, loader flags and code flags share the entry cut", () => {
  const writer = '../test/helpers/native-ownership-cost.mjs';
  for (const executable of ['process.execPath', 'process.argv[0]', 'process.argv0', '"node"']) {
    for (const method of ['spawn', 'spawnSync', 'execFile', 'execFileSync']) {
      for (const arguments_ of [
        JSON.stringify([writer]),
        JSON.stringify(['--test', '--test-concurrency', '1', writer]),
        JSON.stringify(['--import', writer, '-e', '0']),
        JSON.stringify([`--import=${writer}`, '-e', '0']),
        JSON.stringify(['--require', writer, '-e', '0']),
        JSON.stringify(['-r', writer, '-e', '0']),
        JSON.stringify([`-r${writer}`, '-e', '0']),
        JSON.stringify(['--loader', writer, '-e', '0']),
        JSON.stringify(['--experimental-loader', writer, '-e', '0']),
        JSON.stringify(['--', writer]),
        `[...prefix, ${JSON.stringify(writer)}]`,
      ]) {
        const inputs = nativeBoundaryInputs();
        const label = `${method} ${executable} ${arguments_}`;
        inputs.get('tsonic-rust').set('src/launch.mjs', safetyFile(`import { ${method} } from "node:child_process"; ${method}(${executable}, ${arguments_});`));
        assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, label);
      }
    }
  }
  for (const flag of ['-e', '--eval', '-p', '--print']) {
    for (const arguments_ of [JSON.stringify([flag, `import(${JSON.stringify(writer)})`]),
      JSON.stringify([`${flag}=import(${JSON.stringify(writer)})`]),
      ...(['-e', '-p'].includes(flag) ? [JSON.stringify([`${flag}import(${JSON.stringify(writer)})`])] : [])]) {
      const inputs = nativeBoundaryInputs();
      inputs.get('tsonic-rust').set('src/code.mjs', safetyFile(`import { spawnSync } from "node:child_process"; spawnSync(process.execPath, ${arguments_});`));
      assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, arguments_);
    }
  }
  for (const body of [
    'import { spawnSync } from "node:child_process"; spawnSync(process.execPath, ["--test", "--test-concurrency", "1", ...files]);',
    'import { spawnSync } from "node:child_process"; spawnSync(process.execPath, ["--eval", "1 + 1"]);',
    'import { spawnSync } from "node:child_process"; spawnSync("dotnet", ["test", project]);',
    'import { execFileSync } from "node:child_process"; execFileSync("cp", ["../../rust-runtime/tests/helpers/allocation_counts.rs", destination]);',
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get('tsonic-rust').set('scripts/ordinary.mjs', safetyFile(body));
    const result = boundarySafety(inputs);
    assert.equal(result.findings.length, 0, body);
    assert.equal(result.nativeAllocationBoundary.externalDynamicEntries.length > 0, true, 'unknown entries remain explicitly unproved');
  }
});

test("C135-Q3: guarded globals, native destructured members and VM values cannot escape through unmodelled uses", () => {
  for (const body of [
    'globalThis.eval("import(\"../test/helpers/native-ownership-cost.mjs\")");',
    'global["Function"]("return import(\"../test/helpers/native-ownership-cost.mjs\")")();',
    'const execute = eval;', 'consume(Function);', 'globalThis.require = replacement;', 'delete globalThis.module;',
    'process.binding("fs");', 'process.dlopen(module, "addon.node");',
    'import vm from "vm"; const execute = vm.runInThisContext;',
    'const { runInThisContext: execute } = await import("node:vm"); execute("import(\"../test/helpers/native-ownership-cost.mjs\")");',
    'const { readFileSync } = await import("node:fs"); consume(readFileSync);',
    'import fs from "node:fs"; const { [field]: read } = fs;',
    'import fs from "node:fs"; const { readFileSync = fallback } = fs;',
    'import fs from "node:fs"; let { readFileSync } = fs;',
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get('tsonic-rust').set('src/root.mjs', safetyFile(body));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, body);
  }
  for (const body of [
    'import fs from "node:fs"; const { writeFile, constants } = fs; consume(constants); writeFile("output", "");',
    'const { mkdtemp, rm } = await import("node:fs/promises"); function local(rm) { return rm; }',
    'function ordinary(Function, module, require) { consume(Function, module, require); }',
    'const process = { binding: () => 1 }; process.binding();',
    'const metadata = { module: 1, eval: 2, Function: 3 };',
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get('tsonic-rust').set('src/ordinary.mjs', safetyFile(body));
    assert.equal(boundarySafety(inputs).findings.length, 0, body);
  }
});

test("C135-Q3: shell text is an unproved source entry, never an inferred non-Node executable", () => {
  for (const method of ['exec', 'execSync']) {
    for (const argument of ['"node --import ../test/helpers/native-ownership-cost.mjs"',
      '"cp source destination"', '`node ${flags} ${entry}`', 'command']) {
      const body = `import { ${method} } from "node:child_process"; ${method}(${argument});`;
      const inputs = nativeBoundaryInputs();
      inputs.get('tsonic-rust').set('src/shell.mjs', safetyFile(body));
      assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, `${method}: ${argument}`);
      const contained = nativeBoundaryInputs();
      contained.get('tsonic-rust').set('test/shell.test.mjs', safetyFile(`import test from "node:test"; ${body}`));
      const result = boundarySafety(contained);
      assert.equal(result.findings.length, 0, `${method}: genuine test entry is contained`);
      assert.equal(result.nativeAllocationBoundary.consumers.some(consumer => consumer.path === 'tsonic-rust/test/shell.test.mjs' &&
        consumer.kind === 'Node test computed source entry'), true, `${method}: no shell evaluation or false non-Node proof`);
    }
  }
});

test("QRC-01: every Function parameter and body is nonliteral code evidence, not a module filename", () => {
  const imported = 'import("../test/helpers/native-ownership-cost.mjs")';
  const firstDefault = JSON.stringify(`x = ${imported}`);
  const secondDefault = JSON.stringify(`y = ${imported}`);
  for (const body of [
    `new Function(${firstDefault}, "")();`,
    `Function(${firstDefault}, "")();`,
    `new Function("x", ${secondDefault}, "")();`,
    `new Function("x", ${JSON.stringify(`return ${imported}`)})();`,
    `globalThis.Function(${firstDefault}, "")();`,
    `eval(${JSON.stringify(imported)});`,
    `import vm from "node:vm"; vm.runInThisContext(${JSON.stringify(imported)});`,
  ]) {
    const product = nativeBoundaryInputs();
    product.get("tsonic-rust").set("src/code.mjs", safetyFile(body));
    assert.equal(boundarySafety(product).nativeAllocationBoundary === undefined, true, body);
    const contained = nativeBoundaryInputs();
    contained.get("tsonic-rust").set("test/code.test.mjs", safetyFile(`import test from "node:test"; ${body}`));
    const result = boundarySafety(contained);
    assert.equal(result.findings.length, 0, `${body}: contained code`);
    assert.equal(result.nativeAllocationBoundary.consumers.some(consumer => consumer.path === "tsonic-rust/test/code.test.mjs" &&
      consumer.kind === "Node test computed source entry"), true, `${body}: no string evaluation or guessed module path`);
  }
  const malformed = nativeBoundaryInputs();
  malformed.get("tsonic-rust").set("test/code.test.mjs", safetyFile(
    'import test from "node:test"; new Function("x = import("../test/helpers/native-ownership-cost.mjs")", "")();'));
  const malformedResult = boundarySafety(malformed);
  assert.equal(malformedResult.nativeAllocationBoundary === undefined, true,
    "unquoted nested code is still malformed even in a genuine test entry");
  assert.equal(malformedResult.findings.some(finding => finding.reason.includes("unresolved executable source syntax")), true,
    "malformed syntax retains its explicit refusal");
  for (const body of ['new Function("value", "return value");', 'const make = (names, entry) => new Function(...names, entry.body);',
    'eval(code);', 'import vm from "node:vm"; vm.runInThisContext(code);']) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/unknown-code.mjs", safetyFile(body));
    const result = boundarySafety(inputs);
    assert.equal(result.findings.length, 0, body);
    assert.equal(result.nativeAllocationBoundary.externalDynamicEntries.some(entry => entry.environment === "code-string"), true,
      `${body}: unknown code stays explicitly unproved`);
  }
});

test("QRC-10: entry constructors preserve native accessor kinds and optional-call rejection", () => {
  for (const [prefix, construction] of [
    ["", "new Function"],
    ["", "new globalThis.Function"],
    ['import { Script as NativeScript } from "node:vm"; ', "new NativeScript"],
    ['import * as vm from "node:vm"; ', "new vm.Script"],
    ['import vm from "node:vm"; ', "new vm.Script"],
  ]) {
    const ordinary = nativeBoundaryInputs();
    ordinary.get("tsonic-rust").set("src/constructor.mjs", safetyFile(`${prefix}${construction}("value");`));
    const ordinaryResult = boundarySafety(ordinary);
    assert.equal(ordinaryResult.findings.length, 0, `${construction}: ordinary code does not query a call-only token`);
    assert.equal(ordinaryResult.nativeAllocationBoundary.externalDynamicEntries.some(entry => entry.environment === "code-string"), true,
      `${construction}: code remains explicitly unproved`);
    const source = `${prefix}${construction}(${JSON.stringify("import('../test/helpers/native-ownership-cost.mjs')")});`;
    const product = nativeBoundaryInputs();
    product.get("tsonic-rust").set("src/constructor.mjs", safetyFile(source));
    assert.equal(boundarySafety(product).nativeAllocationBoundary === undefined, true, `${construction}: product promotion denied`);
    const contained = nativeBoundaryInputs();
    contained.get("tsonic-rust").set("test/constructor.test.mjs", safetyFile(`import test from "node:test"; ${source}`));
    const containedResult = boundarySafety(contained);
    assert.equal(containedResult.findings.length, 0, `${construction}: genuine test entry contains computed code`);
    assert.equal(containedResult.nativeAllocationBoundary.consumers.some(consumer =>
      consumer.path === "tsonic-rust/test/constructor.test.mjs" && consumer.kind === "Node test computed source entry"), true,
      `${construction}: containment is not a guessed code filename`);
  }
  for (const source of [
    'Function?.("value");',
    'globalThis.Function?.("value");',
    'import { Script as NativeScript } from "node:vm"; NativeScript?.("value");',
    'import * as vm from "node:vm"; vm.Script?.("value");',
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/optional.mjs", safetyFile(source));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, `${source}: optional callee remains unproved`);
  }
});

test("QRC-02: complete known Node operand classes preserve entry position and fail closed on unknown grammar", () => {
  const writer = "../test/helpers/native-ownership-cost.mjs";
  const valueOptions = ["--conditions", "-C", "--title", "--input-type", "--inspect-port", "--debug-port", "--report-directory",
    "--test-concurrency", "--test-name-pattern", "--test-skip-pattern", "--test-reporter-destination", "--test-shard",
    "--test-timeout", "--test-isolation", "--experimental-test-isolation", "--test-coverage-lines", "--test-coverage-functions",
    "--test-coverage-branches", "--test-coverage-include", "--test-coverage-exclude", "--test-random-seed", "--test-rerun-failures",
    "--cpu-prof-dir", "--cpu-prof-name", "--cpu-prof-interval", "--heap-prof-dir", "--heap-prof-name", "--heap-prof-interval",
    "--heapsnapshot-near-heap-limit", "--heapsnapshot-signal", "--diagnostic-dir", "--trace-event-categories",
    "--trace-event-file-pattern", "--dns-result-order", "--disable-proto", "--disable-warning", "--localstorage-file",
    "--max-old-space-size", "--max-semi-space-size", "--max-heap-size", "--max-old-space-size-percentage",
    "--max-http-header-size", "--stack-trace-limit", "--secure-heap", "--secure-heap-min", "--v8-pool-size",
    "--allow-fs-read", "--allow-fs-write", "--watch-path", "--watch-kill-signal", "--unhandled-rejections",
    "--redirect-warnings", "--report-dir", "--report-filename", "--report-signal", "--tls-cipher-list", "--tls-keylog",
    "--use-largepages", "--icu-data-dir", "--openssl-config", "--inspect-publish-uid", "--trace-require-module",
    "--security-revert", "--security-reverts", "--network-family-autoselection-attempt-timeout", "--experimental-test-tag-filter"];
  for (const flag of valueOptions) {
    for (const args of [`[${JSON.stringify(flag)}, "ordinary-value", ENTRY, ${JSON.stringify(writer)}]`,
      `[${JSON.stringify(`${flag}=ordinary-value`)}, ENTRY, ${JSON.stringify(writer)}]`]) {
      const inputs = nativeBoundaryInputs();
      const program = `import { spawnSync } from "node:child_process"; spawnSync(process.execPath, ${args.replace("ENTRY", 'new URL("./ordinary.mjs", import.meta.url).href')});`;
      inputs.get("tsonic-rust").set("src/launch.mjs", safetyFile(program));
      inputs.get("tsonic-rust").set("src/ordinary.mjs", safetyFile("export const value = 1;"));
      assert.equal(boundarySafety(inputs).findings.length, 0, `${flag}: consume the operand and stop at the actual entry`);
    }
  }
  for (const flag of ["--env-file", "--env-file-if-exists", "--run", "--build-sea", "--experimental-sea-config",
    "--experimental-package-map", "--build-snapshot-config", "--experimental-config-file", "--snapshot-blob"]) {
    for (const args of [[flag, "./ordinary.data", writer], [`${flag}=./ordinary.data`, writer]]) {
      const inputs = nativeBoundaryInputs();
      inputs.get("tsonic-rust").set("src/launch.mjs", safetyFile(`import { spawnSync } from "node:child_process"; spawnSync(process.execPath, ${JSON.stringify(args)});`));
      inputs.get("tsonic-rust").set("src/ordinary.data", safetyFile("ordinary data"));
      assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, `${flag}: opaque execution/environment configuration is unproved`);
    }
  }
  for (const flag of ["--future-unknown", "--future-unknown=value", "--not-a-known-value-flag", "-Z"]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/launch.mjs", safetyFile(`import { spawnSync } from "node:child_process"; spawnSync(process.execPath, [${JSON.stringify(flag)}, "ordinary.env", ${JSON.stringify(writer)}]);`));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, `${flag}: never guess unknown arity`);
  }
  for (const flag of ["--import", "--require", "-r", "--loader", "--experimental-loader", "--test-global-setup", "--test-reporter"]) {
    const testPlugin = ["--test-global-setup", "--test-reporter"].includes(flag);
    const launch = testPlugin ? ["--test", "test/ordinary.test.mjs"] : ["-e", "0"];
    for (const args of [[flag, writer, ...launch], [`${flag}=${writer}`, ...launch]]) {
      const inputs = nativeBoundaryInputs();
      if (testPlugin) inputs.get("tsonic-rust").set("test/ordinary.test.mjs", safetyFile('import test from "node:test"; test("ordinary", () => {});'));
      inputs.get("tsonic-rust").set("src/launch.mjs", safetyFile(`import { spawnSync } from "node:child_process"; spawnSync(process.execPath, ${JSON.stringify(args)});`));
      assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, `${flag}: native module-entry option`);
    }
  }
  for (const args of [["-pe", `import(${JSON.stringify(writer)})`], ["--", writer],
    ["--experimental-default-config-file"], ["--print", "--import", writer]]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/launch.mjs", safetyFile(`import { spawnSync } from "node:child_process"; spawnSync(process.execPath, ${JSON.stringify(args)});`));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, JSON.stringify(args));
  }
  for (const args of ['["--test", "--test-reporter=tap", "--test-concurrency=1", ...files]',
    '["--inspect=127.0.0.1:9229", "--no-warnings", "--test", ...files]', '["--print"]']) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/launch.mjs", safetyFile(`import { spawnSync } from "node:child_process"; export const run = files => spawnSync(process.execPath, ${args});`));
    const result = boundarySafety(inputs);
    assert.equal(result.findings.length, 0, args);
    assert.equal(result.nativeAllocationBoundary.externalDynamicEntries.length > 0, true, `${args}: unknown programs stay unproved`);
  }
});

test("QRC-02: explicit execution options, Node environment and shell code share one nonliteral entry cut", () => {
  const writer = 'new URL("../test/helpers/native-ownership-cost.mjs", import.meta.url).href';
  for (const options of [`{ execArgv: ["--import", ${writer}] }`, `{ execArgv: ["--require", ${writer}] }`,
    `{ execArgv: ["--loader", ${writer}] }`, '{ execArgv: ["--eval", "import(\"../test/helpers/native-ownership-cost.mjs\")"] }',
    `{ env: { ...process.env, NODE_OPTIONS: "--import " + ${writer} } }`,
    `{ env: { [option]: "--import " + ${writer} } }`, '{ execArgv }', '{ ...options }']) {
    for (const call of [`import { Worker } from "node:worker_threads"; new Worker(new URL("./ordinary.mjs", import.meta.url), ${options});`,
      `import { fork } from "node:child_process"; fork(new URL("./ordinary.mjs", import.meta.url), [], ${options});`]) {
      const inputs = nativeBoundaryInputs();
      inputs.get("tsonic-rust").set("src/launch.mjs", safetyFile(call));
      inputs.get("tsonic-rust").set("src/ordinary.mjs", safetyFile("export const value = 1;"));
      assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, call);
    }
  }
  for (const call of [
    `import { spawnSync } from "node:child_process"; spawnSync(process.execPath, [], { env: { NODE_OPTIONS: "--import " + ${writer} } });`,
    `import { spawnSync } from "node:child_process"; spawnSync("ordinary", [], { shell: true });`,
    `import { execFileSync } from "node:child_process"; execFileSync("ordinary", [], { shell: shell });`,
    'import { spawnSync } from "node:child_process"; spawnSync(`"${process.execPath}" --import "../test/helpers/native-ownership-cost.mjs"`, { shell: true });',
    `process.env.NODE_OPTIONS = "--import " + ${writer};`,
    `process.env = { NODE_OPTIONS: "--import " + ${writer} };`,
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/launch.mjs", safetyFile(call));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, call);
  }
  for (const call of [
    'import { Worker } from "node:worker_threads"; new Worker(new URL("./ordinary.mjs", import.meta.url), { execArgv: [], argv: ["--import", "../test/helpers/native-ownership-cost.mjs"] });',
    'import { fork } from "node:child_process"; fork(new URL("./ordinary.mjs", import.meta.url), ["--import", "../test/helpers/native-ownership-cost.mjs"], { execArgv: [], env: { ...process.env, ORDINARY: "value" } });',
    'import { spawnSync } from "node:child_process"; spawnSync("ordinary-program", ["../test/helpers/native-ownership-cost.mjs"], { shell: false });',
    'import { Worker } from "node:worker_threads"; new Worker("1 + 1", { eval: true, execArgv: [] });',
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/launch.mjs", safetyFile(call));
    inputs.get("tsonic-rust").set("src/ordinary.mjs", safetyFile("export const value = 1;"));
    assert.equal(boundarySafety(inputs).findings.length, 0, call);
  }
});

test("QRC-02: complete overload, unknown-prefix and explicit environment-spread evidence is never discarded", () => {
  const writer = 'new URL("../test/helpers/native-ownership-cost.mjs", import.meta.url).href';
  const cases = [
    [`import { spawnSync } from "node:child_process"; spawnSync(process.execPath, [], { env: { ...{ NODE_OPTIONS: "--import " + ${writer} } } });`, "Node test computed source entry"],
    [`import { spawnSync } from "node:child_process"; spawnSync(process.execPath, [], { env: { ...{ ...{ NODE_OPTIONS: "--import " + ${writer} } } } });`, "Node test computed source entry"],
    ['import { spawnSync } from "node:child_process"; function launch(flag) { return spawnSync(process.execPath, [flag, "../test/helpers/native-ownership-cost.mjs"]); } launch("--enable-source-maps");', "Node test computed source entry"],
    ['import { spawnSync } from "node:child_process"; function launch(prefix) { return spawnSync(process.execPath, [...prefix, "../test/helpers/native-ownership-cost.mjs"]); } launch([]);', "Node test computed source entry"],
    [`import { Worker } from "node:worker_threads"; function launch(prefix) { return new Worker(new URL("./ordinary.mjs", import.meta.url), { execArgv: [...prefix, "--import", ${writer}] }); } launch([]);`, "Node test computed source entry"],
    [`import { fork } from "node:child_process"; function launch(prefix) { return fork(new URL("./ordinary.mjs", import.meta.url), [], { execArgv: [prefix, "--import", ${writer}] }); } launch("--enable-source-maps");`, "Node test computed source entry"],
    [`import { spawnSync } from "node:child_process"; function launch(args) { return spawnSync(process.execPath, args, { env: { NODE_OPTIONS: "--import " + ${writer} } }); } launch([]);`, "Node test computed source entry"],
    [`import { execFile } from "node:child_process"; function launch(args) { return execFile(process.execPath, args, { env: { NODE_OPTIONS: "--import " + ${writer} } }); } launch([]);`, "Node test computed source entry"],
    [`import { fork } from "node:child_process"; function launch(args) { return fork(new URL("./ordinary.mjs", import.meta.url), args, { execArgv: ["--import", ${writer}] }); } launch([]);`, "Node test writer consumer"],
    [`import { fork } from "node:child_process"; fork(new URL("./ordinary.mjs", import.meta.url), null, { execArgv: ["--import", ${writer}] });`, "Node test writer consumer"],
  ];
  for (const [body, consumerKind] of cases) {
    const product = nativeBoundaryInputs();
    product.get("tsonic-rust").set("src/ordinary.mjs", safetyFile("export const value = 1;"));
    product.get("tsonic-rust").set("src/launch.mjs", safetyFile(body));
    assert.equal(boundarySafety(product).nativeAllocationBoundary === undefined, true, body);
    const contained = nativeBoundaryInputs();
    contained.get("tsonic-rust").set("test/ordinary.mjs", safetyFile("export const value = 1;"));
    contained.get("tsonic-rust").set("test/launch.test.mjs", safetyFile(`import test from "node:test"; ${body}`));
    const result = boundarySafety(contained);
    assert.equal(result.findings.length, 0, `${body}: genuine test containment`);
    assert.equal(result.nativeAllocationBoundary.consumers.some(consumer => consumer.path === "tsonic-rust/test/launch.test.mjs" &&
      consumer.kind === consumerKind), true, `${body}: the exact executable evidence is recorded, not waived`);
  }
  for (const body of [
    'import { Worker } from "node:worker_threads"; new Worker(new URL("./ordinary.mjs", import.meta.url), { shell: true, execArgv: [] });',
    'import { fork } from "node:child_process"; fork(new URL("./ordinary.mjs", import.meta.url), ["--import", "../test/helpers/native-ownership-cost.mjs"], { shell: true, eval: true, execArgv: [] });',
    'import { spawnSync } from "node:child_process"; spawnSync(process.execPath, [new URL("./ordinary.mjs", import.meta.url).href, "--future-unknown", "../test/helpers/native-ownership-cost.mjs"], { execArgv: ["--import", "../test/helpers/native-ownership-cost.mjs"], eval: true, shell: false });',
    'import { spawnSync } from "node:child_process"; function launch(args) { return spawnSync(process.execPath, args, { env: { ...process.env, ORDINARY: "../test/helpers/native-ownership-cost.mjs" } }); }',
    'import { Worker } from "node:worker_threads"; new Worker(new URL("./ordinary.mjs", import.meta.url), { env: { ...{ ORDINARY: "../test/helpers/native-ownership-cost.mjs" }, ...process.env }, execArgv: [] });',
    'import { execFile } from "node:child_process"; execFile(process.execPath, () => "../test/helpers/native-ownership-cost.mjs");',
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/ordinary.mjs", safetyFile("export const value = 1;"));
    inputs.get("tsonic-rust").set("src/launch.mjs", safetyFile(body));
    assert.equal(boundarySafety(inputs).findings.length, 0, body);
  }
});

test("QRC-02: native synchronous Node stdin uses nonliteral code evidence before entry or eval selection", () => {
  const code = 'import("../test/helpers/native-ownership-cost.mjs")';
  for (const method of ["spawnSync", "execFileSync"]) {
    for (const args of [[], ["--input-type=module"], ["-"], ["--", "-"], ["--print"], ["-p"],
      ["-i"], ["--interactive"], ["--eval", "0", "--interactive"], ["--no-print"],
      ["--test", "--no-test"], ["--check", "--no-check"], ["--version", "--no-version"]]) {
      const body = `import { ${method} } from "node:child_process"; ${method}(process.execPath, ${JSON.stringify(args)}, { input: ${JSON.stringify(code)} });`;
      const product = nativeBoundaryInputs();
      product.get("tsonic-rust").set("src/stdin.mjs", safetyFile(body));
      assert.equal(boundarySafety(product).nativeAllocationBoundary === undefined, true, body);
      const contained = nativeBoundaryInputs();
      contained.get("tsonic-rust").set("test/stdin.test.mjs", safetyFile(`import test from "node:test"; ${body}`));
      const result = boundarySafety(contained);
      assert.equal(result.findings.length, 0, `${body}: genuine test containment`);
      assert.equal(result.nativeAllocationBoundary.consumers.some(consumer => consumer.path === "tsonic-rust/test/stdin.test.mjs" &&
        consumer.kind === "Node test computed source entry"), true, `${body}: explicit input is recorded as source, not external filename data`);
    }
  }
  const interactive = nativeBoundaryInputs();
  interactive.get("tsonic-rust").set("src/ordinary.mjs", safetyFile("export const value = 1;"));
  interactive.get("tsonic-rust").set("src/interactive.mjs", safetyFile(`import { spawnSync } from "node:child_process"; spawnSync(process.execPath,
    ["--interactive", new URL("./ordinary.mjs", import.meta.url).href], { input: ${JSON.stringify(code)} });`));
  assert.equal(boundarySafety(interactive).findings.length, 0, "the pinned native target selects the script, not REPL stdin");
  for (const flags of [["--interactive", "--no-interactive"], ["--no-interactive", "--interactive"],
    ["--help", "--interactive"], ["--version", "--interactive"]]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/ordinary.mjs", safetyFile("export const value = 1;"));
    inputs.get("tsonic-rust").set("src/mode.mjs", safetyFile(`import { spawnSync } from "node:child_process"; spawnSync(process.execPath,
      [${flags.map(flag => JSON.stringify(flag)).join(",")}, new URL("./ordinary.mjs", import.meta.url).href], { input: ${JSON.stringify(code)} });`));
    assert.equal(boundarySafety(inputs).findings.length, 0, `${flags.join(" ")}: effective mode, not monotonic enablement`);
  }
  for (const mode of ["--help", "-h", "--version", "-v", "--check", "-c", "--test", "--v8-options", "--completion-bash"]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/mode.mjs", safetyFile(`import { spawnSync } from "node:child_process"; spawnSync(process.execPath, [${JSON.stringify(mode)}], { input: ${JSON.stringify(code)} });`));
    assert.equal(boundarySafety(inputs).findings.length, 0, `${mode}: stdin is not Node execution code`);
  }
  for (const body of [
    `import { spawnSync } from "node:child_process"; spawnSync(process.execPath, [new URL("./ordinary.mjs", import.meta.url).href], { input: ${JSON.stringify(code)} });`,
    `import { execFileSync } from "node:child_process"; execFileSync(process.execPath, ["--eval", "0"], { input: ${JSON.stringify(code)} });`,
    `import { spawn } from "node:child_process"; spawn(process.execPath, [], { input: ${JSON.stringify(code)} });`,
    `import { spawnSync } from "node:child_process"; spawnSync("ordinary-program", [], { input: ${JSON.stringify(code)} });`,
    `import { spawnSync } from "node:child_process"; spawnSync("ordinary-program", [], { env: { NODE_OPTIONS: ${JSON.stringify(code)} } });`,
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/ordinary.mjs", safetyFile("export const value = 1;"));
    inputs.get("tsonic-rust").set("src/stdin.mjs", safetyFile(body));
    assert.equal(boundarySafety(inputs).findings.length, 0, body);
  }
  const unknown = nativeBoundaryInputs();
  unknown.get("tsonic-rust").set("src/unknown.mjs", safetyFile('import { spawnSync } from "node:child_process"; const run = program => spawnSync(process.execPath, ["--input-type=module"], { input: program.source });'));
  const result = boundarySafety(unknown);
  assert.equal(result.findings.length, 0, "the existing oracle shape remains supported");
  assert.equal(result.nativeAllocationBoundary.externalDynamicEntries.some(entry => entry.environment === "code-string"), true,
    "unknown stdin code remains explicitly unproved");
  const override = nativeBoundaryInputs();
  override.get("tsonic-rust").set("src/ordinary.mjs", safetyFile("export const value = 1;"));
  override.get("tsonic-rust").set("src/fork.mjs", safetyFile('import { fork } from "node:child_process"; fork(new URL("./ordinary.mjs", import.meta.url), [], { execPath: executable });'));
  const overridden = boundarySafety(override);
  assert.equal(overridden.findings.length, 0, "an ordinary fork target with an unknown executable remains supported");
  assert.equal(overridden.nativeAllocationBoundary.externalDynamicEntries.some(entry => entry.environment === "fork-executable"), true,
    "an explicit executable override is not certified as native Node");
});

test("QRC-02: optional print operands retain unresolved option, preload and stdin roles without reclassifying proven code data", () => {
  for (const method of ["spawn", "spawnSync", "execFileSync"]) {
    for (const flag of ["--print", "-p"]) {
      for (const operand of ["flag", "...flags"]) {
        const inputs = nativeBoundaryInputs();
        const source = `import { ${method} } from "node:child_process"; function run(flag, flags) { ${method}(process.execPath,
          [${JSON.stringify(flag)}, ${operand}, new URL("../test/bridge.test.mjs", import.meta.url).href]); }`;
        inputs.get("tsonic-rust").set("src/optional.mjs", safetyFile(source));
        const result = boundarySafety(inputs);
        assert.equal(result.nativeAllocationBoundary === undefined, true, `${method}/${flag}/${operand}: possible option leaves the known first-party tail executable`);
        assert.equal(result.findings.some(finding => finding.file === "src/optional.mjs"), true, "the unresolved role is refused at its source");
      }
      if (method !== "spawn") {
        const stdin = nativeBoundaryInputs();
        stdin.get("tsonic-rust").set("src/optional.mjs", safetyFile(`import { ${method} } from "node:child_process";
          function run(flag) { ${method}(process.execPath, [${JSON.stringify(flag)}, flag], { input: 'import("../test/helpers/native-ownership-cost.mjs")' }); }`));
        assert.equal(boundarySafety(stdin).nativeAllocationBoundary === undefined, true, `${method}/${flag}: an unknown optional operand may select interactive stdin`);
      }
    }
  }
  for (const args of [
    '["--eval", expression, new URL("../test/helpers/native-ownership-cost.mjs", import.meta.url).href]',
    '["--print", "0", new URL("../test/helpers/native-ownership-cost.mjs", import.meta.url).href]',
    '["--print=0", new URL("../test/helpers/native-ownership-cost.mjs", import.meta.url).href]',
    '["-p0", new URL("../test/helpers/native-ownership-cost.mjs", import.meta.url).href]',
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/data.mjs", safetyFile(`import { spawnSync } from "node:child_process"; function run(expression) {
      spawnSync(process.execPath, ${args}, { input: 'import("../test/helpers/native-ownership-cost.mjs")' }); }`));
    assert.equal(boundarySafety(inputs).findings.length, 0, `${args}: required or proven expression selects code, so subsequent argv and stdin stay data`);
  }
  const unknown = nativeBoundaryInputs();
  unknown.get("tsonic-rust").set("src/unknown.mjs", safetyFile('import { spawnSync } from "node:child_process"; function run(flag, code) { spawnSync(process.execPath, ["--print", flag], { input: code }); }'));
  const result = boundarySafety(unknown);
  assert.equal(result.findings.length, 0, "genuinely unknown code and option data remain explicitly unproved, not a guessed source edge");
  assert.equal(result.nativeAllocationBoundary.externalDynamicEntries.some(entry => entry.environment === "node-arguments"), true,
    "unknown optional operand role is recorded, not silently certified");
});

test("QRC-08: canonical parsing precedes lexical root admission for every escaped builtin spelling", () => {
  for (const source of [
    String.raw`\u0065val("im" + "port('../test/helpers/native-ownership-cost.mjs')");`,
    String.raw`\u{65}val("im" + "port('../test/helpers/native-ownership-cost.mjs')");`,
    String.raw`new \u0046unction("im" + "port('../test/helpers/native-ownership-cost.mjs')")();`,
    String.raw`\u0046\u0075nction("im" + "port('../test/helpers/native-ownership-cost.mjs')")();`,
    String.raw`\u{46}unction("im" + "port('../test/helpers/native-ownership-cost.mjs')")();`,
    String.raw`glo\u0062alThis.e\u0076al("im" + "port('../test/helpers/native-ownership-cost.mjs')");`,
    String.raw`mo\u0064ule.re\u0071uire("../test/helpers/native-ownership-cost.mjs");`,
    String.raw`pr\u006fcess.getBuiltinMod\u0075le("fs").readFi\u006ceSync("../../rust-runtime/tests/helpers/allocation_counts.rs");`,
    String.raw`glo\u0062alThis.pro\u0063ess.getBuiltinMod\u0075le("fs").readFi\u006ceSync("../../rust-runtime/tests/helpers/allocation_counts.rs");`,
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/escaped.mjs", safetyFile(source));
    const result = boundarySafety(inputs);
    assert.equal(result.nativeAllocationBoundary === undefined, true, source);
    assert.equal(result.findings.some(finding => finding.file === "src/escaped.mjs" && finding.reason.includes("test-only cut")), true,
      `${source}: the canonical parser exposes the actual native binding`);
    assert.equal(result.findings.filter(finding => finding.subject === "native safety").length, 8,
      `${source}: an executable promotion grants no allocator credit`);
    const contained = nativeBoundaryInputs();
    contained.get("tsonic-rust").set("test/escaped.test.mjs", safetyFile(`import test from "node:test";\n${source}`));
    assert.equal(boundarySafety(contained).findings.length, 0, `${source}: the same computed entry retains its actual test boundary`);
  }
});

test("QRC-08: canonical syntax admission preserves ordinary identifiers and nonexecution but rejects malformed executable bodies", () => {
  for (const source of [
    "const value = 1; value + 1;",
    String.raw`const \u0070rocess = { ordinary: 1 }; \u0070rocess.ordinary;`,
    String.raw`function run(Fu\u006ection) { Fu\u006ection("im" + "port('../test/helpers/native-ownership-cost.mjs')"); }`,
    String.raw`function run(pr\u006fcess) { pr\u006fcess.value; }`,
    String.raw`const text = "\\u0065val('not executed')";`,
    String.raw`const pattern = /\u0065val\(value\)/u;`,
    String.raw`/* \u0065val('not executable'); const incomplete = ; */ const value = 1;`,
    "#!/usr/bin/env node\nconst value = 1;",
    "",
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/ordinary.mjs", safetyFile(source));
    assert.equal(boundarySafety(inputs).findings.length, 0, `${source}: actual syntax and scoped identity, not a raw word filter`);
  }
  for (const source of ["const value = ;", "function run( {", String.raw`let value = "\uZZZZ";`]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/malformed.mjs", safetyFile(source));
    const result = boundarySafety(inputs);
    assert.equal(result.nativeAllocationBoundary === undefined, true, `${source}: malformed executable input is unresolved`);
    assert.equal(result.findings.some(finding => finding.file === "src/malformed.mjs" && finding.reason.includes("unresolved executable source syntax")),
      true, "the existing bounded parser diagnostic route owns syntax refusal");
  }
});

test("QRC-09: partial type-list readers admit only their native AST kinds without erasing runtime heritage", () => {
  for (const [file, source] of [
    ["ordinary.ts", "const value = 1; value + 1; ordinary();"],
    ["ordinary.ts", "function ordinary({ value }, [first]) { return value + first; }"],
    ["ordinary.ts", "function ordinary<T extends typeof process>(value: T): T { return value; }"],
    ["ordinary.ts", "function ordinary<T extends { value: number }>({ value }: T) { return value; }"],
    ["ordinary.ts", "const value = ordinary<typeof process>();"],
    ["ordinary.ts", "const value = new Ordinary<typeof process>();"],
    ["ordinary.ts", "const value = ordinary<typeof process>`data`;"],
    ["ordinary.ts", "const value = ordinary<typeof process>;"],
    ["ordinary.ts", 'type Value = import("./ordinary.mjs").Container<typeof process>;'],
    ["ordinary.ts", "type Value = typeof ordinary<typeof process>;"],
    ["ordinary.ts", "class Value extends Ordinary<typeof process> {}"],
    ["ordinary.ts", "interface Value extends Ordinary<typeof process> {}"],
    ["ordinary.ts", "declare function ordinary<T extends typeof process>(value: T): T;"],
    ["ordinary.tsx", "const view = <Component<typeof process> />;"],
    ["ordinary.tsx", "const view = <Component<typeof process>>text</Component>;"],
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set(`src/${file}`, safetyFile(source));
    assert.equal(boundarySafety(inputs).findings.length, 0, source);
  }
  for (const [file, source] of [
    ["runtime.ts", 'eval("import(\'../test/helpers/native-ownership-cost.mjs\')");'],
    ["runtime.ts", 'new Function("import(\'../test/helpers/native-ownership-cost.mjs\')")();'],
    ["runtime.ts", 'class Value extends (await import("../test/helpers/native-ownership-cost.mjs")).Base {}'],
    ["runtime.ts", 'class Value extends (process.getBuiltinModule("fs").readFileSync("../../rust-runtime/tests/helpers/allocation_counts.rs"), Ordinary) {}'],
    ["runtime.tsx", 'const view = <Component value={process.getBuiltinModule("fs").readFileSync("../../rust-runtime/tests/helpers/allocation_counts.rs")} />;'],
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set(`src/${file}`, safetyFile(source));
    const result = boundarySafety(inputs);
    assert.equal(result.nativeAllocationBoundary === undefined, true, source);
    assert.equal(result.findings.some(finding => finding.file === `src/${file}`), true, `${source}: runtime evidence is not erased`);
  }
});

test("QRC-09: argv index text requires a literal while computed executables remain explicitly unproved", () => {
  for (const index of ["0", '"0"', "`0`"]) {
    const source = `import { spawn } from "node:child_process"; spawn(process.argv[${index}], ["../test/helpers/native-ownership-cost.mjs"]);`;
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/argv.mjs", safetyFile(source));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, source);
  }
  for (const index of ["1 + 1", "position", "select()", "{ value: 0 }"]) {
    const source = `import { spawn } from "node:child_process"; spawn(process.argv[${index}], ["../test/helpers/native-ownership-cost.mjs"]);`;
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/argv.mjs", safetyFile(source));
    const result = boundarySafety(inputs);
    assert.equal(result.findings.length, 0, `${source}: no evaluation or accessor panic`);
    assert.equal(result.nativeAllocationBoundary.externalDynamicEntries.some(entry => entry.environment === "external-process"), true,
      `${source}: unknown executable identity is explicitly unproved`);
  }
});

test("QRC-03/04: type erasure and raw import-equals filenames preserve native require identity", () => {
  for (const source of [
    'import type { nativeAllocationSupport } from "../test/helpers/native-ownership-cost.mjs"; export type Support = typeof nativeAllocationSupport;',
    'export type { nativeAllocationSupport } from "../test/helpers/native-ownership-cost.mjs";',
    'export type * from "../test/helpers/native-ownership-cost.mjs";',
    'export type { Stats } from "node:fs";', 'export { type Stats } from "node:fs";',
    'import { type nativeAllocationSupport } from "../test/helpers/native-ownership-cost.mjs";',
    'import type support = require("../test/helpers/native-ownership-cost.mjs");',
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/types.ts", safetyFile(source));
    assert.equal(boundarySafety(inputs).findings.length, 0, source);
  }
  for (const source of [
    'import { type Unused, nativeAllocationSupport } from "../test/helpers/native-ownership-cost.mjs";',
    'export { type Unused, nativeAllocationSupport } from "../test/helpers/native-ownership-cost.mjs";',
    'import support = require("../test/helpers/native-ownership-cost.mjs");',
    'import type { Stats } from "node:fs"; require("../test/helpers/native-ownership-cost.mjs");',
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/runtime.cts", safetyFile(source));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, source);
  }
  for (const name of ["native-ownership-cost.mjs#literal", "native-ownership-cost.mjs?literal", "%6eative-ownership-cost.mjs"]) {
    for (const source of [`require(${JSON.stringify(`../test/helpers/${name}`)});`,
      `import ordinary = require(${JSON.stringify(`../test/helpers/${name}`)}); void ordinary;`]) {
      const inputs = nativeBoundaryInputs();
      inputs.get("tsonic-rust").set("package.json", safetyFile('{"main":"./src/runtime.cts"}'));
      inputs.get("tsonic-rust").set("src/runtime.cts", safetyFile(source));
      inputs.get("tsonic-rust").set(`test/helpers/${name}`, safetyFile(
        name.endsWith(".mjs") ? "export const ordinary = true;" : "module.exports = {};"));
      assert.equal(boundarySafety(inputs).findings.length, 0, source);
    }
  }
});

test("QRC-11: literal source-file identities remain distinct from glob-free metadata scopes", () => {
  for (const [path, scope] of [
    ["test/helpers/native-ownership-cost.mjs#literal", true],
    ["test/helpers/native-ownership-cost.mjs?literal", false],
    ["test/helpers/%6eative-ownership-cost.mjs", true],
    ["test/helpers/literal*name.mjs", false],
    ["test/helpers/literal[name].mjs", false],
    ["test/helpers/literal{name}.mjs", false],
  ]) {
    assert.equal(validLiteralFilePath(path), true, `${path}: a normalized physical filename is literal`);
    assert.equal(validPath(path), scope, `${path}: scope restrictions do not change`);
  }
  for (const path of ["", "/absolute.mjs", "./current.mjs", "../parent.mjs", "test/../parent.mjs",
    "test//empty.mjs", "test/./current.mjs", "test\\other.mjs", "test/zero\0.mjs", undefined, null]) {
    assert.equal(validLiteralFilePath(path), false, "literal file identities require normalized relative non-NUL paths");
    assert.equal(validPath(path), false, "scope validation retains every structural path restriction");
  }
});

test("QRC-11: actual raw module entries preserve harmless filenames and trace transitive writer execution", () => {
  for (const name of ["native-ownership-cost.mjs#literal", "native-ownership-cost.mjs?literal", "%6eative-ownership-cost.mjs"]) {
    const target = `test/helpers/${name}`;
    const ordinary = name.endsWith(".mjs") ? "export const ordinary = true;" : "module.exports = {};";
    const forwarding = name.endsWith(".mjs") ? 'import "./native-ownership-cost.mjs"; export const ordinary = true;'
      : 'module.exports = require("./native-ownership-cost.mjs");';
    for (const source of [`require(${JSON.stringify(`../${target}`)});`,
      `import ordinary = require(${JSON.stringify(`../${target}`)}); void ordinary;`]) {
      const harmless = nativeBoundaryInputs();
      harmless.get("tsonic-rust").set("package.json", safetyFile('{"main":"./src/runtime.cts"}'));
      harmless.get("tsonic-rust").set("src/runtime.cts", safetyFile(source));
      harmless.get("tsonic-rust").set(target, safetyFile(ordinary));
      assert.equal(boundarySafety(harmless).findings.length, 0, `${source}: raw physical filename is not a URL`);
      assert.equal(keelSafetyBuiltModuleEntries(harmless).includes(`tsonic-rust/${target}`), true,
        `${source}: all actual native module bytes are requested through the existing input closure`);
      const harmful = nativeBoundaryInputs();
      harmful.get("tsonic-rust").set("package.json", safetyFile('{"main":"./src/runtime.cts"}'));
      harmful.get("tsonic-rust").set("src/runtime.cts", safetyFile(source));
      harmful.get("tsonic-rust").set(target, safetyFile(forwarding));
      const result = boundarySafety(harmful);
      assert.equal(result.nativeAllocationBoundary === undefined, true, `${source}: actual forwarded writer prevents approval`);
      assert.equal(result.findings.some(finding => finding.repo === "tsonic-rust" && finding.file === "src/runtime.cts"), true,
        `${source}: the incoming product edge is restricted transitively`);
    }
    const url = nativeBoundaryInputs();
    url.get("tsonic-rust").set("src/runtime.mjs", safetyFile(`await import(${JSON.stringify(`../${target}`)});`));
    url.get("tsonic-rust").set(target, safetyFile(ordinary));
    assert.equal(boundarySafety(url).nativeAllocationBoundary === undefined, true,
      `${name}: native ESM URL interpretation still reaches the canonical writer`);
  }
});

test("QRC-11: actual entry formats distinguish JSON data, JavaScript bytes and unproved native code", () => {
  const json = nativeBoundaryInputs();
  json.get("tsonic-rust").set("src/runtime.cts", safetyFile('require("../test/helpers/data.json");'));
  json.get("tsonic-rust").set("test/helpers/data.json", safetyFile(JSON.stringify({ source: 'require("./native-ownership-cost.mjs")' })));
  assert.equal(boundarySafety(json).findings.length, 0, "native JSON is data, not executable script text");
  for (const [name, source] of [
    ["ordinary.blob", 'module.exports = require("./native-ownership-cost.mjs");'],
    ["ordinary.blob", "const value: number = 2; module.exports = { value };"],
    ["ordinary.blob", "interface Value {} module.exports = {};"],
    ["ordinary.blob", 'import type { Value } from "./ordinary.js"; module.exports = {};'],
    ["ordinary.blob", "const value = 2 as const; module.exports = { value };"],
    ["ordinary.node", "unproved native image bytes"],
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/runtime.cts", safetyFile(`require(${JSON.stringify(`../test/helpers/${name}`)});`));
    inputs.get("tsonic-rust").set(`test/helpers/${name}`, safetyFile(source));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true,
      `${name}: actual script, malformed JavaScript and opaque native code never inherit a suffix-based waiver`);
  }
  const missingBytes = nativeBoundaryInputs();
  missingBytes.get("tsonic-rust").set("src/runtime.cts", safetyFile('require("../test/helpers/ordinary.blob");'));
  const bytes = safetyFile("module.exports = {};");
  missingBytes.get("tsonic-rust").set("test/helpers/ordinary.blob", Object.freeze({ ...bytes, text: undefined }));
  assert.equal(boundarySafety(missingBytes).nativeAllocationBoundary === undefined, true,
    "a captured hash without the actual executable source bytes cannot close the boundary");
});

test("QRC-11: literal native path components do not acquire metadata pattern semantics", () => {
  for (const directory of ["literal*directory", "literal[directory]", "literal{directory}"]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("rust-runtime").set("src/ordinary.rs", safetyFile(
      `#[path = "../tests/helpers/${directory}/../ordinary.rs"] mod ordinary;`));
    inputs.get("rust-runtime").set(`tests/helpers/${directory}/present.rs`, safetyFile("pub fn present() {}"));
    inputs.get("rust-runtime").set("tests/helpers/ordinary.rs", safetyFile("pub fn ordinary() {}"));
    assert.equal(boundarySafety(inputs).findings.length, 0, `${directory}: physical native traversal is not a glob`);
    inputs.get("rust-runtime").set("tests/helpers/ordinary.rs", safetyFile(
      '#[path = "allocation_counts.rs"] mod allocation_counts;'));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true,
      `${directory}: the same actual source path still promotes an observer consumer`);
  }
});

test("QRC-13: every native script entry requires actual bytes independent of its recognized suffix", () => {
  const target = "tsonic-rust/dist/bridge.js";
  for (const [file, source] of [
    ["src/entry.cjs", 'require("../dist/bridge.js");'],
    ["src/entry.cts", 'import bridge = require("../dist/bridge.js");'],
    ["src/entry.mjs", 'import "../dist/bridge.js";'],
    ["src/entry.mjs", 'export * from "../dist/bridge.js";'],
    ["src/entry.mjs", 'import { createRequire } from "node:module"; const load = createRequire(import.meta.url); load("../dist/bridge.js");'],
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({ type: "commonjs", main: `./${file}` })));
    inputs.get("tsonic-rust").set(file, safetyFile(source));
    assert.equal(keelSafetyBuiltModuleEntries(inputs).includes(target), true, `${file}: all actual native target bytes must be captured`);
    const absent = boundarySafety(inputs);
    assert.equal(absent.nativeAllocationBoundary === undefined, true, `${file}: no approval from missing script bytes`);
    assert.equal(absent.findings.some(finding => finding.reason.includes("uncaptured first-party native module entry")), true,
      `${file}: missing bytes have an explicit source-entry refusal`);
    inputs.get("tsonic-rust").set("dist/bridge.js", Object.freeze({ ...safetyFile("module.exports = {};", false), builtModule: true }));
    assert.equal(boundarySafety(inputs).findings.length, 0, `${file}: exact harmless script bytes remain admitted`);
    inputs.get("tsonic-rust").set("dist/bridge.js", Object.freeze({
      ...safetyFile('module.exports = require("../test/helpers/native-ownership-cost.mjs");', false), builtModule: true,
    }));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, `${file}: actual bridge-to-writer execution is restricted`);
  }
});

test("QRC-13: authored TypeScript projections gain native authority only through an actual resolved native entry", () => {
  const inputs = nativeBoundaryInputs();
  inputs.get("tsonic-rust").set("src/typed.ts", safetyFile('import "./projected.js"; export const value: number = 1;'));
  assert.equal(boundarySafety(inputs).findings.length, 0, "an authored TS projection is not guessed from untyped filesystem bytes");
  assert.equal(keelSafetyBuiltModuleEntries(inputs).includes("tsonic-rust/src/projected.js"), false,
    "authored TS alone does not queue a native filesystem projection");
  inputs.get("tsonic-rust").set("src/native.mjs", safetyFile('import "./typed.ts";'));
  assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true,
    "native entry strengthens an already visited TS node and refuses its missing native import");
  inputs.get("tsonic-rust").set("src/projected.js", safetyFile("export const value = 1;"));
  assert.equal(boundarySafety(inputs).findings.length, 0, "actual native-reached TypeScript retains its formal TS grammar and complete JS target bytes");
  inputs.get("tsonic-rust").set("src/projected.js", safetyFile('import "../test/helpers/native-ownership-cost.mjs";'));
  assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true,
    "the same physical module edges propagate writer restriction through native-reached TS");
});

test("QRC-14: declaration-file identity is not nonexecution evidence for a native module entry", () => {
  for (const suffix of ["d.ts", "d.cts", "d.mts"]) {
    const file = `src/ordinary.${suffix}`;
    const path = `tsonic-rust/${file}`;
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set(file, safetyFile("const value: number = 2;"));
    assert.equal(boundarySafety(inputs).findings.length, 0, `${suffix}: authored declaration files retain their formal source role`);
    for (const entry of [
      `require(${JSON.stringify(`./ordinary.${suffix}`)});`,
      `import ${JSON.stringify(`./ordinary.${suffix}`)};`,
      `export * from ${JSON.stringify(`./ordinary.${suffix}`)};`,
      `import { fork } from "node:child_process"; fork(new URL(${JSON.stringify(`./ordinary.${suffix}`)}, import.meta.url));`,
    ]) {
      inputs.get("tsonic-rust").set("src/entry.mjs", safetyFile(entry));
      assert.equal(keelSafetyBuiltModuleEntries(inputs).includes(path), true, `${suffix}: native entry queues actual declaration-named bytes`);
      for (const harmless of [
        "const value: number = 2;",
        "function ordinary(value: number): number { return value; } ordinary(2);",
        "class Ordinary { static value: number = 2; }",
        'import type { nativeAllocationSupport } from "../test/helpers/native-ownership-cost.mjs"; const value: number = 2;',
        'declare const support: typeof import("../test/helpers/native-ownership-cost.mjs"); const value: number = 2;',
      ]) {
        inputs.get("tsonic-rust").set(file, safetyFile(harmless));
        assert.equal(boundarySafety(inputs).findings.length, 0, `${suffix}: harmless actual body ${harmless}`);
      }
      for (const harmful of [
        'require("../test/helpers/native-ownership-cost.mjs");',
        'function ordinary(value: number): number { require("../test/helpers/native-ownership-cost.mjs"); return value; } ordinary(2);',
        'class Ordinary { static { require("../test/helpers/native-ownership-cost.mjs"); } }',
        'import "../test/helpers/native-ownership-cost.mjs";',
      ]) {
        inputs.get("tsonic-rust").set(file, safetyFile(harmful));
        assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, `${suffix}: runtime bodies cannot inherit filename ambient authority`);
      }
      inputs.get("tsonic-rust").delete(file);
      const missing = boundarySafety(inputs);
      assert.equal(missing.nativeAllocationBoundary === undefined, true, `${suffix}: native entry requires actual declaration-named bytes`);
      assert.equal(missing.findings.some(finding => finding.reason.includes("uncaptured first-party native module entry")), true, `${suffix}: precise missing input refusal`);
      inputs.get("tsonic-rust").set(file, safetyFile("const value: number = 2;"));
    }
    inputs.get("tsonic-rust").delete("src/entry.mjs");
    inputs.get("tsonic-rust").set(file, Object.freeze({ ...safetyFile('require("../test/helpers/native-ownership-cost.mjs");', false), builtModule: true }));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, `${suffix}: captured native entry is executable without a second source importer`);
  }
});

test("QRC-14: native declaration byte closure propagates through existing physical edges and parser roles are mandatory", () => {
  const inputs = nativeBoundaryInputs();
  const file = "src/bridge.d.ts";
  inputs.get("tsonic-rust").set(file, safetyFile('import "../dist/ordinary.js";'));
  inputs.get("tsonic-rust").set("src/entry.mjs", safetyFile('import "./bridge.d.ts";'));
  assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "native-reached declaration body requires its complete physical module closure");
  inputs.get("tsonic-rust").set(file, Object.freeze({ ...inputs.get("tsonic-rust").get(file), builtModule: true }));
  assert.equal(keelSafetyBuiltModuleEntries(inputs).includes("tsonic-rust/dist/ordinary.js"), true, "the same existing capture owner follows a reached declaration body");
  inputs.get("tsonic-rust").set("dist/ordinary.js", Object.freeze({ ...safetyFile("export const ordinary = 2;", false), builtModule: true }));
  assert.equal(boundarySafety(inputs).findings.length, 0, "complete harmless declaration-native closure remains admitted");
  inputs.get("tsonic-rust").set("dist/ordinary.js", Object.freeze({ ...safetyFile('import "../test/helpers/native-ownership-cost.mjs";', false), builtModule: true }));
  assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "actual writer reachability propagates through declaration-named bridges");
  for (const role of [undefined, "", "unknown"]) assert.throws(() => scriptSourceReferences("tsonic-rust/src/ordinary.d.ts", "const ordinary = 2;", {}, role), /Invalid AC12 executable source role/u);
});

test("QRC-14: native executions from authored TypeScript strengthen the physical declaration target role", () => {
  for (const source of [
    'import { Worker } from "node:worker_threads"; new Worker(new URL("./ordinary.d.ts", import.meta.url));',
    'import { fork } from "node:child_process"; fork(new URL("./ordinary.d.ts", import.meta.url));',
    'import { spawn } from "node:child_process"; spawn(process.execPath, [new URL("./ordinary.d.ts", import.meta.url).href]);',
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("package.json", safetyFile('{"type":"module","main":"./src/entry.ts"}'));
    inputs.get("tsonic-rust").set("src/entry.ts", safetyFile(source));
    assert.equal(keelSafetyBuiltModuleEntries(inputs).includes("tsonic-rust/src/ordinary.d.ts"), true, "native execution is not an authored TS module projection");
    const missing = boundarySafety(inputs);
    assert.equal(missing.nativeAllocationBoundary === undefined, true, "missing native execution bytes are not authored declarations");
    inputs.get("tsonic-rust").set("src/ordinary.d.ts", safetyFile("const ordinary: number = 2;"));
    assert.equal(boundarySafety(inputs).findings.length, 0, "known harmless native execution remains admitted");
    inputs.get("tsonic-rust").set("src/ordinary.d.ts", safetyFile('require("../test/helpers/native-ownership-cost.mjs");'));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "native execution reaches the writer through the actual declaration target");
    inputs.get("tsonic-rust").set("src/ordinary.d.ts", safetyFile("function ("));
    const malformed = boundarySafety(inputs);
    assert.equal(malformed.nativeAllocationBoundary === undefined, true, "malformed native execution cannot inherit declaration nonexecution");
    assert.equal(malformed.findings.some(finding => finding.reason.includes("unresolved executable source syntax")), true, "malformed native bytes have the existing precise syntax refusal");
  }
});

test("QRC-14: erased signatures and declarations cannot manufacture a runtime binding that hides native roots", () => {
  for (const source of [
    'function require(path: string): unknown; require("../test/helpers/native-ownership-cost.mjs");',
    'declare function require(path: string): unknown; require("../test/helpers/native-ownership-cost.mjs");',
    'declare const require: (path: string) => unknown; require("../test/helpers/native-ownership-cost.mjs");',
    'type require = string; require("../test/helpers/native-ownership-cost.mjs");',
    'interface require { value: string } require("../test/helpers/native-ownership-cost.mjs");',
    `function Function(...args: string[]): Function; new Function(${JSON.stringify('return import("../test/helpers/native-ownership-cost.mjs")')})();`,
    'function process(): unknown; process.getBuiltinModule("fs").readFileSync("../../rust-runtime/tests/helpers/allocation_counts.rs");',
  ]) {
    for (const file of ["src/ordinary.cts", "src/ordinary.d.cts"]) {
      const inputs = nativeBoundaryInputs();
      inputs.get("tsonic-rust").set(file, Object.freeze({ ...safetyFile(source), builtModule: true }));
      assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, `${file}: ${source}: native globals remain actual value roots after type erasure`);
    }
  }
  const signature = "function require(path: string): unknown;";
  const implementation = "function require(path: string): unknown { return path; }";
  const inputs = nativeBoundaryInputs();
  inputs.get("tsonic-rust").set("src/ordinary.d.cts", Object.freeze({
    ...safetyFile(`${signature} ${implementation} require("../test/helpers/native-ownership-cost.mjs");`), builtModule: true,
  }));
  assert.equal(boundarySafety(inputs).findings.length, 0, "an actual runtime function implementation still owns its value binding");
  inputs.get("tsonic-rust").set("src/ordinary.d.mts", Object.freeze({ ...safetyFile(
    'function URL(value: string, base: string): URL; await import(new URL("../test/helpers/ordinary.mjs", import.meta.url));'), builtModule: true }));
  inputs.get("tsonic-rust").set("test/helpers/ordinary.mjs", safetyFile("export const ordinary = 2;"));
  assert.equal(boundarySafety(inputs).findings.length, 0, "an erased signature does not shadow the unchanged native URL constructor");
  inputs.get("tsonic-rust").set("test/helpers/ordinary.mjs", safetyFile('import "./native-ownership-cost.mjs";'));
  assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "the same native constructor path still closes actual writer reachability");
});

test("QRC-14: every finite native package exposure strengthens declaration-file execution and captures the actual bytes", () => {
  for (const metadata of [
    { main: "./src/ordinary.d.ts" },
    { bin: { ordinary: "./src/ordinary.d.ts" } },
    { exports: { ".": "./src/ordinary.d.ts" } },
    { exports: { "./*": "./src/ordinary.d.ts" } },
    { imports: { "#ordinary": "./src/ordinary.d.ts" } },
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({ name: "@control/ordinary", ...metadata })));
    inputs.get("tsonic-rust").set("src/ordinary.mjs", safetyFile("export const ordinary = 2;"));
    assert.equal(keelSafetyBuiltModuleEntries(inputs).includes("tsonic-rust/src/ordinary.d.ts"), true, "metadata is a real native entry without an ordinary source importer");
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "uncaptured declaration-named package bytes never imply nonexecution");
    inputs.get("tsonic-rust").set("src/ordinary.d.ts", safetyFile("const ordinary: number = 2;"));
    const harmless = boundarySafety(inputs);
    assert.equal(harmless.findings.length, 0, "complete harmless package source remains admitted");
    assert.equal(harmless.nativeAllocationBoundary.builtModuleInputs.some(entry => entry.path === "tsonic-rust/src/ordinary.d.ts" &&
      entry.sha256 === inputs.get("tsonic-rust").get("src/ordinary.d.ts").sha256), true, "package executable bytes are bound by the same input evidence");
    inputs.get("tsonic-rust").set("src/ordinary.d.ts", safetyFile('require("../test/helpers/native-ownership-cost.mjs");'));
    const harmful = boundarySafety(inputs);
    assert.equal(harmful.nativeAllocationBoundary === undefined, true, "actual package declaration bodies can promote the test writer");
    assert.equal(harmful.findings.some(finding => finding.file === "package.json" && finding.reason.includes("package entry")), true, "incoming package exposure is checked after body restriction");
  }
  for (const metadata of [{ types: "./src/ordinary.d.ts" }, { typings: "./src/ordinary.d.ts" }]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify(metadata)));
    inputs.get("tsonic-rust").set("src/ordinary.d.ts", safetyFile('require("../test/helpers/native-ownership-cost.mjs");'));
    assert.equal(keelSafetyBuiltModuleEntries(inputs).includes("tsonic-rust/src/ordinary.d.ts"), false, "formal top-level type metadata does not create a native module entry");
    assert.equal(boundarySafety(inputs).findings.length, 0, "authored declaration roles retain their actual nonexecution contract");
  }
});

test("QRC-14: declaration conditions do not erase default or explicitly selected native execution", () => {
  const inputs = nativeBoundaryInputs();
  inputs.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({ name: "@control/ordinary", exports: {
    ".": { types: "./src/ordinary.d.ts", default: "./src/ordinary.mjs" },
  } })));
  inputs.get("tsonic-rust").set("src/ordinary.mjs", safetyFile("export const ordinary = 2;"));
  assert.equal(keelSafetyBuiltModuleEntries(inputs).includes("tsonic-rust/src/ordinary.d.ts"), false,
    "a declaration-only metadata facet is not native execution");
  assert.equal(keelSafetyBuiltModuleEntries(inputs).includes("tsonic-rust/src/ordinary.mjs"), true,
    "the default runtime facet retains its exact native byte requirement");
  assert.equal(boundarySafety(inputs).findings.length, 0, "a missing declaration-only input cannot invent a missing runtime input");
  inputs.get("tsonic-rust").delete("src/ordinary.mjs");
  assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "a missing default remains refused");
  for (const source of ['import "../test/helpers/native-ownership-cost.mjs";', "export const = ;"]) {
    inputs.get("tsonic-rust").set("src/ordinary.mjs", safetyFile(source));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "harmful and malformed default bytes retain refusal");
  }
  inputs.get("tsonic-rust").set("src/ordinary.mjs", safetyFile("export const ordinary = 2;"));
  for (const entry of ['import "./ordinary.d.ts";', 'require("./ordinary.d.ts");',
    'import { fork } from "node:child_process"; fork(new URL("./ordinary.d.ts", import.meta.url));']) {
    inputs.get("tsonic-rust").set("src/entry.mjs", safetyFile(entry));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "a real native edge strengthens the declaration facet and refuses missing bytes");
    inputs.get("tsonic-rust").set("src/ordinary.d.ts", safetyFile('require("../test/helpers/native-ownership-cost.mjs");'));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "an actual declaration-named native writer remains forbidden");
    inputs.get("tsonic-rust").set("src/ordinary.d.ts", safetyFile("const = ;"));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "malformed explicitly executed declaration bytes remain refused");
    inputs.get("tsonic-rust").delete("src/ordinary.d.ts");
  }
  inputs.get("tsonic-rust").delete("src/entry.mjs");
  inputs.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({ exports: {
    ".": { types: "./src/ordinary.d.ts", native: "./src/ordinary.d.ts", default: "./src/ordinary.mjs" },
  } })));
  assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "a custom executable condition is never mistaken for the declaration condition");
  inputs.get("tsonic-rust").set("src/ordinary.d.ts", safetyFile('require("../test/helpers/native-ownership-cost.mjs");'));
  assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "custom native-condition writer reachability remains rejected");
  inputs.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({ exports: { ".": { types: "./src/ordinary.mjs" } } })));
  inputs.get("tsonic-rust").set("src/ordinary.mjs", safetyFile('import "../test/helpers/native-ownership-cost.mjs";'));
  assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "a declaration condition cannot relabel a non-declaration executable body");
});

test("QRC-14: nested declaration condition paths and arrays retain every independent executable facet", () => {
  for (const types of [
    { import: "./src/ordinary.d.mts", require: "./src/ordinary.d.cts" },
    [{ import: "./src/ordinary.d.mts" }, { require: "./src/ordinary.d.cts" }],
    { custom: [{ import: "./src/ordinary.d.mts" }, { require: "./src/ordinary.d.cts" }] },
  ]) {
    const inputs = nativeBoundaryInputs();
    const metadata = { exports: { ".": { types, default: "./src/ordinary.mjs" } } };
    inputs.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify(metadata)));
    inputs.get("tsonic-rust").set("src/ordinary.mjs", safetyFile("export const ordinary = 2;"));
    assert.equal(boundarySafety(inputs).findings.length, 0, "the complete nested types facet does not require absent declarations");
    assert.deepEqual(keelSafetyBuiltModuleEntries(inputs), ["tsonic-rust/src/ordinary.mjs"], "the independent default is the exact native root");
    for (const declaration of ["ordinary.d.mts", "ordinary.d.cts"]) {
      for (const entry of [`import "./${declaration}";`, `require("./${declaration}");`,
        `import { fork } from "node:child_process"; fork(new URL("./${declaration}", import.meta.url));`]) {
        inputs.get("tsonic-rust").set("src/entry.mjs", safetyFile(entry));
        assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "a real native entry strengthens the nested declaration facet and requires its bytes");
        for (const body of ["const = ;", 'require("../test/helpers/native-ownership-cost.mjs");']) {
          inputs.get("tsonic-rust").set(`src/${declaration}`, safetyFile(body));
          assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "the same native declaration path retains malformed and writer negatives");
        }
        inputs.get("tsonic-rust").delete(`src/${declaration}`);
      }
    }
    inputs.get("tsonic-rust").delete("src/entry.mjs");
    for (const body of [undefined, "const = ;", 'import "../test/helpers/native-ownership-cost.mjs";']) {
      if (body === undefined) inputs.get("tsonic-rust").delete("src/ordinary.mjs");
      else inputs.get("tsonic-rust").set("src/ordinary.mjs", safetyFile(body));
      assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "a nested declaration facet cannot erase missing, malformed or harmful default bytes");
    }
    inputs.get("tsonic-rust").set("src/ordinary.mjs", safetyFile("export const ordinary = 2;"));
    inputs.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({ exports: {
      ".": { types, custom: { import: "./src/ordinary.d.mts" }, default: "./src/ordinary.mjs" },
    } })));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "a separate custom condition is still executable authority");
    inputs.get("tsonic-rust").set("src/ordinary.d.mts", safetyFile('require("../test/helpers/native-ownership-cost.mjs");'));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "the custom condition still rejects its actual writer body");
    inputs.get("tsonic-rust").delete("src/ordinary.d.mts");
    inputs.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({ ...metadata, main: "./src/ordinary.d.mts" })));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "physical main authority remains independent of the nested declaration facet");
  }
});

test("QRC-14: authored package exports use exact checked-source resolution and native edges strengthen them", () => {
  const inputs = nativeBoundaryInputs();
  inputs.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({ name: "@control/source", type: "module",
    exports: { ".": { types: "./src/index.ts", default: "./src/index.ts" } } })));
  inputs.get("tsonic-rust").set("src/index.ts", safetyFile('import { ordinary } from "./model.js"; export const result: number = ordinary;'));
  inputs.get("tsonic-rust").set("src/model.ts", safetyFile("export const ordinary: number = 2;"));
  assert.equal(boundarySafety(inputs).findings.length, 0, "the actual checked source owner resolves the authored module to its identical model.ts");
  assert.equal(keelSafetyBuiltModuleEntries(inputs).includes("tsonic-rust/src/model.js"), false,
    "authored package evidence does not manufacture native model.js bytes");
  inputs.get("tsonic-rust").delete("src/model.ts");
  assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "an unresolved first-party authored module is refused");
  inputs.get("tsonic-rust").set("src/model.ts", safetyFile('import "../test/helpers/native-ownership-cost.mjs"; export const ordinary = 2;'));
  assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "checked source edges cannot hide a writer behind native-looking module spelling");
  inputs.get("tsonic-rust").set("src/model.ts", safetyFile("export const ordinary: number = 2;"));
  inputs.get("tsonic-rust").set("src/native.mjs", safetyFile('import "./index.ts";'));
  assert.equal(keelSafetyBuiltModuleEntries(inputs).includes("tsonic-rust/src/model.js"), true,
    "the actual native edge strengthens the already visited authored root");
  assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "native execution requires actual missing model.js bytes, never model.ts substitution");
  inputs.get("tsonic-rust").set("src/model.js", safetyFile("export const ordinary = 2;"));
  assert.equal(boundarySafety(inputs).findings.length, 0, "the strengthened root admits only its complete native byte closure");
  inputs.get("tsonic-rust").set("src/model.js", safetyFile('import "../test/helpers/native-ownership-cost.mjs";'));
  assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "native strengthening preserves transitive writer rejection");
  inputs.get("tsonic-rust").delete("src/native.mjs");
  inputs.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({ name: "@control/source", exports: {
    ".": { first: "./src/index.ts", second: "./src/model.ts" },
  } })));
  assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "inconsistent authored export identity cannot grant a source role");
  inputs.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({ name: "@control/source", exports: { "./*": "./src/*.ts" } })));
  inputs.get("tsonic-rust").delete("src/model.js");
  assert.equal(boundarySafety(inputs).findings.length, 0, "actual compiler-source export enumeration is finite original owner evidence, not an unproved native pattern");
  inputs.get("tsonic-rust").set("src/model.ts", safetyFile('import "../test/helpers/native-ownership-cost.mjs"; export const ordinary = 2;'));
  assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "a finite authored export pattern still propagates its actual writer source edge");
});

test("QRC-14: the complete original main module and exports contract selects authored roots without waiving native main", () => {
  const inputs = nativeBoundaryInputs();
  const metadata = { name: "@control/module-only", type: "module", module: "./src/index.ts" };
  inputs.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify(metadata)));
  inputs.get("tsonic-rust").set("src/index.ts", safetyFile('import { value } from "./model.js"; export const result: number = value;'));
  inputs.get("tsonic-rust").set("src/model.ts", safetyFile("export const value: number = 2;"));
  assert.equal(boundarySafety(inputs).findings.length, 0, "a module-only package uses the original checked source owner");
  inputs.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({ ...metadata, module: "src/index.ts" })));
  assert.equal(boundarySafety(inputs).findings.length, 0, "the original owner's unprefixed module spelling selects the same authored file");
  inputs.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify(metadata)));
  assert.equal(keelSafetyBuiltModuleEntries(inputs).includes("tsonic-rust/src/model.js"), false, "authored module metadata does not manufacture native bytes");
  inputs.get("tsonic-rust").delete("src/model.ts");
  assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "a positively selected module-only package refuses unresolved authored evidence");
  inputs.get("tsonic-rust").set("src/model.ts", safetyFile("export const value = 2;"));
  for (const field of ["exports", "main"]) {
    inputs.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({ ...metadata, [field]: "./src/model.ts" })));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "main, module and exports retain their original ambiguous-identity refusal");
  }
  inputs.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({ ...metadata, main: "./src/index.ts" })));
  assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "physical main execution strengthens the same authored module and requires model.js");
  inputs.get("tsonic-rust").set("src/model.js", safetyFile("export const value = 2;"));
  assert.equal(boundarySafety(inputs).findings.length, 0, "a coherent main and module owner accepts only its complete native bytes");
  inputs.get("tsonic-rust").set("src/model.js", safetyFile('import "../test/helpers/native-ownership-cost.mjs";'));
  assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "native main metadata cannot hide a transitive writer");
  inputs.get("tsonic-rust").delete("src/model.js");
  inputs.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify(metadata)));
  inputs.get("tsonic-rust").set("src/model.ts", safetyFile('import "../test/helpers/native-ownership-cost.mjs"; export const value = 2;'));
  assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "a module-only authored edge still reaches the actual writer");
});

test("QRC-14: only original provider reference outputs own native build resources", () => {
  for (const { path, evidence: owner } of keelPackageBuildResources()) {
    const inputs = nativeBoundaryInputs();
    const separator = path.indexOf("/");
    const repo = path.slice(0, separator);
    const file = path.slice(separator + 1);
    inputs.get(repo).set("package.json", safetyFile(JSON.stringify({ name: "@control/resource", exports: { "./resource": `./${file}` } })));
    const resource = readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");
    inputs.get(repo).set(file, Object.freeze({ ...safetyFile(resource), packageResourceOwner: owner }));
    for (const artifact of owner.artifacts) {
      const separator = artifact.path.indexOf("/");
      const text = readFileSync(new URL(`../../../${artifact.path}`, import.meta.url), "utf8");
      assert.equal(keelDigest(text), artifact.sha256, "the fixture carries the exact original owner artifact bytes");
      inputs.get(artifact.path.slice(0, separator)).set(artifact.path.slice(separator + 1), safetyFile(text, false));
    }
    assert.equal(boundarySafety(inputs).findings.length, 0, `${path}: an actual selected provider reference is build data, not JavaScript syntax`);
    assert.equal(keelSafetyBuiltModuleEntries(inputs).includes(path), false, `${path}: build-resource metadata alone is not native module execution`);
    inputs.get(repo).set("src/native.mjs", safetyFile(`import ${JSON.stringify(posix.relative(`${repo}/src`, path).replace(/^(?!\.)/u, "./"))};`));
    inputs.get(repo).set(file, Object.freeze({ ...safetyFile(`${resource}\nexport const = ;`), packageResourceOwner: owner }));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, `${path}: a real native load still parses the actual resource bytes and refuses malformed JS`);
    assert.equal(keelSafetyBuiltModuleEntries(inputs).includes(path), true, `${path}: a native load records its actual bytes even when the malformed body is refused`);
    inputs.get(repo).set(file, Object.freeze({ ...safetyFile(`import ${JSON.stringify(posix.relative(posix.dirname(path), "tsonic-rust/test/helpers/native-ownership-cost.mjs").replace(/^(?!\.)/u, "./"))};`), packageResourceOwner: owner }));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, `${path}: a real native load cannot hide a writer behind build-resource ownership`);
    inputs.get(repo).set(file, Object.freeze({ ...safetyFile("export const ordinary = 2;"), packageResourceOwner: owner }));
    assert.equal(boundarySafety(inputs).findings.length, 0, `${path}: a harmless actual native body is admitted without dropping its byte capture`);
    inputs.get(repo).delete(file);
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, `${path}: an actual native load still requires missing bytes`);
    inputs.get(repo).delete("src/native.mjs");
    inputs.get(repo).set(file, Object.freeze({ ...safetyFile(resource), packageResourceOwner: { ...owner, producer: "forged" } }));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, `${path}: forged ownership cannot waive executable metadata`);
    inputs.get(repo).set(file, Object.freeze({ ...safetyFile(resource), packageResourceOwner: owner }));
    inputs.get(repo).set(`${file}.other`, safetyFile(`${resource}\nexport const = ;`));
    inputs.get(repo).set("package.json", safetyFile(JSON.stringify({ exports: { "./resource": `./${file}.other` } })));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, `${path}: neighboring data cannot inherit the exact original reference's authority`);
  }
});

test("QRC-14: original installed declaration snapshots preserve each compilation owner's actual package context", () => {
  const scratch = new URL("../../.temp/keel-Q109/", import.meta.url);
  mkdirSync(scratch, { recursive: true });
  const workspace = mkdtempSync(join(fileURLToPath(scratch), "original-package-inputs-"));
  const inputs = nativeBoundaryInputs();
  const put = (path, text, tracked = true) => {
    const absolute = join(workspace, path);
    mkdirSync(posix.dirname(absolute), { recursive: true });
    writeFileSync(absolute, text);
    const separator = path.indexOf("/");
    inputs.get(path.slice(0, separator)).set(path.slice(separator + 1), safetyFile(text, tracked));
  };
  for (const { path, evidence } of keelPackageBuildResources()) {
    put(path, readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8"));
    for (const artifact of evidence.artifacts) put(artifact.path, readFileSync(new URL(`../../../${artifact.path}`, import.meta.url), "utf8"), false);
  }
  const roots = ["tsumo-rust/packages/engine", "tsumo-csharp/packages/engine"];
  for (const [index, root] of roots.entries()) {
    put(`${root}/package.json`, JSON.stringify({ name: "@control/engine", type: "module", module: "./src/index.ts",
      dependencies: { "@control/shared": "1.2.3" } }));
    put(`${root}/src/index.ts`, 'import { value } from "@control/shared"; export const result: number = value;');
    const packageText = JSON.stringify({ name: "@control/shared", version: "1.2.3", type: "module", types: "./index.d.ts" });
    const declaration = `export declare const value: ${index + 1};`;
    if (index === 0) {
      const installed = mkdtempSync(join(fileURLToPath(scratch), "external-declaration-"));
      writeFileSync(join(installed, "package.json"), packageText);
      writeFileSync(join(installed, "index.d.ts"), declaration);
      const alias = join(workspace, root, "node_modules/@control/shared");
      mkdirSync(posix.dirname(alias), { recursive: true });
      symlinkSync(posix.relative(posix.dirname(alias), installed), alias, "dir");
    } else {
      put(`${root}/node_modules/@control/shared/package.json`, packageText, false);
      put(`${root}/node_modules/@control/shared/index.d.ts`, declaration, false);
    }
  }
  captureKeelPackageOwners(workspace, inputs);
  const files = () => new Map([...inputs].flatMap(([repo, entries]) => [...entries].map(([file, input]) => [`${repo}/${file}`, input])));
  const captured = files();
  const packages = [...captured].filter(([path]) => posix.basename(path) === "package.json")
    .map(([path, input]) => ({ root: posix.dirname(path), metadata: JSON.parse(input.text) }));
  const exposures = createKeelPackageExposures(packages, captured, path => path);
  assert.equal(exposures.errors.length, 0, "the original file/snapshot provenance is internally consistent");
  for (const root of roots) {
    const context = captured.get(`${root}/package.json`).compilerPackage;
    assert.equal(context === undefined, false, "the actual original collector publishes its source/declaration input context");
    assert.match(context.sourcePackages.fingerprint, /^[a-f0-9]{64}$/u, "the original source-package graph is transported, not reconstructed");
    assert.match(context.installedDeclarations.fingerprint, /^[a-f0-9]{64}$/u, "the original declaration snapshot is transported with its files");
    assert.equal(context.installedDeclarations.packages.length, 1, "the exact declared dependency is selected by the original owner");
    assert.equal(context.installedDeclarations.declarationFileCount, 2, "the original snapshot binds the declaration and package metadata");
    assert.equal(context.files.every(file => file.sourcePath === undefined ? keelDigest(file.text) === file.sha256 : captured.get(file.sourcePath)?.sha256 === file.sha256), true,
      "all original logical files bind identical bytes; outside installed declarations stay in memory, not first-party physical source");
    const selected = exposures.authoredModule(`${root}/src/index.ts`, { module: true, specifier: "@control/shared" });
    assert.equal(selected?.kind, "declaration", "the original resolver and formal declaration identity own the nonexecutable facet");
    assert.equal(selected.input.fileName, join(workspace, root, "node_modules/@control/shared/index.d.ts"),
      "the actual checked resolver selects this owner's dependency, not another package with the same name");
    assert.equal(selected.input.sha256, context.files.find(file => file.path === `${root}/node_modules/@control/shared/index.d.ts`).sha256,
      "the selected declaration is the identical original captured input");
  }
  assert.equal(boundarySafety(inputs).findings.length, 0, "declaration inputs keep their actual nonexecutable authored role");
  assert.equal(captured.has(`${roots[0]}/node_modules/@control/shared/index.d.ts`), false,
    "an installed declaration outside the snapshot never becomes a fabricated first-party native file");
  const broken = new Map([...inputs].map(([repo, entries]) => [repo, new Map(entries)]));
  broken.get("tsumo-csharp").delete("packages/engine/node_modules/@control/shared/index.d.ts");
  assert.equal(boundarySafety(broken).nativeAllocationBoundary === undefined, true, "a missing original context byte cannot grant authored resolution authority");
  const external = new Map([...inputs].map(([repo, entries]) => [repo, new Map(entries)]));
  external.get("tsumo-rust").set("packages/engine/src/native.mjs", safetyFile('import "../node_modules/@control/shared/index.d.ts";'));
  assert.equal(keelSafetyBuiltModuleEntries(external).includes(`${roots[0]}/node_modules/@control/shared/index.d.ts`), true,
    "an actual native incoming edge demands physical bytes, not compiler-only declaration context");
  assert.equal(boundarySafety(external).nativeAllocationBoundary === undefined, true,
    "in-memory declaration authority cannot certify an outside native path");
  external.get("tsumo-rust").set("packages/engine/src/native.mjs", safetyFile('import "@control/shared";'));
  external.set("tsumo-csharp", new Map());
  assert.equal(boundarySafety(external).nativeAllocationBoundary === undefined, true,
    "an unresolved original native package entry cannot borrow its authored declaration resolution");
  const root = roots[1];
  const declaration = `${root}/node_modules/@control/shared/index.d.ts`;
  put(`${root}/src/native.mjs`, 'import "../node_modules/@control/shared/index.d.ts";');
  put(declaration, `require(${JSON.stringify(posix.relative(posix.dirname(declaration), "tsonic-rust/test/helpers/native-ownership-cost.mjs").replace(/^(?!\.)/u, "./"))});`, false);
  captureKeelPackageOwners(workspace, inputs);
  assert.equal(keelSafetyBuiltModuleEntries(inputs).includes(declaration), true, "a separate actual native edge strengthens the original declaration input");
  assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "installed declaration evidence cannot hide native writer execution");
});

test("QRC-14: declared installed dependency ownership is external execution, never a directory exemption", () => {
  const inputs = nativeBoundaryInputs();
  const root = "tsonic-rust/node_modules/ordinary-tool";
  const metadata = { name: "ordinary-tool", version: "1.2.3", bin: "bin/tool" };
  const installed = Object.freeze({ ...safetyFile(JSON.stringify(metadata), false), installedPackageOwners: Object.freeze([
    Object.freeze({ declaredBy: "tsonic-rust/package.json", name: metadata.name, version: metadata.version, root }),
  ]) });
  inputs.get("tsonic-rust").set("package.json", safetyFile('{"devDependencies":{"ordinary-tool":"^1.2.3"}}'));
  inputs.get("tsonic-rust").set("package-lock.json", safetyFile(JSON.stringify({ packages: {
    "node_modules/ordinary-tool": { version: "1.2.3", resolved: "https://registry.npmjs.org/ordinary-tool/-/ordinary-tool-1.2.3.tgz", integrity: "sha512-control" },
  } })));
  inputs.get("tsonic-rust").set("node_modules/ordinary-tool/package.json", installed);
  inputs.get("tsonic-rust").set("scripts/run.mjs", safetyFile('import { spawnSync } from "node:child_process"; import { fileURLToPath } from "node:url"; spawnSync(process.execPath, [fileURLToPath(new URL("../node_modules/ordinary-tool/bin/tool", import.meta.url))]);'));
  const external = boundarySafety(inputs);
  assert.equal(external.findings.length, 0, "the real declared installed package is not misclassified as authored first-party compiler source");
  assert.equal(external.nativeAllocationBoundary.externalDynamicEntries.some(entry => entry.installedDependencies?.includes(`${root}/bin/tool`)), true,
    "installed dependency execution remains explicitly unproved external IO, never certified harmless");
  assert.equal(keelSafetyBuiltModuleEntries(inputs).includes(`${root}/bin/tool`), false,
    "the boundary never interprets external compiler implementation bytes as first-party source");
  for (const change of ["missing-lock", "wrong-version", "tracked-source", "undeclared"]) {
    const changed = new Map([...inputs].map(([repo, entries]) => [repo, new Map(entries)]));
    if (change === "missing-lock") changed.get("tsonic-rust").delete("package-lock.json");
    if (change === "wrong-version") changed.get("tsonic-rust").set("node_modules/ordinary-tool/package.json", Object.freeze({
      ...installed, text: JSON.stringify({ ...metadata, version: "9.9.9" }), sha256: keelDigest(JSON.stringify({ ...metadata, version: "9.9.9" })),
    }));
    if (change === "tracked-source") changed.get("tsonic-rust").set("node_modules/ordinary-tool/bin/tool", safetyFile("export const ordinary = 2;"));
    if (change === "undeclared") changed.get("tsonic-rust").set("package.json", safetyFile("{}"));
    assert.equal(boundarySafety(changed).nativeAllocationBoundary === undefined, true, `${change}: a path or forged metadata cannot create an external-dependency waiver`);
  }
});

test("QRC-14: physical package names, URL targets and finite-pattern proof stay distinct at the canonical owner", () => {
  for (const [metadata, target] of [
    [{ main: "./src/ordinary.d.ts#literal" }, "src/ordinary.d.ts#literal"],
    [{ bin: { ordinary: "./src/ordinary.d.ts?literal" } }, "src/ordinary.d.ts?literal"],
    [{ main: "./src/ordinary*name.d.ts" }, "src/ordinary*name.d.ts"],
    [{ exports: { ".": "./src/ordinary*name.d.ts" } }, "src/ordinary*name.d.ts"],
    [{ exports: { ".": "./src/ordinary.d.ts%23literal" } }, "src/ordinary.d.ts#literal"],
    [{ imports: { "#ordinary": "./src/ordinary.d.ts%3Fliteral" } }, "src/ordinary.d.ts?literal"],
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({ name: "@control/ordinary", ...metadata })));
    inputs.get("tsonic-rust").set(target, safetyFile("const ordinary = 2;"));
    assert.equal(keelSafetyBuiltModuleEntries(inputs).includes(`tsonic-rust/${target}`), true, "actual physical and URL addresses preserve their native file identity");
    assert.equal(boundarySafety(inputs).findings.length, 0, "literal wildcard-looking filenames and harmless suffix bytes are not metadata patterns");
    inputs.get("tsonic-rust").set(target, safetyFile('require("../test/helpers/native-ownership-cost.mjs");'));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "the same actual package bytes still close writer reachability");
  }
  const pattern = nativeBoundaryInputs();
  pattern.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({ exports: { "./*": "./src/*.d.ts" } })));
  pattern.get("tsonic-rust").set("src/ordinary.d.ts", safetyFile("const ordinary = 2;"));
  const unresolved = boundarySafety(pattern);
  assert.equal(unresolved.nativeAllocationBoundary === undefined, true, "an unproved finite native package pattern cannot silently skip its possible module bytes");
  assert.equal(unresolved.findings.some(finding => finding.file === "package.json" && finding.reason.includes("unproved finite package module pattern")), true, "bounded pattern limitation is an explicit refusal, not a source waiver");
});

test("QRC-14: bare packages and package-import aliases preserve the same physical main and URL export identity", () => {
  for (const [metadata, target] of [
    [{ main: "./src/ordinary.d.ts#literal" }, "src/ordinary.d.ts#literal"],
    [{ main: "./src/ordinary.d.ts#literal", exports: null }, "src/ordinary.d.ts#literal"],
    [{ main: "./src/ordinary.d.ts?literal" }, "src/ordinary.d.ts?literal"],
    [{ main: "./src/ordinary.d.ts%23literal" }, "src/ordinary.d.ts%23literal"],
    [{ main: "./src/ordinary*name.d.ts" }, "src/ordinary*name.d.ts"],
    [{ exports: { ".": "./src/ordinary.d.ts%23literal" } }, "src/ordinary.d.ts#literal"],
    [{ exports: { ".": "./src/ordinary.d.ts%3Fliteral" } }, "src/ordinary.d.ts?literal"],
  ]) {
    for (const specifier of ["@control/ordinary", "#entry"]) {
      for (const source of [`require(${JSON.stringify(specifier)});`, `await import(${JSON.stringify(specifier)});`]) {
        const inputs = nativeBoundaryInputs();
        inputs.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({ name: "@control/ordinary", ...metadata,
          imports: { "#entry": "@control/ordinary" } })));
        inputs.get("tsonic-rust").set("src/emitter.mjs", safetyFile(source));
        inputs.get("tsonic-rust").set(target, safetyFile("const ordinary = 2;"));
        const harmless = boundarySafety(inputs);
        assert.equal(harmless.findings.length, 0, `${source}: physical package identity is unchanged`);
        assert.equal(harmless.nativeAllocationBoundary.builtModuleInputs.some(entry => entry.path === `tsonic-rust/${target}`), true,
          `${source}: canonical metadata and ordinary module edges bind the identical bytes`);
        inputs.get("tsonic-rust").set(target, safetyFile('require("../test/helpers/native-ownership-cost.mjs");'));
        assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, `${source}: actual writer reachability remains rejected`);
        inputs.get("tsonic-rust").delete(target);
        assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, `${source}: missing native bytes never imply harmlessness`);
      }
    }
  }
});

test("QRC-14: private import patterns materialize every finite consumer and captured native byte without admitting open exports", () => {
  const inputs = nativeBoundaryInputs();
  inputs.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({ name: "@control/ordinary", imports: { "#safe/*": "./src/*.d.cts" } })));
  inputs.get("tsonic-rust").set("src/emitter.mjs", safetyFile('import "#safe/ordinary";'));
  inputs.get("tsonic-rust").set("src/ordinary.d.cts", safetyFile("const ordinary: number = 2;"));
  assert.equal(keelSafetyBuiltModuleEntries(inputs).includes("tsonic-rust/src/ordinary.d.cts"), true, "literal private consumer materializes its exact native target");
  assert.equal(boundarySafety(inputs).findings.length, 0, "the retained C114-F4 finite wildcard positive is still supported");
  inputs.get("tsonic-rust").set("src/hidden.d.cts", safetyFile('require("../test/helpers/native-ownership-cost.mjs");'));
  assert.equal(keelSafetyBuiltModuleEntries(inputs).includes("tsonic-rust/src/hidden.d.cts"), true, "captured pattern bytes cannot hide behind declaration identity");
  assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "one harmless match never waives a second captured harmful target");
  inputs.get("tsonic-rust").delete("src/hidden.d.cts");
  inputs.get("tsonic-rust").set("src/emitter.mjs", safetyFile('import "#safe/ordinary"; import "#safe/second";'));
  assert.equal(keelSafetyBuiltModuleEntries(inputs).includes("tsonic-rust/src/second.d.cts"), true, "every literal consumer requires its exact missing bytes too");
  assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "one captured harmless target never proves another consumer's missing target");
  inputs.get("tsonic-rust").set("src/second.d.cts", safetyFile('require("../test/helpers/native-ownership-cost.mjs");'));
  assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "all concrete consumer instances are checked, not just the first");
  inputs.get("tsonic-rust").set("src/second.d.cts", safetyFile("const second: number = 3;"));
  assert.equal(boundarySafety(inputs).findings.length, 0, "all finite harmless instances remain admitted");
  inputs.get("tsonic-rust").set("src/emitter.mjs", safetyFile('await import("#safe/" + selected);'));
  assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "computed private uses cannot turn a finite target into a namespace proof");
  inputs.get("tsonic-rust").set("src/emitter.mjs", safetyFile('import "@control/ordinary/ordinary";'));
  inputs.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({ name: "@control/ordinary", exports: { "./*": "./src/*.d.cts" } })));
  assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "one captured public export consumer never proves an ignored physical namespace");
  const precedence = nativeBoundaryInputs();
  precedence.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({ imports: {
    "#safe/*": "./src/*.d.cts", "#safe/specific/*": "./exact/*.d.cts", "#safe/exact": "./exact/ordinary.d.cts",
  } })));
  precedence.get("tsonic-rust").set("src/emitter.mjs", safetyFile('import "#safe/ordinary"; import "#safe/specific/ordinary"; import "#safe/exact";'));
  precedence.get("tsonic-rust").set("src/ordinary.d.cts", safetyFile("const ordinary: number = 2;"));
  precedence.get("tsonic-rust").set("exact/ordinary.d.cts", safetyFile("const exact: number = 2;"));
  precedence.get("tsonic-rust").set("src/exact.d.cts", safetyFile('require("../test/helpers/native-ownership-cost.mjs");'));
  precedence.get("tsonic-rust").set("src/specific/ordinary.d.cts", safetyFile('require("../../test/helpers/native-ownership-cost.mjs");'));
  assert.equal(boundarySafety(precedence).findings.length, 0, "exact and most-specific native mappings exclude shadowed broad targets, independently of declaration order");
  precedence.get("tsonic-rust").set("src/emitter.mjs", safetyFile('import "#safe/ordinary"; import "#safe/specific/ordinary"; import "#safe/exact"; import "#safe/other";'));
  precedence.get("tsonic-rust").set("src/other.d.cts", safetyFile('require("../test/helpers/native-ownership-cost.mjs");'));
  assert.equal(boundarySafety(precedence).nativeAllocationBoundary === undefined, true, "precedence proof does not exempt a genuine broad-pattern writer target");
  const late = nativeBoundaryInputs();
  late.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({ main: "./entry.d.cts", imports: { "#safe/*": "./src/*.d.cts" } })));
  late.get("tsonic-rust").set("entry.d.cts", safetyFile('require("#safe/ordinary");'));
  late.get("tsonic-rust").set("src/ordinary.d.cts", safetyFile("const ordinary: number = 2;"));
  late.get("tsonic-rust").set("src/hidden.d.cts", safetyFile("const hidden: number = 3;"));
  const complete = boundarySafety(late);
  assert.equal(complete.findings.length, 0, "late native metadata strengthens every matching module through the same queue");
  assert.equal(complete.nativeAllocationBoundary.builtModuleInputs.some(entry => entry.path === "tsonic-rust/src/hidden.d.cts"), true,
    "late finite evidence publishes actual matching bytes, not merely an earlier harmless consumer");
  late.get("tsonic-rust").set("src/hidden.d.cts", safetyFile('require("../test/helpers/native-ownership-cost.mjs");'));
  assert.equal(boundarySafety(late).nativeAllocationBoundary === undefined, true, "late byte evidence must also be executable-scanned before publication");
  late.get("tsonic-rust").delete("src/ordinary.d.cts");
  assert.equal(boundarySafety(late).nativeAllocationBoundary === undefined, true, "a late explicit missing consumer target remains an exact byte refusal");
});

test("QRC-14: bound createRequire package imports use the proven factory origin instead of the caller's package scope", () => {
  for (const root of ["../../rust-js/src/factory.mjs", "../../rust-js/src/"]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({ imports: { "#route/ordinary": "./src/caller.d.cts" } })));
    inputs.get("tsonic-rust").set("src/caller.d.cts", safetyFile("const caller: number = 1;"));
    inputs.get("rust-js").set("package.json", safetyFile(JSON.stringify({ imports: { "#route/*": "./src/*.d.cts" } })));
    inputs.get("tsonic-rust").set("src/emitter.mjs", safetyFile(`import { createRequire } from "node:module";
      const load = createRequire(new URL(${JSON.stringify(root)}, import.meta.url)); load("#route/ordinary");`));
    inputs.get("rust-js").set("src/ordinary.d.cts", safetyFile("const ordinary: number = 2;"));
    assert.equal(keelSafetyBuiltModuleEntries(inputs).includes("rust-js/src/ordinary.d.cts"), true, "actual factory-root private scope drives finite byte capture");
    assert.equal(boundarySafety(inputs).findings.length, 0, "the proven foreign first-party factory root remains an ordinary harmless native module edge");
    inputs.get("rust-js").set("src/ordinary.d.cts", safetyFile('require("../../tsonic-rust/test/helpers/native-ownership-cost.mjs");'));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "the caller's harmless mapping cannot hide a writer in the actual factory package");
    inputs.get("rust-js").delete("src/ordinary.d.cts");
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "missing factory-package bytes never fall back to the caller's supplied bytes");
  }
});

test("QRC-15: private package aliases retain native acquisition identities across the complete builtin family", () => {
  const cases = [
    ["module", 'import { createRequire } from "#native"; const load = createRequire(import.meta.url); load("../test/helpers/native-ownership-cost.mjs");'],
    ["fs", 'import { readFileSync } from "#native"; readFileSync(new URL("../../rust-runtime/tests/helpers/allocation_counts.rs", import.meta.url));'],
    ["fs/promises", 'import { readFile } from "#native"; await readFile(new URL("../../rust-runtime/tests/helpers/allocation_counts.rs", import.meta.url));'],
    ["url", 'import { URL } from "#native"; await import(new URL("../test/helpers/native-ownership-cost.mjs", import.meta.url));'],
    ["path", 'import { join } from "#native"; import { readFileSync } from "node:fs"; import { fileURLToPath } from "node:url"; readFileSync(join(fileURLToPath(new URL("../../rust-runtime/tests/helpers/", import.meta.url)), "allocation_counts.rs"));'],
    ["process", 'import { getBuiltinModule } from "#native"; getBuiltinModule("module").createRequire(import.meta.url)("../test/helpers/native-ownership-cost.mjs");'],
    ["worker_threads", 'import { Worker } from "#native"; new Worker(new URL("../test/helpers/native-ownership-cost.mjs", import.meta.url));'],
    ["child_process", 'import { fork } from "#native"; fork(new URL("../test/helpers/native-ownership-cost.mjs", import.meta.url));'],
    ["vm", 'import { runInThisContext } from "#native"; runInThisContext("import(\"../test/helpers/native-ownership-cost.mjs\")");'],
  ];
  for (const [module, source] of cases) {
    for (const target of [module, `node:${module}`, { node: `node:${module}`, default: module }]) {
      const inputs = nativeBoundaryInputs();
      inputs.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({ imports: { "#native": target } })));
      inputs.get("tsonic-rust").set("src/alias.mjs", safetyFile(source));
      assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, `${module}/${JSON.stringify(target)}: actual native authority cannot hide behind metadata`);
    }
  }
  for (const source of ['import "#native";', 'import * as fs from "#native"; void fs;',
    'import { readFileSync as read } from "#native"; typeof read;']) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("package.json", safetyFile('{"imports":{"#native":"node:fs"}}'));
    inputs.get("tsonic-rust").set("src/unused.mjs", safetyFile(source));
    assert.equal(boundarySafety(inputs).findings.length, 0, source);
  }
  const ambiguous = nativeBoundaryInputs();
  ambiguous.get("tsonic-rust").set("package.json", safetyFile('{"imports":{"#native":{"node":"node:module","default":"foreign-native-provider"}}}'));
  ambiguous.get("tsonic-rust").set("src/ambiguous.mjs", safetyFile('import { createRequire } from "#native"; const load = createRequire(import.meta.url); load("./ordinary.mjs");'));
  const result = boundarySafety(ambiguous);
  assert.equal(result.nativeAllocationBoundary === undefined, true, "conditional native authority is not selected by guessing one branch");
  assert.equal(result.findings.some(finding => finding.reason.includes("unproved native builtin identity")), true,
    "the alias identity has a precise native admission refusal");
});

test("QRC-15: factory-origin native aliases use the actual private package before binding readers", () => {
  for (const target of ["./ordinary.txt", "../../rust-runtime/tests/helpers/allocation_counts.rs"]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("package.json", safetyFile('{"imports":{"#module":"module","#url":"url","#read":"fs"}}'));
    const source = `import * as modules from "#module";
      const { createRequire } = modules;
      const first = createRequire(import.meta.url);
      const { URL } = first("#url");
      const next = createRequire(new URL("./next.mjs", import.meta.url));
      const { readFileSync: read } = next("#read");
      read(new URL(${JSON.stringify(target)}, import.meta.url));`;
    inputs.get("tsonic-rust").set("src/facts.mjs", safetyFile(source));
    const actual = boundarySafety(inputs);
    assert.equal(actual.nativeAllocationBoundary === undefined, target !== "./ordinary.txt",
      `${target}: each immutable native producer is established before its dependent consumer`);
    inputs.get("tsonic-rust").set("src/facts.mjs", safetyFile(source.replace('const next =', 'consume(URL); const next =')));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true,
      `${target}: native constructor escape cannot gain authority through a derived binding`);
  }
  for (const root of ["../../rust-js/src/factory.mjs", "../../rust-js/src/"]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("package.json", safetyFile('{"imports":{"#read":"foreign-harmless-package"}}'));
    inputs.get("rust-js").set("package.json", safetyFile('{"imports":{"#read":"node:fs"}}'));
    inputs.get("tsonic-rust").set("src/factory.mjs", safetyFile(`import { createRequire } from "node:module";
      const load = createRequire(new URL(${JSON.stringify(root)}, import.meta.url));
      const { readFileSync: read } = load("#read");
      read(new URL("../../rust-runtime/tests/helpers/allocation_counts.rs", import.meta.url));`));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true,
      `${root}: the caller's external metadata cannot hide the actual factory package's native reader`);
    inputs.get("tsonic-rust").set("src/factory.mjs", safetyFile(`import { createRequire } from "node:module";
      const load = createRequire(new URL(${JSON.stringify(root)}, import.meta.url));
      const { readFileSync: read } = load("#read");
      read(new URL("./ordinary.txt", import.meta.url));`));
    assert.equal(boundarySafety(inputs).findings.length, 0, `${root}: the same exact reader may read ordinary data`);
  }
  for (const source of [
    'const { readFileSync: read } = require("#native"); read(new URL("../../rust-runtime/tests/helpers/allocation_counts.rs", import.meta.url));',
    'const { readFile: read } = await import("#native"); read(new URL("../../rust-runtime/tests/helpers/allocation_counts.rs", import.meta.url));',
    'import native = require("#native"); native.readFileSync(new URL("../../rust-runtime/tests/helpers/allocation_counts.rs", import.meta.url));',
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("package.json", safetyFile('{"imports":{"#native":"node:fs"}}'));
    inputs.get("tsonic-rust").set("src/alias.cts", safetyFile(source));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, source);
  }
});

test("QRC-15: CommonJS export data is inert while loader authority and writer forwarding stay restricted", () => {
  for (const [file, source] of [["ordinary.cjs", 'module.exports = {};'], ["ordinary.cjs", 'module.exports.value = 1;'],
    ["ordinary.cjs", 'exports.value = 1;'], ["ordinary.mjs", 'import { createRequire } from "node:module"; void createRequire;']]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set(`src/${file}`, safetyFile(source));
    assert.equal(boundarySafety(inputs).findings.length, 0, source);
  }
  for (const source of ['module.exports = require("../test/helpers/native-ownership-cost.mjs");',
    'module.require("../test/helpers/native-ownership-cost.mjs");', 'module.constructor._load("../test/helpers/native-ownership-cost.mjs");',
    'module.paths = ["../test/helpers"]; require("native-ownership-cost.mjs");',
    'import Module from "node:module"; Module._resolveFilename = replacement; require("ordinary");']) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/entry.cjs", safetyFile(source));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, source);
  }
  const malformed = nativeBoundaryInputs();
  malformed.get("tsonic-rust").set("src/entry.cjs", safetyFile('require("../test/helpers/native-ownership-cost.mjs#literal");'));
  malformed.get("tsonic-rust").set("test/helpers/native-ownership-cost.mjs#literal", safetyFile("ordinary bytes"));
  assert.equal(boundarySafety(malformed).nativeAllocationBoundary === undefined, true,
    "actual malformed raw JavaScript is never made harmless by its physical filename");
});

test("QRC-15: physical execution requires its actual native source role, never a TypeScript filename projection", () => {
  for (const source of [
    'import { Worker } from "node:worker_threads"; new Worker(new URL("./worker-entry.js", import.meta.url));',
    'import { fork } from "node:child_process"; fork(new URL("./worker-entry.js", import.meta.url));',
    'import { spawn } from "node:child_process"; import { fileURLToPath } from "node:url"; const entry = fileURLToPath(new URL("./worker-entry.js", import.meta.url)); spawn(process.execPath, [entry]);',
    'import { createRequire } from "node:module"; const load = createRequire(import.meta.url); load("./worker-entry.js");',
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/entry.ts", safetyFile(source));
    inputs.get("tsonic-rust").set("src/worker-entry.ts", safetyFile("export const ordinary: number = 1;"));
    assert.equal(keelSafetyBuiltModuleEntries(inputs).includes("tsonic-rust/src/worker-entry.js"), false,
      `${source}: authored syntax is not proof of a physical native runtime filename`);
    assert.equal(boundarySafety(inputs).findings.length, 0, `${source}: source-only syntax has no invented native entry`);
    inputs.get("tsonic-rust").set("src/worker-entry.ts", safetyFile('import "../test/helpers/native-ownership-cost.mjs";'));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true,
      `${source}: direct authored source dependencies cannot conceal the writer`);
    inputs.get("tsonic-rust").set("src/worker-entry.ts", safetyFile("export const ordinary: number = 1;"));
    inputs.get("tsonic-rust").set("src/native.mjs", safetyFile('import "./entry.ts";'));
    assert.equal(keelSafetyBuiltModuleEntries(inputs).includes("tsonic-rust/src/entry.ts"), true,
      `${source}: the actual native edge first requests the exact typed source bytes`);
    const entry = inputs.get("tsonic-rust").get("src/entry.ts");
    inputs.get("tsonic-rust").set("src/entry.ts", Object.freeze({ ...entry, builtModule: true }));
    assert.equal(keelSafetyBuiltModuleEntries(inputs).includes("tsonic-rust/src/worker-entry.js"), true,
      `${source}: actual native input strengthens the typed source's real execution role`);
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true,
      `${source}: actual native reachability requires its physical JS entry, not the authored TS projection`);
    inputs.get("tsonic-rust").set("src/worker-entry.js", safetyFile("export const ordinary = 1;"));
    assert.equal(boundarySafety(inputs).findings.length, 0,
      `${source}: the exact provided harmless native entry remains admitted`);
    inputs.get("tsonic-rust").set("src/worker-entry.js", safetyFile('import "../test/helpers/native-ownership-cost.mjs";'));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true,
      `${source}: harmless typed sibling bytes never substitute for the actual native writer entry`);
  }
  assert.throws(() => scriptSourceReferences("tsonic-rust/src/ordinary.ts", "export const ordinary = 1;", {}, "authored"),
    /Missing AC12 canonical package-import resolution/u, "the superseded parser signature is rejected");
});

test("QRC-15: actual native Node resolves package builtin aliases and factory origins without caller-scope substitution", context => {
  const temporary = new URL("../../.temp/", import.meta.url);
  mkdirSync(temporary, { recursive: true });
  const root = mkdtempSync(fileURLToPath(new URL("q109-native-package-identities-", temporary)));
  const modules = ["module", "fs", "fs/promises", "url", "path", "process", "worker_threads", "child_process", "vm"];
  const observations = [];
  for (const spelling of ["bare", "conditional", "native-invalid"]) {
    const directory = join(root, spelling);
    mkdirSync(directory);
    const imports = Object.fromEntries(modules.map((module, index) => [`#native${index}`,
      spelling === "bare" ? module : spelling === "native-invalid" ? `node:${module}` : { node: module, default: module }]));
    imports["#reader"] = "./reader.cjs";
    writeFileSync(join(directory, "package.json"), JSON.stringify({ type: "module", imports }));
    writeFileSync(join(directory, "reader.cjs"), 'module.exports = require("node:path");');
    const foreign = join(directory, "foreign");
    mkdirSync(foreign);
    writeFileSync(join(foreign, "package.json"), '{"type":"module","imports":{"#reader":"./reader.cjs","#native-reader":"fs"}}');
    writeFileSync(join(foreign, "reader.cjs"), 'module.exports = require("node:fs");');
    const entry = modules.map((module, index) =>
      `import * as actual${index} from ${JSON.stringify(`node:${module}`)}; import * as alias${index} from ${JSON.stringify(`#native${index}`)};`).join("\n") +
      '\nimport { createRequire } from "node:module";\n' +
      'const load = createRequire(new URL("./foreign/entry.mjs", import.meta.url));\n' +
      'let nativeRequireRefusal; try { load("#native-reader"); } catch (error) { nativeRequireRefusal = error.code; }\n' +
      `process.stdout.write(JSON.stringify({ identities: [${modules.map((_module, index) => `actual${index} === alias${index}`).join(",")}, load("#reader").readFileSync === actual1.readFileSync], nativeRequireRefusal }));\n`;
    writeFileSync(join(directory, "entry.mjs"), entry);
    const child = spawnSync(process.execPath, [join(directory, "entry.mjs")], { encoding: "utf8" });
    context.diagnostic(JSON.stringify({ nativeNode: process.version, spelling, status: child.status,
      stdout: child.stdout, stderr: child.stderr }));
    observations.push({ spelling, ...child });
  }
  for (const child of observations) {
    const { spelling } = child;
    if (spelling === "native-invalid") {
      assert.equal(child.status, 1, "native Node refuses node:-prefixed package-import targets before execution");
      assert.match(child.stderr, /ERR_INVALID_PACKAGE_TARGET/u, "native target refusal is not an alias capability or fallback");
      continue;
    }
    assert.equal(child.status, 0, `${spelling}: ${child.stderr}`);
    const actual = JSON.parse(child.stdout);
    assert.deepEqual(actual.identities, Array.from({ length: modules.length + 1 }, () => true),
      `${spelling}: all native identities and the foreign factory's exact private scope agree`);
    assert.equal(actual.nativeRequireRefusal, "ERR_INVALID_URL_SCHEME",
      `${spelling}: current native CJS builtin-alias refusal is never claimed as a supported reader path`);
  }
});

for (const [role, launches] of [
  ["package-script", [
    { path: "src/entry.ts", command: "node src/entry.ts" },
    { path: "src/entry.ts", command: "node --max-old-space-size=32 -- src/entry.ts" },
    { path: "src/native entry.ts", command: "node 'src/native entry.ts'" },
  ]],
  ["node-shebang", [
    { path: "src/entry.ts", shebang: "#!/usr/bin/env node" },
    { path: "src/entry.ts", shebang: "#!/usr/bin/node" },
    { path: "src/entry", shebang: "#!/usr/bin/env -S node --max-old-space-size=32" },
  ]],
]) test(`QRC-16: ${role} launches share exact native root closure`, () => {
  const bodies = [
    'import { Worker } from "node:worker_threads"; new Worker(new URL("./worker-entry.js", import.meta.url));',
    'import { fork } from "node:child_process"; fork(new URL("./worker-entry.js", import.meta.url));',
    'import { spawn } from "node:child_process"; import { fileURLToPath } from "node:url"; const entry = fileURLToPath(new URL("./worker-entry.js", import.meta.url)); spawn(process.execPath, [entry]);',
    'import { createRequire } from "node:module"; const load = createRequire(import.meta.url); load("./worker-entry.js");',
  ];
  for (const launch of launches) for (const body of bodies) {
    const inputs = nativeBoundaryInputs();
    const text = launch.shebang === undefined ? body : `${launch.shebang}\n${body}`;
    inputs.get("tsonic-rust").set(launch.path, Object.freeze({ ...safetyFile(text), mode: launch.shebang === undefined ? "100644" : "100755" }));
    if (launch.command !== undefined) inputs.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({ type: "module", scripts: { start: launch.command } })));
    inputs.get("tsonic-rust").set("src/worker-entry.ts", safetyFile("export const ordinary: number = 1;"));
    const label = `${launch.command ?? launch.shebang}: ${body}`;
    const entries = keelSafetyBuiltModuleEntries(inputs);
    assert.equal(entries.includes(`tsonic-rust/${launch.path}`), true, `${label}: the same producer identifies the actual native root`);
    assert.equal(entries.includes("tsonic-rust/src/worker-entry.js"), true, `${label}: physical native bytes are requested without a filename projection`);
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, `${label}: missing bytes refuse despite a harmless authored TS sibling`);
    inputs.get("tsonic-rust").set("src/worker-entry.js", safetyFile("export const ordinary = 1;", false));
    assert.equal(boundarySafety(inputs).findings.length, 0, `${label}: provided exact harmless physical bytes pass`);
    inputs.get("tsonic-rust").set("src/worker-entry.js", safetyFile('import "../test/helpers/native-ownership-cost.mjs";', false));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, `${label}: a native bridge to the writer refuses`);
  }
  const authored = nativeBoundaryInputs();
  authored.get("tsonic-rust").set("src/entry.ts", safetyFile(`#!/usr/bin/env node\n${bodies[0]}`));
  assert.equal(keelSafetyBuiltModuleEntries(authored).includes("tsonic-rust/src/worker-entry.js"), false,
    "a nonexecutable authored typed shebang is not by itself a native OS entry");
  assert.equal(boundarySafety(authored).findings.length, 0, "authored-only typed sources retain their original positive");
});

test("QRC-16: unproved declared native launch spelling refuses without a shell or code evaluator", () => {
  for (const command of [
    "node --unknown-root-flag src/entry.ts", "node --env-file environment.env src/entry.ts",
    "node --eval 'globalThis.execute()'", "node -", "node", "node --require ./src/preload.mjs", "node --test 'src/*.ts'", null,
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({ scripts: { start: command } })));
    inputs.get("tsonic-rust").set("src/entry.ts", safetyFile("export const ordinary: number = 1;"));
    inputs.get("tsonic-rust").set("src/preload.mjs", safetyFile("export const ordinary = 1;"));
    const result = boundarySafety(inputs);
    assert.equal(result.nativeAllocationBoundary === undefined, true, `${command}: unsupported native execution cannot certify a missing root`);
    assert.equal(result.findings.some(finding => /unproved|unsupported|invalid/u.test(finding.reason) && finding.file === "package.json"), true,
      `${command}: refusal belongs to the actual metadata entry boundary`);
  }
  for (const header of ["#!/usr/bin/env -S node --unknown-root-flag", "#!/usr/bin/env -S node --require ./preload.cjs"]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/entry", Object.freeze({ ...safetyFile(`${header}\nexport const ordinary = 1;`), mode: "100755" }));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, `${header}: unproved interpreter options cannot hide a native root`);
  }
});

test("QRC-17: opaque commands remain individually open, and actual incoming product boundaries refuse by exact command", () => {
  const commands = ["node $ENTRY", "node src/entry.ts && node src/second.ts", "node src/entry.ts\nnode src/second.ts",
    "npm run test", "bash scripts/build.sh"];
  const inputs = nativeBoundaryInputs();
  inputs.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({ name: "native-control",
    scripts: Object.fromEntries(commands.map((command, index) => ["command" + index, command])) })));
  inputs.get("tsonic-rust").set("bin/opaque", Object.freeze({ ...safetyFile("#!/usr/bin/env bash\nexport const value = 1;"), mode: "100755" }));
  inputs.get("tsonic-rust").set("bin/ambiguous-env", Object.freeze({ ...safetyFile("#!/usr/bin/env node --import preload.mjs\nexport const value = 1;"), mode: "100755" }));
  const positive = boundarySafety(inputs);
  assert.equal(positive.findings.length, 0, "opaque commands outside the native incoming cut are listed, never blanket-refused or certified closed");
  assert.equal(positive.openNativeExecutionBoundaries.length, commands.length + 2, "every opaque declaration has an individual open-boundary record");
  assert.deepEqual(positive.openNativeExecutionBoundaries.filter(row => row.path.endsWith("/package.json")).map(row => row.command), commands,
    "exact package command text is preserved without a shell interpreter");
  assert.equal(positive.openNativeExecutionBoundaries.every(row => row.status === "OPEN_BOUNDARY" && !row.inIncomingCut && row.owner === "tsonic-rust"), true,
    "each outside-proof command has an explicit owner and no invented closure claim");
  assert.equal(positive.unsupportedNativeExecutionBoundaryCount, 0, "no unsupported command enters this actual incoming product cut");
  for (const command of ["node --help", "node --version", "node --check test/helpers/native-ownership-cost.mjs"]) {
    const current = nativeBoundaryInputs();
    current.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({ scripts: { inspect: command } })));
    assert.equal(boundarySafety(current).findings.length, 0, `${command}: the existing nonexecuting native modes do not manufacture a source-execution root`);
  }
  for (const bridge of [false, true, "native-source"]) {
    const current = nativeBoundaryInputs();
    current.get("tsonic-rust").set("bin/opaque", inputs.get("tsonic-rust").get("bin/opaque"));
    current.get("tsonic-rust").set("src/bridge.mjs", safetyFile('import "../bin/opaque"; export const ordinary = 1;'));
    if (bridge !== "native-source") current.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({ bin: bridge ? "./src/bridge.mjs" : "./bin/opaque" })));
    const negative = boundarySafety(current);
    assert.equal(negative.nativeAllocationBoundary === undefined, true, "direct or transitive product promotion cannot certify an opaque interpreter boundary");
    assert.equal(negative.unsupportedNativeExecutionBoundaryCount, 1, "the one actual incoming command is counted exactly once");
    assert.equal(negative.findings.some(row => row.reason.includes("TEST-ALLOCATOR no-product-reachability") && row.reason.includes("/usr/bin/env bash")), true,
      "unsupported guarantee refusal names the exact real command, not an invented blanket rule");
  }
  inputs.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({ scripts: { start: "node --run opaque", opaque: commands[4] } })));
  const delegated = boundarySafety(inputs);
  assert.equal(delegated.nativeAllocationBoundary === undefined, true, "a literal native --run cannot silently close its opaque command dependency");
  assert.equal(delegated.openNativeExecutionBoundaries.some(row => row.command === commands[4] && row.inIncomingCut), true,
    "the existing literal metadata table names the actual dependent shell command without executing it");
});

test("QRC-17: bounded native test globs require their complete exact snapshot and every positional execution root", () => {
  const inputs = nativeBoundaryInputs();
  const packagePath = "tsonic-rust/package.json";
  inputs.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({ scripts: {
    test: "node --test 'src/**/*.test.ts' 'other/*.test.ts'",
  } })));
  const paths = ["src/one.test.ts", "src/nested/two.test.ts", "other/three.test.ts"];
  for (const path of paths) inputs.get("tsonic-rust").set(path, safetyFile("export const ordinary: number = 1;"));
  const globs = keelSafetyNativeTestGlobs(inputs);
  assert.equal(globs.length, 2, "the same argv owner retains both Node test positional patterns");
  assert.equal(globs.every(row => row.source === packagePath && row.pattern.startsWith(row.prefix + "/")), true,
    "each literal pattern stays below its snapshot-contained static prefix");
  const matches = globs.map(({ source, ...glob }) => {
    const rows = paths.filter(path => `${glob.prefix}/` === `tsonic-rust/${path.split("/")[0]}/`)
      .map(path => ({ path: `tsonic-rust/${path}`, sha256: inputs.get("tsonic-rust").get(path).sha256 }))
      .sort((left, right) => left.path.localeCompare(right.path));
    return Object.freeze({ ...glob, matches: Object.freeze(rows), sha256: keelDigest(JSON.stringify(rows)) });
  });
  const packageInput = inputs.get("tsonic-rust").get("package.json");
  inputs.get("tsonic-rust").set("package.json", Object.freeze({ ...packageInput, nodeTestGlobs: Object.freeze(matches) }));
  assert.equal(boundarySafety(inputs).findings.length, 0, "the complete harmless snapshot remains admitted");
  assert.equal(paths.every(path => keelSafetyBuiltModuleEntries(inputs).includes(`tsonic-rust/${path}`)), true,
    "every matched typed filename becomes its actual native execution root without a JS-to-TS projection");
  const empty = nativeBoundaryInputs();
  const emptyMatches = [];
  empty.get("tsonic-rust").set("package.json", Object.freeze({ ...safetyFile(JSON.stringify({ scripts: { test: "node --test 'src/*.test.mjs'" } })),
    nodeTestGlobs: [{ prefix: "tsonic-rust/src", pattern: "tsonic-rust/src/*.test.mjs", matches: emptyMatches, sha256: keelDigest(JSON.stringify(emptyMatches)) }],
  }));
  assert.equal(boundarySafety(empty).findings.length, 0, "an actually captured empty magic-pattern set is distinct from missing snapshot evidence");
  for (const mutation of ["absent", "wrong-hash", "missing-member", "duplicate-member", "outside-prefix", "missing-physical", "changed-bytes", "duplicate-capture"]) {
    const current = new Map([...inputs].map(([repo, files]) => [repo, new Map(files)]));
    let changed = matches.map(row => ({ ...row, matches: [...row.matches] }));
    if (mutation === "wrong-hash") changed[0].sha256 = "0".repeat(64);
    if (mutation === "missing-member") changed[1].matches.pop();
    if (mutation === "duplicate-member") changed[1].matches.push(changed[1].matches[0]);
    if (mutation === "outside-prefix") changed[1].matches[0] = { path: "tsonic-rust/other/three.test.ts", sha256: inputs.get("tsonic-rust").get(paths[2]).sha256 };
    if (mutation === "missing-physical") current.get("tsonic-rust").delete(paths[0]);
    if (mutation === "changed-bytes") current.get("tsonic-rust").set(paths[0], safetyFile("export const changed: number = 2;"));
    if (!["absent", "wrong-hash"].includes(mutation)) changed = changed.map(row => ({ ...row, sha256: keelDigest(JSON.stringify(row.matches)) }));
    if (mutation === "duplicate-capture") changed.push(changed[0]);
    current.get("tsonic-rust").set("package.json", Object.freeze({ ...packageInput,
      ...(mutation === "absent" ? {} : { nodeTestGlobs: changed }) }));
    assert.equal(boundarySafety(current).nativeAllocationBoundary === undefined, true, `${mutation}: incomplete or forged membership cannot close the native boundary`);
  }
  for (const pattern of ["src/*/../*.test.ts", "/outside/*.test.ts", "src/\\*.test.ts"]) {
    const current = nativeBoundaryInputs();
    current.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({ scripts: { test: `node --test '${pattern}'` } })));
    assert.equal(boundarySafety(current).nativeAllocationBoundary === undefined, true, `${pattern}: no unresolved prefix traversal or alternate separator can claim a finite native snapshot`);
  }
  const nested = new Map([...inputs].map(([repo, files]) => [repo, new Map(files)]));
  nested.get("tsonic-rust").delete("package.json");
  nested.get("tsonic-rust").set("nested/package.json", Object.freeze({
    ...safetyFile(JSON.stringify({ scripts: { test: "node --test '../src/**/*.test.ts'" } })), nodeTestGlobs: [matches[1]],
  }));
  assert.equal(boundarySafety(nested).findings.length, 0, "literal parent segments before the first wildcard retain their exact snapshot-contained prefix");
  inputs.get("tsonic-rust").set(paths[2], safetyFile('import "../test/helpers/native-ownership-cost.mjs";'));
  const updated = matches.map(row => ({ ...row, matches: row.matches.map(member => ({ ...member,
    sha256: inputs.get("tsonic-rust").get(member.path.slice("tsonic-rust/".length)).sha256 })) }));
  inputs.get("tsonic-rust").set("package.json", Object.freeze({ ...packageInput,
    nodeTestGlobs: updated.map(row => ({ ...row, sha256: keelDigest(JSON.stringify(row.matches)) })) }));
  assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "the second pattern cannot hide a real writer bridge behind the first harmless test root");
});

test("QRC-17: actual native Node test-glob membership matches the complete hashed runtime snapshot", context => {
  const temporary = new URL("../../.temp/", import.meta.url);
  mkdirSync(temporary, { recursive: true });
  const root = mkdtempSync(fileURLToPath(new URL("q109-native-test-globs-", temporary)));
  const paths = ["src/one.test.mjs", "src/nested/two.test.mjs", "other/three.test.mjs"];
  for (const [index, path] of paths.entries()) {
    const absolute = join(root, path);
    mkdirSync(posix.dirname(absolute), { recursive: true });
    writeFileSync(absolute, `import test from "node:test"; test("native-glob-${index}", () => {});\n`);
  }
  const excluded = join(root, "src/node_modules/hidden.test.mjs");
  mkdirSync(posix.dirname(excluded), { recursive: true });
  writeFileSync(excluded, 'throw new Error("native glob never traverses node_modules");');
  const patterns = ["src/**/*.test.mjs", "other/*.test.mjs"];
  const snapshot = () => globSync(patterns, { cwd: root, exclude: name => name === "node_modules" }).sort()
    .map(path => ({ path, sha256: keelDigest(readFileSync(join(root, path))) }));
  const before = snapshot();
  const arguments_ = ["--test", "--test-reporter=tap", "--test-concurrency=1", ...patterns];
  const environment = { ...process.env };
  delete environment.NODE_TEST_CONTEXT;
  const child = spawnSync(process.execPath, arguments_, { cwd: root, encoding: "utf8", env: environment });
  const after = snapshot();
  context.diagnostic(JSON.stringify({ nativeNode: process.version, command: [process.execPath, ...arguments_],
    root, before, beforeSha256: keelDigest(JSON.stringify(before)), after, afterSha256: keelDigest(JSON.stringify(after)),
    status: child.status, stdout: child.stdout, stderr: child.stderr }));
  assert.equal(child.status, 0, `the actual native Node test runner succeeds: ${child.stderr}`);
  assert.deepEqual(before.map(row => row.path), [...paths].sort(), "the native glob set includes every supplied pattern and no excluded directory");
  assert.deepEqual(before, after, "complete native matched sets and every member's exact bytes are immutable before and after execution");
  for (const index of paths.keys()) assert.match(child.stdout, new RegExp(`^ok \\d+ - native-glob-${index}$`, "mu"),
    `the actual native runner executes every declared member: ${index}`);
  const inert = join(root, "must-not-execute.mjs");
  writeFileSync(inert, 'throw new Error("a native nonexecuting mode must not load this program");');
  for (const option of ["--help", "--version", "--check"]) {
    const control = spawnSync(process.execPath, [option, inert], { cwd: root, encoding: "utf8" });
    writeFileSync(join(root, option.slice(2) + ".stdout.log"), control.stdout);
    writeFileSync(join(root, option.slice(2) + ".stderr.log"), control.stderr);
    context.diagnostic(JSON.stringify({ nativeNode: process.version, command: [process.execPath, option, inert],
      status: control.status, stdoutPath: join(root, option.slice(2) + ".stdout.log"), stderrPath: join(root, option.slice(2) + ".stderr.log"),
      stdoutSha256: keelDigest(control.stdout), stderrSha256: keelDigest(control.stderr) }));
    assert.equal(control.status, 0, `${option}: the actual native mode never executes the valid throwing source`);
  }
});

test("QRC-16: Node launch entry paths remain physical while URL entries and preloads keep their native address rules", () => {
  for (const [command, path] of [
    ["node 'src/entry#literal.ts'", "src/entry#literal.ts"],
    ["node 'src/entry%23literal.ts'", "src/entry%23literal.ts"],
    ["node --entry-url file:///keel/tsonic-rust/src/entry%23literal.ts", "src/entry#literal.ts"],
    ["node --require ./src/preload.cts src/entry.ts", "src/preload.cts"],
    ["node --import ./src/preload.mts src/entry.ts", "src/preload.mts"],
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({ scripts: { start: command } })));
    inputs.get("tsonic-rust").set("src/entry.ts", safetyFile("export const ordinary: number = 1;"));
    inputs.get("tsonic-rust").set(path, safetyFile('import "../test/helpers/native-ownership-cost.mjs";'));
    assert.equal(keelSafetyBuiltModuleEntries(inputs).includes(`tsonic-rust/${path}`), true, `${command}: exact native address is captured`);
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, `${command}: native entry or preload cannot promote the writer`);
    inputs.get("tsonic-rust").set(path, safetyFile("export const ordinary = 1;"));
    assert.equal(boundarySafety(inputs).findings.length, 0, `${command}: harmless bytes at the same exact address pass`);
  }
  const inputs = nativeBoundaryInputs();
  const file = "test/entry.ts";
  inputs.get("tsonic-rust").set(file, safetyFile('import test from "node:test"; import { nativeOwnershipCostSupport } from "./helpers/native-ownership-cost.mjs"; test("native", () => { void nativeOwnershipCostSupport; });'));
  inputs.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({ scripts: { test: `node --test ${file}` } })));
  assert.equal(boundarySafety(inputs).findings.length, 0, "an actual direct Node test entry remains test-only under its real execution launch");
  inputs.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({ main: `./${file}`, scripts: { test: `node --test ${file}` } })));
  assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "a native test launch cannot waive a second real product/module promotion");
});

test("QRC-18: effective native execution modes distinguish positionals, code and every module-option family", () => {
  const writer = "test/helpers/native-ownership-cost.mjs";
  for (const mode of ["--help", "-h", "--version", "-v", "--check", "-c", "--v8-options", "--completion-bash", "--prof-process"]) {
    for (const path of [writer, "missing-entry.mjs"]) {
      const inputs = nativeBoundaryInputs();
      inputs.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({ scripts: { inspect: `node ${mode} ${path}` } })));
      assert.equal(boundarySafety(inputs).findings.length, 0, `${mode}/${path}: no executable positional is manufactured`);
      inputs.get("tsonic-rust").delete("package.json");
      inputs.get("tsonic-rust").set("src/inspect.mjs", safetyFile(`import { spawnSync } from "node:child_process"; spawnSync(process.execPath, ${JSON.stringify([mode, "../" + path])});`));
      assert.equal(boundarySafety(inputs).findings.length, 0, `${mode}/${path}: the AST adapter reads the same effective positional role`);
    }
  }
  const families = ["--require", "--import", "--experimental-loader", "--test-reporter", "--test-global-setup"];
  for (const [mode, active] of [["normal", families.slice(0, 3)], ["--help", ["--require"]], ["--version", []],
    ["--check", ["--require", "--import"]], ["--v8-options", []], ["--completion-bash", []], ["--prof-process", []], ["--test", families]]) {
    for (const option of families) for (const joined of [false, true]) {
      const inputs = nativeBoundaryInputs();
      const path = "test/ordinary.test.mjs";
      inputs.get("tsonic-rust").set(path, safetyFile('import test from "node:test"; test("ordinary", () => {});'));
      const prefix = mode === "normal" ? [] : [mode];
      const operand = "./" + writer;
      const args = [...prefix, ...(joined ? [`${option}=${operand}`] : [option, operand]), path];
      inputs.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({ scripts: { inspect: "node " + args.join(" ") } })));
      assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, active.includes(option), `${mode}/${option}/${joined}: actual native metadata module role`);
      inputs.get("tsonic-rust").delete("package.json");
      const nativeWriter = "/keel/tsonic-rust/" + writer;
      const astArgs = [...prefix, ...(joined ? [`${option}=${nativeWriter}`] : [option, nativeWriter]), "/keel/tsonic-rust/" + path];
      inputs.get("tsonic-rust").set("src/inspect.mjs", safetyFile(`import { spawnSync } from "node:child_process"; spawnSync(process.execPath, ${JSON.stringify(astArgs)});`));
      assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, active.includes(option), `${mode}/${option}/${joined}: actual native AST module role`);
    }
  }
  for (const prefix of [["--help", "--require", "./test/benign.cjs"], ["--check", "--import", "./test/benign.mjs"],
    ["--require", "./test/benign.cjs", "--prof-process"]]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("test/benign.cjs", safetyFile('void import("./benign.mjs");'));
    inputs.get("tsonic-rust").set("test/benign.mjs", safetyFile("export const ordinary = 1;"));
    inputs.get("tsonic-rust").set("test/ordinary.mjs", safetyFile("export const ordinary = 1;"));
    const args = prefix.at(-1) === "--prof-process"
      ? [...prefix.slice(0, -1), "--experimental-loader", "./" + writer, "--prof-process", "profile.log"]
      : [...prefix, "--experimental-loader", "./" + writer, "test/ordinary.mjs"];
    inputs.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({ scripts: { inspect: "node " + args.join(" ") } })));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true,
      `${prefix.join(" ")}: an active preload may initialize the selected loader; its authority is not hidden by the main mode`);
  }
  for (const prefix of [["--help", "--no-help"], ["--version", "--no-version"], ["--test", "--no-test"]]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({ scripts: { run: `node ${prefix.join(" ")} ${writer}` } })));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, `${prefix.join(" ")}: reenabled ordinary execution retains its writer inverse`);
  }
  for (const arguments_ of ['["--help", flag, "../test/helpers/native-ownership-cost.mjs"]',
    '["--help", ...flags, "../test/helpers/native-ownership-cost.mjs"]']) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/unknown.mjs", safetyFile(`import { spawnSync } from "node:child_process"; function inspect(flag, flags) { spawnSync(process.execPath, ${arguments_}); }`));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, `${arguments_}: an unresolved argument may disable help and expose the real entry`);
  }
  for (const prefix of [["--help", "--eval"], ["--eval", "0", "--help"]]) {
    const inputs = nativeBoundaryInputs();
    const args = prefix.at(-1) === "--eval" ? [...prefix, `import("../${writer}")`] : prefix;
    inputs.get("tsonic-rust").set("src/inspect.mjs", safetyFile(`import { spawnSync } from "node:child_process"; spawnSync(process.execPath, ${JSON.stringify(args)});`));
    assert.equal(boundarySafety(inputs).findings.length, 0, "help suppresses inline code, not its genuinely executed CJS preload");
  }
  assert.throws(() => readKeelNodeArguments([], {}), /Missing AC12 native argument role contract/u,
    "the superseded callback contract is rejected instead of retaining a second mode reader");
});

test("QRC-18: explicit captured native tests keep their own authority without promoting authored or product entries", () => {
  const bodies = [
    ["test/entry.ts", 'import test from "node:test"; import { nativeOwnershipCostSupport } from "./helpers/native-ownership-cost.mjs"; const label: string = "native"; test(label, () => { void nativeOwnershipCostSupport; });'],
    ["test/entry.cts", 'const test = require("node:test"); const { nativeOwnershipCostSupport } = require("./helpers/native-ownership-cost.mjs"); test("native", () => { void nativeOwnershipCostSupport; });'],
  ];
  for (const [path, text] of bodies) {
    const make = () => {
      const inputs = nativeBoundaryInputs();
      inputs.get("tsonic-rust").set(path, safetyFile(text));
      inputs.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({ scripts: { test: `node --test ${path}` } })));
      return inputs;
    };
    assert.equal(boundarySafety(make()).findings.length, 0, `${path}: real native test authority, node:test and physical bytes are all present`);
    const globbed = make();
    const pattern = path.endsWith(".cts") ? "test/*.cts" : "test/*.ts";
    const matches = [{ path: "tsonic-rust/" + path, sha256: globbed.get("tsonic-rust").get(path).sha256 }];
    globbed.get("tsonic-rust").set("package.json", Object.freeze({
      ...safetyFile(JSON.stringify({ scripts: { test: `node --test '${pattern}'` } })),
      nodeTestGlobs: [{ prefix: "tsonic-rust/test", pattern: "tsonic-rust/" + pattern,
        matches, sha256: keelDigest(JSON.stringify(matches)) }],
    }));
    assert.equal(boundarySafety(globbed).findings.length, 0, `${path}: complete native glob membership preserves the same explicit test role`);
    for (const promotion of ["main", "bin", "ordinary-script", "import", "reexport", "alias", "missing-bytes", "missing-node-test", "authored-only", "nonowned-root"]) {
      const inputs = make();
      if (["main", "bin"].includes(promotion)) inputs.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({
        [promotion]: "./" + path, scripts: { test: `node --test ${path}` },
      })));
      if (promotion === "ordinary-script") inputs.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({ scripts: { test: `node --test ${path}`, start: `node ${path}` } })));
      if (["import", "reexport"].includes(promotion)) inputs.get("tsonic-rust").set("src/product.mjs", safetyFile(
        promotion === "import" ? `import "../${path}";` : `export * from "../${path}";`));
      if (promotion === "alias") inputs.get("tsonic-rust").set("src/alias", Object.freeze({ kind: "symlink", tracked: true, mode: "120000", target: "../" + path }));
      if (promotion === "missing-bytes") inputs.get("tsonic-rust").delete(path);
      if (promotion === "missing-node-test") inputs.get("tsonic-rust").set(path, safetyFile('import { nativeOwnershipCostSupport } from "./helpers/native-ownership-cost.mjs"; void nativeOwnershipCostSupport;'));
      if (promotion === "authored-only") inputs.get("tsonic-rust").delete("package.json");
      if (promotion === "nonowned-root") {
        inputs.get("tsonic-rust").delete(path);
        inputs.get("tsonic-rust").set("src/entry.ts", safetyFile(text.replaceAll("./helpers/", "../test/helpers/")));
        inputs.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({ scripts: { test: "node --test src/entry.ts" } })));
      }
      assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, `${path}/${promotion}: test authority is not a filename or product waiver`);
    }
  }
});

test("QRC-18: default test discovery is explicitly unproved cwd, never supplied stdin execution", () => {
  const inputs = nativeBoundaryInputs();
  inputs.get("tsonic-rust").set("src/discovery.mjs", safetyFile('import { spawnSync } from "node:child_process"; spawnSync(process.execPath, ["--test"], { input: \'import("../test/helpers/native-ownership-cost.mjs")\' });'));
  const actual = boundarySafety(inputs);
  assert.equal(actual.findings.length, 0, "the retained stdin positive does not become an invented code or file entry");
  assert.equal(actual.nativeAllocationBoundary.externalDynamicEntries.some(row => row.environment === "node-test-discovery"), true,
    "unknown cwd/default discovery is disclosed as unproved, not certified absent");
  const rooted = nativeBoundaryInputs();
  rooted.get("tsonic-rust").set("src/discovery.mjs", safetyFile('import { spawnSync } from "node:child_process"; spawnSync(process.execPath, ["--test"], { cwd: new URL("../test", import.meta.url) });'));
  assert.equal(boundarySafety(rooted).nativeAllocationBoundary === undefined, true,
    "an explicit default-discovery working directory requires its own unsupported source-boundary refusal, not a guessed empty target set");
  const ordinary = nativeBoundaryInputs();
  ordinary.get("tsonic-rust").set("src/ordinary.mjs", safetyFile("export const value = 1;"));
  ordinary.get("tsonic-rust").set("src/launch.mjs", safetyFile('import { spawnSync } from "node:child_process"; const run = cwd => spawnSync(process.execPath, [new URL("./ordinary.mjs", import.meta.url).href], { cwd });'));
  assert.equal(boundarySafety(ordinary).findings.length, 0, "ordinary cwd data is not a fabricated default-discovery root or a new option-shape refusal");
  inputs.get("tsonic-rust").set("package.json", safetyFile(JSON.stringify({ scripts: { test: "node --test" } })));
  const declared = boundarySafety(inputs);
  assert.equal(declared.nativeAllocationBoundary === undefined, true, "literal metadata needs captured explicit roots, not unknown default discovery");
  assert.equal(declared.findings.some(row => row.file === "package.json" && row.reason.includes("default test-discovery root")), true,
    "the actual unsupported declaration has a precise boundary explanation");
});

test("QRC-05: unrelated scoped URL names do not invalidate native constructor or literal-member evidence", () => {
  for (const source of [
    'function local(URL) { return URL; } await import(new URL("./ordinary.mjs", import.meta.url));',
    'import { URL as NativeURL } from "node:url"; function local(NativeURL) { return NativeURL; } await import(new NativeURL("./ordinary.mjs", import.meta.url));',
    'function local(globalThis) { return globalThis; } await import(new URL("./ordinary.mjs", import.meta.url));',
    'import * as fs from "node:fs"; fs["readFileSync"](new URL("./ordinary.json", import.meta.url));',
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/ordinary.mjs", safetyFile("export const value = 1;"));
    inputs.get("tsonic-rust").set("src/ordinary.json", safetyFile("{}"));
    inputs.get("tsonic-rust").set("src/use.mjs", safetyFile(source));
    assert.equal(boundarySafety(inputs).findings.length, 0, source);
  }
  for (const body of [
    'URL = replacement;', 'URL ||= replacement;', 'URL++;', 'consume(URL);', 'const alias = URL;',
    'globalThis.URL = replacement;', 'delete globalThis.URL;', 'globalThis[field] = replacement;',
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/ordinary.mjs", safetyFile("export const value = 1;"));
    inputs.get("tsonic-rust").set("src/use.mjs", safetyFile(`${body} await import(new URL("./ordinary.mjs", import.meta.url));`));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, body);
  }
});

test("C119-R7: Module loading is refused, registration is cut, hooks remain an explicit environment assumption", () => {
  for (const body of [
    'import Module from "node:module"; Module._load("../test/helpers/native-ownership-cost.mjs");',
    'import Module from "node:module"; new Module().require("../test/helpers/native-ownership-cost.mjs");',
    'import Module from "module"; Module.runMain();',
    'import Module from "node:module"; consume(Module.prototype);',
    'import { _load } from "node:module"; _load("../test/helpers/native-ownership-cost.mjs");',
    'import { register } from "node:module"; register("../test/helpers/native-ownership-cost.mjs", import.meta.url);',
    'import * as module from "node:module"; module.register(new URL("../test/helpers/native-ownership-cost.mjs", import.meta.url));',
    'import { register } from "node:module"; const start = register; start("../test/helpers/native-ownership-cost.mjs", import.meta.url);',
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/resolve.mjs", safetyFile(body));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, body);
  }
  for (const body of [
    'import { builtinModules, isBuiltin, stripTypeScriptTypes } from "node:module"; consume(builtinModules); isBuiltin("node:fs"); stripTypeScriptTypes("const x = 1;");',
    'import Module from "node:module"; consume(Module.builtinModules); Module.isBuiltin("node:fs");',
    'import { register } from "node:module"; register("./ordinary.mjs", import.meta.url);',
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/resolve.mjs", safetyFile(body));
    inputs.get("tsonic-rust").set("src/ordinary.mjs", safetyFile("export const value = 1;"));
    assert.equal(boundarySafety(inputs).findings.length, 0, body);
  }
  const hooks = nativeBoundaryInputs();
  hooks.get("tsonic-rust").set("scripts/preload.mjs", safetyFile('import { registerHooks } from "node:module"; registerHooks({ resolve() {} });'));
  const result = boundarySafety(hooks);
  assert.equal(result.findings.length, 0);
  assert.equal(result.nativeAllocationBoundary.externalDynamicEntries.some(entry => entry.path === "tsonic-rust/scripts/preload.mjs" && entry.environment === "loader-hook"), true);
  assert.match(result.nativeAllocationBoundary.staticEntryCut, /Installed package contents/u);
});

test("C116-F5: one finite literal input owns the actual registry targets and their imported bytes", () => {
  const path = "test/architecture/tooling/keel-node-registry.mjs";
  const source = readFileSync(new URL("./tooling/keel-node-registry.mjs", import.meta.url), "utf8");
  const targets = ["csharp-nodejs/dist/provider/assembly/modules.js", "rust-nodejs/dist/provider/assembly/modules.js"];
  const required = [...targets, "tsonic/test/architecture/tooling/keel-source-analysis.mjs"].sort();
  function registryInputs(changed = source) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic").set(path, safetyFile(changed));
    inputs.get("tsonic").set("test/architecture/tooling/keel-source-analysis.mjs", safetyFile("export const keelDigest = value => value;"));
    for (const target of targets) {
      const separator = target.indexOf("/");
      inputs.get(target.slice(0, separator)).set(target.slice(separator + 1), safetyFile("export const nodejsProviderModules = [];", false));
    }
    return inputs;
  }
  const current = registryInputs();
  const positive = boundarySafety(current);
  assert.equal(positive.findings.length, 0, "the unchanged registry is a finite input, not an external IO waiver");
  assert.deepEqual(keelSafetyBuiltModuleEntries(current), required);
  assert.deepEqual(positive.nativeAllocationBoundary.builtModuleInputs.map(input => input.path), required);
  assert.equal(positive.nativeAllocationBoundary.builtModuleInputs.every(input => {
    const separator = input.path.indexOf("/");
    return input.sha256 === current.get(input.path.slice(0, separator)).get(input.path.slice(separator + 1)).sha256;
  }), true, "the actual cut and recorded artifact hashes cover identical bytes");
  const namespaceRoot = source.replace('import { resolve } from "node:path";', 'import * as paths from "node:path";').replaceAll('resolve(', 'paths.resolve(');
  assert.equal(boundarySafety(registryInputs(namespaceRoot)).findings.length, 0, "a proven native namespace uses the same finite root contract");
  for (const changed of [source.replaceAll("createRequire", String.raw`createR\u0065quire`),
    source.replaceAll("createRequire", String.raw`createR\u{65}quire`).replace('"node:module"', String.raw`"node:mod\u0075le"`)]) {
    assert.notEqual(changed, source, "escaped names remain raw source bytes, not cooked fixture identifiers");
    const escaped = registryInputs(changed);
    assert.deepEqual(keelSafetyBuiltModuleEntries(escaped), required,
      "canonical semantic identity captures the complete finite registry and its unchanged static imports");
    const actual = boundarySafety(escaped);
    assert.equal(actual.findings.length, 0, "the same closed finite owner remains ordinary through escaped native names");
    assert.deepEqual(actual.nativeAllocationBoundary.builtModuleInputs.map(input => input.path), required,
      "discovery and final admission consume the same actual compiled target bytes");
    assert.equal(actual.nativeAllocationBoundary.builtModuleInputs.every(input => {
      const separator = input.path.indexOf("/");
      return input.sha256 === escaped.get(input.path.slice(0, separator)).get(input.path.slice(separator + 1)).sha256;
    }), true, "all three escaped-name inputs retain their identical actual hashes");
  }
  for (const [label, changed] of [
    ["observer row", source.replace('  "csharp-nodejs":', '  "rust-runtime": { file: "tests/helpers/allocation_counts.rs", export: "observer", form: "value" },\n  "csharp-nodejs":')],
    ["writer row", source.replace('  "csharp-nodejs":', '  "tsonic-rust": { file: "test/helpers/native-ownership-cost.mjs", export: "nativeAllocationSupport", form: "function" },\n  "csharp-nodejs":')],
    ["computed key", source.replace('"csharp-nodejs":', '[computed]:')],
    ["computed file", source.replace('file: "dist/provider/assembly/modules.js"', 'file: process.env.MODULE')],
    ["spread table", source.replace('const owners = Object.freeze({', 'const owners = Object.freeze({ ...extra,')],
    ["spread row", source.replace('"csharp-nodejs": {', '"csharp-nodejs": { ...extra,')],
    ["table mutation", source.replace('  const owner = owners[repo];', '  owners[repo] = replacement; const owner = owners[repo];')],
    ["row mutation", source.replace('  const root = resolve(workspace, repo);', '  owner.file = process.env.MODULE; const root = resolve(workspace, repo);')],
    ["row escape", source.replace('  const root = resolve(workspace, repo);', '  consume(owner); const root = resolve(workspace, repo);')],
    ["out of table key", source.replace('resolve(workspace, repo)', 'resolve(workspace, other)')],
    ["out of table target", source.replace('require(file)[owner.export]', 'require(other)[owner.export]')],
    ["second load", source.replace('  const selected = require(file)[owner.export];', '  require(file); const selected = require(file)[owner.export];')],
    ["binding escape", source.replace('  const selected = require(file)[owner.export];', '  consume(require); const selected = require(file)[owner.export];')],
    ["binding alias", source.replace('  const selected = require(file)[owner.export];', '  const alias = require; const selected = alias(file)[owner.export];')],
    ["destructured workspace parameter", source.replace("(workspace, repo)", "({ workspace }, repo)")],
    ["destructured owner parameter", source.replace("(workspace, repo)", "(workspace, { repo })")],
    ["array workspace parameter", source.replace("(workspace, repo)", "([workspace], repo)")],
    ["array owner parameter", source.replace("(workspace, repo)", "(workspace, [repo])")],
    ["extra destructured parameter", source.replace("(workspace, repo)", "(workspace, repo, { extra })")],
    ["missing guard", source.replace('  if (!Object.hasOwn(owners, repo)) throw new Error("Unknown Node registry owner.");', '')],
    ["non-own guard", source.replace('!Object.hasOwn(owners, repo)', 'owners[repo] === undefined')],
    ["guard after lookup", source.replace('  if (!Object.hasOwn(owners, repo)) throw new Error("Unknown Node registry owner.");\n  const owner = owners[repo];', '  const owner = owners[repo];\n  if (!Object.hasOwn(owners, repo)) throw new Error("Unknown Node registry owner.");')],
    ["prototype write", source.replace('const owners = Object.freeze({', 'Object.prototype.file = "../tsonic-rust/test/helpers/native-ownership-cost.mjs";\nObject.prototype.export = "nativeAllocationSupport";\nObject.prototype.form = "function";\nconst owners = Object.freeze({')],
    ["no immediate export", source.replace('require(file)[owner.export]', 'require(file)')],
    ["root function escape", source.replace('  const root = resolve(workspace, repo);', '  consume(resolve); const root = resolve(workspace, repo);')],
    ["root namespace mutation", source.replace('import { resolve } from "node:path";', 'import * as paths from "node:path";').replaceAll('resolve(', 'paths.resolve(')
      .replace('  const root = paths.resolve(workspace, repo);', '  paths.resolve = replacement; const root = paths.resolve(workspace, repo);')],
  ]) {
    assert.notEqual(changed, source, label);
    const rejected = boundarySafety(registryInputs(changed));
    assert.equal(rejected.nativeAllocationBoundary === undefined, true, label);
    assert.equal(rejected.findings.filter(finding => finding.subject === "native safety").length, 8, label);
  }
  const bridge = registryInputs();
  bridge.get("csharp-nodejs").set("dist/provider/assembly/modules.js", Object.freeze({ ...safetyFile('import "../bridge.js";', false), builtModule: true }));
  bridge.get("csharp-nodejs").set("dist/provider/bridge.js", Object.freeze({ ...safetyFile('import "../../../tsonic-rust/test/helpers/native-ownership-cost.mjs";', false), builtModule: true }));
  assert.equal(keelSafetyBuiltModuleEntries(bridge).includes("csharp-nodejs/dist/provider/bridge.js"), true, "ordinary static imports are capture inputs");
  assert.equal(boundarySafety(bridge).nativeAllocationBoundary === undefined, true, "a registry target's import cannot reach the writer");
  bridge.get("csharp-nodejs").set("dist/provider/assembly/modules.js", Object.freeze({ ...safetyFile('import "../%62ridge.js?cost=1#entry";', false), builtModule: true }));
  assert.equal(keelSafetyBuiltModuleEntries(bridge).includes("csharp-nodejs/dist/provider/bridge.js"), true, "capture and validation share physical URL identity");
  assert.equal(boundarySafety(bridge).nativeAllocationBoundary === undefined, true, "encoded artifact imports still traverse the actual writer bridge");
  const missing = registryInputs();
  missing.get("rust-nodejs").delete("dist/provider/assembly/modules.js");
  assert.equal(boundarySafety(missing).nativeAllocationBoundary === undefined, true, "a finite artifact is never opaque or missing");
  for (const key of ["__proto__", "constructor", "toString", "hasOwnProperty"]) {
    assert.throws(() => readKeelNodeModuleRegistry("/workspace", key), { message: "Unknown Node registry owner." }, key);
  }
});

test("C114-F6: native Worker and fork inputs are module entries, never guessed from cwd", () => {
  for (const source of [
    'import { Worker } from "node:worker_threads"; new Worker(new URL("../test/helpers/native-ownership-cost.mjs", import.meta.url));',
    'import { Worker as Thread } from "node:worker_threads"; new Thread(new URL("../test/helpers/native-ownership-cost.mjs", import.meta.url));',
    'import * as workers from "node:worker_threads"; new workers.Worker(new URL("../test/helpers/native-ownership-cost.mjs", import.meta.url));',
    'import { fork } from "node:child_process"; fork(new URL("../test/helpers/native-ownership-cost.mjs", import.meta.url));',
    'import * as process from "node:child_process"; process.fork(new URL("../test/helpers/native-ownership-cost.mjs", import.meta.url));',
    'import { Worker } from "node:worker_threads"; new Worker("../test/helpers/native-ownership-cost.mjs");',
    'import { fork } from "node:child_process"; fork("./ordinary.mjs");',
    'import { Worker } from "node:worker_threads"; const Thread = Worker; new Thread(new URL("../test/helpers/native-ownership-cost.mjs", import.meta.url));',
    'import { fork } from "node:child_process"; const start = fork; start(new URL("../test/helpers/native-ownership-cost.mjs", import.meta.url));',
    'import * as workers from "node:worker_threads"; const Thread = workers["Worker"]; new Thread(new URL("../test/helpers/native-ownership-cost.mjs", import.meta.url));',
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/emitter.mjs", safetyFile(source));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, source);
  }
  for (const source of [
    'import { Worker } from "node:worker_threads"; new Worker(new URL("./ordinary.mjs", import.meta.url));',
    'import { fork } from "node:child_process"; fork(new URL("./ordinary.mjs", import.meta.url));',
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/emitter.mjs", safetyFile(source));
    inputs.get("tsonic-rust").set("src/ordinary.mjs", safetyFile("export const value = 1;"));
    assert.equal(boundarySafety(inputs).findings.length, 0, source);
  }
  const external = nativeBoundaryInputs();
  external.get("tsonic-rust").set("src/emitter.mjs", safetyFile('import { Worker } from "node:worker_threads"; new Worker(process.env.EXTERNAL_ENTRY);'));
  assert.equal(boundarySafety(external).nativeAllocationBoundary.externalDynamicEntries.length, 1, "unknown external runtime entry is disclosed, not proven harmless");
});

test("C114-F7: every constructor write, mutation and escape fails the one positive-use proof", () => {
  const source = 'const root = new URL("../test/helpers/", import.meta.url); const load = (entry) => import(new URL(entry, root).href); load("ordinary.mjs");';
  const assignments = ["=", "+=", "-=", "*=", "**=", "/=", "%=", "<<=", ">>=", ">>>=", "&=", "|=", "^=", "&&=", "||=", "??="];
  const writes = [...assignments.map(operator => `URL ${operator} replacement;`), "++URL;", "URL++;", "--URL;", "URL--;",
    "[URL] = values;", "[...URL] = values;", "({ a: URL } = value);", "({ a: URL = fallback } = value);", "({ URL } = value);",
    "for (URL of values) {}", "for (URL in value) {}", "const alias = URL;", "sink(URL);", "const values = [URL];",
    "const value = { constructor: URL };", "function escape() { return URL; }", "export { URL };", "URL.prototype.href = replacement;",
    'Object.defineProperty(URL.prototype, "href", replacement);', "globalThis.URL = replacement;", 'globalThis["URL"] = replacement;',
    'global["URL"] ||= replacement;', 'self["URL"] ??= replacement;', 'window["URL"] += replacement;',
    'delete globalThis["URL"];', 'globalThis["U" + "RL"] = replacement;', 'Object.defineProperty(globalThis, "URL", replacement);',
    'Object.defineProperties(globalThis, replacement);', 'Object.assign(globalThis, replacement);', 'Reflect.set(globalThis, "URL", replacement);',
    'Reflect.deleteProperty(globalThis, "URL");', "const nativeRoot = globalThis;", "sink(globalThis);", "const nativeRoot = globalThis.global;",
  ];
  for (const write of writes) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/loader.mjs", safetyFile(`${source} ${write}`));
    inputs.get("tsonic-rust").set("test/helpers/ordinary.mjs", safetyFile("export const value = 1;"));
    const result = boundarySafety(inputs);
    assert.equal(result.nativeAllocationBoundary === undefined, true, write);
    assert.equal(result.findings.filter(finding => finding.subject === "native safety").length, 8, write);
    assert.equal(keelFixtureHas(result.findings, "AC12", "literal URL loader"), true, write);
  }
  for (const clean of [source, `${source} const unrelated = { URL: 1 }; console.log(unrelated.URL);`,
    `${source} globalThis.Math.max(1, 2); globalThis.Number.parseInt("1"); new globalThis.Error("ordinary");`,
    `import { URL as NativeURL } from "node:url"; ${source.replaceAll("new URL(", "new NativeURL(")}`]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/loader.mjs", safetyFile(clean));
    inputs.get("tsonic-rust").set("test/helpers/ordinary.mjs", safetyFile("export const value = 1;"));
    assert.equal(boundarySafety(inputs).findings.length, 0, clean);
  }
});

test("C114-F7: direct URL addresses share constructor identity and refuse mutable object roots", () => {
  for (const source of [
    'URL = replacement; await import(new URL("./ordinary.mjs", import.meta.url));',
    'const address = new URL("./ordinary.mjs", import.meta.url); address.pathname = replacement; await import(address.href);',
    'const address = new URL("./ordinary.mjs", import.meta.url); ({ value: address.href } = replacement); await import(address.href);',
    'const address = new URL("./ordinary.mjs", import.meta.url); delete address.href; await import(address.href);',
    'const address = new URL("./ordinary.mjs", import.meta.url); sink(address); await import(address.href);',
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/emitter.mjs", safetyFile(source));
    assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, source);
  }
  for (const source of [
    'const address = new URL("./ordinary.mjs", import.meta.url); await import(address.href);',
    'import { fileURLToPath } from "node:url"; const address = fileURLToPath(new URL("./ordinary.mjs", import.meta.url)); const alias = address; await import(alias);',
  ]) {
    const inputs = nativeBoundaryInputs();
    inputs.get("tsonic-rust").set("src/emitter.mjs", safetyFile(source));
    inputs.get("tsonic-rust").set("src/ordinary.mjs", safetyFile("export const value = 1;"));
    assert.equal(boundarySafety(inputs).findings.length, 0, source);
  }
  const boundary = boundarySafety().nativeAllocationBoundary;
  assert.match(boundary.staticEntryCut, /foreign-module, preload or loader-hook intrinsic mutation/u);
  assert.match(boundary.staticEntryCut, /computed-value prototype mutation are excluded, not proven harmless/u);
});

test("the actual transcript manifest declares data, not an executable-suffix waiver", () => {
  const inputs = nativeBoundaryInputs();
  const root = "packages/tsts/tools/tsgo-suite";
  const path = `${root}/tsgo-accepted/typescript/transpile/transcript.js`;
  const transcript = "Generated by tools/tsgo-suite/capture-tsgo-accepted.mjs from pinned TS-Go abc.\n//// [code.js] ////\nexport const value = ;\nDiagnostics reported";
  inputs.get("tsts-legacy").set(path, safetyFile(transcript));
  assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "undeclared executable syntax remains refused");
  inputs.get("tsts-legacy").set(`${root}/tsgo-accepted/manifest.json`, safetyFile(JSON.stringify([
    { corpus: "typescript", suite: "transpile", artifact: "transcript.js", sections: ["code.js"] },
  ])));
  inputs.get("tsts-legacy").set(`${root}/run.mjs`, safetyFile('import { readFileSync } from "node:fs"; export function readOverlay(overlayPath) { return parseBaselineSections(readFileSync(overlayPath, "utf8")); }'));
  inputs.get("tsts-legacy").set(`${root}/capture-tsgo-accepted.mjs`, safetyFile('const file = join(overlayRoot, "manifest.json");'));
  const accepted = boundarySafety(inputs);
  assert.equal(accepted.findings.length, 0, "the existing reader and manifest give the captured bytes their data role");
  assert.deepEqual(accepted.nativeAllocationBoundary.transcriptData, [`tsts-legacy/${path}`]);
  assert.equal(keelSafetyBuiltModuleEntries(inputs).includes(`tsts-legacy/${path}`), false,
    "the same declared data role governs capture, not an executable-suffix parser scan");
  inputs.get("tsts-legacy").set("src/promote.mjs", safetyFile(`import "../${path}";`));
  assert.equal(keelSafetyBuiltModuleEntries(inputs).includes(`tsts-legacy/${path}`), true,
    "an actual native entry still demands the declared bytes before source promotion is refused");
  assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "declared data cannot be imported as executable source");
  inputs.get("tsts-legacy").delete("src/promote.mjs");
  inputs.get("tsts-legacy").set("package.json", safetyFile(JSON.stringify({ main: `./${path}` })));
  assert.equal(boundarySafety(inputs).nativeAllocationBoundary === undefined, true, "declared data cannot be a package executable entry");
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
