import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, type ExtensionDiagnostic } from "@tsonic/tsts";
import { targetDiagnosticFromExtension } from "./artifacts.js";
import { formatDiagnosticEvidenceDetails } from "./diagnostic-evidence.js";

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
  assert.equal(diagnostic.evidence?.length, 2, "duplicate evidence is still removed without dropping its details");
  assert.equal(diagnostic.evidence?.[0], "second", "evidence order stays stable");
  assert.equal(diagnostic.evidence?.[1], `first: ${formatDiagnosticEvidenceDetails(node)}`,
    "compiler evidence retains the canonical bounded source details instead of losing the cause");
  assert.equal(Object.isFrozen(diagnostic.evidence), true, "the published unique evidence vector is immutable");
});

test("extension diagnostic transport retains the actual native acquisition failure evidence", () => {
  const diagnostic = targetDiagnosticFromExtension(undefined, { ...selected, evidence: [{ message: "Provider evidence",
    details: { args: ["build", "/src/native.csproj"], status: 1, signal: null, stdout: "CS0001: exact native failure", stderr: "native stderr" } }] });
  assert.deepEqual(diagnostic.evidence, ['Provider evidence: {"args":["build","/src/native.csproj"],"status":1,"signal":null,"stdout":"CS0001: exact native failure","stderr":"native stderr"}']);
  assert.equal(Object.isFrozen(diagnostic.evidence), true, "native failure evidence is immutable after transport");
});
