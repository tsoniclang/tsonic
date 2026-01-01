/**
 * Function expression converters (function expressions and arrow functions)
 */

import * as ts from "typescript";
import {
  IrFunctionExpression,
  IrArrowFunctionExpression,
  IrParameter,
  IrType,
} from "../../types.js";
import { getSourceSpan } from "./helpers.js";
import { convertExpression } from "../../expression-converter.js";
import { convertBlockStatement } from "../../statement-converter.js";
import { convertType, convertBindingName } from "../../type-converter.js";
import type { Binding } from "../../binding/index.js";

/**
 * Extract parameter types from an expected function type.
 * DETERMINISTIC: Uses only the IR type structure, not TS type inference.
 */
const extractParamTypesFromExpectedType = (
  expectedType: IrType | undefined
): readonly (IrType | undefined)[] | undefined => {
  if (!expectedType) return undefined;
  if (expectedType.kind !== "functionType") return undefined;
  return expectedType.parameters.map((p) => p.type);
};

/**
 * Convert parameters for lambda expressions (arrow functions and function expressions).
 *
 * DETERMINISTIC TYPING: Parameter types come from:
 * 1. Explicit type annotations on the parameter
 * 2. expectedType (function type passed from call site via extractParameterTypes)
 *
 * If no type is available, parameter type is undefined (unknownType poison).
 * Validation will emit TSN5202 for untyped lambda parameters.
 */
const convertLambdaParameters = (
  node: ts.ArrowFunction | ts.FunctionExpression,
  binding: Binding,
  expectedType: IrType | undefined
): readonly IrParameter[] => {
  // DETERMINISTIC: Extract parameter types from expectedType (the ONLY source for unannotated params)
  const expectedParamTypes = extractParamTypesFromExpectedType(expectedType);

  return node.parameters.map((param, index) => {
    let passing: "value" | "ref" | "out" | "in" = "value";
    let actualType: ts.TypeNode | undefined = param.type;

    // Detect ref<T>, out<T>, in<T> wrapper types (explicit annotation only)
    if (
      param.type &&
      ts.isTypeReferenceNode(param.type) &&
      ts.isIdentifier(param.type.typeName)
    ) {
      const typeName = param.type.typeName.text;
      if (
        (typeName === "ref" || typeName === "out" || typeName === "in") &&
        param.type.typeArguments &&
        param.type.typeArguments.length > 0
      ) {
        passing = typeName === "in" ? "in" : typeName;
        actualType = param.type.typeArguments[0];
      }
    }

    // Determine the IrType for this parameter
    // DETERMINISTIC Priority: 1. Explicit annotation, 2. expectedType from call site
    let irType: IrType | undefined;
    if (actualType) {
      // Explicit type annotation - use it
      irType = convertType(actualType, binding);
    } else if (expectedParamTypes && expectedParamTypes[index]) {
      // Use expectedType from call site (deterministic)
      irType = expectedParamTypes[index];
    }
    // If no type available, irType stays undefined (unknownType poison)
    // Validation will emit TSN5202 for untyped lambda parameters

    return {
      kind: "parameter" as const,
      pattern: convertBindingName(param.name),
      type: irType,
      // Pass parameter type for contextual typing of default value
      initializer: param.initializer
        ? convertExpression(param.initializer, binding, irType)
        : undefined,
      isOptional: !!param.questionToken,
      isRest: !!param.dotDotDotToken,
      passing,
    };
  });
};

/**
 * Convert function expression
 *
 * DETERMINISTIC TYPING: Build function type from declared parameters and return type.
 * Parameter types come from explicit annotations or expectedType (no TS inference).
 */
export const convertFunctionExpression = (
  node: ts.FunctionExpression,
  binding: Binding,
  expectedType?: IrType
): IrFunctionExpression => {
  // Get return type from declared annotation for contextual typing
  const returnType = node.type ? convertType(node.type, binding) : undefined;
  // DETERMINISTIC: Pass expectedType for parameter type inference
  const parameters = convertLambdaParameters(node, binding, expectedType);

  // DETERMINISTIC: Build function type from declared parameters and return type
  const inferredType = {
    kind: "functionType" as const,
    parameters,
    returnType: returnType ?? { kind: "voidType" as const },
  };

  return {
    kind: "functionExpression",
    name: node.name?.text,
    parameters,
    returnType,
    // Pass return type to body for contextual typing of return statements
    body: node.body
      ? convertBlockStatement(node.body, binding, returnType)
      : { kind: "blockStatement", statements: [] },
    isAsync: !!node.modifiers?.some(
      (m) => m.kind === ts.SyntaxKind.AsyncKeyword
    ),
    isGenerator: !!node.asteriskToken,
    inferredType,
    sourceSpan: getSourceSpan(node),
  };
};

/**
 * Convert arrow function expression
 *
 * DETERMINISTIC TYPING: Build function type from declared parameters and return type.
 * Parameter types come from explicit annotations or expectedType (no TS inference).
 */
export const convertArrowFunction = (
  node: ts.ArrowFunction,
  binding: Binding,
  expectedType?: IrType
): IrArrowFunctionExpression => {
  // Get return type from declared annotation, or from expectedType if available
  const declaredReturnType = node.type
    ? convertType(node.type, binding)
    : undefined;
  // DETERMINISTIC: Use expectedType's return type if no explicit annotation
  const expectedReturnType =
    expectedType?.kind === "functionType" ? expectedType.returnType : undefined;
  const returnType = declaredReturnType ?? expectedReturnType;

  // DETERMINISTIC: Pass expectedType for parameter type inference
  const parameters = convertLambdaParameters(node, binding, expectedType);

  // Pass return type to body for contextual typing:
  // - Block body: return statements get the expected type
  // - Expression body: the expression gets the expected type
  const body = ts.isBlock(node.body)
    ? convertBlockStatement(node.body, binding, returnType)
    : convertExpression(node.body, binding, returnType);

  // DETERMINISTIC TYPING: contextualType comes from expectedType
  const contextualType = expectedType;

  // DETERMINISTIC: Build function type from declared parameters and return type
  const inferredType = {
    kind: "functionType" as const,
    parameters,
    returnType: returnType ?? { kind: "voidType" as const },
  };

  return {
    kind: "arrowFunction",
    parameters,
    returnType,
    body,
    isAsync: !!node.modifiers?.some(
      (m) => m.kind === ts.SyntaxKind.AsyncKeyword
    ),
    inferredType,
    contextualType,
    sourceSpan: getSourceSpan(node),
  };
};
