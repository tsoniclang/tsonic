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

for (const repo of ["tsonic-rust"]){
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
  ]).slice(5, 24)){
test(`${repo}: provider metadata R3 actual public ${type}`, () => {
    const file = "src/providers/native/projection/members.ts";
    const imported = type === "readonly ProviderMemberDeclaration[]" ? "ProviderMemberDeclaration" : type;
    const model = checkedMetadataFixture([[file, `import type { ${imported} } from "@tsonic/tsts"; export function selectMetadata(value: ${type}): ${type} { return value; }`]], type, publicMetadataInputs);
    const findings = evaluateKeelLayers(repo, model, { functions: [keelFixtureReview(model, file, "selectMetadata", "provider-metadata")] });
    assert.equal(accepted ? findings.length === 0 : keelFixtureHas(findings, "AC1", "metadata-only inputs"), true, `${type}: actual public declaration meaning`);
  });
}
}
