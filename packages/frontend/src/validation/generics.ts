/**
 * Generic type validation
 */

import type { TstsSourceFile } from "@tsonic/tsts";
import { TsonicProgram } from "../program.js";
import { DiagnosticsCollector } from "../types/diagnostic.js";

/**
 * Validate generic types and constraints
 */
export const validateGenerics = (
  _sourceFile: TstsSourceFile,
  _program: TsonicProgram,
  collector: DiagnosticsCollector
): DiagnosticsCollector => {
  // TSN7203 retired; no generic-only blockers remain in this pass.
  return collector;
};
