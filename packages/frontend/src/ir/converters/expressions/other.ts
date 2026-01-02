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
import { getSourceSpan } from "./helpers.js";
import { convertExpression } from "../../expression-converter.js";
import type { ProgramContext } from "../../program-context.js";

/**
 * Convert conditional (ternary) expression
 *
 * DETERMINISTIC TYPING:
 * - Threads expectedType to both branches for consistent typing
 * - Result type is expectedType if available, otherwise derives from whenTrue branch
 * Example: `const x: int = cond ? 5 : 10` → both 5 and 10 get expectedType `int`
 */
export const convertConditionalExpression = (
  node: ts.ConditionalExpression,
  ctx: ProgramContext,
  expectedType: IrType | undefined
): IrConditionalExpression => {
  const whenTrue = convertExpression(node.whenTrue, ctx, expectedType);
  const whenFalse = convertExpression(node.whenFalse, ctx, expectedType);

  // DETERMINISTIC: Use expectedType if available, otherwise derive from whenTrue
  const inferredType = expectedType ?? whenTrue.inferredType;

  return {
    kind: "conditional",
    condition: convertExpression(node.condition, ctx, undefined),
    whenTrue,
    whenFalse,
    inferredType,
    sourceSpan: getSourceSpan(node),
  };
};

/**
 * Convert template literal expression
 *
 * DETERMINISTIC TYPING: Template literals always produce string type.
 */
export const convertTemplateLiteral = (
  node: ts.TemplateExpression | ts.NoSubstitutionTemplateLiteral,
  ctx: ProgramContext
): IrTemplateLiteralExpression => {
  // DETERMINISTIC: Template literals always produce string
  const stringType = {
    kind: "primitiveType" as const,
    name: "string" as const,
  };

  if (ts.isNoSubstitutionTemplateLiteral(node)) {
    return {
      kind: "templateLiteral",
      quasis: [node.text],
      expressions: [],
      inferredType: stringType,
      sourceSpan: getSourceSpan(node),
    };
  }

  const quasis: string[] = [node.head.text];
  const expressions: IrExpression[] = [];

  node.templateSpans.forEach((span) => {
    expressions.push(convertExpression(span.expression, ctx, undefined));
    quasis.push(span.literal.text);
  });

  return {
    kind: "templateLiteral",
    quasis,
    expressions,
    inferredType: stringType,
    sourceSpan: getSourceSpan(node),
  };
};
