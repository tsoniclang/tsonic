/**
 * Variable declaration converter
 */

import * as ts from "typescript";
import { IrVariableDeclaration } from "../../../types.js";
import { convertExpression } from "../../../expression-converter.js";
import {
  convertType,
  convertBindingName,
  inferType,
} from "../../../type-converter.js";
import { hasExportModifier } from "../helpers.js";

/**
 * Check if a variable statement is at module level (not inside a function).
 * Module-level variables become static fields in C# and need explicit types.
 */
const isModuleLevelVariable = (node: ts.VariableStatement): boolean => {
  // Walk up the parent chain to check if we're inside a function/method
  let current: ts.Node = node;
  while (current.parent) {
    current = current.parent;
    // If we hit a function-like node, we're not at module level
    if (
      ts.isFunctionDeclaration(current) ||
      ts.isFunctionExpression(current) ||
      ts.isArrowFunction(current) ||
      ts.isMethodDeclaration(current) ||
      ts.isConstructorDeclaration(current) ||
      ts.isGetAccessorDeclaration(current) ||
      ts.isSetAccessorDeclaration(current)
    ) {
      return false;
    }
    // If we hit the source file, we're at module level
    if (ts.isSourceFile(current)) {
      return true;
    }
  }
  return false;
};

/**
 * Check if a variable declaration has a binding pattern (destructuring).
 * Binding patterns include array patterns ([a, b]) and object patterns ({x, y}).
 */
const isBindingPattern = (decl: ts.VariableDeclaration): boolean => {
  return (
    ts.isArrayBindingPattern(decl.name) || ts.isObjectBindingPattern(decl.name)
  );
};

/**
 * Get the IR type for a variable declaration.
 * Uses explicit annotation if present, otherwise infers from TypeChecker.
 *
 * For binding patterns (destructuring), we infer from the initializer's type,
 * not from the declaration itself (which returns a tuple or any).
 */
const getDeclarationType = (
  decl: ts.VariableDeclaration,
  checker: ts.TypeChecker,
  needsExplicitType: boolean
) => {
  // If there's an explicit type annotation, use it
  if (decl.type) {
    return convertType(decl.type, checker);
  }
  // If we need an explicit type (for module-level variables), infer it
  // EXCEPT for binding patterns - destructuring gets its type from the initializer's
  // literal-form inference, not from an expected type
  if (needsExplicitType && !isBindingPattern(decl)) {
    return inferType(decl, checker);
  }
  return undefined;
};

/**
 * Convert variable statement
 *
 * Passes the LHS type annotation (if present) to the initializer conversion
 * for deterministic contextual typing. This ensures that:
 * - `const a: number[] = [1,2,3]` produces `double[]` not `int[]`
 * - `const x: int = 5` produces `int` not `double`
 *
 * For module-level variables (without explicit annotation), we infer the type
 * from TypeScript and pass it as expectedType to ensure consistent typing
 * between the variable declaration and its initializer.
 */
export const convertVariableStatement = (
  node: ts.VariableStatement,
  checker: ts.TypeChecker
): IrVariableDeclaration => {
  const isConst = !!(node.declarationList.flags & ts.NodeFlags.Const);
  const isLet = !!(node.declarationList.flags & ts.NodeFlags.Let);
  const declarationKind = isConst ? "const" : isLet ? "let" : "var";
  const isExported = hasExportModifier(node);

  // Module-level variables need explicit types in C# (they become static fields)
  const isModuleLevel = isModuleLevelVariable(node);
  const needsExplicitType = isExported || isModuleLevel;

  return {
    kind: "variableDeclaration",
    declarationKind,
    declarations: node.declarationList.declarations.map((decl) => {
      // Get the declared type from LHS annotation or inferred type for module-level
      const declaredType = getDeclarationType(decl, checker, needsExplicitType);

      return {
        kind: "variableDeclarator",
        name: convertBindingName(decl.name),
        type: declaredType,
        // Pass declared type as expectedType for deterministic contextual typing
        initializer: decl.initializer
          ? convertExpression(decl.initializer, checker, declaredType)
          : undefined,
      };
    }),
    isExported,
  };
};
