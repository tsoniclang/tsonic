/**
 * Union and intersection type conversion
 */

import * as ts from "typescript";
import { IrType } from "../../../types.js";
import type { Binding } from "../../../binding/index.js";

/**
 * Convert TypeScript union type to IR union type
 */
export const convertUnionType = (
  node: ts.UnionTypeNode,
  binding: Binding,
  convertType: (node: ts.TypeNode, binding: Binding) => IrType
): IrType => {
  return {
    kind: "unionType",
    types: node.types.map((t) => convertType(t, binding)),
  };
};

/**
 * Convert TypeScript intersection type to IR intersection type
 */
export const convertIntersectionType = (
  node: ts.IntersectionTypeNode,
  binding: Binding,
  convertType: (node: ts.TypeNode, binding: Binding) => IrType
): IrType => {
  return {
    kind: "intersectionType",
    types: node.types.map((t) => convertType(t, binding)),
  };
};
