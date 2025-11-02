/**
 * Import information extraction
 */

import * as ts from "typescript";
import { TsonicProgram } from "../../program.js";
import { Import } from "../../types/module.js";
import { resolveImport } from "../../resolver.js";

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
