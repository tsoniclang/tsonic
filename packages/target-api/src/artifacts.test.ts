import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, type ExtensionDiagnostic } from "@tsonic/tsts";
import { targetDiagnosticFromExtension } from "./artifacts.js";

const selected: ExtensionDiagnostic = {
  extensionId: "native-owner", extensionCode: "EXACT", numericCode: 9101002,
  category: "error", message: "Exact native refusal.",
};

test("extension diagnostic transport preserves native fields without an invented source node or evidence", () => {
  assert.deepEqual(targetDiagnosticFromExtension(undefined, selected), {
    code: "TS9101002", category: "error", source: "native-owner", message: "Exact native refusal.",
  });
  assert.deepEqual(targetDiagnosticFromExtension(undefined, { ...selected, evidence: [] }),
    targetDiagnosticFromExtension(undefined, selected));
  for (const category of ["error", "warning", "suggestion"] as const) {
    assert.equal(targetDiagnosticFromExtension(undefined, { ...selected, category }).category, category);
  }
});

test("extension diagnostic transport retains exact source identity and stable immutable evidence", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": "export const value = 1;" },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  const node = checked.getSourceFile("/src/index.ts");
  assert.equal(node !== undefined, true, "actual checked source file");
  const diagnostic = targetDiagnosticFromExtension(node, { ...selected,
    evidence: [{ message: "second" }, { message: "first", details: node }, { message: "second" }],
  });
  assert.equal(diagnostic.sourceNode === node, true, "source identity is not copied or inferred");
  assert.deepEqual(diagnostic.evidence, ["second", "first"]);
  assert.equal(Object.isFrozen(diagnostic.evidence), true, "the published unique evidence vector is immutable");
});
