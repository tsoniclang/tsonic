/**
 * Literal type conversion
 */

import type { TstsNode } from "@tsonic/tsts";
import { TstsSyntax } from "@tsonic/tsts";
import { IrType } from "../../../types.js";
import { literalNodeValue } from "./tsts-syntax.js";

/**
 * Convert TSTS literal type to IR literal type
 */
export const convertLiteralType = (node: TstsNode): IrType => {
  const literal = TstsSyntax.AsLiteralTypeNode(node)?.Literal;
  if (!literal) return { kind: "anyType" };

  const value = literalNodeValue(literal);
  if (value === null) {
    return { kind: "primitiveType", name: "null" };
  }
  if (literal.Kind === TstsSyntax.KindUndefinedKeyword) {
    return { kind: "primitiveType", name: "undefined" };
  }
  if (value !== undefined) return { kind: "literalType", value };

  // Fallback for unrecognized literals - use anyType as marker
  // The IR soundness gate will catch this and emit TSN7414
  return { kind: "anyType" };
};
