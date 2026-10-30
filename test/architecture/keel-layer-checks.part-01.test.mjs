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
for (const [type, accepted] of Array.from([
    ["ProviderTypeExpression", true], ["readonly ProviderMemberDeclaration[]", true],
    ["ProviderParameterDeclaration", true], ["ProviderPropertyName", true],
    ["SourcePrimitiveKind", true], ["ArgumentPassingMode", true], ["ProviderWellKnownSymbolName", true],
    ["ExtensionEvidence", true], ["ProviderIdentity", true], ["ProviderDeclarationKind", true],
    ["ProviderExportKind", true], ["ProviderTypeFamilyDeclaration", true], ["ProviderTypeParameterDeclaration", true],
    ["ProviderSignatureDeclaration", true], ["ProviderExportDeclaration", true], ["ProviderImportDeclaration", true],
    ["ProviderHeritageDeclaration", true], ["ProviderDeclarationModel", true], ["ProviderRequestedExport", true],
    ["ProviderImportRequestKind", true], ["ExtensionDiagnosticRange", true],
    ["SourcePrimitiveFact", false], ["ExtensionDiagnostic", false], ["ExtensionDiagnosticCategory", false],
  ]).slice(15, 24)){
test(`${repo}: provider metadata R3 actual public ${type}`, () => {
    const file = "src/providers/native/projection/members.ts";
    const imported = type === "readonly ProviderMemberDeclaration[]" ? "ProviderMemberDeclaration" : type;
    const model = checkedMetadataFixture([[file, `import type { ${imported} } from "@tsonic/tsts"; export function selectMetadata(value: ${type}): ${type} { return value; }`]], type, publicMetadataInputs);
    const findings = evaluateKeelLayers(repo, model, { functions: [keelFixtureReview(model, file, "selectMetadata", "provider-metadata")] });
    assert.equal(accepted ? findings.length === 0 : keelFixtureHas(findings, "AC1", "metadata-only inputs"), true, `${type}: actual public declaration meaning`);
  });
}
}

for (const repo of ["tsonic-csharp"]){
for (const type of Array.from(["SourcePrimitiveKind", "ArgumentPassingMode", "ProviderWellKnownSymbolName"]).slice(0, 2)){
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
