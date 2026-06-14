/**
 * Export validation.
 *
 * TSTS owns export discovery. Tsonic validates product policy over the TSTS
 * module graph.
 */

import type { TstsSourceFile } from "@tsonic/tsts";
import { TstsSyntax } from "@tsonic/tsts";
import { TsonicProgram } from "../program.js";
import {
  DiagnosticsCollector,
  addDiagnostic,
  createDiagnostic,
} from "../types/diagnostic.js";
import { getNodeLocation } from "./helpers.js";

/**
 * Validate exports by checking duplicate exported names.
 */
export const validateExports = (
  sourceFile: TstsSourceFile,
  program: TsonicProgram,
  collector: DiagnosticsCollector
): DiagnosticsCollector => {
  let currentCollector = collector;
  const exportedKinds = new Map<string, "function" | "other">();
  const module = program.sourceProgram.moduleGraph.getSourceFileModule(sourceFile);
  if (!module) {
    return currentCollector;
  }

  for (const binding of module.exports) {
    const exportedName =
      binding.exportedName ??
      (binding.kind === "default" || binding.kind === "export-equals"
        ? "default"
        : undefined);
    if (!exportedName) {
      continue;
    }

    const kind =
      TstsSyntax.IsFunctionDeclaration(binding.bindingNode) ||
      TstsSyntax.IsFunctionDeclaration(binding.exportNode)
        ? "function"
        : "other";
    const existingKind = exportedKinds.get(exportedName);
    if (existingKind) {
      if (!(existingKind === "function" && kind === "function")) {
        currentCollector = addDiagnostic(
          currentCollector,
          createDiagnostic(
            "TSN1005",
            "error",
            `Duplicate export: "${exportedName}"`,
            getNodeLocation(
              sourceFile,
              binding.bindingNode ?? binding.exportNode ?? sourceFile
            )
          )
        );
      }
      continue;
    }

    exportedKinds.set(exportedName, kind);
  }

  return currentCollector;
};
