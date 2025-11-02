/**
 * Export information extraction
 */

import * as ts from "typescript";
import { Export } from "../../types/module.js";

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
