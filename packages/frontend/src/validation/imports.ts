/**
 * Import validation
 */

import * as ts from "typescript";
import * as fs from "node:fs";
import { TsonicProgram } from "../program.js";
import {
  DiagnosticsCollector,
  addDiagnostic,
  createDiagnostic,
} from "../types/diagnostic.js";
import { resolveImport } from "../resolver.js";
import { getNodeLocation } from "./helpers.js";

const hasDefaultModifier = (node: ts.Node): boolean => {
  if (!ts.canHaveModifiers(node)) {
    return false;
  }
  const modifiers = ts.getModifiers(node);
  return (
    modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword
    ) ?? false
  );
};

const moduleHasExplicitDefaultExport = (resolvedPath: string): boolean => {
  if (resolvedPath.length === 0 || !fs.existsSync(resolvedPath)) {
    return false;
  }

  const sourceText = fs.readFileSync(resolvedPath, "utf8");
  const sourceFile = ts.createSourceFile(
    resolvedPath,
    sourceText,
    ts.ScriptTarget.Latest,
    false,
    resolvedPath.endsWith(".d.ts") ? ts.ScriptKind.TS : ts.ScriptKind.TS
  );

  for (const statement of sourceFile.statements) {
    if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
      return true;
    }

    if (hasDefaultModifier(statement)) {
      return true;
    }

    if (
      ts.isExportDeclaration(statement) &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause) &&
      statement.exportClause.elements.some(
        (element) => element.name.text === "default"
      )
    ) {
      return true;
    }
  }

  return false;
};

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
      declarationModuleAliases: program.declarationModuleAliases,
    }
  );

  if (!result.ok) {
    const location = getNodeLocation(sourceFile, node.moduleSpecifier);
    return addDiagnostic(collector, { ...result.error, location });
  }

  if (node.importClause?.name) {
    const resolvedPath = result.value.resolvedPath;
    if (!moduleHasExplicitDefaultExport(resolvedPath)) {
      return addDiagnostic(
        collector,
        createDiagnostic(
          "TSN2002",
          "error",
          `Default import requires an explicit default export: "${importPath}"`,
          getNodeLocation(sourceFile, node.importClause),
          "Use a namespace import, a named import, or add `export default` to the source module"
        )
      );
    }
  }

  return collector;
};
