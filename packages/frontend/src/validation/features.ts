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

const PROMISE_CHAIN_METHODS = new Set(["then", "catch", "finally"]);

const isBuiltInPromiseSymbol = (symbol: ts.Symbol): boolean => {
  const name = symbol.getName();
  if (name !== "Promise" && name !== "PromiseLike") {
    return false;
  }

  const declarations = symbol.declarations ?? [];
  return declarations.some((decl) => {
    const fileName = decl.getSourceFile().fileName;
    const normalized = fileName.replace(/\\/g, "/");
    const baseName = normalized.slice(normalized.lastIndexOf("/") + 1);
    return baseName.startsWith("lib.");
  });
};

const isPromiseLikeType = (
  checker: ts.TypeChecker,
  type: ts.Type,
  visited: Set<ts.Type> = new Set()
): boolean => {
  if (visited.has(type)) return false;
  visited.add(type);

  if (type.isUnion() || type.isIntersection()) {
    return type.types.some((member) =>
      isPromiseLikeType(checker, member, visited)
    );
  }

  const symbol = type.getSymbol();
  if (symbol !== undefined && isBuiltInPromiseSymbol(symbol)) {
    return true;
  }

  const apparent = checker.getApparentType(type);
  if (apparent !== type && isPromiseLikeType(checker, apparent, visited)) {
    return true;
  }

  return false;
};

/**
 * Validate that unsupported features are not used
 */
export const validateUnsupportedFeatures = (
  sourceFile: ts.SourceFile,
  program: TsonicProgram,
  collector: DiagnosticsCollector
): DiagnosticsCollector => {
  const checker = program.checker;

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

    // Check for Promise-like `.then/.catch/.finally` chaining (not supported)
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression)
    ) {
      const methodName = node.expression.name.text;
      if (PROMISE_CHAIN_METHODS.has(methodName)) {
        const receiverType = checker.getTypeAtLocation(
          node.expression.expression
        );
        const isPromiseLike = isPromiseLikeType(checker, receiverType);
        if (isPromiseLike) {
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
    }

    ts.forEachChild(node, visitor);
  };

  visitor(sourceFile);
  return collector;
};
