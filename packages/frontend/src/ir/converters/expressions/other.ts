/**
 * Miscellaneous expression converters (conditional, template literals)
 */

import * as ts from "typescript";
import {
  IrConditionalExpression,
  IrTemplateLiteralExpression,
  IrExpression,
  IrType,
} from "../../types.js";
import { getInferredType, getSourceSpan } from "./helpers.js";
import { convertExpression } from "../../expression-converter.js";

/**
 * Convert conditional (ternary) expression
 *
 * Threads expectedType to both branches to ensure deterministic typing.
 * Example: `const x: int = cond ? 5 : 10` → both 5 and 10 get expectedType `int`
 */
export const convertConditionalExpression = (
  node: ts.ConditionalExpression,
  checker: ts.TypeChecker,
  expectedType: IrType | undefined
): IrConditionalExpression => {
  return {
    kind: "conditional",
    condition: convertExpression(node.condition, checker, undefined),
    whenTrue: convertExpression(node.whenTrue, checker, expectedType),
    whenFalse: convertExpression(node.whenFalse, checker, expectedType),
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
