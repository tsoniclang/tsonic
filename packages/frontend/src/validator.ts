/**
 * Validation facade for the TSTS-backed frontend.
 *
 * Source-language diagnostics are produced by TSTS and Tsonic compiler
 * extensions while creating TsonicProgram. Lowering-time acceptability checks
 * belong to the lowering pipeline and capability manifest.
 */

import type { TstsSourceFile } from "@tsonic/tsts";
import type { TsonicProgram } from "./program.js";
import {
  createDiagnosticsCollector,
  type DiagnosticsCollector,
} from "./types/diagnostic.js";

export const validateProgram = (
  _program: TsonicProgram
): DiagnosticsCollector => createDiagnosticsCollector();

export const validateSourceFile = (
  _sourceFile: TstsSourceFile,
  _program: TsonicProgram
): DiagnosticsCollector => createDiagnosticsCollector();
