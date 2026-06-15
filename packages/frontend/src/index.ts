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
export * from "./validator.js";
export * from "./surface/profiles.js";
export * from "./source-frontend/index.js";
export * from "./tsonic-extension/index.js";
export * from "./lowering/index.js";
export * from "./capabilities/backend-capabilities.js";

import { createProgram, TsonicProgram, CompilerOptions } from "./program.js";
import { validateProgram } from "./validator.js";
import {
  createLoweringModuleGraph,
  type LoweringModuleGraphResult,
} from "./program/lowering-graph.js";
import type { BackendTargetId } from "./lowering/index.js";
import {
  addDiagnostic,
  createDiagnostic,
  createDiagnosticsCollector,
  type DiagnosticsCollector,
  mergeDiagnostics,
} from "./types/diagnostic.js";
import { Result, ok, error } from "./types/result.js";

export type CompileResult<Target extends BackendTargetId = BackendTargetId> = {
  readonly program: TsonicProgram<Target>;
  readonly loweringGraph: LoweringModuleGraphResult<Target>;
};

/**
 * Main entry point for compiling source files
 */
export const compile = <Target extends BackendTargetId = BackendTargetId>(
  filePaths: readonly string[],
  options: CompilerOptions<Target>
): Result<CompileResult<Target>, DiagnosticsCollector> => {
  const entryFile = filePaths[0];
  if (entryFile === undefined || filePaths.length !== 1) {
    return error(
      addDiagnostic(
        createDiagnosticsCollector(),
        createDiagnostic(
          "TSN1001",
          "error",
          entryFile === undefined
            ? "No entry file was provided."
            : "compile() accepts exactly one runtime entry file. Additional source files must enter through the TSTS module graph."
        )
      )
    );
  }

  // Create Tsonic program through the TSTS source engine
  const programResult = createProgram(filePaths, options);

  if (!programResult.ok) {
    return programResult;
  }

  const program = programResult.value;

  // Validate ESM rules and Tsonic source constraints
  const validationDiagnostics = validateProgram(program);

  // Build lowering plans from the already-created TSTS program.
  const loweringGraph = createLoweringModuleGraph(program, entryFile);
  if (!loweringGraph.ok) {
    return error({
      diagnostics: loweringGraph.error,
      hasErrors: loweringGraph.error.some(
        (diagnostic) =>
          diagnostic.severity === "error" || diagnostic.severity === "fatal"
      ),
      hasFatalErrors: loweringGraph.error.some(
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
    loweringGraph: loweringGraph.value,
  });
};
