/**
 * Tsonic Frontend - TSTS-backed source engine and IR builder
 */

export {
  type DiagnosticSeverity,
  type DiagnosticCode,
  type SourceLocation,
  type Diagnostic,
  type DiagnosticsCollector,
  createDiagnostic,
  formatDiagnostic,
  createDiagnosticsCollector,
  addDiagnostic,
  mergeDiagnostics,
  isError as isDiagnosticError,
} from "./types/diagnostic.js";

export * from "./types/module.js";
export * from "./types/result.js";

export * from "./program.js";
export * from "./resolver.js";
export * from "./validator.js";
export * from "./dependency-graph.js";
export * from "./surface/profiles.js";
export * from "./source-frontend/index.js";
export * from "./tsonic-extension/index.js";
export * from "./capabilities/backend-capabilities.js";
export * from "./symbols/index.js";
export * from "./ir/index.js";
export * from "./ir/validation/index.js";
export * from "./external-metadata.js";

import { createProgram, TsonicProgram, CompilerOptions } from "./program.js";
import { validateProgram } from "./validator.js";
import {
  buildDependencyGraph,
  DependencyAnalysis,
} from "./dependency-graph.js";
import { DiagnosticsCollector, mergeDiagnostics } from "./types/diagnostic.js";
import { Result, ok, error } from "./types/result.js";

export type CompileResult = {
  readonly program: TsonicProgram;
  readonly analysis: DependencyAnalysis;
};

/**
 * Main entry point for compiling source files
 */
export const compile = (
  filePaths: readonly string[],
  options: CompilerOptions
): Result<CompileResult, DiagnosticsCollector> => {
  // Create Tsonic program through the TSTS source engine
  const programResult = createProgram(filePaths, options);

  if (!programResult.ok) {
    return programResult;
  }

  const program = programResult.value;

  // Validate ESM rules and Tsonic source constraints
  const validationDiagnostics = validateProgram(program);

  // Build dependency graph from the TSTS module graph.
  const analysis = buildDependencyGraph(program, filePaths);

  // Merge all diagnostics
  const allDiagnostics = mergeDiagnostics(
    validationDiagnostics,
    analysis.diagnostics
  );

  if (allDiagnostics.hasErrors) {
    return error(allDiagnostics);
  }

  return ok({
    program,
    analysis,
  });
};
