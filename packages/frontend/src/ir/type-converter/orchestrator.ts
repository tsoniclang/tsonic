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
            elementType: convertType(firstElement.type.elementType, checker),
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
        return convertType(element.type, checker);
      }
      return convertType(element, checker);
    });
    return { kind: "tupleType", elementTypes } as IrTupleType;
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

  // TypeQuery: typeof X - resolve to the type of the referenced value
  // DETERMINISTIC: Get type from declaration's TypeNode, not TS inference
  if (ts.isTypeQueryNode(typeNode)) {
    const symbol = checker.getSymbolAtLocation(typeNode.exprName);
    if (symbol) {
      const declarations = symbol.getDeclarations();
      if (declarations && declarations.length > 0) {
        for (const decl of declarations) {
          // Variable declaration with explicit type: const x: Foo = ...
          if (ts.isVariableDeclaration(decl) && decl.type) {
            return convertType(decl.type, checker);
          }
          // Variable declaration with new expression: const x = new Foo()
          if (ts.isVariableDeclaration(decl) && decl.initializer) {
            if (
              ts.isNewExpression(decl.initializer) &&
              ts.isIdentifier(decl.initializer.expression)
            ) {
              // typeof x where x = new Foo() → Foo
              const className = decl.initializer.expression.text;
              if (decl.initializer.typeArguments) {
                return {
                  kind: "referenceType",
                  name: className,
                  typeArguments: decl.initializer.typeArguments.map((ta) =>
                    convertType(ta, checker)
                  ),
                };
              }
              return { kind: "referenceType", name: className };
            }
          }
          // Class declaration: typeof SomeClass → SomeClass type
          if (ts.isClassDeclaration(decl) && decl.name) {
            return { kind: "referenceType", name: decl.name.text };
          }
          // Function declaration: typeof someFunc → function type
          if (ts.isFunctionDeclaration(decl)) {
            return convertFunctionType(
              ts.factory.createFunctionTypeNode(
                decl.typeParameters,
                decl.parameters,
                decl.type ?? ts.factory.createKeywordTypeNode(ts.SyntaxKind.VoidKeyword)
              ),
              checker,
              convertType
            );
          }
          // Parameter with explicit type
          if (ts.isParameter(decl) && decl.type) {
            return convertType(decl.type, checker);
          }
        }
      }
    }
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
