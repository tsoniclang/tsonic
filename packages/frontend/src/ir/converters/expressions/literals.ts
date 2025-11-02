/**
 * Literal expression converters
 */

import * as ts from "typescript";
import { IrLiteralExpression } from "../../types.js";
import { getInferredType } from "./helpers.js";

/**
 * Convert string or numeric literal
 */
export const convertLiteral = (
  node: ts.StringLiteral | ts.NumericLiteral,
  checker: ts.TypeChecker
): IrLiteralExpression => {
  return {
    kind: "literal",
    value: ts.isStringLiteral(node) ? node.text : Number(node.text),
    raw: node.getText(),
    inferredType: getInferredType(node, checker),
  };
};
