/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { validateUnsupportedFeatures } from "../features.js";
import { createDiagnosticsCollector } from "../../types/diagnostic.js";
import type { TsonicProgram } from "../../program.js";
import { createTstsTestProgramFromFiles } from "../../testing/tsts-test-program.js";

export type ValidationResult = ReturnType<typeof createDiagnosticsCollector>;

export const createTestProgram = (
  source: string,
  fileName = "/test/index.ts",
  extraFiles: Readonly<Record<string, string>> = {},
  options: Partial<TsonicProgram["options"]> = {}
) => {
  const files = {
    [fileName.replace(/^\//, "")]: source,
    ...Object.fromEntries(
      Object.entries(extraFiles).map(([name, text]) => [
        name.replace(/^\//, ""),
        text,
      ])
    ),
  };
  return createTstsTestProgramFromFiles(
    files,
    fileName.replace(/^\//, ""),
    {
      projectRoot: options.projectRoot,
      sourceRoot: options.sourceRoot,
      rootNamespace: options.rootNamespace ?? "TestApp",
      ...options,
    }
  );
};

export const runValidation = (
  sourceText: string,
  extraFiles: Readonly<Record<string, string>> = {},
  options: Partial<TsonicProgram["options"]> = {}
): ValidationResult => {
  const testProgram = createTestProgram(
    sourceText,
    "/test/index.ts",
    extraFiles,
    options
  );
  return validateUnsupportedFeatures(
    testProgram.sourceFile,
    testProgram,
    createDiagnosticsCollector()
  );
};

export const runValidationInTempProject = (
  sourceText: string,
  extraFiles: Readonly<Record<string, string>> = {}
): ValidationResult => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "tsonic-features-dynamic-import-")
  );

  try {
    const files: Record<string, string> = {
      "src/index.ts": sourceText,
      ...extraFiles,
    };
    const testProgram = createTstsTestProgramFromFiles(
      files,
      "src/index.ts",
      {
        projectRoot: tempDir,
        sourceRoot: path.join(tempDir, "src"),
      }
    );

    return validateUnsupportedFeatures(
      testProgram.sourceFile,
      testProgram,
      createDiagnosticsCollector()
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};

export const hasDiagnostic = (
  result: ValidationResult,
  code: string,
  messageFragment?: string
) =>
  result.diagnostics.some(
    (d) =>
      d.code === code &&
      (messageFragment === undefined || d.message.includes(messageFragment))
  );
