/**
 * Literal expression converters
 *
 * DETERMINISTIC TYPING: Literal types are derived from lexeme form, NOT TypeScript.
 *
 * Numeric literals:
 * - Integer literals (42, 0xFF) → Int32 → inferredType: int
 * - Floating literals (42.0, 3.14, 1e3) → Double → inferredType: double
 *
 * String literals → inferredType: string
 * Boolean literals → inferredType: boolean (handled elsewhere)
 */

import * as ts from "typescript";
import { IrLiteralExpression, IrType } from "../../types.js";
import { getSourceSpan } from "./helpers.js";
import { inferNumericKindFromRaw } from "../../types/numeric-helpers.js";
import { NumericKind } from "../../types/numeric-kind.js";
import type { ProgramContext } from "../../program-context.js";

/**
 * Derive inferredType from numericIntent (deterministic, no TypeScript).
 */
const deriveTypeFromNumericIntent = (numericIntent: NumericKind): IrType => {
  if (numericIntent === "Int32") {
    return { kind: "referenceType", name: "int" };
  } else if (numericIntent === "Double") {
    return { kind: "primitiveType", name: "number" };
  } else if (numericIntent === "Int64") {
    return { kind: "referenceType", name: "long" };
  } else if (numericIntent === "Single") {
    return { kind: "referenceType", name: "float" };
  } else if (numericIntent === "Byte") {
    return { kind: "referenceType", name: "byte" };
  } else if (numericIntent === "Int16") {
    return { kind: "referenceType", name: "short" };
  } else if (numericIntent === "UInt32") {
    return { kind: "referenceType", name: "uint" };
  } else if (numericIntent === "UInt64") {
    return { kind: "referenceType", name: "ulong" };
  } else if (numericIntent === "UInt16") {
    return { kind: "referenceType", name: "ushort" };
  } else if (numericIntent === "SByte") {
    return { kind: "referenceType", name: "sbyte" };
  }
  // Default to double for unknown
  return { kind: "primitiveType", name: "number" };
};

/**
 * Convert string or numeric literal
 *
 * DETERMINISTIC TYPING: inferredType is derived from the literal value itself,
 * NOT from TypeScript's type checker. This ensures consistent typing regardless
 * of contextual type.
 */
export const convertLiteral = (
  node: ts.StringLiteral | ts.NumericLiteral,
  _ctx: ProgramContext
): IrLiteralExpression => {
  const raw = node.getText();
  const value = ts.isStringLiteral(node) ? node.text : Number(node.text);

  // For numeric literals, derive type from lexeme form
  const numericIntent =
    typeof value === "number" ? inferNumericKindFromRaw(raw) : undefined;

  // Derive inferredType deterministically (no TypeScript)
  // - String literals → string
  // - Numeric literals with numericIntent → derived from intent
  // - Unknown → undefined (let caller handle)
  const inferredType: IrType | undefined =
    typeof value === "string"
      ? { kind: "primitiveType", name: "string" }
      : numericIntent
        ? deriveTypeFromNumericIntent(numericIntent)
        : undefined;

  return {
    kind: "literal",
    value,
    raw,
    inferredType,
    sourceSpan: getSourceSpan(node),
    numericIntent,
  };
};
