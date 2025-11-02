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
          "'with' statement not supported",
          getNodeLocation(sourceFile, node)
        )
      );
    }

    if (ts.isMetaProperty(node)) {
      collector = addDiagnostic(
        collector,
        createDiagnostic(
          "TSN2001",
          "error",
          "Meta properties (import.meta) not supported",
          getNodeLocation(sourceFile, node)
        )
      );
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      collector = addDiagnostic(
        collector,
        createDiagnostic(
          "TSN2001",
          "error",
          "Dynamic import() not supported",
          getNodeLocation(sourceFile, node),
          "Use static imports"
        )
      );
    }

    // Check for Promise.then/catch/finally chaining (not supported)
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression)
    ) {
      const methodName = node.expression.name.text;
      if (["then", "catch", "finally"].includes(methodName)) {
        collector = addDiagnostic(
          collector,
          createDiagnostic(
            "TSN3011",
            "error",
            `Promise.${methodName}() is not supported`,
            getNodeLocation(sourceFile, node),
            "Use async/await instead of Promise chaining"
          )
        );
      }
    }

    ts.forEachChild(node, visitor);
  };

  visitor(sourceFile);
  return collector;
};
