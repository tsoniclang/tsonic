/**
 * Variable declaration helpers
 *
 * Utility predicates and type derivation helpers used by the variable
 * declaration converter:
 * - isModuleLevelVariable: Check if a variable is at module level
 * - isBindingPattern: Check if a declaration uses destructuring
 * - getExpectedTypeForInitializer: Derive expected type from annotation
 */

import * as ts from "typescript";
import type { IrType } from "../../../types.js";
import type { ProgramContext } from "../../../program-context.js";

/**
 * Check if a variable statement is at module level (not inside a function).
 * Module-level variables become static fields in C# and need explicit types.
 */
export const isModuleLevelVariable = (node: ts.VariableStatement): boolean => {
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
export const isBindingPattern = (decl: ts.VariableDeclaration): boolean => {
  return (
    ts.isArrayBindingPattern(decl.name) || ts.isObjectBindingPattern(decl.name)
  );
};

/**
 * Get the expected type for initializer conversion (only from explicit annotations).
 * This is used for deterministic contextual typing - only explicit annotations
 * should influence literal type inference.
 */
export const getExpectedTypeForInitializer = (
  decl: ts.VariableDeclaration,
  ctx: ProgramContext
): IrType | undefined => {
  // Only use explicit type annotation as expectedType
  // Inferred types should NOT influence literal typing
  if (decl.type) {
    // Convert declaration syntax through the TypeSystem.
    return ctx.typeSystem.typeFromSyntax(
      ctx.binding.captureTypeSyntax(decl.type)
    );
  }
  return undefined;
};
