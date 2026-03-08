/**
 * Unsupported feature validation
 */

import * as ts from "typescript";
import { TsonicProgram } from "../program.js";
import {
  getDynamicImportLiteralSpecifier,
  isClosedWorldDynamicImportSpecifier,
  isSideEffectOnlyDynamicImport,
  resolveDynamicImportNamespace,
} from "../resolver/dynamic-import.js";
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
  program: TsonicProgram,
  collector: DiagnosticsCollector
): DiagnosticsCollector => {
  const sourceFilesByPath = new Map<string, ts.SourceFile>(
    program.sourceFiles.map((currentSourceFile) => [
      currentSourceFile.fileName.replace(/\\/g, "/"),
      currentSourceFile,
    ])
  );

  const getDynamicImportSupportFailure = (
    node: ts.CallExpression
  ): string | undefined => {
    const specifier = getDynamicImportLiteralSpecifier(node);
    if (!specifier) {
      return "Dynamic import() is only supported for string-literal specifiers.";
    }

    if (!isClosedWorldDynamicImportSpecifier(specifier)) {
      return "Dynamic import() is only supported for closed-world local specifiers ('./' or '../').";
    }

    if (isSideEffectOnlyDynamicImport(node)) {
      return undefined;
    }

    if (ts.isExpressionStatement(node.parent)) {
      return 'Dynamic import() in bare side-effect position must be written as `await import("./local-module.js")`.';
    }

    const resolution = resolveDynamicImportNamespace(
      node,
      sourceFile.fileName,
      {
        checker: program.checker,
        compilerOptions: program.program.getCompilerOptions(),
        sourceFilesByPath,
      }
    );

    return resolution.ok ? undefined : resolution.reason;
  };

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
      getDynamicImportSupportFailure(node) !== undefined
    ) {
      const message =
        getDynamicImportSupportFailure(node) ??
        "Dynamic import() is only supported for deterministic closed-world local modules.";
      collector = addDiagnostic(
        collector,
        createDiagnostic(
          "TSN2001",
          "error",
          message,
          getNodeLocation(sourceFile, node),
          "Use static import declarations, or restrict dynamic import() to deterministic closed-world local modules."
        )
      );
    }

    ts.forEachChild(node, visitor);
  };

  visitor(sourceFile);
  return collector;
};
