/**
 * Generic type validation
 */

import * as ts from "typescript";
import { TsonicProgram } from "../program.js";
import { DiagnosticsCollector } from "../types/diagnostic.js";

/**
 * Validate generic types and constraints
 */
export const validateGenerics = (
  _sourceFile: ts.SourceFile,
  _program: TsonicProgram,
  collector: DiagnosticsCollector
): DiagnosticsCollector => {
  // TSN7203 retired; no generic-only blockers remain in this pass.
  return collector;
};
