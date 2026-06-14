/**
 * Validation facade for the TSTS-backed frontend.
 *
 * Source-language diagnostics are produced by TSTS and Tsonic compiler
 * extensions while creating TsonicProgram. Lowering-time acceptability checks
 * belong to the lowering pipeline and capability manifest.
 */

import type { ExtensionDiagnostic, TstsNode, TstsSourceFile } from "@tsonic/tsts";
import { getTstsNodeLocation } from "@tsonic/tsts";
import type { TsonicProgram } from "./program.js";
import {
  addDiagnostic,
  createDiagnosticsCollector,
  createDiagnostic,
  type Diagnostic,
  type DiagnosticCode,
  type DiagnosticsCollector,
} from "./types/diagnostic.js";

const extensionDiagnosticLocation = (
  diagnostic: ExtensionDiagnostic
): Diagnostic["location"] => {
  const sourceFile = diagnostic.sourceFile;
  const node = diagnostic.node as TstsNode | undefined;
  return node ? getTstsNodeLocation(sourceFile, node) : undefined;
};

const adaptExtensionDiagnostic = (
  diagnostic: ExtensionDiagnostic
): Diagnostic =>
  createDiagnostic(
    diagnostic.code as DiagnosticCode,
    diagnostic.category === "error" ? "error" : "warning",
    diagnostic.message,
    extensionDiagnosticLocation(diagnostic)
  );

const isSuppressedByCapabilities = (
  program: TsonicProgram,
  diagnostic: Diagnostic
): boolean => {
  const capabilities = program.options.backendCapabilities;
  if (!capabilities) return false;
  if (
    diagnostic.code === "TSN5001" &&
    diagnostic.message.includes("Array.isArray") &&
    capabilities.get("broad-array-narrowing")?.status === "supported"
  ) {
    return true;
  }
  if (
    diagnostic.code === "TSN5001" &&
    diagnostic.message.includes("JSON.parse") &&
    capabilities.get("broad-json-targets")?.status === "supported"
  ) {
    return true;
  }
  if (
    diagnostic.code === "TSN5001" &&
    diagnostic.message.includes("JSON.stringify") &&
    capabilities.get("broad-json-stringify-source")?.status === "supported"
  ) {
    return true;
  }
  return false;
};

export const validateProgram = (
  program: TsonicProgram
): DiagnosticsCollector =>
  program.sourceProgram.diagnostics
    .map(adaptExtensionDiagnostic)
    .filter((diagnostic) => !isSuppressedByCapabilities(program, diagnostic))
    .reduce(
      (collector, diagnostic) => addDiagnostic(collector, diagnostic),
      createDiagnosticsCollector()
    );

export const validateSourceFile = (
  sourceFile: TstsSourceFile,
  program: TsonicProgram
): DiagnosticsCollector =>
  program.sourceProgram.diagnostics
    .filter((diagnostic) => diagnostic.sourceFile === sourceFile)
    .map(adaptExtensionDiagnostic)
    .reduce(
      (collector, diagnostic) => addDiagnostic(collector, diagnostic),
      createDiagnosticsCollector()
    );
