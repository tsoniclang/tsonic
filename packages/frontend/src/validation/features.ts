/**
 * Unsupported feature validation
 */

import * as ts from "typescript";
import { TsonicProgram } from "../program.js";
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
  return (
    ts.isPropertyAccessExpression(parent) &&
    parent.expression === node &&
    SUPPORTED_IMPORT_META_FIELDS.has(parent.name.text)
  );
};

const isDynamicImportCall = (node: ts.CallExpression): boolean =>
  node.expression.kind === ts.SyntaxKind.ImportKeyword;

const isSupportedDynamicImportUsage = (node: ts.CallExpression): boolean => {
  if (!isDynamicImportCall(node)) return false;
  if (node.arguments.length !== 1) return false;

  const [arg] = node.arguments;
  if (!arg) return false;
  const isStaticSpecifier =
    ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg);
  if (!isStaticSpecifier) return false;

  const awaitExpr = node.parent;
  if (!ts.isAwaitExpression(awaitExpr) || awaitExpr.expression !== node) {
    return false;
  }

  const statement = awaitExpr.parent;
  return ts.isExpressionStatement(statement) && statement.expression === awaitExpr;
};

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

    if (ts.isCallExpression(node) && isDynamicImportCall(node)) {
      if (isSupportedDynamicImportUsage(node)) {
        ts.forEachChild(node, visitor);
        return;
      }
      collector = addDiagnostic(
        collector,
        createDiagnostic(
          "TSN2001",
          "error",
          "Dynamic import() is only supported in side-effect form: await import(\"./module.js\");",
          getNodeLocation(sourceFile, node),
          "Use static imports, or use side-effect form with a static string literal specifier."
        )
      );
    }

    ts.forEachChild(node, visitor);
  };

  visitor(sourceFile);
  return collector;
};
