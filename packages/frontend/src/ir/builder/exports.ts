/**
 * Export extraction from TypeScript source
 *
 * Phase 5 Step 4: Uses ProgramContext for statement/expression conversion.
 */

import * as ts from "typescript";
import { IrExport } from "../types.js";
import {
  convertStatement,
  flattenStatementResult,
} from "../statement-converter.js";
import { convertExpression } from "../expression-converter.js";
import { hasExportModifier, hasDefaultModifier } from "./helpers.js";
import type { Binding } from "../binding/index.js";
import type { ProgramContext } from "../program-context.js";

/**
 * Extract export declarations from source file.
 *
 * This function has two signatures:
 * - With just Binding: Used when only export metadata is needed (no statement conversion)
 * - With ProgramContext: Used when exported declarations need to be converted
 *
 * @param sourceFile - The TypeScript source file
 * @param binding - The binding layer (for simple export extraction without conversion)
 */
export const extractExports = (
  sourceFile: ts.SourceFile,
  _binding: Binding
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
    } else if (hasExportModifier(node)) {
      // For exported declarations, we need the full context to convert them
      // This is handled by extractExportsWithContext
      // Here we just record that there's an export, but don't convert
      // The actual conversion is done in extractStatements
    }
    ts.forEachChild(node, visitor);
  };

  visitor(sourceFile);
  return exports;
};

/**
 * Extract export declarations from source file with full conversion.
 *
 * @param sourceFile - The TypeScript source file
 * @param ctx - ProgramContext for full statement/expression conversion
 */
export const extractExportsWithContext = (
  sourceFile: ts.SourceFile,
  ctx: ProgramContext
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
        expression: convertExpression(node.expression, ctx, undefined),
      });
    } else if (hasExportModifier(node)) {
      const hasDefault = hasDefaultModifier(node);
      if (hasDefault) {
        // export default function/class/etc
        const result = convertStatement(node, ctx, undefined);
        const statements = flattenStatementResult(result);
        if (statements.length > 0) {
          exports.push({
            kind: "default",
            expression: {
              kind: "identifier",
              name: "_default",
            }, // placeholder for now
          });
        }
      } else {
        // regular export - may produce multiple statements (e.g., type aliases with synthetics)
        const result = convertStatement(node, ctx, undefined);
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
