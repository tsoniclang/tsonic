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
} from "../../../types.js";
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
import type { Binding, BindingInternal } from "../../../binding/index.js";

const dedupeUnionMembers = (types: readonly IrType[]): readonly IrType[] => {
  const seen = new Set<string>();
  const result: IrType[] = [];
  for (const type of types) {
    const key = JSON.stringify(type);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(type);
  }
  return result;
};

const toUnionOrSingle = (types: readonly IrType[]): IrType => {
  const deduped = dedupeUnionMembers(types);
  if (deduped.length === 0) return { kind: "unknownType" };
  if (deduped.length === 1) {
    const first = deduped[0];
    return first ?? { kind: "unknownType" };
  }
  return { kind: "unionType", types: deduped };
};

/**
 * Convert TypeScript type node to IR type
 */
export const convertType = (
  typeNode: ts.TypeNode,
  binding: Binding
): IrType => {
  // Heritage clause type syntax (`extends Foo<T>`, `implements Bar<U>`) is represented
  // as ExpressionWithTypeArguments in the TS AST. This must be treated like a normal
  // type reference so NominalEnv can compute substitution through inheritance chains.
  if (ts.isExpressionWithTypeArguments(typeNode)) {
    const toEntityName = (expr: ts.Expression): ts.EntityName | undefined => {
      if (ts.isIdentifier(expr)) return expr;
      if (ts.isPropertyAccessExpression(expr)) {
        if (!ts.isIdentifier(expr.name)) return undefined;
        const left = toEntityName(expr.expression);
        return left
          ? ts.factory.createQualifiedName(left, expr.name)
          : undefined;
      }
      return undefined;
    };

    const entityName = toEntityName(typeNode.expression);
    if (entityName) {
      const ref = ts.factory.createTypeReferenceNode(
        entityName,
        typeNode.typeArguments
      );
      return convertTypeReference(ref, binding, convertType);
    }

    // Fallback: preserve text form (should be rare; computed expressions).
    return {
      kind: "referenceType",
      name: typeNode.expression.getText(),
      typeArguments: typeNode.typeArguments?.map((t) =>
        convertType(t, binding)
      ),
    };
  }

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
    // Check for rest elements.
    const hasRest = typeNode.elements.some(
      (el) =>
        ts.isRestTypeNode(el) ||
        (ts.isNamedTupleMember(el) &&
          (el.dotDotDotToken !== undefined || ts.isRestTypeNode(el.type)))
    );

    if (hasRest) {
      const elementTypes: IrType[] = [];

      for (const element of typeNode.elements) {
        if (ts.isNamedTupleMember(element)) {
          if (
            element.dotDotDotToken !== undefined ||
            ts.isRestTypeNode(element.type)
          ) {
            const restType = ts.isRestTypeNode(element.type)
              ? element.type.type
              : element.type;
            if (ts.isArrayTypeNode(restType)) {
              elementTypes.push(convertType(restType.elementType, binding));
              continue;
            }
            if (ts.isTupleTypeNode(restType)) {
              for (const nestedElement of restType.elements) {
                if (ts.isNamedTupleMember(nestedElement)) {
                  elementTypes.push(convertType(nestedElement.type, binding));
                } else if (ts.isRestTypeNode(nestedElement)) {
                  if (ts.isArrayTypeNode(nestedElement.type)) {
                    elementTypes.push(
                      convertType(nestedElement.type.elementType, binding)
                    );
                  } else {
                    elementTypes.push({ kind: "unknownType" });
                  }
                } else {
                  elementTypes.push(convertType(nestedElement, binding));
                }
              }
              continue;
            }
            elementTypes.push({ kind: "unknownType" });
            continue;
          }

          elementTypes.push(convertType(element.type, binding));
          continue;
        }

        if (ts.isRestTypeNode(element)) {
          const restType = element.type;
          if (ts.isArrayTypeNode(restType)) {
            elementTypes.push(convertType(restType.elementType, binding));
            continue;
          }
          if (ts.isTupleTypeNode(restType)) {
            for (const nestedElement of restType.elements) {
              if (ts.isNamedTupleMember(nestedElement)) {
                elementTypes.push(convertType(nestedElement.type, binding));
              } else if (ts.isRestTypeNode(nestedElement)) {
                if (ts.isArrayTypeNode(nestedElement.type)) {
                  elementTypes.push(
                    convertType(nestedElement.type.elementType, binding)
                  );
                } else {
                  elementTypes.push({ kind: "unknownType" });
                }
              } else {
                elementTypes.push(convertType(nestedElement, binding));
              }
            }
            continue;
          }
          elementTypes.push({ kind: "unknownType" });
          continue;
        }

        elementTypes.push(convertType(element, binding));
      }

      return {
        kind: "arrayType",
        elementType: toUnionOrSingle(elementTypes),
        origin: "explicit",
      };
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

  // Mapped types
  //
  // Direct mapped syntax is TS-only and has no first-class CLR type equivalent.
  // For deterministic AOT lowering we treat it as `unknown` at IR level
  // (which emits to `object?`) instead of falling back to anyType/ICE.
  if (ts.isMappedTypeNode(typeNode)) {
    return { kind: "unknownType" };
  }

  // Conditional types
  //
  // Utility-conditionals (Extract/Exclude/NonNullable/...) are expanded via
  // type references in convertTypeReference(). Direct conditional syntax is
  // lowered conservatively to `unknown` for stable emission.
  if (ts.isConditionalTypeNode(typeNode)) {
    return { kind: "unknownType" };
  }

  // infer type nodes are only valid within conditional types. If one survives
  // to direct conversion, lower conservatively to unknown.
  if (ts.isInferTypeNode(typeNode)) {
    return { kind: "unknownType" };
  }

  // Literal types
  if (ts.isLiteralTypeNode(typeNode)) {
    return convertLiteralType(typeNode);
  }

  // Parenthesized types
  if (ts.isParenthesizedTypeNode(typeNode)) {
    return convertType(typeNode.type, binding);
  }

  // Type operators
  // - `readonly T[]` should behave like `T[]` at the IR level (we do not model
  //   readonly-ness in emitted C# types).
  // Other operators (e.g. `keyof`) are handled elsewhere (utility-type expansion)
  // or intentionally rejected by the soundness gate when they lower to anyType.
  if (ts.isTypeOperatorNode(typeNode)) {
    if (typeNode.operator === ts.SyntaxKind.ReadonlyKeyword) {
      return convertType(typeNode.type, binding);
    }
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
        const declInfo = (binding as BindingInternal)
          ._getHandleRegistry()
          .getDecl(declId);
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
    // Qualified name typeof is intentionally unsupported here (IR gate emits TSN7414).
    return { kind: "anyType" };
  }

  // Default: use anyType as marker for unsupported types
  // The IR soundness gate will catch this and emit TSN7414
  return { kind: "anyType" };
};

// Export types
export type { IrFunctionType, IrObjectType, IrDictionaryType, IrTupleType };
