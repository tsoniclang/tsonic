/**
 * ESM and TypeScript validation rules
 */

import * as ts from "typescript";
import { TsonicProgram } from "./program.js";
import {
  DiagnosticsCollector,
  createDiagnosticsCollector,
  addDiagnostic,
  createDiagnostic,
} from "./types/diagnostic.js";
import { resolveImport } from "./resolver.js";

export const validateProgram = (
  program: TsonicProgram
): DiagnosticsCollector => {
  const collector = createDiagnosticsCollector();

  return program.sourceFiles.reduce(
    (acc, sourceFile) => validateSourceFile(sourceFile, program, acc),
    collector
  );
};

const validateSourceFile = (
  sourceFile: ts.SourceFile,
  program: TsonicProgram,
  collector: DiagnosticsCollector
): DiagnosticsCollector => {
  const validationFns = [
    validateImports,
    validateExports,
    validateUnsupportedFeatures,
  ];

  return validationFns.reduce(
    (acc, fn) => fn(sourceFile, program, acc),
    collector
  );
};

const validateImports = (
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

const validateImportDeclaration = (
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
    program.options.sourceRoot
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

const validateExports = (
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

const validateUnsupportedFeatures = (
  sourceFile: ts.SourceFile,
  _program: TsonicProgram,
  collector: DiagnosticsCollector
): DiagnosticsCollector => {
  const visitor = (node: ts.Node): void => {
    // Check for features we don't support yet
    if (ts.isWithStatement(node)) {
      collector = addDiagnostic(
        collector,
        createDiagnostic(
          "TSN2001",
          "error",
          "'with' statement not supported",
          getNodeLocation(sourceFile, node)
        )
      );
    }

    if (ts.isMetaProperty(node)) {
      collector = addDiagnostic(
        collector,
        createDiagnostic(
          "TSN2001",
          "error",
          "Meta properties (import.meta) not supported",
          getNodeLocation(sourceFile, node)
        )
      );
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      collector = addDiagnostic(
        collector,
        createDiagnostic(
          "TSN2001",
          "error",
          "Dynamic import() not supported",
          getNodeLocation(sourceFile, node),
          "Use static imports"
        )
      );
    }

    ts.forEachChild(node, visitor);
  };

  visitor(sourceFile);
  return collector;
};

const hasExportModifier = (node: ts.Node): boolean => {
  if (!ts.canHaveModifiers(node)) {
    return false;
  }
  const modifiers = ts.getModifiers(node);
  return (
    modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false
  );
};

const getNodeLocation = (
  sourceFile: ts.SourceFile,
  node: ts.Node
): {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly length: number;
} => {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(
    node.getStart()
  );
  return {
    file: sourceFile.fileName,
    line: line + 1,
    column: character + 1,
    length: node.getWidth(),
  };
};
