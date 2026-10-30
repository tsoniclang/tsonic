import assert from "node:assert/strict";

import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";

import { createTargetSourceProgram } from "../public/source.js";

function checked(sourceText: string, files: Readonly<Record<string, string>> = {}) {
  const source = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: { "/src/index.ts": sourceText, ...files },
    compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
  }).checkSource();
  assert.equal(source.diagnostics.length, 0, formatDiagnostics(source.diagnostics.filter(diagnostic => diagnostic !== undefined)));
  return createTargetSourceProgram(source);
}

export { checked };
