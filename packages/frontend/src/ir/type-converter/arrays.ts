/**
 * Array type conversion
 */

import * as ts from "typescript";
import { IrType } from "../types.js";
import type { Binding } from "../binding/index.js";

/**
 * Convert TypeScript array type to IR array type
 */
export const convertArrayType = (
  node: ts.ArrayTypeNode,
  binding: Binding,
  convertType: (node: ts.TypeNode, binding: Binding) => IrType
): IrType => {
  return {
    kind: "arrayType",
    elementType: convertType(node.elementType, binding),
    origin: "explicit",
  };
};
