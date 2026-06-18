import { expect } from "chai";
import * as fs from "node:fs";
import * as path from "node:path";
import type { TsonicProgram } from "../program.js";
import { validateProgram } from "../validator.js";
import { createTstsTestProgramFromFiles } from "../testing/tsts-test-program.js";

export { describe, it } from "mocha";
export { expect };

export const createTestProgram = (
  source: string,
  fileName = "/test/index.ts",
  extraFiles: Readonly<Record<string, string>> = {},
  options: Partial<TsonicProgram["options"]> = {}
): TsonicProgram => {
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

export const collectCodes = (
  source: string,
  extraFiles: Readonly<Record<string, string>> = {},
  options: Partial<TsonicProgram["options"]> = {}
): readonly string[] =>
  validateProgram(
    createTestProgram(source, "/test/index.ts", extraFiles, options)
  ).diagnostics.map((d) => d.code);

export const hasCode = (
  source: string,
  code: string,
  extraFiles: Readonly<Record<string, string>> = {},
  options: Partial<TsonicProgram["options"]> = {}
): boolean => collectCodes(source, extraFiles, options).includes(code);

export const collectCodesInTempProject = (
  source: string,
  extraFiles: Readonly<Record<string, string>> = {}
): readonly string[] => {
  const tempRoot = path.join(process.cwd(), ".temp", "validator-maximus");
  fs.mkdirSync(tempRoot, { recursive: true });
  const tempDir = fs.mkdtempSync(
    path.join(tempRoot, "dynamic-import-")
  );

  try {
    const files: Record<string, string> = {
      "src/index.ts": source,
      ...extraFiles,
    };
    const program = createTstsTestProgramFromFiles(files, "src/index.ts", {
      projectRoot: tempDir,
      sourceRoot: path.join(tempDir, "src"),
    });
    return validateProgram(program).diagnostics.map(
      (diagnostic) => diagnostic.code
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};
