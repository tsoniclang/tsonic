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
import { metadataWorkspace, publicMetadataInputs, checkedMetadataFixture } from './keel-layer-checks-fixtures.mjs';

for (const repo of ["tsonic-csharp"]){
for (const [origin, foreign] of [["source", "src/source/semantics.ts"], ["policy", "src/policy/types/native.ts"]]){
for (const [grammar, statement] of [
      ["label and break", "done: { break done; }"],
      ["label and continue", "done: for (let index = 0; index < 1; index += 1) { continue done; }"],
    ]){
for (const read of [false, true]){
test(`${repo}: provider metadata G1 ${origin} ${grammar} ${read ? "actual read" : "no read"}`, () => {
      const label = `${origin} ${grammar} ${read}`;
      const file = "src/providers/native/projection/members.ts";
      const model = checkedMetadataFixture([
        [foreign, "export interface CheckedSource { readonly value: number; } export const checked: CheckedSource = { value: 1 };"],
        ["src/providers/native/model/input.ts", "export interface NativeMetadata { readonly value: number; } export interface ProviderModel { readonly value: number; }"],
        [file, `import { checked as done } from "../../../${foreign.slice(4, -3)}.js"; import type { NativeMetadata, ProviderModel } from "../model/input.js"; export function selectMetadata(value: NativeMetadata): ProviderModel { ${statement} return ${read ? "done" : "value"}; }`],
      ], label);
      const findings = evaluateKeelLayers(repo, model, { functions: [keelFixtureReview(model, file, "selectMetadata", "provider-metadata")] });
      assert.equal(read ? keelFixtureHas(findings, "AC1", "cannot read checked source") : findings.length === 0, true, label);
    });
}
}
}
}

for (const repo of ["tsonic-csharp"]){
for (const [form, body, symbol, explicit, typeOnly] of [
    ["direct this", "return this;", "Metadata.selectMetadata", false, false],
    ["lexical arrow this", "return (() => this)();", "Metadata.selectMetadata", false, false],
    ["type this only", "type Receiver = this; return value;", "Metadata.selectMetadata", false, true],
    ["explicit this", "return this;", "selectMetadata", true, false],
  ]){
for (const foreign of [false, true]){
test(`${repo}: provider metadata G2 ${form} ${foreign ? "source" : "native"}`, () => {
    const file = "src/providers/native/projection/members.ts";
    const declaration = `export class Metadata extends ${foreign ? "CheckedSource" : "NativeMetadata"} { selectMetadata(value: NativeMetadata): ProviderModel { ${body} } }`;
    const model = checkedMetadataFixture([
      ["src/source/semantics.ts", "export class CheckedSource { readonly value = 1; }"],
      ["src/providers/native/model/input.ts", "export class NativeMetadata { readonly value = 0; } export interface ProviderModel { readonly value: number; }"],
      [file, `import { CheckedSource } from "../../../source/semantics.js"; import { NativeMetadata } from "../model/input.js"; import type { ProviderModel } from "../model/input.js"; ${explicit ? `export function selectMetadata(this: ${foreign ? "CheckedSource" : "NativeMetadata"}, value: NativeMetadata): ProviderModel { ${body} }` : declaration}`],
    ], `${form} ${foreign}`);
    const findings = evaluateKeelLayers(repo, model, { functions: [keelFixtureReview(model, file, symbol, "provider-metadata")] });
    assert.equal(foreign && !typeOnly ? keelFixtureHas(findings, "AC1", explicit ? "metadata-only inputs" : "cannot read checked source") : findings.length === 0,
      true, `${form}: only actual receiver values participate`);
  });
}
}
}

for (const repo of ["tsonic-csharp"]){
for (const boundary of ["input", "output"]){
for (const getter of [false, true]){
for (const foreign of [false, true]){
test(`${repo}: provider metadata G3 inferred ${getter ? "getter" : "field"} ${boundary} ${foreign ? "source" : "native"}`, () => {
      const file = "src/providers/native/projection/members.ts";
      const member = getter ? `get source() { return new ${foreign ? "CheckedSource" : "NativeValue"}(); }` : `readonly source = new ${foreign ? "CheckedSource" : "NativeValue"}();`;
      const selected = boundary === "input" ? "NativeMetadata" : "ProviderModel";
      const other = boundary === "input" ? "ProviderModel" : "NativeMetadata";
      const model = checkedMetadataFixture([
        ["src/source/semantics.ts", "export class CheckedSource { readonly value = 1; }"],
        ["src/providers/native/model/input.ts", `import { CheckedSource } from "../../../source/semantics.js"; class NativeValue { readonly value = 1; } export class ${selected} { ${member} readonly value = 0; readonly next: ${selected} | undefined = undefined; } export interface ${other} { readonly value: number; }`],
        [file, `import { ${selected} } from "../model/input.js"; import type { ${other} } from "../model/input.js"; export function selectMetadata(value: NativeMetadata): ProviderModel { return ${boundary === "input" ? "{ value: 0 }" : "new ProviderModel()"}; }`],
      ], `inferred ${getter} ${boundary} ${foreign}`);
      const findings = evaluateKeelLayers(repo, model, { functions: [keelFixtureReview(model, file, "selectMetadata", "provider-metadata")] });
      assert.equal(foreign ? keelFixtureHas(findings, "AC1", "metadata-only inputs") : findings.length === 0, true,
        `${boundary}: checked inferred members, native recursive members and getters retain their actual types`);
    });
}
}
}
}

for (const repo of ["tsonic-csharp"]){
for (const [form, body, parameter, foreign, rejected] of [
    ["unused foreign static", "return value;", "NativeMetadata", true, false],
    ["unused native static", "return value;", "NativeMetadata", false, false],
    ["foreign static read", "return NativeMetadata.source;", "NativeMetadata", true, true],
    ["native static read", "return NativeMetadata.source;", "NativeMetadata", false, false],
    ["foreign constructor boundary", "return { value: 0 };", "typeof NativeMetadata", true, true],
  ]){
test(`${repo}: provider metadata G4 ${form}`, () => {
    const file = "src/providers/native/projection/members.ts";
    const model = checkedMetadataFixture([
      ["src/source/semantics.ts", "export class CheckedSource { readonly value = 1; }"],
      ["src/providers/native/model/input.ts", `import { CheckedSource } from "../../../source/semantics.js"; class NativeValue { readonly value = 1; } export class NativeMetadata { static readonly source: ${foreign ? "CheckedSource" : "NativeValue"} = new ${foreign ? "CheckedSource" : "NativeValue"}(); readonly value = 0; } export interface ProviderModel { readonly value: number; }`],
      [file, `import { NativeMetadata } from "../model/input.js"; import type { ProviderModel } from "../model/input.js"; export function selectMetadata(value: ${parameter}): ProviderModel { ${body} }`],
    ], form);
    const findings = evaluateKeelLayers(repo, model, { functions: [keelFixtureReview(model, file, "selectMetadata", "provider-metadata")] });
    assert.equal(rejected ? keelFixtureHas(findings, "AC1", form.includes("boundary") ? "metadata-only inputs" : "cannot read checked source") : findings.length === 0,
      true, `${form}: instance and constructor are distinct checked types`);
  });
}
}
