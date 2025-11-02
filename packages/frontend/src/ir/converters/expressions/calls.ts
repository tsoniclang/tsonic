/**
 * Call and new expression converters
 */

import * as ts from "typescript";
import { IrCallExpression, IrNewExpression } from "../../types.js";
import {
  getInferredType,
  extractTypeArguments,
  checkIfRequiresSpecialization,
} from "./helpers.js";
import { convertExpression } from "../../expression-converter.js";

/**
 * Convert call expression
 */
export const convertCallExpression = (
  node: ts.CallExpression,
  checker: ts.TypeChecker
): IrCallExpression => {
  // Extract type arguments from the call signature
  const typeArguments = extractTypeArguments(node, checker);
  const requiresSpecialization = checkIfRequiresSpecialization(node, checker);

  return {
    kind: "call",
    callee: convertExpression(node.expression, checker),
    arguments: node.arguments.map((arg) => {
      if (ts.isSpreadElement(arg)) {
        return {
          kind: "spread" as const,
          expression: convertExpression(arg.expression, checker),
        };
      }
      return convertExpression(arg, checker);
    }),
    isOptional: node.questionDotToken !== undefined,
    inferredType: getInferredType(node, checker),
    typeArguments,
    requiresSpecialization,
  };
};

/**
 * Convert new expression
 */
export const convertNewExpression = (
  node: ts.NewExpression,
  checker: ts.TypeChecker
): IrNewExpression => {
  // Extract type arguments from the constructor signature
  const typeArguments = extractTypeArguments(node, checker);
  const requiresSpecialization = checkIfRequiresSpecialization(node, checker);

  return {
    kind: "new",
    callee: convertExpression(node.expression, checker),
    arguments:
      node.arguments?.map((arg) => {
        if (ts.isSpreadElement(arg)) {
          return {
            kind: "spread" as const,
            expression: convertExpression(arg.expression, checker),
          };
        }
        return convertExpression(arg, checker);
      }) ?? [],
    inferredType: getInferredType(node, checker),
    typeArguments,
    requiresSpecialization,
  };
};
