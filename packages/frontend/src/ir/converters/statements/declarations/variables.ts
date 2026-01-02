/**
 * Variable declaration converter
 */

import * as ts from "typescript";
import { IrVariableDeclaration, IrExpression, IrType } from "../../../types.js";
import { convertExpression } from "../../../expression-converter.js";
import { convertBindingName } from "../../../syntax/binding-patterns.js";
import { getTypeSystem } from "./registry.js";
import { hasExportModifier } from "../helpers.js";
import type { Binding } from "../../../binding/index.js";

/**
 * Derive the type from a converted IR expression using deterministic rules.
 * NO TYPESCRIPT FALLBACK - types must be derivable from IR or undefined.
 *
 * DETERMINISTIC TYPING RULES:
 * - Literals → use inferredType (already set deterministically in literals.ts)
 * - Arrays → derive from element inferredType
 * - Call/New expressions → use inferredType (has numeric recovery)
 * - Identifiers → use inferredType
 * - Other → use inferredType if available, otherwise undefined
 */
const deriveTypeFromExpression = (expr: IrExpression): IrType | undefined => {
  // For literals, the inferredType is already set deterministically
  if (expr.kind === "literal") {
    return expr.inferredType;
  }

  // For arrays, derive from first element's type or array's inferredType
  if (expr.kind === "array") {
    if (expr.inferredType) {
      return expr.inferredType;
    }
    // Try to derive from first element
    if (expr.elements.length > 0) {
      const firstElement = expr.elements[0];
      if (firstElement) {
        const elementType = deriveTypeFromExpression(firstElement);
        if (elementType) {
          return { kind: "arrayType", elementType };
        }
      }
    }
    return undefined;
  }

  // For all other expressions, use their inferredType if available
  // This includes call, new, identifier, member access, etc.
  if ("inferredType" in expr && expr.inferredType) {
    return expr.inferredType;
  }

  // Cannot determine type - return undefined (no TypeScript fallback)
  return undefined;
};

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
 * Get the expected type for initializer conversion (only from explicit annotations).
 * This is used for deterministic contextual typing - only explicit annotations
 * should influence literal type inference.
 */
const getExpectedTypeForInitializer = (
  decl: ts.VariableDeclaration,
  binding: Binding
) => {
  // Only use explicit type annotation as expectedType
  // Inferred types should NOT influence literal typing
  if (decl.type) {
    // PHASE 4 (Alice's spec): Use captureTypeSyntax + typeFromSyntax
    const typeSystem = getTypeSystem();
    return typeSystem
      ? typeSystem.typeFromSyntax(binding.captureTypeSyntax(decl.type))
      : undefined;
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
  binding: Binding
): IrVariableDeclaration => {
  const isConst = !!(node.declarationList.flags & ts.NodeFlags.Const);
  const isLet = !!(node.declarationList.flags & ts.NodeFlags.Let);
  const declarationKind = isConst ? "const" : isLet ? "let" : "var";
  const isExported = hasExportModifier(node);

  // Module-level variables need explicit types in C# (they become static fields)
  const isModuleLevel = isModuleLevelVariable(node);
  const needsExplicitType = isExported || isModuleLevel;

  // PHASE 4 (Alice's spec): Use captureTypeSyntax + typeFromSyntax
  const typeSystem = getTypeSystem();

  return {
    kind: "variableDeclaration",
    declarationKind,
    declarations: node.declarationList.declarations.map((decl) => {
      // expectedType for initializer: ONLY from explicit type annotation
      // This ensures deterministic literal typing (e.g., 100 -> int unless annotated)
      const expectedType = getExpectedTypeForInitializer(decl, binding);

      // Convert initializer FIRST (before determining type)
      // This allows us to derive the variable type from the converted expression
      const convertedInitializer = decl.initializer
        ? convertExpression(decl.initializer, binding, expectedType)
        : undefined;

      // Determine the variable type:
      // 1. If there's an explicit annotation, use it
      // 2. If we need an explicit type (module-level) and have an initializer,
      //    derive it from the converted expression (NO TypeScript fallback)
      // 3. Otherwise, undefined (let emitter use var or report error)
      // PHASE 4 (Alice's spec): Use captureTypeSyntax + typeFromSyntax
      const declaredType = decl.type
        ? typeSystem
          ? typeSystem.typeFromSyntax(binding.captureTypeSyntax(decl.type))
          : { kind: "unknownType" as const }
        : needsExplicitType && convertedInitializer && !isBindingPattern(decl)
          ? deriveTypeFromExpression(convertedInitializer)
          : undefined;

      return {
        kind: "variableDeclarator",
        name: convertBindingName(decl.name),
        type: declaredType,
        initializer: convertedInitializer,
      };
    }),
    isExported,
  };
};
