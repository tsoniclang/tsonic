/**
 * Test scenario runner
 */

import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { compile, buildIr, runNumericProofPass } from "@tsonic/frontend";
import { emitCSharpFiles } from "../emitter.js";
import { DiagnosticsMode, Scenario } from "./types.js";

// Resolve paths to js-globals and types packages for golden tests
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../../..");
const jsGlobalsPath = path.join(
  monorepoRoot,
  "node_modules/@tsonic/js-globals"
);
const corePath = path.join(monorepoRoot, "node_modules/@tsonic/core");

/**
 * Normalize C# output for comparison
 */
export const normalizeCs = (code: string): string => {
  return (
    code
      .trim()
      // Normalize line endings
      .replace(/\r\n/g, "\n")
      // Remove trailing whitespace
      .replace(/\s+$/gm, "")
      // Normalize timestamp line (make comparison timestamp-agnostic)
      .replace(/\/\/ Generated at: .+/, "// Generated at: TIMESTAMP")
      // Normalize file path to just filename (strip directory path)
      .replace(/\/\/ Generated from: .+\/([^/]+)$/, "// Generated from: $1")
  );
};

/**
 * Run a single test scenario
 */
export const runScenario = async (scenario: Scenario): Promise<void> => {
  // Determine source root (parent of input file)
  const sourceRoot = path.dirname(scenario.inputPath);

  // Build namespace from path parts (case-preserved, hyphens stripped per spec)
  // e.g., ['types', 'interfaces'] → 'TestCases.types.interfaces'
  // Note: pathParts contains directory path only (no filename), so no slicing needed
  const namespaceParts = scenario.pathParts.map((part) =>
    part.replace(/-/g, "")
  ); // Strip hyphens
  const rootNamespace = ["TestCases", ...namespaceParts].join(".");

  // Step 1: Compile TypeScript → Program
  // Use js-globals for golden tests (JS mode types with int type alias for index-space values)
  const compileResult = compile([scenario.inputPath], {
    projectRoot: monorepoRoot, // Use monorepo root for node_modules resolution
    sourceRoot,
    rootNamespace,
    typeRoots: [jsGlobalsPath, corePath],
  });

  // Handle expected diagnostics tests
  if (scenario.expectDiagnostics?.length) {
    if (compileResult.ok) {
      throw new Error(
        `Expected diagnostics ${scenario.expectDiagnostics.join(", ")} but compilation succeeded for ${scenario.inputPath}`
      );
    }

    const actualDiagnostics = compileResult.error.diagnostics;
    const actualCodes = new Set(actualDiagnostics.map((d) => d.code as string));
    const expected = scenario.expectDiagnostics; // readonly string[], already validated as TSN####
    const expectedSet = new Set(expected);
    const mode: DiagnosticsMode = scenario.expectDiagnosticsMode ?? "contains";

    // Check for missing expected diagnostics (both modes)
    const missing = expected.filter((c) => !actualCodes.has(c));

    if (missing.length) {
      // Show full diagnostic details for debugging
      const actualDetails = actualDiagnostics
        .map((d) => `  ${d.code}: ${d.message}`)
        .join("\n");
      throw new Error(
        `Missing expected diagnostics (${mode}): ${missing.join(", ")}\n` +
          `Expected: ${expected.join(", ")}\n` +
          `Actual diagnostics:\n${actualDetails}`
      );
    }

    // In "exact" mode, also check for unexpected diagnostics
    if (mode === "exact") {
      const unexpected = Array.from(actualCodes).filter(
        (c) => !expectedSet.has(c)
      );

      if (unexpected.length) {
        const unexpectedDetails = actualDiagnostics
          .filter((d) => !expectedSet.has(d.code))
          .map((d) => `  ${d.code}: ${d.message}`)
          .join("\n");
        throw new Error(
          `Unexpected diagnostics in exact mode: ${unexpected.join(", ")}\n` +
            `Expected exactly: ${scenario.expectDiagnostics.join(", ")}\n` +
            `Unexpected diagnostics:\n${unexpectedDetails}`
        );
      }
    }

    // PASS: expected diagnostics were found (and no extras in exact mode)
    return;
  }

  if (!compileResult.ok) {
    // Show diagnostics if compilation failed
    const errors = compileResult.error.diagnostics
      .map((d) => `${d.code}: ${d.message}`)
      .join("\n");
    throw new Error(`Compilation failed:\n${errors}`);
  }

  // Step 2: Build IR from Program
  const irResult = buildIr(compileResult.value.program, {
    sourceRoot,
    rootNamespace,
  });

  if (!irResult.ok) {
    const errors = irResult.error
      .map((d) => `${d.code}: ${d.message}`)
      .join("\n");
    throw new Error(`IR build failed:\n${errors}`);
  }

  // Step 2.5: Run numeric proof pass (validates and annotates numeric types)
  const proofResult = runNumericProofPass(irResult.value);
  if (!proofResult.ok) {
    const errors = proofResult.diagnostics
      .map((d) => `${d.code}: ${d.message}`)
      .join("\n");
    throw new Error(`Numeric proof validation failed:\n${errors}`);
  }

  // Step 3: Emit IR → C#
  // Note: Don't set entryPointPath - golden tests are NOT entry points
  // Use the proof-annotated modules from the proof pass
  const emitResult = emitCSharpFiles(proofResult.modules, {
    rootNamespace,
  });

  if (!emitResult.ok) {
    const errors = emitResult.errors
      .map((d) => `${d.code}: ${d.message}`)
      .join("\n");
    throw new Error(`Emit failed:\n${errors}`);
  }

  const csharpFiles = emitResult.files;

  // Find the generated file for our input
  // The key should be the class name derived from the input file
  const className = path.basename(scenario.inputPath, ".ts");
  const generatedKey = Array.from(csharpFiles.keys()).find((key) =>
    key.endsWith(`${className}.cs`)
  );

  if (!generatedKey) {
    throw new Error(
      `Could not find generated C# file for ${scenario.inputPath}. Available: ${Array.from(csharpFiles.keys()).join(", ")}`
    );
  }

  const actualCs = csharpFiles.get(generatedKey);
  if (!actualCs) {
    throw new Error(
      `Generated file key exists but content is missing: ${generatedKey}`
    );
  }

  // Read expected output (includes header) - only needed for non-diagnostic tests
  if (!scenario.expectedPath) {
    throw new Error(
      `Expected path missing for successful test: ${scenario.inputPath}`
    );
  }
  const expectedCs = fs.readFileSync(scenario.expectedPath, "utf-8");

  // Normalize and compare
  const normalizedActual = normalizeCs(actualCs);
  const normalizedExpected = normalizeCs(expectedCs);

  expect(normalizedActual).to.equal(
    normalizedExpected,
    `C# output mismatch for ${scenario.pathParts.join("/")}`
  );
};
