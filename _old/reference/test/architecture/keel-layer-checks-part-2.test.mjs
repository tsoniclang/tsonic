import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "../../packages/tsts/dist/src/index.js";
import { evaluateKeelLayers } from "./tooling/keel-layer-checks.mjs";
import { readKeelDeclarations } from "./tooling/keel-declarations.mjs";
import { readSourceInventory } from "./tooling/file-inventory.mjs";
import { analyzeKeelTypeScript } from "./tooling/keel-source-analysis.mjs";
import {
  keelFixtureHas, keelFixtureModel, keelFixtureReference, keelFixtureReview,
} from "./tooling/keel-test-fixtures.mjs";
import { publicMetadataInputs, checkedMetadataFixture } from './keel-layer-checks-fixtures.mjs';

for (const repo of ["tsonic-csharp"]){
for (const [origin, foreign, type] of [
    ["source", "src/source/semantics.ts", "CheckedSource"],
    ["policy", "src/policy/types/native.ts", "CarrierDecision"],
  ]){
for (const [form, body] of [
    ["bare imported value", "return imported;"],
    ["local constant alias", "const selected: ProviderModel = imported; return selected;"],
    ["local mutable alias", "let selected: ProviderModel = imported; return selected;"],
  ]){
test(`${repo}: provider metadata rejects ${origin} values through ${form}`, () => {
    const file = "src/providers/native/projection/members.ts";
    const model = checkedMetadataFixture([
      [foreign, `export interface ${type} { readonly value: number; } export const checked: ${type} = { value: 1 };`],
      ["src/providers/native/model/input.ts", "export interface NativeMetadata { readonly value: number; } export interface ProviderModel { readonly value: number; }"],
      [file, `import { checked as imported } from "../../../${foreign.slice(4, -3)}.js"; import type { NativeMetadata, ProviderModel } from "../model/input.js"; export function selectMetadata(value: NativeMetadata): ProviderModel { ${body} }`],
    ], `${repo}: ${origin} ${form}`);
    assert.equal(keelFixtureHas(evaluateKeelLayers(repo, model, {
      functions: [keelFixtureReview(model, file, "selectMetadata", "provider-metadata")],
    }), "AC1", "cannot read checked source"), true, `${origin} ${form}: actual foreign value identity`);
  });
}
}
}

for (const repo of ["tsonic-csharp"]){
for (const [boundary, foreign, declaration] of [
    ["input", "src/source/semantics.ts", "interface"],
    ["class input", "src/source/semantics.ts", "class"],
    ["output", "src/policy/types/native.ts", "interface"],
    ["output", "src/analysis/operations/native.ts", "interface"],
    ["output", "src/backend/target-ast/native.ts", "interface"],
  ]){
test(`${repo}: provider metadata rejects inherited ${boundary} from ${foreign}`, () => {
    const file = "src/providers/native/projection/members.ts";
    const input = boundary !== "output";
    const model = checkedMetadataFixture([
      [foreign, declaration === "class" ? "export class Foreign { readonly value = 1; }" : "export interface Foreign { readonly value: number; }"],
      ["src/providers/native/model/input.ts", `import type { Foreign as Ancestor } from "../../../${foreign.slice(4, -3)}.js"; ${input ? declaration === "class" ? 'import { Foreign as Parent } from "../../../source/semantics.js"; export class NativeMetadata extends Parent {}' : "export interface NativeMetadata extends Ancestor {}" : "export interface NativeMetadata { readonly value: number; }"} ${input ? "export interface ProviderModel { readonly value: number; }" : "export interface ProviderModel extends Ancestor {}"}`],
      [file, 'import type { NativeMetadata, ProviderModel } from "../model/input.js"; export function selectMetadata(value: NativeMetadata): ProviderModel { return { value: 0 }; }'],
    ], `${repo}: inherited ${boundary} ${foreign}`);
    assert.equal(keelFixtureHas(evaluateKeelLayers(repo, model, {
      functions: [keelFixtureReview(model, file, "selectMetadata", "provider-metadata")],
    }), "AC1", "metadata-only inputs"), true, `${boundary}: checked base identity cannot be hidden by a local declaration`);
  });
}
}

for (const repo of ["tsonic-csharp"]){
test(`${repo}: provider metadata preserves native inherited data and unrelated imported types`, () => {
    const file = "src/providers/native/projection/members.ts";
    for (const declaration of [
      "export interface Base<T> { readonly value: T; } export interface NativeMetadata extends Base<number> {} export interface ProviderModel extends NativeMetadata {}",
      "export class Base { readonly value = 1; } export class NativeMetadata extends Base {} export class ProviderModel extends NativeMetadata {}",
    ]) {
      const model = checkedMetadataFixture([
        ["src/source/semantics.ts", "export interface UnusedSource { readonly source: number; }"],
        ["src/providers/native/model/input.ts", `import type { UnusedSource } from "../../../source/semantics.js"; ${declaration}`],
        [file, 'import type { NativeMetadata, ProviderModel } from "../model/input.js"; export function selectMetadata(value: NativeMetadata): ProviderModel { return value; }'],
      ], `${repo}: native-only inheritance`);
      assert.equal(evaluateKeelLayers(repo, model, {
        functions: [keelFixtureReview(model, file, "selectMetadata", "provider-metadata")],
      }).length, 0, "native inheritance is allowed without a global import ban");
    }
  });
}

for (const repo of ["tsonic-csharp"]){
test(`${repo}: AC1 keeps reviewed native metadata normalization and projection at the provider owner`, () => {
    const metadata = "src/providers/native/model/input.ts";
    const types = "export interface NativeMetadata { readonly value: number; } export interface ProviderModel { readonly value: number; }";
    const source = 'import type { NativeMetadata, ProviderModel } from "../model/input.js"; export function selectMetadata(value: NativeMetadata): ProviderModel { return { value: value.value }; }';
    for (const file of [
      "src/providers/native/model/normalization/defaults.ts",
      "src/providers/native/projection/members.ts",
    ]) {
      const model = keelFixtureModel([[metadata, types], [file,
        file.includes("/normalization/") ? source.replace("../model/input.js", "../input.js") : source]]);
      const functions = [keelFixtureReview(model, file, "selectMetadata", "provider-metadata")];
      assert.equal(evaluateKeelLayers(repo, model, { functions }).length, 0, `${file}: exact provider role`);
      assert.equal(keelFixtureHas(evaluateKeelLayers(repo, model), "AC1", "reviewed semantic-role classification"), true,
        `${file}: unreviewed metadata processing is still discovered`);
      assert.equal(keelFixtureHas(evaluateKeelLayers(repo, model, {
        functions: [{ ...functions[0], role: "analysis" }],
      }), "AC1", "owned by analysis"), true, `${file}: source analysis cannot be relabelled as provider input`);
    }
    for (const [file, check] of [
      ["src/providers/model/metadata.ts", "AC1"],
      ["src/policy/operations/metadata.ts", "AC1"],
      ["src/analysis/operations/metadata.ts", "AC1"],
      ["src/backend/planner/expressions/metadata.ts", "AC2"],
    ]) {
      const model = keelFixtureModel([[metadata, types], [file,
        source.replace("../model/input.js", file.startsWith("src/backend/")
          ? "../../../providers/native/model/input.js" : "../../providers/native/model/input.js")]]);
      assert.equal(keelFixtureHas(evaluateKeelLayers(repo, model, {
        functions: [keelFixtureReview(model, file, "selectMetadata", "provider-metadata")],
      }), check, "owned by providers/native"), true, `${file}: provider role cannot hide a foreign owner`);
    }
  });
}

for (const repo of ["tsonic-csharp"]){
test(`${repo}: provider metadata refuses checked source inputs, non-model outputs and foreign decisions`, () => {
    const metadata = "src/providers/native/model/input.ts";
    const file = "src/providers/native/projection/members.ts";
    const types = "export interface NativeMetadata { readonly value: number; } export interface ProviderModel { readonly value: number; }";
    const external = "src/source/semantics.ts";
    const checked = "export interface CheckedSource { readonly value: number; }";
    const checkedModel = keelFixtureModel([
      [external, checked], [metadata, types],
      [file, 'import type { CheckedSource } from "../../../source/semantics.js"; import type { ProviderModel } from "../model/input.js"; export function selectMetadata(value: CheckedSource): ProviderModel { return { value: value.value }; }'],
    ]);
    assert.equal(keelFixtureHas(evaluateKeelLayers(repo, checkedModel, { functions: [
      keelFixtureReview(checkedModel, file, "selectMetadata", "provider-metadata"),
    ] }), "AC1", "metadata-only inputs"), true, "checked source is not provider metadata");
    const nested = keelFixtureModel([
      [external, checked], [metadata, 'import type { CheckedSource } from "../../../source/semantics.js"; export interface NativeMetadata { readonly source: CheckedSource; } export interface ProviderModel { readonly value: number; }'],
      [file, 'import type { NativeMetadata, ProviderModel } from "../model/input.js"; export function selectMetadata(value: NativeMetadata): ProviderModel { return { value: value.source.value }; }'],
    ]);
    assert.equal(keelFixtureHas(evaluateKeelLayers(repo, nested, { functions: [
      keelFixtureReview(nested, file, "selectMetadata", "provider-metadata"),
    ] }), "AC1", "metadata-only inputs"), true, "a metadata wrapper does not hide checked source");
    for (const [foreign, type, role, check] of [
      ["src/policy/types/native.ts", "CarrierDecision", "selection", "AC1"],
      ["src/analysis/operations/native.ts", "AnalysisDecision", "analysis", "AC1"],
      ["src/backend/target-ast/native.ts", "SyntaxDecision", "syntax", "AC1"],
    ]) {
      const output = keelFixtureModel([
        [metadata, types], [foreign, `export interface ${type} { readonly value: number; }`],
        [file, `import type { NativeMetadata } from "../model/input.js"; import type { ${type} } from "../../../${foreign.slice(4, -3)}.js"; export function selectMetadata(value: NativeMetadata): ${type} { return { value: value.value }; }`],
      ]);
      assert.equal(keelFixtureHas(evaluateKeelLayers(repo, output, { functions: [
        keelFixtureReview(output, file, "selectMetadata", "provider-metadata"),
      ] }), check, "metadata-only inputs"), true, `${type}: output must be provider model data`);
      const model = keelFixtureModel([
        [metadata, types], [foreign, `export function decide(value: number): number { return value; }`],
        [file, `import type { NativeMetadata, ProviderModel } from "../model/input.js"; import { decide as invoke } from "../../../${foreign.slice(4, -3)}.js"; export function selectMetadata(value: NativeMetadata): ProviderModel { return { value: invoke(value.value) }; }`],
      ]);
      assert.equal(keelFixtureHas(evaluateKeelLayers(repo, model, { functions: [
        keelFixtureReview(model, file, "selectMetadata", "provider-metadata"),
        keelFixtureReview(model, foreign, "decide", role),
      ] }), check, "cannot read checked source"), true, `${type}: aliases cannot hide deciding calls`);
    }
  });
}

for (const repo of ["tsonic-csharp"]){
test(`${repo}: AC1 distinguishes native selection from reviewed cross-construct analysis`, () => {
    const policy = "src/policy/types/select.ts";
    const analysis = "src/analysis/storage/select.ts";
    const model = keelFixtureModel([
      [policy, "export function chooseCarrier(value: number): number { return value; }"],
      [analysis, "export function analyzeCaptures(values: number[]): number { let count = 0; for (const value of values) count += value; return count; }"],
    ]);
    const functions = [
      keelFixtureReview(model, policy, "chooseCarrier", "selection"),
      keelFixtureReview(model, analysis, "analyzeCaptures", "analysis"),
    ];
    assert.equal(evaluateKeelLayers(repo, model, { functions }).length, 0);
    assert.equal(keelFixtureHas(evaluateKeelLayers(repo, model), "AC1", "reviewed semantic-role classification"), true);
    functions[1] = { ...functions[1], role: "selection" };
    assert.equal(keelFixtureHas(evaluateKeelLayers(repo, model, { functions }), "AC1", "owned by policy"), true);
  });
}

for (const repo of ["tsonic-csharp"]){
for (const [name, source] of [
    ["unlisted declaration", "export function selectCheckedIteration(value: number): number { return value; }"],
    ["unlisted arrow", "export const chooseNative = (value: number): number => value;"],
    ["unlisted function expression", "export const chooseNative = function(value: number): number { return value; };"],
    ["annotated function property", "type Selector = (value: number) => number; export const chooseNative: Selector = value => value;"],
    ["exported method", "export class Operations { selectNative(value: number): number { return value; } }"],
  ]){
test(`${repo}: AC1 discovers every ${name} without a census exemption`, () => {
      const file = "src/analysis/operations/provider/elements-and-iteration.ts";
      const model = keelFixtureModel([[file, source]]);
      const findings = evaluateKeelLayers(repo, model);
      assert.equal(findings.filter(entry => entry.check === "AC1" && entry.reason.includes("reviewed semantic-role classification")).length, 1);
      const policy = "src/policy/operations/iteration/selection.ts";
      const reviewed = keelFixtureModel([[policy, source]]);
      assert.equal(keelFixtureHas(evaluateKeelLayers(repo, reviewed), "AC1", "reviewed semantic-role classification"), true);
      assert.equal(evaluateKeelLayers(repo, reviewed, {
        functions: [keelFixtureReview(reviewed, policy, reviewed.functions[0].symbol, "selection")],
      }).length, 0);
    });
}
}

for (const repo of ["tsonic-csharp"]){
test(`${repo}: AC1 accepts reviewed analysis named select without inferring its semantic role from spelling`, () => {
    const file = "src/analysis/operations/orchestration.ts";
    const model = keelFixtureModel([[file, "export function selectOperations(values: number[]): number { let total = 0; for (const value of values) total += value; return total; }"]]);
    const functions = [keelFixtureReview(model, file, "selectOperations", "analysis")];
    assert.equal(evaluateKeelLayers(repo, model, { functions }).length, 0);
    assert.equal(keelFixtureHas(evaluateKeelLayers(repo, model), "AC1", "reviewed semantic-role classification"), true);
    assert.equal(keelFixtureHas(evaluateKeelLayers(repo, model, {
      functions: [{ ...functions[0], role: "selection" }],
    }), "AC1", "owned by policy"), true);
  });
}

for (const repo of ["tsonic-csharp"]){
test(`${repo}: AC1 admits exact reviewed source-fact readers only at source/extension`, () => {
    const source = "export function selectCheckedArgument(value: number): number { return value; }";
    const file = "src/source/extension/arguments.ts";
    const model = keelFixtureModel([[file, source]]);
    const reviewed = keelFixtureReview(model, file, "selectCheckedArgument", "source-reader");
    assert.equal(evaluateKeelLayers(repo, model, { functions: [reviewed] }).length, 0,
      "a reviewed source reader keeps its checked source owner");
    assert.equal(keelFixtureHas(evaluateKeelLayers(repo, model), "AC1", "reviewed semantic-role classification"), true,
      "source placement does not implicitly classify an unreviewed reader");
    for (const directory of ["source", "policy/operations", "analysis/operations", "backend/planner/expressions"]) {
      const misplaced = `src/${directory}/arguments.ts`;
      const moved = keelFixtureModel([[misplaced, source]]);
      assert.equal(keelFixtureHas(evaluateKeelLayers(repo, moved, {
        functions: [keelFixtureReview(moved, misplaced, "selectCheckedArgument", "source-reader")],
      }), directory.startsWith("backend/") ? "AC2" : "AC1", "source-fact readers are owned by source/extension"), true,
      `${directory}: the same reviewed body cannot be placed at another deciding layer`);
    }
    const changed = keelFixtureModel([[file, source.replace("return value;", "return value + 1;")]]);
    assert.equal(keelFixtureHas(evaluateKeelLayers(repo, changed, { functions: [reviewed] }),
      "AC1", "missing, ambiguous or stale"), true, "changing the body invalidates its source-reader review");
    assert.equal(keelFixtureHas(evaluateKeelLayers(repo, model, {
      functions: [{ ...reviewed, evidence: [{ kind: "parameter", name: "absent" }] }],
    }), "AC1", "structural evidence"), true, "source-reader evidence must identify an actual input");
  });
}

for (const repo of ["tsonic-csharp"]){
test(`${repo}: AC1 follows checked export aliases and does not mistake private nested names or data for selectors`, () => {
    const implementation = "src/analysis/operations/implementation.ts";
    const barrel = "src/analysis/operations/index.ts";
    for (const exportSource of [
      'export { implementation as chooseNative } from "./implementation.js";',
      'import { implementation } from "./implementation.js"; export const chooseNative = implementation;',
      'import { implementation as chosen } from "./implementation.js"; export { chosen as selectNative };',
    ]) {
      const model = keelFixtureModel([
        [implementation, "export function implementation(value: number): number { return value; }"],
        [barrel, exportSource],
      ]);
      const findings = evaluateKeelLayers(repo, model);
      assert.equal(findings.some(entry => entry.check === "AC1" && entry.file === implementation && entry.subject === "implementation"), true);
      assert.equal(evaluateKeelLayers(repo, model, {
        functions: [keelFixtureReview(model, implementation, "implementation", "analysis")],
      }).length, 0);
    }
    const model = keelFixtureModel([[implementation,
      "export const selectedCount = 1; export function analyze(value: number): number { function selectPrivate(item: number): number { return item; } return selectPrivate(value); }"]]);
    assert.equal(evaluateKeelLayers(repo, model).length, 0);
  });
}

for (const repo of ["tsonic-csharp"]){
test(`${repo}: AC1 follows selection re-exports to their policy owner, not the barrel's path`, () => {
    const model = keelFixtureModel([
      ["src/policy/operations/iteration/selection.ts", "export function selectCheckedIteration(value: number): number { return value; }"],
      ["src/analysis/operations/index.ts", 'export { selectCheckedIteration as chooseIteration } from "../../policy/operations/iteration/selection.js";'],
    ]);
    const policy = "src/policy/operations/iteration/selection.ts";
    assert.equal(evaluateKeelLayers(repo, model, {
      functions: [keelFixtureReview(model, policy, "selectCheckedIteration", "selection")],
    }).filter(entry => entry.check === "AC1").length, 0);
    const anonymous = keelFixtureModel([
      ["src/policy/operations/iteration/selection.ts", "export default function(value: number): number { return value; }"],
      ["src/analysis/operations/index.ts", 'export { default as chooseIteration } from "../../policy/operations/iteration/selection.js";'],
    ]);
    assert.equal(evaluateKeelLayers(repo, anonymous, {
      functions: [keelFixtureReview(anonymous, policy, anonymous.functions[0].symbol, "selection")],
    }).filter(entry => entry.check === "AC1").length, 0);
  });
}

for (const repo of ["tsonic-csharp"]){
test(`${repo}: AC1 retains a reviewed native selection obligation through renaming and flattening`, () => {
    const original = "src/analysis/operations/provider/elements-and-iteration.ts";
    const flattened = "src/analysis/operations/elements-and-iteration.ts";
    const source = "export function selectCheckedIteration(value: number): number { return value; }";
    const before = keelFixtureModel([[original, source]]);
    const reviewed = keelFixtureReview(before, original, "selectCheckedIteration", "selection");
    const renamed = keelFixtureModel([[flattened, source.replace("selectCheckedIteration", "resolveCheckedIteration")]]);
    assert.equal(keelFixtureHas(evaluateKeelLayers(repo, renamed, { functions: [reviewed] }), "AC1", "missing, ambiguous or stale"), true);
    const matched = keelFixtureReview(renamed, flattened, "resolveCheckedIteration", "selection");
    assert.equal(keelFixtureHas(evaluateKeelLayers(repo, renamed, { functions: [matched] }), "AC1", "owned by policy"), true);
    assert.equal(keelFixtureHas(evaluateKeelLayers(repo, renamed, {}, [reviewed]), "AC1", "semantic-role obligation"), true);
    const corresponding = { ...matched, replaces: [keelFixtureReference(original, "selectCheckedIteration")] };
    assert.equal(keelFixtureHas(evaluateKeelLayers(repo, renamed, { functions: [corresponding] }, [reviewed]), "AC1", "owned by policy"), true);
    assert.equal(keelFixtureHas(evaluateKeelLayers(repo, renamed, {
      functions: [{ ...corresponding, role: "analysis" }],
    }, [reviewed]), "AC1", "unchanged role"), true);
    const policy = "src/policy/operations/iteration/selection.ts";
    const rehomed = keelFixtureModel([[policy, source]]);
    assert.equal(evaluateKeelLayers(repo, rehomed, {
      functions: [{ ...keelFixtureReview(rehomed, policy, "selectCheckedIteration", "selection"),
        replaces: [keelFixtureReference(original, "selectCheckedIteration")] }],
    }, [reviewed]).length, 0);
  });
}

for (const repo of ["tsonic-csharp"]){
test(`${repo}: AC1 keeps unresolved exported selector evidence open instead of classifying it as data`, () => {
    const file = "src/analysis/operations/selection.ts";
    const model = keelFixtureModel([[file, "export const chooseNative = missingNative;"]]);
    assert.equal(keelFixtureHas(evaluateKeelLayers(repo, model), "AC1", "no exact checked declaration"), true);
  });
}

for (const repo of ["tsonic-csharp"]){
test(`${repo}: AC1 fails closed on stale or invented classification evidence`, () => {
    const file = "src/policy/types/select.ts";
    const model = keelFixtureModel([[file, "export function chooseCarrier(value: number): number { return value; }"]]);
    const valid = keelFixtureReview(model, file, "chooseCarrier", "selection");
    for (const invalid of [
      { ...valid, bodySha256: "a".repeat(64) },
      { ...valid, evidence: [{ kind: "parameter", name: "invented" }] },
      { ...valid, evidence: [{ kind: "import", file: "src/analysis/missing.ts" }] },
    ]) assert.equal(keelFixtureHas(evaluateKeelLayers(repo, model, { functions: [invalid] }), "AC1"), true);
    assert.throws(() => evaluateKeelLayers(repo, model, { functions: [valid, valid] }), /duplicate/u);
    assert.throws(() => evaluateKeelLayers(repo, model, { functions: [{ ...valid, file: "src/*" }] }), /exact/u);
  });
}
