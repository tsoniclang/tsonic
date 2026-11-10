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

export const metadataWorkspace = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

export const publicMetadataInputs = readKeelDeclarations(metadataWorkspace);

export function checkedMetadataFixture(entries, label, declarations = { declarationFiles: new Map(), modulePaths: {} }) {
  const files = new Map([...declarations.declarationFiles, ...entries].map(([file, text]) => [`/keel/${file}`, text]));
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/keel", files, rootFiles: entries.map(([file]) => file),
    compilerOptions: {
      module: "esnext", moduleResolution: "bundler", target: "esnext", lib: ["es2022"],
      skipLibCheck: true, strict: true, allowJs: true,
      paths: Object.fromEntries(Object.entries(declarations.modulePaths).map(([specifier, paths]) => [specifier, paths.map(path => `/keel/${path}`)])),
    },
  }).checkSource();
  assert.equal(checked.diagnostics.length, 0,
    `${label}: fixture must be semantically valid\n${formatDiagnostics(checked.diagnostics)}`);
  return analyzeKeelTypeScript(new Map(entries), declarations);
}
