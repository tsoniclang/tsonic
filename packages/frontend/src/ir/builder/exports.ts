/**
 * Export extraction from TypeScript source
 */

import * as ts from "typescript";
import { IrExport } from "../types.js";
import {
  convertStatement,
  flattenStatementResult,
} from "../statement-converter.js";
import { convertExpression } from "../expression-converter.js";
import { hasExportModifier, hasDefaultModifier } from "./helpers.js";

/**
 * Extract export declarations from source file
 */
export const extractExports = (
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker
): readonly IrExport[] => {
  const exports: IrExport[] = [];

  const visitor = (node: ts.Node): void => {
    if (ts.isExportDeclaration(node)) {
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        // Check if this is a re-export (has moduleSpecifier)
        if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
          // Re-export: export { x } from "./other.ts"
          const fromModule = node.moduleSpecifier.text;
          node.exportClause.elements.forEach((spec) => {
            exports.push({
              kind: "reexport",
              name: spec.name.text, // Exported name
              originalName: (spec.propertyName ?? spec.name).text, // Name in source module
              fromModule,
            });
          });
        } else {
          // Regular named export: export { x }
          node.exportClause.elements.forEach((spec) => {
            exports.push({
              kind: "named",
              name: spec.name.text,
              localName: (spec.propertyName ?? spec.name).text,
            });
          });
        }
      }
    } else if (ts.isExportAssignment(node)) {
      exports.push({
        kind: "default",
        expression: convertExpression(node.expression, checker),
      });
    } else if (hasExportModifier(node)) {
      const hasDefault = hasDefaultModifier(node);
      if (hasDefault) {
        // export default function/class/etc
        const result = convertStatement(node, checker);
        const statements = flattenStatementResult(result);
        if (statements.length > 0) {
          exports.push({
            kind: "default",
            expression: { kind: "identifier", name: "_default" }, // placeholder for now
          });
        }
      } else {
        // regular export - may produce multiple statements (e.g., type aliases with synthetics)
        const result = convertStatement(node, checker);
        const statements = flattenStatementResult(result);
        for (const stmt of statements) {
          exports.push({
            kind: "declaration",
            declaration: stmt,
          });
        }
      }
    }
    ts.forEachChild(node, visitor);
  };

  visitor(sourceFile);
  return exports;
};
