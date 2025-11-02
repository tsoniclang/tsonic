/**
 * Import extraction from TypeScript source
 */

import * as ts from "typescript";
import { IrImport, IrImportSpecifier } from "../types.js";

/**
 * Extract import declarations from source file
 */
export const extractImports = (
  sourceFile: ts.SourceFile
): readonly IrImport[] => {
  const imports: IrImport[] = [];

  const visitor = (node: ts.Node): void => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const source = node.moduleSpecifier.text;
      const isLocal = source.startsWith(".") || source.startsWith("/");
      const isDotNet =
        !isLocal && !source.includes("/") && /^[A-Z]/.test(source);
      const specifiers = extractImportSpecifiers(node);

      imports.push({
        kind: "import",
        source,
        isLocal,
        isDotNet,
        specifiers,
        resolvedNamespace: isDotNet ? source : undefined,
      });
    }
    ts.forEachChild(node, visitor);
  };

  visitor(sourceFile);
  return imports;
};

/**
 * Extract import specifiers from an import declaration
 */
export const extractImportSpecifiers = (
  node: ts.ImportDeclaration
): readonly IrImportSpecifier[] => {
  const specifiers: IrImportSpecifier[] = [];

  if (node.importClause) {
    // Default import
    if (node.importClause.name) {
      specifiers.push({
        kind: "default",
        localName: node.importClause.name.text,
      });
    }

    // Named or namespace imports
    if (node.importClause.namedBindings) {
      if (ts.isNamespaceImport(node.importClause.namedBindings)) {
        specifiers.push({
          kind: "namespace",
          localName: node.importClause.namedBindings.name.text,
        });
      } else if (ts.isNamedImports(node.importClause.namedBindings)) {
        node.importClause.namedBindings.elements.forEach((spec) => {
          specifiers.push({
            kind: "named",
            name: (spec.propertyName ?? spec.name).text,
            localName: spec.name.text,
          });
        });
      }
    }
  }

  return specifiers;
};
