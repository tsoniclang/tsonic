/**
 * Operator expression converters (binary, unary, update, assignment)
 */

import * as ts from "typescript";
import {
  IrExpression,
  IrUnaryExpression,
  IrUpdateExpression,
  IrBinaryOperator,
  IrAssignmentOperator,
} from "../../types.js";
import {
  getInferredType,
  getSourceSpan,
  convertBinaryOperator,
  isAssignmentOperator,
} from "./helpers.js";
import { convertExpression } from "../../expression-converter.js";

/**
 * Convert binary expression (including logical and assignment)
 */
export const convertBinaryExpression = (
  node: ts.BinaryExpression,
  checker: ts.TypeChecker
): IrExpression => {
  const operator = convertBinaryOperator(node.operatorToken);
  const inferredType = getInferredType(node, checker);
  const sourceSpan = getSourceSpan(node);

  // Handle assignment separately
  if (isAssignmentOperator(node.operatorToken)) {
    return {
      kind: "assignment",
      operator: operator as IrAssignmentOperator,
      left: ts.isIdentifier(node.left)
        ? {
            kind: "identifier",
            name: node.left.text,
            inferredType: getInferredType(node.left, checker),
            sourceSpan: getSourceSpan(node.left),
          }
        : convertExpression(node.left, checker, undefined),
      right: convertExpression(node.right, checker, undefined),
      inferredType,
      sourceSpan,
    };
  }

  // Handle logical operators
  if (operator === "&&" || operator === "||" || operator === "??") {
    return {
      kind: "logical",
      operator,
      left: convertExpression(node.left, checker, undefined),
      right: convertExpression(node.right, checker, undefined),
      inferredType,
      sourceSpan,
    };
  }

  // Regular binary expression
  return {
    kind: "binary",
    operator: operator as IrBinaryOperator,
    left: convertExpression(node.left, checker, undefined),
    right: convertExpression(node.right, checker, undefined),
    inferredType,
    sourceSpan,
  };
};

/**
 * Convert prefix unary expression
 */
export const convertUnaryExpression = (
  node: ts.PrefixUnaryExpression,
  checker: ts.TypeChecker
): IrUnaryExpression | IrUpdateExpression => {
  const inferredType = getInferredType(node, checker);
  const sourceSpan = getSourceSpan(node);

  // Check if it's an increment/decrement (++ or --)
  if (
    node.operator === ts.SyntaxKind.PlusPlusToken ||
    node.operator === ts.SyntaxKind.MinusMinusToken
  ) {
    return {
      kind: "update",
      operator: node.operator === ts.SyntaxKind.PlusPlusToken ? "++" : "--",
      prefix: true,
      expression: convertExpression(node.operand, checker, undefined),
      inferredType,
      sourceSpan,
    };
  }

  // Handle regular unary operators
  let operator: IrUnaryExpression["operator"] = "+";

  switch (node.operator) {
    case ts.SyntaxKind.PlusToken:
      operator = "+";
      break;
    case ts.SyntaxKind.MinusToken:
      operator = "-";
      break;
    case ts.SyntaxKind.ExclamationToken:
      operator = "!";
      break;
    case ts.SyntaxKind.TildeToken:
      operator = "~";
      break;
  }

  return {
    kind: "unary",
    operator,
    expression: convertExpression(node.operand, checker, undefined),
    inferredType,
    sourceSpan,
  };
};

/**
 * Convert postfix unary expression (++ or --)
 */
export const convertUpdateExpression = (
  node: ts.PostfixUnaryExpression | ts.PrefixUnaryExpression,
  checker: ts.TypeChecker
): IrUpdateExpression => {
  const inferredType = getInferredType(node, checker);
  const sourceSpan = getSourceSpan(node);

  if (ts.isPrefixUnaryExpression(node)) {
    // Check if it's an increment or decrement
    if (
      node.operator === ts.SyntaxKind.PlusPlusToken ||
      node.operator === ts.SyntaxKind.MinusMinusToken
    ) {
      return {
        kind: "update",
        operator: node.operator === ts.SyntaxKind.PlusPlusToken ? "++" : "--",
        prefix: true,
        expression: convertExpression(node.operand, checker, undefined),
        inferredType,
        sourceSpan,
      };
    }
  }

  // Handle postfix unary expression
  const postfix = node as ts.PostfixUnaryExpression;
  return {
    kind: "update",
    operator: postfix.operator === ts.SyntaxKind.PlusPlusToken ? "++" : "--",
    prefix: false,
    expression: convertExpression(postfix.operand, checker, undefined),
    inferredType,
    sourceSpan,
  };
};
