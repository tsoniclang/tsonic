/**
 * Ref/Out Parameter Handling - Generate C# ref/out/in keywords from TSByRef wrapper.
 *
 * C# supports pass-by-reference parameters (ref, out, in) which don't have direct
 * JavaScript equivalents. TypeScript code uses TSByRef<T> wrapper:
 *
 * TypeScript: const result = { value: 0 }; TryParse("42", result);
 * C#:         int result; TryParse("42", out result);
 *
 * @see spec/ref-out-parameters.md for complete documentation
 */

import type * as ts from "typescript";
import type { ParameterMetadata } from "./metadata.ts";
import { isTSByRef, getTSByRefWrappedType } from "./support-types.ts";

/**
 * Parameter modifier for C# emission.
 */
export type ParameterModifier = "ref" | "out" | "in" | "none";

/**
 * Information about a ref/out/in parameter.
 */
export type RefParameterInfo = {
  readonly isRef: boolean;
  readonly isOut: boolean;
  readonly isIn: boolean;
  readonly modifier: ParameterModifier;
  readonly wrappedType: ts.Type;
};

/**
 * Get ref/out/in information from parameter metadata.
 *
 * @param paramMetadata - Parameter metadata from .metadata.json
 * @returns Parameter modifier to use in C# emission
 */
export const getParameterModifier = (
  paramMetadata: ParameterMetadata
): ParameterModifier => {
  if (paramMetadata.isOut) {
    return "out";
  }
  if (paramMetadata.isRef) {
    return "ref";
  }
  if (paramMetadata.isIn) {
    return "in";
  }
  return "none";
};

/**
 * Check if parameter requires TSByRef wrapper based on metadata.
 *
 * @param paramMetadata - Parameter metadata from .metadata.json
 * @returns True if parameter should use TSByRef<T> in TypeScript
 */
export const requiresTSByRef = (paramMetadata: ParameterMetadata): boolean => {
  return paramMetadata.isRef || paramMetadata.isOut || (paramMetadata.isIn ?? false);
};

/**
 * Get ref parameter info from TypeScript type and metadata.
 *
 * @param paramType - TypeScript parameter type
 * @param paramMetadata - Parameter metadata from .metadata.json
 * @param checker - TypeScript type checker
 * @returns Ref parameter info if applicable, undefined otherwise
 */
export const getRefParameterInfo = (
  paramType: ts.Type,
  paramMetadata: ParameterMetadata,
  checker: ts.TypeChecker
): RefParameterInfo | undefined => {
  // Check if type is TSByRef<T>
  if (!isTSByRef(paramType, checker)) {
    return undefined;
  }

  // Extract wrapped type
  const wrappedType = getTSByRefWrappedType(paramType, checker);
  if (!wrappedType) {
    return undefined;
  }

  return {
    isRef: paramMetadata.isRef,
    isOut: paramMetadata.isOut,
    isIn: paramMetadata.isIn ?? false,
    modifier: getParameterModifier(paramMetadata),
    wrappedType,
  };
};

/**
 * Extract variable name from TSByRef argument expression.
 *
 * TypeScript: TryParse("42", result)  // where result = { value: 0 }
 * C#:         TryParse("42", out result)
 *
 * @param argumentNode - Argument AST node
 * @returns Variable identifier name, or undefined if not extractable
 */
export const extractRefArgumentVariable = (
  argumentNode: ts.Expression
): string | undefined => {
  // Handle simple identifier
  if (ts.isIdentifier(argumentNode)) {
    return argumentNode.text;
  }

  // Handle property access (unlikely for ref params, but possible)
  if (ts.isPropertyAccessExpression(argumentNode)) {
    return argumentNode.name.text;
  }

  // Cannot extract variable name from complex expressions
  return undefined;
};

/**
 * Check if argument expression is a TSByRef wrapper object literal.
 *
 * Detects: { value: 0 } or { value: initialValue }
 *
 * @param argumentNode - Argument AST node
 * @returns True if argument is object literal with 'value' property
 */
export const isTSByRefObjectLiteral = (
  argumentNode: ts.Expression
): boolean => {
  if (!ts.isObjectLiteralExpression(argumentNode)) {
    return false;
  }

  // Check if object has exactly one property named 'value'
  const properties = argumentNode.properties;
  if (properties.length !== 1) {
    return false;
  }

  const prop = properties[0];
  if (!ts.isPropertyAssignment(prop)) {
    return false;
  }

  if (!ts.isIdentifier(prop.name)) {
    return false;
  }

  return prop.name.text === "value";
};

/**
 * Generate C# parameter declaration with modifier.
 *
 * @param modifier - Parameter modifier (ref/out/in/none)
 * @param typeName - C# type name
 * @param paramName - Parameter name
 * @returns C# parameter declaration
 */
export const generateCSharpParameter = (
  modifier: ParameterModifier,
  typeName: string,
  paramName: string
): string => {
  if (modifier === "none") {
    return `${typeName} ${paramName}`;
  }
  return `${modifier} ${typeName} ${paramName}`;
};

/**
 * Generate C# argument with modifier for method call.
 *
 * @param modifier - Parameter modifier (ref/out/in/none)
 * @param argumentExpression - C# argument expression
 * @returns C# argument with modifier
 */
export const generateCSharpArgument = (
  modifier: ParameterModifier,
  argumentExpression: string
): string => {
  if (modifier === "none") {
    return argumentExpression;
  }
  return `${modifier} ${argumentExpression}`;
};

/**
 * Check if variable declaration is needed for out parameter.
 *
 * For out parameters in TypeScript:
 *   const result = { value: 0 };  // Declaration
 *   TryParse("42", result);       // Usage
 *
 * For out parameters in C#:
 *   TryParse("42", out int result);  // Inline declaration
 *
 * @param argumentNode - Argument AST node
 * @returns True if variable should be declared before the call
 */
export const needsOutVariableDeclaration = (
  argumentNode: ts.Expression
): boolean => {
  // If argument is already a simple identifier, it's already declared
  if (ts.isIdentifier(argumentNode)) {
    return false;
  }

  // If argument is an object literal { value: ... }, we need to declare the variable
  if (isTSByRefObjectLiteral(argumentNode)) {
    return true;
  }

  return false;
};

/**
 * Extract initial value from TSByRef object literal.
 *
 * { value: 42 } → 42
 * { value: getDefault() } → getDefault()
 *
 * @param argumentNode - Argument AST node (must be object literal)
 * @returns Initial value expression, or undefined if no initializer
 */
export const extractTSByRefInitialValue = (
  argumentNode: ts.Expression
): ts.Expression | undefined => {
  if (!ts.isObjectLiteralExpression(argumentNode)) {
    return undefined;
  }

  const properties = argumentNode.properties;
  if (properties.length !== 1) {
    return undefined;
  }

  const prop = properties[0];
  if (!ts.isPropertyAssignment(prop)) {
    return undefined;
  }

  return prop.initializer;
};

/**
 * Determine if ref/out parameter should use inline declaration in C#.
 *
 * C# 7.0+ supports inline out var:
 *   if (int.TryParse("42", out var result)) { ... }
 *
 * We use this when the TypeScript code declares the wrapper inline.
 *
 * @param argumentNode - Argument AST node
 * @returns True if should use inline declaration
 */
export const shouldUseInlineDeclaration = (
  argumentNode: ts.Expression
): boolean => {
  // Use inline declaration if argument is an object literal
  return isTSByRefObjectLiteral(argumentNode);
};
