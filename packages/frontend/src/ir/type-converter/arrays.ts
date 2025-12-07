/**
 * Array type conversion
 */

import * as ts from "typescript";
import { IrType } from "../types.js";

/**
 * Convert TypeScript array type to IR array type
 */
export const convertArrayType = (
  node: ts.ArrayTypeNode,
  checker: ts.TypeChecker,
  convertType: (node: ts.TypeNode, checker: ts.TypeChecker) => IrType
): IrType => {
  return {
    kind: "arrayType",
    elementType: convertType(node.elementType, checker),
    origin: "explicit",
  };
};
