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
  IrType,
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
 *
 * Threads expectedType through:
 * - Assignment RHS: gets LHS type
 * - Nullish coalescing (??): RHS gets expectedType (fallback value)
 * - Logical OR (||): RHS gets expectedType (fallback value)
 */
export const convertBinaryExpression = (
  node: ts.BinaryExpression,
  checker: ts.TypeChecker,
  expectedType?: IrType
): IrExpression => {
  const operator = convertBinaryOperator(node.operatorToken);
  const inferredType = getInferredType(node, checker);
  const sourceSpan = getSourceSpan(node);

  // Handle assignment separately
  // Thread LHS type to RHS for deterministic typing (e.g., x = 10 where x: int)
  if (isAssignmentOperator(node.operatorToken)) {
    const lhsType = getInferredType(node.left, checker);
    return {
      kind: "assignment",
      operator: operator as IrAssignmentOperator,
      left: ts.isIdentifier(node.left)
        ? {
            kind: "identifier",
            name: node.left.text,
            inferredType: lhsType,
            sourceSpan: getSourceSpan(node.left),
          }
        : convertExpression(node.left, checker, undefined),
      right: convertExpression(node.right, checker, lhsType),
      inferredType,
      sourceSpan,
    };
  }

  // Handle logical operators
  // For ?? and ||, the RHS is the fallback value, so it gets expectedType
  // For &&, the RHS is only reached if LHS is truthy, no type coercion needed
  if (operator === "&&" || operator === "||" || operator === "??") {
    const rhsExpectedType =
      operator === "??" || operator === "||" ? expectedType : undefined;
    return {
      kind: "logical",
      operator,
      left: convertExpression(node.left, checker, undefined),
      right: convertExpression(node.right, checker, rhsExpectedType),
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
