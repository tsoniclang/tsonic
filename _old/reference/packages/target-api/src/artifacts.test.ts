import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, type ExtensionDiagnostic } from "@tsonic/tsts";
import { targetDiagnosticFromExtension } from "./artifacts.js";
import { formatDiagnosticEvidenceDetails } from "./target-artifacts/diagnostic-evidence.js";

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

test("extension diagnostic transport preserves an actual public code and otherwise only the actual numeric identity", () => {
  for (const category of ["error", "warning", "suggestion"] as const) {
    const publicDiagnostic = targetDiagnosticFromExtension(undefined, { ...selected, category,
      publicCode: "CSHARP_GENERATOR_THROW_UNSUPPORTED" });
    assert.equal(publicDiagnostic.code, "CSHARP_GENERATOR_THROW_UNSUPPORTED", "the approved public refusal is not replaced with its transport number");
    assert.equal(publicDiagnostic.category, category, "the actual native category is preserved independently of its public code");
    assert.equal(publicDiagnostic.source, selected.extensionId, "the declaring owner is preserved");
    assert.equal(publicDiagnostic.message, selected.message, "the original refusal message is preserved");
    assert.equal("sourceNode" in publicDiagnostic, false, "absence of a source node remains genuine");
    assert.equal("evidence" in publicDiagnostic, false, "absence of evidence remains genuine");
    const numericDiagnostic = targetDiagnosticFromExtension(undefined, { ...selected, category, numericCode: 0,
      extensionCode: "NOT_A_PUBLIC_CODE" });
    assert.equal(numericDiagnostic.code, "TS0", "a missing public code uses the exact numeric value, including zero");
    assert.equal(numericDiagnostic.category, category, "numeric transport preserves the same category");
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
