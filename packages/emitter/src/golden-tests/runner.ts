/**
 * Test scenario runner
 */

import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { compile, buildIr } from "@tsonic/frontend";
import { emitCSharpFiles } from "../emitter.js";
import { generateFileHeader } from "../constants.js";
import { Scenario } from "./types.js";

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
  // Read expected output (without header)
  const expectedCsBody = fs.readFileSync(scenario.expectedPath, "utf-8");

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
  // Use standard lib for golden tests (they don't have BCL bindings)
  const compileResult = compile([scenario.inputPath], {
    sourceRoot,
    rootNamespace,
    useStandardLib: true,
  });

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

  // Step 3: Emit IR → C#
  // Note: Don't set entryPointPath - golden tests are NOT entry points
  const emitResult = emitCSharpFiles(irResult.value, {
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

  // Generate expected header using shared constant (with TIMESTAMP placeholder)
  // Use just the filename for comparison (actual files may have full paths)
  const fileName = path.basename(scenario.inputPath);
  const expectedHeader = generateFileHeader(fileName, {
    timestamp: "TIMESTAMP",
  });

  // Combine header with expected body
  const expectedCs = expectedHeader + expectedCsBody;

  // Normalize and compare
  const normalizedActual = normalizeCs(actualCs);
  const normalizedExpected = normalizeCs(expectedCs);

  expect(normalizedActual).to.equal(
    normalizedExpected,
    `C# output mismatch for ${scenario.pathParts.join("/")}`
  );
};
