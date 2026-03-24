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
  let currentCollector = collector;
  const visitor = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) {
      currentCollector = validateImportDeclaration(
        node,
        sourceFile,
        program,
        currentCollector
      );
      return;
    }

    if (ts.isImportTypeNode(node)) {
      // Supported: type-only imports are erased at runtime.
      return;
    }

    ts.forEachChild(node, visitor);
  };

  visitor(sourceFile);
  return currentCollector;
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
    {
      clrResolver: program.clrResolver,
      bindings: program.bindings,
      projectRoot: program.options.projectRoot,
      surface: program.options.surface,
      authoritativeTsonicPackageRoots: program.authoritativeTsonicPackageRoots,
    }
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
