/**
 * Tsonic Frontend - TSTS-backed source engine and lowering planner
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

export * from "./types/result.js";

export * from "./program.js";
export * from "./resolver.js";
export * from "./validator.js";
export * from "./dependency-graph.js";
export * from "./surface/profiles.js";
export * from "./source-frontend/index.js";
export * from "./tsonic-extension/index.js";
export * from "./lowering/index.js";
export * from "./capabilities/backend-capabilities.js";

import { createProgram, TsonicProgram, CompilerOptions } from "./program.js";
import { validateProgram } from "./validator.js";
import {
  buildModuleDependencyGraph,
  type ModuleDependencyGraphResult,
} from "./dependency-graph.js";
import {
  addDiagnostic,
  createDiagnostic,
  createDiagnosticsCollector,
  type DiagnosticsCollector,
  mergeDiagnostics,
} from "./types/diagnostic.js";
import { Result, ok, error } from "./types/result.js";

export type CompileResult = {
  readonly program: TsonicProgram;
  readonly analysis: ModuleDependencyGraphResult;
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
  const entryFile = filePaths[0];
  if (entryFile === undefined) {
    return error(
      addDiagnostic(
        createDiagnosticsCollector(),
        createDiagnostic("TSN1001", "error", "No entry files were provided.")
      )
    );
  }

  // Validate ESM rules and Tsonic source constraints
  const validationDiagnostics = validateProgram(program);

  // Build dependency graph from the TSTS module graph.
  const analysis = buildModuleDependencyGraph(entryFile, options);
  if (!analysis.ok) {
    return error({
      diagnostics: analysis.error,
      hasErrors: analysis.error.some(
        (diagnostic) =>
          diagnostic.severity === "error" || diagnostic.severity === "fatal"
      ),
      hasFatalErrors: analysis.error.some(
        (diagnostic) => diagnostic.severity === "fatal"
      ),
    });
  }

  // Merge all diagnostics
  const allDiagnostics = mergeDiagnostics(
    validationDiagnostics,
    createDiagnosticsCollector()
  );

  if (allDiagnostics.hasErrors) {
    return error(allDiagnostics);
  }

  return ok({
    program,
    analysis: analysis.value,
  });
};
