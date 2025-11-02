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

  // Handle assignment separately
  if (isAssignmentOperator(node.operatorToken)) {
    return {
      kind: "assignment",
      operator: operator as IrAssignmentOperator,
      left: ts.isIdentifier(node.left)
        ? { kind: "identifier", name: node.left.text }
        : convertExpression(node.left, checker),
      right: convertExpression(node.right, checker),
      inferredType,
    };
  }

  // Handle logical operators
  if (operator === "&&" || operator === "||" || operator === "??") {
    return {
      kind: "logical",
      operator,
      left: convertExpression(node.left, checker),
      right: convertExpression(node.right, checker),
      inferredType,
    };
  }

  // Regular binary expression
  return {
    kind: "binary",
    operator: operator as IrBinaryOperator,
    left: convertExpression(node.left, checker),
    right: convertExpression(node.right, checker),
    inferredType,
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

  // Check if it's an increment/decrement (++ or --)
  if (
    node.operator === ts.SyntaxKind.PlusPlusToken ||
    node.operator === ts.SyntaxKind.MinusMinusToken
  ) {
    return {
      kind: "update",
      operator: node.operator === ts.SyntaxKind.PlusPlusToken ? "++" : "--",
      prefix: true,
      expression: convertExpression(node.operand, checker),
      inferredType,
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
    expression: convertExpression(node.operand, checker),
    inferredType,
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
        expression: convertExpression(node.operand, checker),
        inferredType,
      };
    }
  }

  // Handle postfix unary expression
  const postfix = node as ts.PostfixUnaryExpression;
  return {
    kind: "update",
    operator: postfix.operator === ts.SyntaxKind.PlusPlusToken ? "++" : "--",
    prefix: false,
    expression: convertExpression(postfix.operand, checker),
    inferredType,
  };
};
