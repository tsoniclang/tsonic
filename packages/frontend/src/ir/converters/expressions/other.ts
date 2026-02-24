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
import { irTypesEqual, normalizedUnionType } from "../../types/type-ops.js";
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

  // DETERMINISTIC:
  // - If expectedType exists, it is the contextual contract for both branches.
  // - Otherwise infer from both branches (never from whenTrue alone).
  const inferredType = (() => {
    if (expectedType) return expectedType;

    const t = whenTrue.inferredType;
    const f = whenFalse.inferredType;

    if (!t) return f;
    if (!f) return t;

    if (irTypesEqual(t, f)) return t;
    return normalizedUnionType([t, f]);
  })();

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
