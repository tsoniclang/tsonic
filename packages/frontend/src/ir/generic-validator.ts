/**
 * Generic validation - detect unsupported generic patterns and emit diagnostics
 */

import * as ts from "typescript";
import { Diagnostic, createDiagnostic, SourceLocation } from "../types/diagnostic.js";

/**
 * Get source location from TypeScript node
 */
const getLocation = (
  node: ts.Node,
  sourceFile: ts.SourceFile
): SourceLocation => {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  return {
    file: sourceFile.fileName,
    line: line + 1,
    column: character + 1,
    length: node.getWidth(),
  };
};

/**
 * Check for conditional types with infer keyword (TSN7102)
 */
export const checkForInferKeyword = (
  node: ts.Node,
  sourceFile: ts.SourceFile
): Diagnostic | null => {
  if (ts.isConditionalTypeNode(node)) {
    // Check if the true/false types contain infer
    const hasInfer = (type: ts.TypeNode): boolean => {
      if (ts.isInferTypeNode(type)) return true;
      let found = false;
      ts.forEachChild(type, (child) => {
        if (ts.isTypeNode(child) && hasInfer(child)) {
          found = true;
        }
      });
      return found;
    };

    if (hasInfer(node.trueType) || hasInfer(node.falseType)) {
      return createDiagnostic(
        "TSN7102",
        "error",
        "Conditional types using infer are not supported",
        getLocation(node, sourceFile),
        "Consider using explicit type parameters instead of infer"
      );
    }
  }
  return null;
};

/**
 * Check for recursive mapped types (TSN7101)
 */
export const checkForRecursiveMappedType = (
  node: ts.TypeAliasDeclaration,
  sourceFile: ts.SourceFile
): Diagnostic | null => {
  if (!ts.isMappedTypeNode(node.type)) {
    return null;
  }

  // Simple check: if the mapped type references itself
  const typeName = node.name.text;
  let isRecursive = false;

  const checkRecursion = (n: ts.Node): void => {
    if (ts.isTypeReferenceNode(n) && ts.isIdentifier(n.typeName)) {
      if (n.typeName.text === typeName) {
        isRecursive = true;
      }
    }
    ts.forEachChild(n, checkRecursion);
  };

  checkRecursion(node.type);

  if (isRecursive) {
    return createDiagnostic(
      "TSN7101",
      "error",
      "Recursive mapped types are not supported",
      getLocation(node, sourceFile),
      "Refactor to use explicit type definitions instead of recursion"
    );
  }

  return null;
};

/**
 * Check for `this` typing in generics (TSN7103)
 */
export const checkForThisType = (
  node: ts.Node,
  sourceFile: ts.SourceFile
): Diagnostic | null => {
  if (ts.isTypeReferenceNode(node) && node.typeName.getText() === "this") {
    return createDiagnostic(
      "TSN7103",
      "error",
      "`this` typing is not supported; refactor to explicit type parameters",
      getLocation(node, sourceFile),
      "Use a generic type parameter instead of `this`"
    );
  }
  return null;
};

/**
 * Check for variadic type parameters (TSN7104/TSN7204)
 */
export const checkForVariadicTypeParameter = (
  typeParam: ts.TypeParameterDeclaration,
  sourceFile: ts.SourceFile
): Diagnostic | null => {
  if (!typeParam.constraint) {
    return null;
  }

  // Check if constraint is unknown[] or any[] (indicates variadic)
  if (ts.isArrayTypeNode(typeParam.constraint)) {
    const elementType = typeParam.constraint.elementType;
    if (
      ts.isTypeReferenceNode(elementType) &&
      ts.isIdentifier(elementType.typeName)
    ) {
      const name = elementType.typeName.text;
      if (name === "unknown" || name === "any") {
        return createDiagnostic(
          "TSN7104",
          "error",
          "Variadic type parameters are not supported",
          getLocation(typeParam, sourceFile),
          "Use fixed-length tuple types or refactor to avoid variadic generics"
        );
      }
    }
  }

  return null;
};

/**
 * Check for symbol index signatures (TSN7203)
 */
export const checkForSymbolIndexSignature = (
  node: ts.IndexSignatureDeclaration,
  sourceFile: ts.SourceFile
): Diagnostic | null => {
  // Check if the parameter type is symbol
  if (node.parameters.length > 0) {
    const param = node.parameters[0];
    if (param && param.type && ts.isTypeReferenceNode(param.type)) {
      if (
        ts.isIdentifier(param.type.typeName) &&
        param.type.typeName.text === "symbol"
      ) {
        return createDiagnostic(
          "TSN7203",
          "error",
          "Symbol keys are not supported in C#",
          getLocation(node, sourceFile),
          "Use string keys instead of symbol keys"
        );
      }
    }
  }

  return null;
};

/**
 * Check for recursive structural aliases (TSN7201)
 */
export const checkForRecursiveStructuralAlias = (
  node: ts.TypeAliasDeclaration,
  sourceFile: ts.SourceFile
): Diagnostic | null => {
  if (!ts.isTypeLiteralNode(node.type)) {
    return null;
  }

  const typeName = node.name.text;
  let isRecursive = false;

  const checkRecursion = (n: ts.Node): void => {
    if (ts.isTypeReferenceNode(n) && ts.isIdentifier(n.typeName)) {
      if (n.typeName.text === typeName) {
        isRecursive = true;
      }
    }
    ts.forEachChild(n, checkRecursion);
  };

  checkRecursion(node.type);

  if (isRecursive) {
    return createDiagnostic(
      "TSN7201",
      "error",
      "Recursive structural alias not supported",
      getLocation(node, sourceFile),
      "Add a base case or use nominal types instead"
    );
  }

  return null;
};
