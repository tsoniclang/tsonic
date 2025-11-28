/**
 * Import validation
 */

import * as ts from "typescript";
import { TsonicProgram } from "../program.js";
import {
  DiagnosticsCollector,
  addDiagnostic,
  createDiagnostic,
} from "../types/diagnostic.js";
import { resolveImport } from "../resolver.js";
import { getNodeLocation } from "./helpers.js";

/**
 * Validate all imports in a source file
 */
export const validateImports = (
  sourceFile: ts.SourceFile,
  program: TsonicProgram,
  collector: DiagnosticsCollector
): DiagnosticsCollector => {
  const visitor = (node: ts.Node): DiagnosticsCollector => {
    if (ts.isImportDeclaration(node)) {
      return validateImportDeclaration(node, sourceFile, program, collector);
    }

    if (ts.isImportTypeNode(node)) {
      return addDiagnostic(
        collector,
        createDiagnostic(
          "TSN2001",
          "error",
          "Import type syntax not supported",
          getNodeLocation(sourceFile, node),
          "Use regular imports instead"
        )
      );
    }

    return ts.forEachChild(node, visitor) ?? collector;
  };

  return visitor(sourceFile);
};

/**
 * Validate a specific import declaration
 */
export const validateImportDeclaration = (
  node: ts.ImportDeclaration,
  sourceFile: ts.SourceFile,
  program: TsonicProgram,
  collector: DiagnosticsCollector
): DiagnosticsCollector => {
  if (!ts.isStringLiteral(node.moduleSpecifier)) {
    return addDiagnostic(
      collector,
      createDiagnostic(
        "TSN2001",
        "error",
        "Dynamic imports not supported",
        getNodeLocation(sourceFile, node),
        "Use static import statements"
      )
    );
  }

  const importPath = node.moduleSpecifier.text;
  const result = resolveImport(
    importPath,
    sourceFile.fileName,
    program.options.sourceRoot,
    program.dotnetResolver
  );

  if (!result.ok) {
    const location = getNodeLocation(sourceFile, node.moduleSpecifier);
    return addDiagnostic(collector, { ...result.error, location });
  }

  // Check for default imports from local modules (we might want to restrict this)
  if (result.value.isLocal && node.importClause?.name) {
    return addDiagnostic(
      collector,
      createDiagnostic(
        "TSN2001",
        "warning",
        "Default imports from local modules may not work as expected",
        getNodeLocation(sourceFile, node.importClause),
        "Consider using named imports"
      )
    );
  }

  return collector;
};
