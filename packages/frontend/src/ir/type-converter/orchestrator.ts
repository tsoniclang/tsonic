/**
 * Type conversion orchestrator
 */

import * as ts from "typescript";
import {
  IrType,
  IrFunctionType,
  IrObjectType,
  IrDictionaryType,
  IrTupleType,
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
import type { Binding } from "../binding/index.js";

/**
 * Convert TypeScript type node to IR type
 */
export const convertType = (
  typeNode: ts.TypeNode,
  binding: Binding
): IrType => {
  // Type references (including primitive type names)
  if (ts.isTypeReferenceNode(typeNode)) {
    return convertTypeReference(typeNode, binding, convertType);
  }

  // Primitive keywords
  const primitiveType = convertPrimitiveKeyword(typeNode.kind);
  if (primitiveType) {
    return primitiveType;
  }

  // Array types
  if (ts.isArrayTypeNode(typeNode)) {
    return convertArrayType(typeNode, binding, convertType);
  }

  // Tuple types
  if (ts.isTupleTypeNode(typeNode)) {
    // Check for rest elements - not fully supported in C# ValueTuple
    const hasRest = typeNode.elements.some((el) => ts.isRestTypeNode(el));

    if (hasRest) {
      // If tuple is just [...T[]] (pure variadic), treat as array type
      // If tuple has both fixed and rest elements, fall through to anyType
      // (TODO: add proper diagnostic for mixed variadic tuples)
      const firstElement = typeNode.elements[0];
      if (
        typeNode.elements.length === 1 &&
        firstElement &&
        ts.isRestTypeNode(firstElement)
      ) {
        if (ts.isArrayTypeNode(firstElement.type)) {
          // [...T[]] → T[]
          return {
            kind: "arrayType",
            elementType: convertType(firstElement.type.elementType, binding),
            origin: "explicit",
          };
        }
      }
      // Mixed variadic tuples not supported - fall through to anyType
      return { kind: "anyType" };
    }

    const elementTypes = typeNode.elements.map((element) => {
      // Handle named tuple elements (e.g., [name: string, age: number])
      if (ts.isNamedTupleMember(element)) {
        return convertType(element.type, binding);
      }
      return convertType(element, binding);
    });
    return { kind: "tupleType", elementTypes } as IrTupleType;
  }

  // Function types
  if (ts.isFunctionTypeNode(typeNode)) {
    return convertFunctionType(typeNode, binding, convertType);
  }

  // Object/interface types
  if (ts.isTypeLiteralNode(typeNode)) {
    return convertObjectType(typeNode, binding, convertType);
  }

  // Union types
  if (ts.isUnionTypeNode(typeNode)) {
    return convertUnionType(typeNode, binding, convertType);
  }

  // Intersection types
  if (ts.isIntersectionTypeNode(typeNode)) {
    return convertIntersectionType(typeNode, binding, convertType);
  }

  // Literal types
  if (ts.isLiteralTypeNode(typeNode)) {
    return convertLiteralType(typeNode);
  }

  // Parenthesized types
  if (ts.isParenthesizedTypeNode(typeNode)) {
    return convertType(typeNode.type, binding);
  }

  // Type predicate return types: (x is T) has no direct C# type-level equivalent.
  // MVP: lower to boolean so we can emit valid C# and avoid anyType/ICE.
  if (ts.isTypePredicateNode(typeNode)) {
    return { kind: "primitiveType", name: "boolean" };
  }

  // TypeQuery: typeof X - resolve to the type of the referenced value
  // DETERMINISTIC: Get type from declaration's TypeNode, not TS inference
  if (ts.isTypeQueryNode(typeNode)) {
    // Resolve the expression name to its declaration using Binding
    // For simple identifiers, use resolveIdentifier. For qualified names,
    // we need to traverse the AST to find the declaration.
    const exprName = typeNode.exprName;
    if (ts.isIdentifier(exprName)) {
      const declId = binding.resolveIdentifier(exprName);
      if (declId) {
        const declInfo = binding.getHandleRegistry().getDecl(declId);
        // If we have a type node from the declaration, convert it
        if (declInfo?.typeNode) {
          return convertType(declInfo.typeNode as ts.TypeNode, binding);
        }
        // For classes/interfaces, return a referenceType with the name
        if (declInfo?.kind === "class" || declInfo?.kind === "interface") {
          return { kind: "referenceType", name: exprName.text };
        }
        // For functions, we can't easily construct a function type without
        // access to the declaration node itself, so fall through to anyType
      }
    }
    // For qualified names (A.B.C), fall through to anyType
    // TODO: Add support for qualified name resolution if needed
    // Fallback: use anyType as marker - IR soundness gate will emit TSN7414
    return { kind: "anyType" };
  }

  // Default: use anyType as marker for unsupported types
  // The IR soundness gate will catch this and emit TSN7414
  return { kind: "anyType" };
};

// Re-export specialized converters for backward compatibility
export { convertFunctionType } from "./functions.js";
export { convertObjectType } from "./objects.js";

// Export types
export type { IrFunctionType, IrObjectType, IrDictionaryType, IrTupleType };
