/**
 * Literal type conversion
 */

import * as ts from "typescript";
import { IrType } from "../../../types.js";

/**
 * Convert TypeScript literal type to IR literal type
 */
export const convertLiteralType = (node: ts.LiteralTypeNode): IrType => {
  const literal = node.literal;

  if (ts.isStringLiteral(literal)) {
    return { kind: "literalType", value: literal.text };
  }

  if (ts.isNumericLiteral(literal)) {
    return { kind: "literalType", value: Number(literal.text) };
  }

  if (
    ts.isPrefixUnaryExpression(literal) &&
    ts.isNumericLiteral(literal.operand) &&
    (literal.operator === ts.SyntaxKind.MinusToken ||
      literal.operator === ts.SyntaxKind.PlusToken)
  ) {
    const magnitude = Number(literal.operand.text);
    return {
      kind: "literalType",
      value:
        literal.operator === ts.SyntaxKind.MinusToken ? -magnitude : magnitude,
    };
  }

  if (literal.kind === ts.SyntaxKind.TrueKeyword) {
    return { kind: "literalType", value: true };
  }

  if (literal.kind === ts.SyntaxKind.FalseKeyword) {
    return { kind: "literalType", value: false };
  }

  if (literal.kind === ts.SyntaxKind.NullKeyword) {
    return { kind: "primitiveType", name: "null" };
  }

  if (literal.kind === ts.SyntaxKind.UndefinedKeyword) {
    return { kind: "primitiveType", name: "undefined" };
  }

  // Fallback for unrecognized literals - use anyType as marker
  // The IR soundness gate will catch this and emit TSN7414
  return { kind: "anyType" };
};
