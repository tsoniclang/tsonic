/**
 * Variable declaration converter
 */

import * as ts from "typescript";
import { IrVariableDeclaration, IrExpression, IrType } from "../../../types.js";
import { convertExpression } from "../../../expression-converter.js";
import {
  convertType,
  convertBindingName,
  inferType,
} from "../../../type-converter.js";
import { hasExportModifier } from "../helpers.js";

/**
 * Derive the type from a converted IR expression using deterministic rules.
 * This replaces TypeScript type inference for unannotated variables.
 *
 * DETERMINISTIC TYPING RULES:
 * - Integer literals (numericIntent: "Int32") → int
 * - Floating literals (numericIntent: "Double") → double (as number)
 * - String literals → string
 * - Boolean literals → boolean
 * - Call expressions → use inferredType (which has numeric recovery)
 * - Other expressions → use inferredType, fallback to TypeScript inference
 */
const deriveTypeFromExpression = (
  expr: IrExpression,
  decl: ts.VariableDeclaration,
  checker: ts.TypeChecker
): IrType | undefined => {
  // For literals with numericIntent, use the intent to determine type
  if (expr.kind === "literal") {
    if (typeof expr.value === "number" && expr.numericIntent) {
      if (expr.numericIntent === "Int32") {
        return { kind: "referenceType", name: "int" };
      } else if (expr.numericIntent === "Double") {
        return { kind: "primitiveType", name: "number" };
      }
    }
    if (typeof expr.value === "string") {
      return { kind: "primitiveType", name: "string" };
    }
    if (typeof expr.value === "boolean") {
      return { kind: "primitiveType", name: "boolean" };
    }
  }

  // For arrays, derive element type from first element if it's a literal
  if (expr.kind === "array" && expr.elements.length > 0) {
    const firstElement = expr.elements[0];
    if (firstElement && firstElement.kind === "literal") {
      if (
        typeof firstElement.value === "number" &&
        firstElement.numericIntent
      ) {
        if (firstElement.numericIntent === "Int32") {
          return {
            kind: "arrayType",
            elementType: { kind: "referenceType", name: "int" },
          };
        } else if (firstElement.numericIntent === "Double") {
          return {
            kind: "arrayType",
            elementType: { kind: "primitiveType", name: "number" },
          };
        }
      }
    }
  }

  // For call expressions and other complex expressions, use inferredType
  // The inferredType should have numeric recovery from function return types
  if (expr.kind === "call" || expr.kind === "new") {
    if (expr.inferredType) {
      return expr.inferredType;
    }
  }

  // For identifiers (variable references), use inferredType
  if (expr.kind === "identifier" && expr.inferredType) {
    return expr.inferredType;
  }

  // For other expressions, fallback to TypeScript inference
  return inferType(decl, checker);
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
  checker: ts.TypeChecker
) => {
  // Only use explicit type annotation as expectedType
  // Inferred types should NOT influence literal typing
  if (decl.type) {
    return convertType(decl.type, checker);
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
      // expectedType for initializer: ONLY from explicit type annotation
      // This ensures deterministic literal typing (e.g., 100 -> int unless annotated)
      const expectedType = getExpectedTypeForInitializer(decl, checker);

      // Convert initializer FIRST (before determining type)
      // This allows us to derive the variable type from the converted expression
      const convertedInitializer = decl.initializer
        ? convertExpression(decl.initializer, checker, expectedType)
        : undefined;

      // Determine the variable type:
      // 1. If there's an explicit annotation, use it
      // 2. If we need an explicit type (module-level) and have an initializer,
      //    derive it from the converted expression using deterministic rules
      // 3. Otherwise, use TypeScript inference
      const declaredType = decl.type
        ? convertType(decl.type, checker)
        : needsExplicitType && convertedInitializer && !isBindingPattern(decl)
          ? deriveTypeFromExpression(convertedInitializer, decl, checker)
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
