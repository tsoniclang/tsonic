/**
 * TypeScript diagnostics collection and conversion
 */

import * as ts from "typescript";
import {
  Diagnostic,
  DiagnosticsCollector,
  createDiagnosticsCollector,
  addDiagnostic,
  createDiagnostic,
} from "../types/diagnostic.js";

/**
 * Collect all TypeScript diagnostics from a program
 */
export const collectTsDiagnostics = (
  program: ts.Program
): DiagnosticsCollector => {
  const tsDiagnostics = [
    ...program.getConfigFileParsingDiagnostics(),
    ...program.getOptionsDiagnostics(),
    ...program.getSyntacticDiagnostics(),
    ...program.getGlobalDiagnostics(),
    ...program.getSemanticDiagnostics(),
  ];

  return tsDiagnostics.reduce((collector, tsDiag) => {
    const diagnostic = convertTsDiagnostic(tsDiag);
    return diagnostic ? addDiagnostic(collector, diagnostic) : collector;
  }, createDiagnosticsCollector());
};

/**
 * Convert TypeScript diagnostic to Tsonic diagnostic
 */
export const convertTsDiagnostic = (
  tsDiag: ts.Diagnostic
): Diagnostic | null => {
  if (tsDiag.category === ts.DiagnosticCategory.Suggestion) {
    return null; // Ignore suggestions
  }

  const severity =
    tsDiag.category === ts.DiagnosticCategory.Error
      ? "error"
      : tsDiag.category === ts.DiagnosticCategory.Warning
        ? "warning"
        : "info";

  const message = ts.flattenDiagnosticMessageText(tsDiag.messageText, "\n");

  const location =
    tsDiag.file && tsDiag.start !== undefined
      ? getSourceLocation(tsDiag.file, tsDiag.start, tsDiag.length ?? 1)
      : undefined;

  return createDiagnostic(
    "TSN2001", // Generic TypeScript error
    severity,
    message,
    location
  );
};

/**
 * Get source location information from TypeScript source file
 */
export const getSourceLocation = (
  file: ts.SourceFile,
  start: number,
  length: number
): {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly length: number;
} => {
  const { line, character } = file.getLineAndCharacterOfPosition(start);
  return {
    file: file.fileName,
    line: line + 1,
    column: character + 1,
    length,
  };
};
