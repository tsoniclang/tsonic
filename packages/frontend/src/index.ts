/**
 * Tsonic Frontend - TypeScript parser and IR builder
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
export * from "./symbol-table.js";
export * from "./dependency-graph.js";

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
 * Main entry point for compiling TypeScript files
 */
export const compile = (
  filePaths: readonly string[],
  options: CompilerOptions
): Result<CompileResult, DiagnosticsCollector> => {
  // Create TypeScript program
  const programResult = createProgram(filePaths, options);

  if (!programResult.ok) {
    return programResult;
  }

  const program = programResult.value;

  // Validate ESM rules and TypeScript constraints
  const validationDiagnostics = validateProgram(program);

  // Build dependency graph and symbol table
  const analysis = buildDependencyGraph(program, filePaths);

  // Merge all diagnostics
  const allDiagnostics = mergeDiagnostics(
    mergeDiagnostics(validationDiagnostics, analysis.diagnostics),
    validationDiagnostics
  );

  if (allDiagnostics.hasErrors) {
    return error(allDiagnostics);
  }

  return ok({
    program,
    analysis,
  });
};
