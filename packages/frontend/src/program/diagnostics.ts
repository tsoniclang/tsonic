/**
 * TypeScript diagnostics collection and conversion
 */

import * as ts from "typescript";
import {
  Diagnostic,
  DiagnosticsCollector,
  createDiagnosticsCollector,
  addDiagnostic,
  createDiagnostic,
} from "../types/diagnostic.js";

/**
 * Collect all TypeScript diagnostics from a program
 */
export const collectTsDiagnostics = (
  program: ts.Program
): DiagnosticsCollector => {
  const checker = program.getTypeChecker();
  const tsDiagnostics = [
    ...program.getConfigFileParsingDiagnostics(),
    ...program.getOptionsDiagnostics(),
    ...program.getSyntacticDiagnostics(),
    ...program.getGlobalDiagnostics(),
    ...program.getSemanticDiagnostics(),
  ];

  return tsDiagnostics.reduce((collector, tsDiag) => {
    const diagnostic = convertTsDiagnostic(tsDiag, checker);
    return diagnostic ? addDiagnostic(collector, diagnostic) : collector;
  }, createDiagnosticsCollector());
};

const findNodeAtPosition = (
  sourceFile: ts.SourceFile,
  position: number
): ts.Node | undefined => {
  const visit = (node: ts.Node): ts.Node | undefined => {
    if (position < node.getFullStart() || position >= node.getEnd()) {
      return undefined;
    }
    const child = ts.forEachChild(node, visit);
    return child ?? node;
  };
  return visit(sourceFile);
};

const isDictionaryLikeType = (
  checker: ts.TypeChecker,
  type: ts.Type
): boolean =>
  checker.getIndexTypeOfType(type, ts.IndexKind.String) !== undefined ||
  checker.getIndexTypeOfType(type, ts.IndexKind.Number) !== undefined;

const shouldIgnoreDictionaryPseudoMemberUnknownDiagnostic = (
  tsDiag: ts.Diagnostic,
  checker: ts.TypeChecker
): boolean => {
  if (tsDiag.code !== 18046 || !tsDiag.file || tsDiag.start === undefined) {
    return false;
  }

  const node = findNodeAtPosition(tsDiag.file, tsDiag.start);
  if (!node || !ts.isIdentifier(node)) return false;

  const symbol = checker.getSymbolAtLocation(node);
  if (!symbol) return false;

  return (symbol.declarations ?? []).some((decl) => {
    if (!ts.isVariableDeclaration(decl)) return false;
    const initializer = decl.initializer;
    if (!initializer || !ts.isPropertyAccessExpression(initializer)) {
      return false;
    }

    if (
      initializer.name.text !== "Keys" &&
      initializer.name.text !== "Values"
    ) {
      return false;
    }

    const receiverType = checker.getTypeAtLocation(initializer.expression);
    return isDictionaryLikeType(checker, receiverType);
  });
};

/**
 * Convert TypeScript diagnostic to Tsonic diagnostic
 */
export const convertTsDiagnostic = (
  tsDiag: ts.Diagnostic,
  checker?: ts.TypeChecker
): Diagnostic | null => {
  if (tsDiag.category === ts.DiagnosticCategory.Suggestion) {
    return null; // Ignore suggestions
  }

  const message = ts.flattenDiagnosticMessageText(tsDiag.messageText, "\n");

  // Ignore "type used as value" errors for .NET types
  // These are handled by the Tsonic compiler
  if (
    message.includes("only refers to a type, but is being used as a value") &&
    tsDiag.file
  ) {
    // Check if this is a .NET import
    const sourceText = tsDiag.file.getText();
    if (
      sourceText.includes('from "System') ||
      sourceText.includes('from "Microsoft') ||
      sourceText.includes('from "Windows')
    ) {
      return null; // Ignore - will be handled by Tsonic
    }
  }

  // Dictionary pseudo-members (`Record<K,V>.Keys` / `.Values`) are modeled
  // by Tsonic. TS can type these as `unknown` (TS18046) because Record has a
  // string index signature. Ignore only this targeted pattern.
  if (
    checker &&
    shouldIgnoreDictionaryPseudoMemberUnknownDiagnostic(tsDiag, checker)
  ) {
    return null;
  }

  const severity =
    tsDiag.category === ts.DiagnosticCategory.Error
      ? "error"
      : tsDiag.category === ts.DiagnosticCategory.Warning
        ? "warning"
        : "info";

  const location =
    tsDiag.file && tsDiag.start !== undefined
      ? getSourceLocation(tsDiag.file, tsDiag.start, tsDiag.length ?? 1)
      : undefined;

  return createDiagnostic(
    "TSN2001", // Generic TypeScript error
    severity,
    message,
    location
  );
};

/**
 * Get source location information from TypeScript source file
 */
export const getSourceLocation = (
  file: ts.SourceFile,
  start: number,
  length: number
): {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly length: number;
} => {
  const { line, character } = file.getLineAndCharacterOfPosition(start);
  return {
    file: file.fileName,
    line: line + 1,
    column: character + 1,
    length,
  };
};
