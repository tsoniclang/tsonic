/**
 * Program creation
 */

import * as ts from "typescript";
import * as path from "node:path";
import { Result, ok, error } from "../types/result.js";
import { DiagnosticsCollector } from "../types/diagnostic.js";
import { CompilerOptions, TsonicProgram } from "./types.js";
import { defaultTsConfig } from "./config.js";
import { loadDotnetMetadata } from "./metadata.js";
import { collectTsDiagnostics } from "./diagnostics.js";

/**
 * Create a Tsonic program from TypeScript source files
 */
export const createProgram = (
  filePaths: readonly string[],
  options: CompilerOptions
): Result<TsonicProgram, DiagnosticsCollector> => {
  const absolutePaths = filePaths.map((fp) => path.resolve(fp));

  const tsOptions: ts.CompilerOptions = {
    ...defaultTsConfig,
    strict: options.strict ?? true,
    rootDir: options.sourceRoot,
  };

  const host = ts.createCompilerHost(tsOptions);
  const program = ts.createProgram(absolutePaths, tsOptions, host);

  const diagnostics = collectTsDiagnostics(program);

  if (diagnostics.hasErrors) {
    return error(diagnostics);
  }

  const sourceFiles = program
    .getSourceFiles()
    .filter(
      (sf) => !sf.isDeclarationFile && absolutePaths.includes(sf.fileName)
    );

  // Load .NET metadata files
  const metadata = loadDotnetMetadata(program);

  return ok({
    program,
    checker: program.getTypeChecker(),
    options,
    sourceFiles,
    metadata,
  });
};
