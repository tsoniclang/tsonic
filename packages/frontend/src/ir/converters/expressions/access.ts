/**
 * Member access expression converters
 */

import * as ts from "typescript";
import { IrMemberExpression } from "../../types.js";
import { getInferredType } from "./helpers.js";
import { convertExpression } from "../../expression-converter.js";

/**
 * Convert property access or element access expression
 */
export const convertMemberExpression = (
  node: ts.PropertyAccessExpression | ts.ElementAccessExpression,
  checker: ts.TypeChecker
): IrMemberExpression => {
  const isOptional = node.questionDotToken !== undefined;
  const inferredType = getInferredType(node, checker);

  if (ts.isPropertyAccessExpression(node)) {
    return {
      kind: "memberAccess",
      object: convertExpression(node.expression, checker),
      property: node.name.text,
      isComputed: false,
      isOptional,
      inferredType,
    };
  } else {
    return {
      kind: "memberAccess",
      object: convertExpression(node.expression, checker),
      property: convertExpression(node.argumentExpression, checker),
      isComputed: true,
      isOptional,
      inferredType,
    };
  }
};
