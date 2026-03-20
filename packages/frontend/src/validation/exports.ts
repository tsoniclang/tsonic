/**
 * Export validation
 */

import * as ts from "typescript";
import { TsonicProgram } from "../program.js";
import {
  DiagnosticsCollector,
  addDiagnostic,
  createDiagnostic,
} from "../types/diagnostic.js";
import { hasExportModifier, getNodeLocation } from "./helpers.js";

/**
 * Validate exports (check for duplicates)
 */
export const validateExports = (
  sourceFile: ts.SourceFile,
  _program: TsonicProgram,
  collector: DiagnosticsCollector
): DiagnosticsCollector => {
  const exportedKinds = new Map<string, "function" | "other">();

  const recordExport = (
    name: string,
    kind: "function" | "other",
    node: ts.Node
  ): void => {
    const existingKind = exportedKinds.get(name);
    if (existingKind) {
      if (!(existingKind === "function" && kind === "function")) {
        collector = addDiagnostic(
          collector,
          createDiagnostic(
            "TSN1005",
            "error",
            `Duplicate export: "${name}"`,
            getNodeLocation(sourceFile, node)
          )
        );
      }
      return;
    }
    exportedKinds.set(name, kind);
  };

  const visitor = (node: ts.Node): void => {
    if (ts.isExportDeclaration(node) || ts.isExportAssignment(node)) {
      // Validate export syntax
      if (ts.isExportAssignment(node) && !node.isExportEquals) {
        // export default is allowed
      } else if (
        ts.isExportDeclaration(node) &&
        node.exportClause &&
        ts.isNamedExports(node.exportClause)
      ) {
        node.exportClause.elements.forEach((spec) => {
          recordExport(spec.name.text, "other", spec);
        });
      }
    }

    if (ts.isVariableStatement(node) && hasExportModifier(node)) {
      node.declarationList.declarations.forEach((decl) => {
        if (ts.isIdentifier(decl.name)) {
          recordExport(decl.name.text, "other", decl);
        }
      });
    }

    if (
      (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) &&
      hasExportModifier(node)
    ) {
      const name = node.name?.text;
      if (name) {
        recordExport(
          name,
          ts.isFunctionDeclaration(node) ? "function" : "other",
          node
        );
      }
    }

    ts.forEachChild(node, visitor);
  };

  visitor(sourceFile);
  return collector;
};
