/**
 * Type conversion orchestrator
 */

import * as ts from "typescript";
import {
  IrType,
  IrFunctionType,
  IrObjectType,
  IrDictionaryType,
} from "../types.js";
import { convertPrimitiveKeyword } from "./primitives.js";
import { convertTypeReference } from "./references.js";
import { convertArrayType } from "./arrays.js";
import { convertFunctionType } from "./functions.js";
import { convertObjectType } from "./objects.js";
import {
  convertUnionType,
  convertIntersectionType,
} from "./unions-intersections.js";
import { convertLiteralType } from "./literals.js";

/**
 * Convert TypeScript type node to IR type
 */
export const convertType = (
  typeNode: ts.TypeNode,
  checker: ts.TypeChecker
): IrType => {
  // Type references (including primitive type names)
  if (ts.isTypeReferenceNode(typeNode)) {
    return convertTypeReference(typeNode, checker, convertType);
  }

  // Primitive keywords
  const primitiveType = convertPrimitiveKeyword(typeNode.kind);
  if (primitiveType) {
    return primitiveType;
  }

  // Array types
  if (ts.isArrayTypeNode(typeNode)) {
    return convertArrayType(typeNode, checker, convertType);
  }

  // Function types
  if (ts.isFunctionTypeNode(typeNode)) {
    return convertFunctionType(typeNode, checker, convertType);
  }

  // Object/interface types
  if (ts.isTypeLiteralNode(typeNode)) {
    return convertObjectType(typeNode, checker, convertType);
  }

  // Union types
  if (ts.isUnionTypeNode(typeNode)) {
    return convertUnionType(typeNode, checker, convertType);
  }

  // Intersection types
  if (ts.isIntersectionTypeNode(typeNode)) {
    return convertIntersectionType(typeNode, checker, convertType);
  }

  // Literal types
  if (ts.isLiteralTypeNode(typeNode)) {
    return convertLiteralType(typeNode);
  }

  // Parenthesized types
  if (ts.isParenthesizedTypeNode(typeNode)) {
    return convertType(typeNode.type, checker);
  }

  // Type predicate return types: (x is T) has no direct C# type-level equivalent.
  // MVP: lower to boolean so we can emit valid C# and avoid anyType/ICE.
  if (ts.isTypePredicateNode(typeNode)) {
    return { kind: "primitiveType", name: "boolean" };
  }

  // Default to any type for unsupported types
  return { kind: "anyType" };
};

// Re-export specialized converters for backward compatibility
export { convertFunctionType } from "./functions.js";
export { convertObjectType } from "./objects.js";

// Export types
export type { IrFunctionType, IrObjectType, IrDictionaryType };
