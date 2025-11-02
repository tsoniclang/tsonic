/**
 * Reference type conversion
 */

import * as ts from "typescript";
import { IrType } from "../types.js";
import { isPrimitiveTypeName, getPrimitiveType } from "./primitives.js";

/**
 * Convert TypeScript type reference to IR type
 * Handles both primitive type names and user-defined types
 */
export const convertTypeReference = (
  node: ts.TypeReferenceNode,
  checker: ts.TypeChecker,
  convertType: (node: ts.TypeNode, checker: ts.TypeChecker) => IrType
): IrType => {
  const typeName = ts.isIdentifier(node.typeName)
    ? node.typeName.text
    : node.typeName.getText();

  // Check for primitive type names
  if (isPrimitiveTypeName(typeName)) {
    return getPrimitiveType(typeName);
  }

  // Reference type (user-defined or library)
  return {
    kind: "referenceType",
    name: typeName,
    typeArguments: node.typeArguments?.map((t) => convertType(t, checker)),
  };
};
