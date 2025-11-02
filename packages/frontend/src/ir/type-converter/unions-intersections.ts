/**
 * Union and intersection type conversion
 */

import * as ts from "typescript";
import { IrType } from "../types.js";

/**
 * Convert TypeScript union type to IR union type
 */
export const convertUnionType = (
  node: ts.UnionTypeNode,
  checker: ts.TypeChecker,
  convertType: (node: ts.TypeNode, checker: ts.TypeChecker) => IrType
): IrType => {
  return {
    kind: "unionType",
    types: node.types.map((t) => convertType(t, checker)),
  };
};

/**
 * Convert TypeScript intersection type to IR intersection type
 */
export const convertIntersectionType = (
  node: ts.IntersectionTypeNode,
  checker: ts.TypeChecker,
  convertType: (node: ts.TypeNode, checker: ts.TypeChecker) => IrType
): IrType => {
  return {
    kind: "intersectionType",
    types: node.types.map((t) => convertType(t, checker)),
  };
};
