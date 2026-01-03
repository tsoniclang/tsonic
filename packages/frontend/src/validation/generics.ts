/**
 * Generic type validation
 */

import * as ts from "typescript";
import { TsonicProgram } from "../program.js";
import {
  DiagnosticsCollector,
  addDiagnostic,
} from "../types/diagnostic.js";
import { checkForSymbolIndexSignature } from "../ir/generic-validator.js";

/**
 * Validate generic types and constraints
 */
export const validateGenerics = (
  sourceFile: ts.SourceFile,
  _program: TsonicProgram,
  collector: DiagnosticsCollector
): DiagnosticsCollector => {
  // Debug: log when validation runs
  if (process.env.DEBUG_GENERICS) {
    console.log(`[validateGenerics] Checking: ${sourceFile.fileName}`);
  }

  const visitor = (node: ts.Node): void => {
    // Only check for truly unsupported features (no static C# mapping)
    // Symbol index signatures - TSN7203
    if (ts.isIndexSignatureDeclaration(node)) {
      const symbolDiag = checkForSymbolIndexSignature(node, sourceFile);
      if (symbolDiag) {
        collector = addDiagnostic(collector, symbolDiag);
      }
    }

    // Explicitly visit interface and type literal members
    if (ts.isInterfaceDeclaration(node) || ts.isTypeLiteralNode(node)) {
      for (const member of node.members) {
        visitor(member);
      }
    }

    ts.forEachChild(node, visitor);
  };

  visitor(sourceFile);
  return collector;
};
