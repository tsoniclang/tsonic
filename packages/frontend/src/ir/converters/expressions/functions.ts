/**
 * Function expression converters (function expressions and arrow functions)
 */

import * as ts from "typescript";
import {
  IrFunctionExpression,
  IrArrowFunctionExpression,
  IrParameter,
} from "../../types.js";
import { getSourceSpan } from "./helpers.js";
import { convertExpression } from "../../expression-converter.js";
import { convertBlockStatement } from "../../statement-converter.js";
import {
  convertType,
  convertBindingName,
  inferLambdaParamTypes,
  convertTsTypeToIr,
} from "../../type-converter.js";

/**
 * Convert parameters for lambda expressions (arrow functions and function expressions).
 * Uses contextual signature inference for parameters without explicit type annotations.
 */
const convertLambdaParameters = (
  node: ts.ArrowFunction | ts.FunctionExpression,
  checker: ts.TypeChecker
): readonly IrParameter[] => {
  // Get inferred types from contextual signature
  const inference = inferLambdaParamTypes(node, checker);

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
    let irType;
    if (actualType) {
      // Explicit type annotation - use it
      irType = convertType(actualType, checker);
    } else if (inference) {
      // No explicit type - use inferred type from contextual signature
      irType = inference.paramTypes[index];
    }

    return {
      kind: "parameter" as const,
      pattern: convertBindingName(param.name),
      type: irType,
      // Pass parameter type for contextual typing of default value
      initializer: param.initializer
        ? convertExpression(param.initializer, checker, irType)
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
 */
export const convertFunctionExpression = (
  node: ts.FunctionExpression,
  checker: ts.TypeChecker
): IrFunctionExpression => {
  // Get return type from declared annotation for contextual typing
  const returnType = node.type ? convertType(node.type, checker) : undefined;
  const parameters = convertLambdaParameters(node, checker);

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
      ? convertBlockStatement(node.body, checker, returnType)
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
 */
export const convertArrowFunction = (
  node: ts.ArrowFunction,
  checker: ts.TypeChecker
): IrArrowFunctionExpression => {
  // Get return type from declared annotation for contextual typing
  const returnType = node.type ? convertType(node.type, checker) : undefined;
  const parameters = convertLambdaParameters(node, checker);

  // Pass return type to body for contextual typing:
  // - Block body: return statements get the expected type
  // - Expression body: the expression gets the expected type
  const body = ts.isBlock(node.body)
    ? convertBlockStatement(node.body, checker, returnType)
    : convertExpression(node.body, checker, returnType);

  // Get contextual type from call site (e.g., array.map callback signature)
  // This is used by later passes to infer parameter/return types
  const tsContextualType = checker.getContextualType(node);
  const contextualType = tsContextualType
    ? convertTsTypeToIr(tsContextualType, checker)
    : undefined;

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
