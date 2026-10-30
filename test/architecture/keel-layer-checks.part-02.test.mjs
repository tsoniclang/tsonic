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
for (const type of Array.from(["SourcePrimitiveKind", "ArgumentPassingMode", "ProviderWellKnownSymbolName"]).slice(2, 3)){
for (const owner of ["source", "policy/types", "unapproved"]){
test(`${repo}: provider metadata R3 ${type} homonym in ${owner}`, () => {
      const file = "src/providers/native/projection/members.ts";
      const foreign = owner === "unapproved" ? "external/unapproved/native.d.ts" : `src/${owner}/native.ts`;
      const inputs = owner === "unapproved" ? { ...publicMetadataInputs, declarationFiles: new Map([...publicMetadataInputs.declarationFiles, [foreign, `export type ${type} = "native" | "other";`]]), modulePaths: { ...publicMetadataInputs.modulePaths, "@unapproved/native": [foreign] } } : publicMetadataInputs;
      const entries = owner === "unapproved" ? [] : [[foreign, `export type ${type} = "native" | "other";`]];
      const specifier = owner === "unapproved" ? "@unapproved/native" : `../../../${owner}/native.js`;
      const model = checkedMetadataFixture([...entries, [file, `import type { ${type} } from "${specifier}"; import type { ProviderTypeExpression } from "@tsonic/tsts"; interface NativeMetadata { readonly type: ProviderTypeExpression; readonly hidden: ${type}; } export function selectMetadata(value: NativeMetadata): ProviderTypeExpression { return value.type; }`]], `${type} ${owner}`, inputs);
      assert.equal(keelFixtureHas(evaluateKeelLayers(repo, model, { functions: [keelFixtureReview(model, file, "selectMetadata", "provider-metadata")] }), "AC1", "metadata-only inputs"), true, `${type}: foreign homonym is not public vocabulary proof`);
    });
}
}
}

for (const repo of ["tsonic-csharp"]){
for (const read of [false, true]){
test(`${repo}: provider metadata R3 actual checked fact ${read ? "value" : "nested payload"}`, () => {
    const file = "src/providers/native/projection/members.ts";
    const model = checkedMetadataFixture([
      ["src/source/semantics.ts", 'import type { SourcePrimitiveFact } from "@tsonic/tsts"; export const checked: SourcePrimitiveFact = { kind: "int32", runtimeBase: "number" };'],
      [file, `import { checked } from "../../../source/semantics.js"; import type { ProviderTypeExpression, SourcePrimitiveFact } from "@tsonic/tsts"; interface NativeMetadata { readonly type: ProviderTypeExpression; readonly checked: SourcePrimitiveFact; } export function selectMetadata(value: ${read ? "ProviderTypeExpression" : "NativeMetadata"}): ProviderTypeExpression { ${read ? "void checked; return value;" : "return value.type;"} }`],
    ], `actual checked fact ${read}`, publicMetadataInputs);
    assert.equal(keelFixtureHas(evaluateKeelLayers(repo, model, { functions: [keelFixtureReview(model, file, "selectMetadata", "provider-metadata")] }), "AC1", read ? "cannot read checked source" : "metadata-only inputs"), true, "actual checked-source facts remain forbidden inside the real metadata contract");
  });
}
}

for (const repo of ["tsonic-csharp"]){
test(`${repo}: provider metadata R3 actual registered native owner contracts`, () => {
    const native = new Map([...readSourceInventory(resolve(metadataWorkspace, "tsonic-rust/src"))].map(([path, text]) => [`src/${path}`, text]));
    const dependencies = [["@types/node", "node"], ["undici-types", "undici"]].flatMap(([packageName, library]) =>
      [...readSourceInventory(resolve(metadataWorkspace, "tsonic/node_modules", packageName), { extensions: [".d.ts", "package.json"] })]
        .map(([path, text]) => [`libraries/${library}/${path}`, text]));
    const authored = native.get("src/providers/native/projection/declarations/signatures.ts");
    const start = authored.indexOf("export function selectUnambiguousMembers(");
    const end = authored.indexOf("\nfunction uniqueVariadicParameterName(", start);
    assert.equal(start >= 0 && end > start, true, "actual pinned native owner span exists");
    const file = "src/providers/native/projection/public-contract-owner.ts";
    const inputs = { ...publicMetadataInputs, declarationFiles: new Map([...publicMetadataInputs.declarationFiles, ...native, ...dependencies]),
      modulePaths: { ...publicMetadataInputs.modulePaths, "undici-types": ["libraries/undici/index.d.ts"] } };
    const model = checkedMetadataFixture([[file, `import "../../../../libraries/node/index.js"; import type { ProviderMemberDeclaration } from "@tsonic/tsts"; import type { RustProviderOperationDefinition } from "../../../target-model/identities/provider-relations.js"; ${authored.slice(start, end)}`]], "actual native owner", inputs);
    const reviewed = keelFixtureReview(model, file, "selectUnambiguousMembers", "provider-metadata");
    assert.equal(reviewed.bodySha256, "98c1971f96588e79fdd944987c61e67f012602ba5d39ae674e9d1ede0cfc6c34", "actual native owner body is unchanged");
    const findings = evaluateKeelLayers(repo, model, { functions: [reviewed] });
    assert.equal(findings.filter(finding => finding.file === file && finding.subject === "selectUnambiguousMembers").length, 0, "actual input and output contracts, including native resultCarrier, are metadata");
  });
}

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
