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
for (const type of ["SourcePrimitiveKind", "ArgumentPassingMode", "ProviderWellKnownSymbolName"]){
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
