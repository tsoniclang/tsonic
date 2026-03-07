/**
 * Unsupported feature validation
 */

import * as ts from "typescript";
import { TsonicProgram } from "../program.js";
import { isSupportedDynamicImportSideEffect } from "../resolver/dynamic-import.js";
import {
  DiagnosticsCollector,
  addDiagnostic,
  createDiagnostic,
} from "../types/diagnostic.js";
import { getNodeLocation } from "./helpers.js";

const SUPPORTED_IMPORT_META_FIELDS = new Set(["url", "filename", "dirname"]);

const isSupportedImportMetaUsage = (node: ts.MetaProperty): boolean => {
  if (
    node.keywordToken !== ts.SyntaxKind.ImportKeyword ||
    node.name.text !== "meta"
  ) {
    return false;
  }

  const parent = node.parent;
  if (ts.isPropertyAccessExpression(parent) && parent.expression === node) {
    return SUPPORTED_IMPORT_META_FIELDS.has(parent.name.text);
  }

  return !ts.isElementAccessExpression(parent);
};

const isDynamicImportCall = (node: ts.CallExpression): boolean =>
  node.expression.kind === ts.SyntaxKind.ImportKeyword;

/**
 * Validate that unsupported features are not used
 */
export const validateUnsupportedFeatures = (
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
          "'with' statement is not supported in strict AOT mode",
          getNodeLocation(sourceFile, node)
        )
      );
    }

    if (ts.isMetaProperty(node) && !isSupportedImportMetaUsage(node)) {
      collector = addDiagnostic(
        collector,
        createDiagnostic(
          "TSN2001",
          "error",
          "Meta properties (import.meta) not supported in this form",
          getNodeLocation(sourceFile, node)
        )
      );
    }

    if (
      ts.isCallExpression(node) &&
      isDynamicImportCall(node) &&
      !isSupportedDynamicImportSideEffect(node)
    ) {
      collector = addDiagnostic(
        collector,
        createDiagnostic(
          "TSN2001",
          "error",
          'Dynamic import() is only supported as `await import("./local-module.js")` in side-effect position',
          getNodeLocation(sourceFile, node),
          'Use static import declarations, or use `await import("./local-module.js")` as a standalone statement.'
        )
      );
    }

    ts.forEachChild(node, visitor);
  };

  visitor(sourceFile);
  return collector;
};
