/**
 * Miscellaneous expression converters (conditional, template literals)
 */

import * as ts from "typescript";
import {
  IrConditionalExpression,
  IrTemplateLiteralExpression,
  IrExpression,
} from "../../types.js";
import { getInferredType, getSourceSpan } from "./helpers.js";
import { convertExpression } from "../../expression-converter.js";

/**
 * Convert conditional (ternary) expression
 */
export const convertConditionalExpression = (
  node: ts.ConditionalExpression,
  checker: ts.TypeChecker
): IrConditionalExpression => {
  return {
    kind: "conditional",
    condition: convertExpression(node.condition, checker, undefined),
    whenTrue: convertExpression(node.whenTrue, checker, undefined),
    whenFalse: convertExpression(node.whenFalse, checker, undefined),
    inferredType: getInferredType(node, checker),
    sourceSpan: getSourceSpan(node),
  };
};

/**
 * Convert template literal expression
 */
export const convertTemplateLiteral = (
  node: ts.TemplateExpression | ts.NoSubstitutionTemplateLiteral,
  checker: ts.TypeChecker
): IrTemplateLiteralExpression => {
  if (ts.isNoSubstitutionTemplateLiteral(node)) {
    return {
      kind: "templateLiteral",
      quasis: [node.text],
      expressions: [],
      inferredType: getInferredType(node, checker),
      sourceSpan: getSourceSpan(node),
    };
  }

  const quasis: string[] = [node.head.text];
  const expressions: IrExpression[] = [];

  node.templateSpans.forEach((span) => {
    expressions.push(convertExpression(span.expression, checker, undefined));
    quasis.push(span.literal.text);
  });

  return {
    kind: "templateLiteral",
    quasis,
    expressions,
    inferredType: getInferredType(node, checker),
    sourceSpan: getSourceSpan(node),
  };
};
