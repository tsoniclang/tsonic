/**
 * Module information extraction from TypeScript source files
 */

import * as ts from "typescript";
import { TsonicProgram } from "../program.js";
import { ModuleInfo, Import, Export } from "../types/module.js";
import {
  resolveImport,
  getNamespaceFromPath,
  getClassNameFromPath,
} from "../resolver.js";
import { hasExportModifier, isTopLevelCode } from "./helpers.js";

/**
 * Extract module information from a TypeScript source file
 */
export const extractModuleInfo = (
  sourceFile: ts.SourceFile,
  program: TsonicProgram
): ModuleInfo => {
  const imports: Import[] = [];
  const exports: Export[] = [];
  let hasTopLevelCode = false;

  const visitor = (node: ts.Node): void => {
    // Extract imports
    if (ts.isImportDeclaration(node)) {
      const imp = extractImport(node, sourceFile, program);
      if (imp) {
        imports.push(imp);
      }
    }

    // Extract exports
    if (ts.isExportDeclaration(node)) {
      const exp = extractExport(node);
      if (exp) {
        exports.push(exp);
      }
    }

    if (ts.isExportAssignment(node)) {
      exports.push({
        kind: "default",
        localName: node.expression.getText(),
      });
    }

    // Check for exported declarations
    if (hasExportModifier(node)) {
      if (ts.isVariableStatement(node)) {
        node.declarationList.declarations.forEach((decl) => {
          if (ts.isIdentifier(decl.name)) {
            exports.push({
              kind: "named",
              name: decl.name.text,
              localName: decl.name.text,
            });
          }
        });
      } else if (
        (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) &&
        node.name
      ) {
        exports.push({
          kind: "named",
          name: node.name.text,
          localName: node.name.text,
        });
      }
    }

    // Check for top-level code (non-declaration statements)
    if (isTopLevelCode(node)) {
      hasTopLevelCode = true;
    }

    ts.forEachChild(node, visitor);
  };

  visitor(sourceFile);

  const namespace = getNamespaceFromPath(
    sourceFile.fileName,
    program.options.sourceRoot,
    program.options.rootNamespace
  );

  const className = getClassNameFromPath(sourceFile.fileName);

  return {
    filePath: sourceFile.fileName,
    sourceText: sourceFile.getFullText(),
    imports,
    exports,
    hasTopLevelCode,
    namespace,
    className,
  };
};

/**
 * Extract import information from an import declaration
 */
export const extractImport = (
  node: ts.ImportDeclaration,
  sourceFile: ts.SourceFile,
  program: TsonicProgram
): Import | null => {
  if (!ts.isStringLiteral(node.moduleSpecifier)) {
    return null;
  }

  const specifier = node.moduleSpecifier.text;
  const result = resolveImport(
    specifier,
    sourceFile.fileName,
    program.options.sourceRoot
  );

  const importedNames: { readonly name: string; readonly alias?: string }[] =
    [];

  if (node.importClause) {
    // Default import
    if (node.importClause.name) {
      importedNames.push({
        name: "default",
        alias: node.importClause.name.text,
      });
    }

    // Named imports
    if (node.importClause.namedBindings) {
      if (ts.isNamespaceImport(node.importClause.namedBindings)) {
        // import * as ns from "..."
        importedNames.push({
          name: "*",
          alias: node.importClause.namedBindings.name.text,
        });
      } else if (ts.isNamedImports(node.importClause.namedBindings)) {
        // import { a, b as c } from "..."
        node.importClause.namedBindings.elements.forEach((spec) => {
          importedNames.push({
            name: (spec.propertyName ?? spec.name).text,
            alias: spec.propertyName ? spec.name.text : undefined,
          });
        });
      }
    }
  }

  if (result.ok) {
    return {
      kind: result.value.isLocal
        ? "local"
        : result.value.isDotNet
          ? "dotnet"
          : "node_module",
      specifier,
      resolvedPath: result.value.resolvedPath || undefined,
      namespace: result.value.isDotNet ? specifier : undefined,
      importedNames,
    };
  }

  return {
    kind: "local",
    specifier,
    importedNames,
  };
};

/**
 * Extract export information from an export declaration
 */
export const extractExport = (node: ts.ExportDeclaration): Export | null => {
  if (
    !node.moduleSpecifier &&
    node.exportClause &&
    ts.isNamedExports(node.exportClause)
  ) {
    // export { a, b as c } - named exports without re-export
    const elements = Array.from(node.exportClause.elements);
    if (elements.length > 0 && elements[0]) {
      const spec = elements[0];
      return {
        kind: "named",
        name: spec.name.text,
        localName: (spec.propertyName ?? spec.name).text,
      };
    }
    return null;
  }

  if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
    // export { ... } from "..." - re-exports
    const fromModule = node.moduleSpecifier.text;
    const exportedNames: { readonly name: string; readonly alias?: string }[] =
      [];

    if (node.exportClause) {
      if (ts.isNamedExports(node.exportClause)) {
        Array.from(node.exportClause.elements).forEach((spec) => {
          exportedNames.push({
            name: (spec.propertyName ?? spec.name).text,
            alias: spec.propertyName ? spec.name.text : undefined,
          });
        });
      }
    }

    return {
      kind: "reexport",
      fromModule,
      exports: exportedNames,
    };
  }

  return null;
};
