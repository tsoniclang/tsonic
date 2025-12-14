/**
 * Literal expression converters
 *
 * Numeric literals get numericIntent attached based on their lexeme:
 * - Integer literals (42, 0xFF) → Int32
 * - Floating literals (42.0, 3.14, 1e3) → Double
 *
 * IMPORTANT: numericIntent is expression-level, NOT type-level.
 * The inferredType remains unchanged (number → double semantically).
 * The numericIntent field on the expression enables:
 * 1. Emitter to emit `42` vs `42.0` appropriately
 * 2. Coercion pass to detect int→double conversions
 */

import * as ts from "typescript";
import { IrLiteralExpression } from "../../types.js";
import { getInferredType, getSourceSpan } from "./helpers.js";
import { inferNumericKindFromRaw } from "../../types/numeric-helpers.js";

/**
 * Convert string or numeric literal
 *
 * For numeric literals, attaches numericIntent directly on the expression
 * based on the raw lexeme. This is expression-level information that does
 * NOT modify the inferredType (which remains "number" = double semantically).
 */
export const convertLiteral = (
  node: ts.StringLiteral | ts.NumericLiteral,
  checker: ts.TypeChecker
): IrLiteralExpression => {
  const raw = node.getText();
  const value = ts.isStringLiteral(node) ? node.text : Number(node.text);

  return {
    kind: "literal",
    value,
    raw,
    inferredType: getInferredType(node, checker),
    sourceSpan: getSourceSpan(node),
    // For numeric literals, infer numeric kind from lexeme form
    // This is expression-level, not type-level
    numericIntent:
      typeof value === "number" ? inferNumericKindFromRaw(raw) : undefined,
  };
};
