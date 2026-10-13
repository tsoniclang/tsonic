import assert from "node:assert/strict";
import test from "node:test";
import { keelNativeDifferences, validateKeelDifferences } from "./tooling/keel-contract.mjs";
import { keelNativeTokens, keelNativeUnsafeSites } from "./tooling/keel-native-tokens.mjs";
import {
  evaluateKeelCoreDomains, evaluateKeelNodeModules, evaluateKeelRuntimeFamilies,
  evaluateKeelSkeleton, evaluateKeelStorageStages, evaluateKeelTestSkeleton, keelRuntimeRoots,
} from "./tooling/keel-structure-checks.mjs";
import { keelFixtureHas, keelFixtureModel } from "./tooling/keel-test-fixtures.mjs";

test("AC7 compares responsibility, including file-versus-folder equivalence", () => {
  const targets = new Map([
    ["tsonic-csharp", new Map([
      ["src/analysis/project-types/catalog.ts", "export {};"],
      ["src/providers/packages/validation.ts", "export {};"],
      ["src/print/source/expressions.ts", "export {};"],
    ])],
    ["tsonic-rust", new Map([
      ["src/analysis/project-types/catalog/index.ts", "export {};"],
      ["src/providers/packages/validation/model.ts", "export {};"],
      ["src/print/source/expressions/calls.ts", "export {};"],
    ])],
  ]);
  assert.equal(evaluateKeelSkeleton(targets).length, 0);
  targets.get("tsonic-rust").delete("src/analysis/project-types/catalog/index.ts");
  assert.equal(keelFixtureHas(evaluateKeelSkeleton(targets), "AC7", "one-sided"), true);
});

for (const repo of ["tsonic-csharp", "tsonic-rust"]) {
  for (const path of [
    "src/mystery/rule.ts", "src/policy/operations/mystery/rule.ts",
    "src/policy/types/old-flat-selection.ts", "src/backend/target-ast/old-syntax.ts",
    "src/providers/native/old-acquisition/rule.ts",
  ]) {
    test(`${repo}: AC7 rejects unowned slot ${path}`, () => {
      const targets = new Map([[
        repo, new Map([[path, "export {};"]]),
      ]]);
      assert.equal(keelFixtureHas(evaluateKeelSkeleton(targets), "AC7"), true);
    });
  }
}

test("AC7 accepts only registered target-native differences on their actual side", () => {
  const targets = new Map([
    ["tsonic-csharp", new Map([["src/analysis/attributes/check.ts", "export {};"]])],
    ["tsonic-rust", new Map([["src/analysis/ownership/check.ts", "export {};"]])],
  ]);
  assert.equal(evaluateKeelSkeleton(targets).length, 0);
  targets.get("tsonic-csharp").set("src/analysis/ownership/check.ts", "export {};");
  assert.equal(keelFixtureHas(evaluateKeelSkeleton(targets), "AC7", "prescribed slot"), true);
  for (const entry of [
    { path: "analysis/*", target: "tsonic-rust", reason: "broad", evidence: "test" },
    { path: "analysis/new", target: "tsonic-rust", reason: "", evidence: "test" },
  ]) assert.throws(() => validateKeelDifferences([...keelNativeDifferences, entry]), /Invalid/u);
});

test("AC7 mirrors source ownership moves in target tests", () => {
  for (const repo of ["tsonic-csharp", "tsonic-rust"]) {
    const files = ["test/providers/native/acquisition/read.test.mjs", "test/backend/target-ast/syntax/nodes.test.mjs"];
    assert.equal(evaluateKeelTestSkeleton(new Map([[repo, files]])).length, 0);
    files.push("test/providers/native/reflection/read.test.mjs");
    assert.equal(keelFixtureHas(evaluateKeelTestSkeleton(new Map([[repo, files]])), "AC7", "matching test"), true);
  }
});

test("AC7 expected-type/contextual analysis is a shared responsibility, not an automatic C# exemption", () => {
  const targets = new Map([
    ["tsonic-csharp", new Map([["src/analysis/expected-types/analyze.ts", "export {};"]])],
    ["tsonic-rust", new Map([["src/analysis/expected-types/contextual.ts", "export {};"]])],
  ]);
  assert.equal(evaluateKeelSkeleton(targets).length, 0);
  targets.get("tsonic-rust").clear();
  assert.equal(keelFixtureHas(evaluateKeelSkeleton(targets), "AC7", "one-sided"), true);
});

test("AC8 accepts same/earlier stages and rejects reverse or unresolved imports", () => {
  const prefix = "packages/target-api/src/target-analysis/source-storage/";
  const sources = new Map([
    [`${prefix}model/types.ts`, "export interface Value {}"],
    [`${prefix}graph/edges.ts`, 'import type { Value } from "../model/types.js"; export interface Edges { value: Value; }'],
    [`${prefix}scoped/scopes.ts`, 'import type { Edges } from "../graph/edges.js"; export interface Scope { edges: Edges; }'],
    [`${prefix}transport/domains.ts`, 'import type { Scope } from "../scoped/scopes.js"; export interface Domain { scope: Scope; }'],
    [`${prefix}queries.ts`, 'import type { Domain } from "./transport/domains.js"; export type Query = Domain;'],
  ]);
  let model = keelFixtureModel(sources);
  assert.equal(evaluateKeelStorageStages(sources, model.edges).length, 0);
  sources.set(`${prefix}model/types.ts`, 'import type { Domain } from "../transport/domains.js"; export interface Value { domain: Domain; }');
  model = keelFixtureModel(sources);
  assert.equal(keelFixtureHas(evaluateKeelStorageStages(sources, model.edges), "AC8", "earlier stage"), true);
  sources.set(`${prefix}model/types.ts`, 'import type { Missing } from "../missing.js"; export interface Value { missing: Missing; }');
  model = keelFixtureModel(sources);
  assert.equal(keelFixtureHas(evaluateKeelStorageStages(sources, model.edges), "AC8"), true);
  sources.set(`${prefix}flat.ts`, "export {};");
  assert.equal(keelFixtureHas(evaluateKeelStorageStages(sources, model.edges), "AC8", "staged owner"), true);
  sources.delete(`${prefix}flat.ts`);
  sources.set(`${prefix}index.ts`, 'export * from "./queries.js";');
  assert.equal(keelFixtureHas(evaluateKeelStorageStages(sources, model.edges), "AC8", "staged owner"), true);
});

test("AC8 rejects same-stage and self cycles without condemning unrelated native-model type cycles", () => {
  const prefix = "packages/target-api/src/target-analysis/source-storage/model/";
  const sources = new Map([
    [`${prefix}left.ts`, 'import type { Right } from "./right.js"; export interface Left { right: Right; }'],
    [`${prefix}right.ts`, 'import type { Left } from "./left.js"; export interface Right { left: Left; }'],
  ]);
  assert.equal(keelFixtureHas(evaluateKeelStorageStages(sources, keelFixtureModel(sources).edges), "AC8", "acyclic"), true);
  const self = new Map([[`${prefix}self.ts`, 'import type { Value as Self } from "./self.js"; export interface Value { self: Self; }']]);
  assert.equal(keelFixtureHas(evaluateKeelStorageStages(self, keelFixtureModel(self).edges), "AC8", "acyclic"), true);
  const other = new Map([
    ["src/target-model/types/left.ts", 'import type { Right } from "./right.js"; export interface Left { right: Right; }'],
    ["src/target-model/types/right.ts", 'import type { Left } from "./left.js"; export interface Right { left: Left; }'],
  ]);
  assert.equal(evaluateKeelStorageStages(other, keelFixtureModel(other).edges).length, 0);
});

for (const [repo, source] of [
  ["rust-runtime", "pub enum DispatchPhase { RuntimeTasks, Http, Net }"],
  ["csharp-runtime", "internal enum DispatchPhase { RuntimeTasks, Http, Net }"],
]) {
  test(`${repo}: AC9 rejects Node-owned phases and dependencies, not string or comment spellings`, () => {
    const files = new Map([["src/dispatch", source]]);
    assert.equal(evaluateKeelCoreDomains(new Map([[repo, files]])).length, 2);
    files.set("src/dispatch", '/* DispatchPhase::Http */ const text = "DispatchPhase::Net"; enum DispatchPhase { RuntimeTasks }');
    assert.equal(evaluateKeelCoreDomains(new Map([[repo, files]])).length, 0);
    files.set("src/dispatch", repo === "rust-runtime" ? "use tsonic_rust_node::fs;" : "using Tsonic.CSharp.Node;");
    assert.equal(keelFixtureHas(evaluateKeelCoreDomains(new Map([[repo, files]])), "AC9", "Node runtime"), true);
  });
}

test("AC10 runtime ownership is exact, paired and layer-consistent", () => {
  const csharp = `${keelRuntimeRoots["csharp-runtime"]}/Arrays/NativeArray.cs`;
  const rust = `${keelRuntimeRoots["rust-runtime"]}/array.rs`;
  const sources = new Map([
    ["csharp-runtime", new Map([[csharp, "public class NativeArray {}"]])],
    ["rust-runtime", new Map([[rust, "pub struct NativeArray;"]])],
  ]);
  const register = [{ family: "Arrays", evidence: "Runtime contract", owners: [
    { repo: "csharp-runtime", path: csharp }, { repo: "rust-runtime", path: rust },
  ] }];
  assert.equal(evaluateKeelRuntimeFamilies(sources, register).findings.length, 0);
  sources.get("rust-runtime").set(`${keelRuntimeRoots["rust-runtime"]}/hidden.rs`, "pub struct Hidden;");
  assert.equal(keelFixtureHas(evaluateKeelRuntimeFamilies(sources, register).findings, "AC10", "exactly one"), true);
  assert.throws(() => evaluateKeelRuntimeFamilies(sources, [{ ...register[0], owners: [
    ...register[0].owners, register[0].owners[0],
  ] }]), /Duplicate/u);
  assert.throws(() => evaluateKeelRuntimeFamilies(sources, [{ ...register[0], owners: [
    { repo: "csharp-runtime", path: keelRuntimeRoots["csharp-runtime"] },
  ] }]), /entire package/u);
  const oneSided = [{ ...register[0], owners: [register[0].owners[0]] }];
  assert.equal(keelFixtureHas(evaluateKeelRuntimeFamilies(sources, oneSided).findings, "AC10", "native constraint"), true);
  oneSided[0].nativeReason = "Demonstrated target scheduler requirement";
  assert.equal(keelFixtureHas(evaluateKeelRuntimeFamilies(sources, oneSided).findings, "AC10", "native constraint"), false);
});

test("AC10 Node parity uses checked identities and reachability, retaining native-only modules", () => {
  const packageFile = "nodejs/src/provider/package.ts";
  const moduleFile = "nodejs/src/provider/modules/fs.ts";
  const evidence = new Map(["csharp-nodejs", "rust-nodejs"].map(repo => [repo, { ...keelFixtureModel([
    [packageFile, 'import { moduleSpecifier } from "./modules/fs.js"; export const module = moduleSpecifier;'],
    [moduleFile, 'export const moduleSpecifier = "node:fs";'],
  ]), moduleRegistry: { modules: ["node:fs"] } }]));
  const rows = new Map(["csharp-nodejs", "rust-nodejs"].map(repo => [repo, [
    { module: "node:fs", file: moduleFile, exposed: true },
  ]]));
  assert.equal(evaluateKeelNodeModules(rows, [], evidence).findings.length, 0);
  rows.get("rust-nodejs").push({ module: "node:cluster", file: "rust/crates/tsonic_rust_node/src/cluster/mod.rs", exposed: false, nativeReachable: true, evidence: "Native cluster implementation remains checked; no public provider is claimed." });
  assert.equal(evaluateKeelNodeModules(rows, [], evidence).findings.length, 0);
  rows.get("csharp-nodejs").push({ module: "node:extra", file: moduleFile, exposed: true });
  evidence.get("csharp-nodejs").moduleRegistry.modules.push("node:extra");
  assert.equal(keelFixtureHas(evaluateKeelNodeModules(rows, [], evidence).findings, "AC10", "module sets differ"), true);
  assert.equal(keelFixtureHas(evaluateKeelNodeModules(rows, [], evidence).findings, "AC10", "exact literal"), true);
  rows.get("rust-nodejs")[0] = { ...rows.get("rust-nodejs")[0], file: "nodejs/src/provider/modules/orphan.ts" };
  assert.equal(keelFixtureHas(evaluateKeelNodeModules(rows, [], evidence).findings, "AC10", "package-reachability"), true);
});

test("AC10 distinguishes actual public modules from reachable signature and export identifiers", () => {
  const packageFile = "nodejs/src/provider/package.ts";
  const moduleFile = "nodejs/src/provider/modules/fs.ts";
  const evidence = new Map(["csharp-nodejs", "rust-nodejs"].map(repo => [repo, {
    ...keelFixtureModel([
      [packageFile, 'import { moduleSpecifier, signature } from "./modules/fs.js"; export const metadata = [moduleSpecifier, signature];'],
      [moduleFile, 'export const moduleSpecifier = "node:fs"; export const signature = "node:fs.readFile(System.String)"; export const exportIdentity = "node:fs::readFile";'],
    ]), moduleRegistry: { modules: ["node:fs"] },
  }]));
  const rows = new Map(["csharp-nodejs", "rust-nodejs"].map(repo => [repo, [
    { module: "node:fs", file: moduleFile, exposed: true },
  ]]));
  assert.equal(evaluateKeelNodeModules(rows, [], evidence).findings.length, 0,
    "native signature spelling is not module identity");
  evidence.get("rust-nodejs").moduleRegistry.modules.push("node:unregistered");
  assert.equal(keelFixtureHas(evaluateKeelNodeModules(rows, [], evidence).findings, "AC10", "public module registration"), true);
  delete evidence.get("csharp-nodejs").moduleRegistry;
  assert.equal(keelFixtureHas(evaluateKeelNodeModules(rows, [], evidence).findings, "AC10", "actual built registry"), true);
});

test("AC10 excluded native API gaps stay visible; retained counterpart and ownership defects still fail", () => {
  const file = `${keelRuntimeRoots["rust-nodejs"]}/sqlite/mod.rs`;
  const sources = new Map([["rust-nodejs", new Map([[file, "pub struct DatabaseSync;"]])]]);
  const entry = { family: "nodejs/sqlite", api: "node:sqlite", required: false, scopeEvidence: "D-K01", evidence: "Public native sqlite owner",
    owners: [{ repo: "rust-nodejs", path: file }] };
  const result = evaluateKeelRuntimeFamilies(sources, [entry]);
  assert.equal(result.findings.length, 0);
  assert.equal(result.capabilityGaps.length, 1);
  assert.equal(result.capabilityGaps[0].api === "node:sqlite", true);
  assert.equal(keelFixtureHas(evaluateKeelRuntimeFamilies(sources, [{ ...entry, required: true }]).findings, "AC10", "native constraint"), true);
  sources.get("rust-nodejs").clear();
  assert.equal(keelFixtureHas(evaluateKeelRuntimeFamilies(sources, [entry]).findings, "AC10", "no implementation"), true);
});

test("AC10 missing optional perf_hooks exposure is not a native exception; requiring it fails the retained gate", () => {
  const moduleFile = "nodejs/src/provider/modules/performance.ts";
  const evidence = new Map([["rust-nodejs", { ...keelFixtureModel([
    ["nodejs/src/provider/package.ts", 'import { moduleSpecifier } from "./modules/performance.js"; export const module = moduleSpecifier;'],
    [moduleFile, 'export const moduleSpecifier = "node:perf_hooks";'],
  ]), moduleRegistry: { modules: ["node:perf_hooks"] } }],
  ["csharp-nodejs", { moduleRegistry: { modules: [] } }]]);
  const row = { module: "node:perf_hooks", file: moduleFile, exposed: true, required: false, scopeEvidence: "D-K01" };
  const rows = new Map([["csharp-nodejs", []], ["rust-nodejs", [row]]]);
  const result = evaluateKeelNodeModules(rows, [], evidence);
  assert.equal(result.findings.length, 0);
  assert.equal(result.capabilityGaps.length, 1);
  rows.get("rust-nodejs")[0] = { ...row, required: true };
  assert.equal(keelFixtureHas(evaluateKeelNodeModules(rows, [], evidence).findings, "AC10", "module sets differ"), true);
});

test("native lexical guards ignore strings, nested comments and lifetime syntax", () => {
  for (const source of [
    'let message = "unsafe"; let empty = "";',
    'let message = r###"unsafe { }"###;',
    '/* outer unsafe /* inner unsafe */ */ let character = \'x\';',
    'let value: &\'static str = "unsafe";',
    'var text = @"unsafe ""literal""";',
    'var text = """unsafe { }""";',
    'var text = $"unsafe {{literal}} {Safe(\"unsafe\")}";',
    'var text = $$"""unsafe {{Safe("unsafe")}}""";',
    "let r#unsafe = 1; let value = r#unsafe;",
    "var @unsafe = 1; var value = @unsafe;",
  ]) assert.equal(keelNativeUnsafeSites(source).length, 0, source);
  assert.equal(keelNativeUnsafeSites("unsafe { operation(); }").length, 1);
  assert.equal(keelNativeUnsafeSites('var text = $"{(() => { unsafe { operation(); } })()}";').length, 1);
  assert.equal(keelNativeTokens("/* safe */ unsafe {}").filter(token => token.kind === "comment").length, 1);
  assert.throws(() => keelNativeTokens('r#"unfinished'), /Unterminated/u);
  assert.throws(() => keelNativeTokens("/* unfinished"), /Unterminated/u);
});
