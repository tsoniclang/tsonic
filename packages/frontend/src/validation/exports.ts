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
  const exportedNames = new Set<string>();

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
          const name = spec.name.text;
          if (exportedNames.has(name)) {
            collector = addDiagnostic(
              collector,
              createDiagnostic(
                "TSN1005",
                "error",
                `Duplicate export: "${name}"`,
                getNodeLocation(sourceFile, spec)
              )
            );
          }
          exportedNames.add(name);
        });
      }
    }

    if (ts.isVariableStatement(node) && hasExportModifier(node)) {
      node.declarationList.declarations.forEach((decl) => {
        if (ts.isIdentifier(decl.name)) {
          const name = decl.name.text;
          if (exportedNames.has(name)) {
            collector = addDiagnostic(
              collector,
              createDiagnostic(
                "TSN1005",
                "error",
                `Duplicate export: "${name}"`,
                getNodeLocation(sourceFile, decl)
              )
            );
          }
          exportedNames.add(name);
        }
      });
    }

    if (
      (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) &&
      hasExportModifier(node)
    ) {
      const name = node.name?.text;
      if (name) {
        if (exportedNames.has(name)) {
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
        exportedNames.add(name);
      }
    }

    ts.forEachChild(node, visitor);
  };

  visitor(sourceFile);
  return collector;
};
