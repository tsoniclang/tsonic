/**
 * Type conversion orchestrator – facade that delegates to sub-modules.
 *
 * Sub-modules:
 *   - type-operators.ts: keyof, indexed access, template literals, shared helpers
 *   - value-inference.ts: deterministic value type inference from declarations/expressions
 */

import type { TstsNode } from "@tsonic/tsts";
import { TstsSyntax } from "@tsonic/tsts";
import type {
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
import {
  toUnionOrSingle,
  resolveKeyofFromType,
  resolveIndexedAccessFromTypes,
  convertTemplateLiteralType,
} from "./type-operators.js";
import {
  getTypeParameterConstraintNode,
  withTypeParameterConstraint,
  inferTypeFromValueDeclaration,
} from "./value-inference.js";
import {
  assertConverterNode,
  entityNameToText,
  nodeTypeArguments,
  typeOperatorKind,
} from "./tsts-syntax.js";

/**
 * Convert TypeScript type node to IR type
 */
const POLYMORPHIC_THIS_MARKER = "__tsonic_polymorphic_this";

export const convertType = (
  typeNode: TstsNode,
  binding: Binding
): IrType => {
  if (TstsSyntax.IsExpressionWithTypeArguments(typeNode)) {
    const name = entityNameToText(TstsSyntax.Node_Expression(typeNode));
    if (!name) {
      return { kind: "unknownType" };
    }
    return {
      kind: "referenceType",
      name,
      typeArguments: nodeTypeArguments(typeNode).map((t) =>
        convertType(t, binding)
      ),
    };
  }

  // Type references (including primitive type names)
  if (TstsSyntax.IsTypeReferenceNode(typeNode)) {
    return convertTypeReference(typeNode, binding, convertType);
  }

  if (typeNode.Kind === TstsSyntax.KindThisType) {
    return {
      kind: "typeParameterType",
      name: POLYMORPHIC_THIS_MARKER,
    };
  }

  // Primitive keywords
  const primitiveType = convertPrimitiveKeyword(typeNode.Kind);
  if (primitiveType) {
    return primitiveType;
  }

  // Array types
  if (TstsSyntax.IsArrayTypeNode(typeNode)) {
    return convertArrayType(typeNode, binding, convertType);
  }

  // Tuple types
  if (TstsSyntax.IsTupleTypeNode(typeNode)) {
    const tupleElements =
      TstsSyntax.AsTupleTypeNode(typeNode)?.Elements?.Nodes?.filter(
        (element): element is TstsNode => element !== undefined
      ) ?? [];
    // Check for rest elements.
    const hasRest = tupleElements.some(
      (el) =>
        TstsSyntax.IsRestTypeNode(el) ||
        (TstsSyntax.IsNamedTupleMember(el) &&
          (TstsSyntax.AsNamedTupleMember(el)?.DotDotDotToken !== undefined ||
            TstsSyntax.IsRestTypeNode(
              TstsSyntax.AsNamedTupleMember(el)?.Type
            )))
    );

    if (hasRest) {
      const restIndex = tupleElements.findIndex(
        (el) =>
          TstsSyntax.IsRestTypeNode(el) ||
          (TstsSyntax.IsNamedTupleMember(el) &&
            (TstsSyntax.AsNamedTupleMember(el)?.DotDotDotToken !== undefined ||
              TstsSyntax.IsRestTypeNode(
                TstsSyntax.AsNamedTupleMember(el)?.Type
              )))
      );
      const elementTypes: IrType[] = [];

      for (const element of tupleElements) {
        if (TstsSyntax.IsNamedTupleMember(element)) {
          const namedElement = TstsSyntax.AsNamedTupleMember(element);
          const namedElementType = namedElement?.Type;
          if (
            namedElement?.DotDotDotToken !== undefined ||
            TstsSyntax.IsRestTypeNode(namedElementType)
          ) {
            const restType = TstsSyntax.IsRestTypeNode(namedElementType)
              ? TstsSyntax.AsRestTypeNode(namedElementType)?.Type
              : namedElementType;
            if (restType && TstsSyntax.IsArrayTypeNode(restType)) {
              const elementType = TstsSyntax.AsArrayTypeNode(restType)?.ElementType;
              elementTypes.push(
                elementType ? convertType(elementType, binding) : { kind: "unknownType" }
              );
              continue;
            }
            if (restType && TstsSyntax.IsTupleTypeNode(restType)) {
              for (const nestedElement of
                TstsSyntax.AsTupleTypeNode(restType)?.Elements?.Nodes ?? []) {
                if (!nestedElement) continue;
                if (TstsSyntax.IsNamedTupleMember(nestedElement)) {
                  const nestedType =
                    TstsSyntax.AsNamedTupleMember(nestedElement)?.Type;
                  elementTypes.push(
                    nestedType
                      ? convertType(nestedType, binding)
                      : { kind: "unknownType" }
                  );
                } else if (TstsSyntax.IsRestTypeNode(nestedElement)) {
                  const nestedRestType =
                    TstsSyntax.AsRestTypeNode(nestedElement)?.Type;
                  if (
                    nestedRestType &&
                    TstsSyntax.IsArrayTypeNode(nestedRestType)
                  ) {
                    const nestedElementType =
                      TstsSyntax.AsArrayTypeNode(nestedRestType)?.ElementType;
                    elementTypes.push(
                      nestedElementType
                        ? convertType(nestedElementType, binding)
                        : { kind: "unknownType" }
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

          elementTypes.push(
            namedElementType
              ? convertType(namedElementType, binding)
              : { kind: "unknownType" }
          );
          continue;
        }

        if (TstsSyntax.IsRestTypeNode(element)) {
          const restType = TstsSyntax.AsRestTypeNode(element)?.Type;
          if (restType && TstsSyntax.IsArrayTypeNode(restType)) {
            const elementType = TstsSyntax.AsArrayTypeNode(restType)?.ElementType;
            elementTypes.push(
              elementType ? convertType(elementType, binding) : { kind: "unknownType" }
            );
            continue;
          }
          if (restType && TstsSyntax.IsTupleTypeNode(restType)) {
            for (const nestedElement of
              TstsSyntax.AsTupleTypeNode(restType)?.Elements?.Nodes ?? []) {
              if (!nestedElement) continue;
              if (TstsSyntax.IsNamedTupleMember(nestedElement)) {
                const nestedType =
                  TstsSyntax.AsNamedTupleMember(nestedElement)?.Type;
                elementTypes.push(
                  nestedType
                    ? convertType(nestedType, binding)
                    : { kind: "unknownType" }
                );
              } else if (TstsSyntax.IsRestTypeNode(nestedElement)) {
                const nestedRestType =
                  TstsSyntax.AsRestTypeNode(nestedElement)?.Type;
                if (
                  nestedRestType &&
                  TstsSyntax.IsArrayTypeNode(nestedRestType)
                ) {
                  const nestedElementType =
                    TstsSyntax.AsArrayTypeNode(nestedRestType)?.ElementType;
                  elementTypes.push(
                    nestedElementType
                      ? convertType(nestedElementType, binding)
                      : { kind: "unknownType" }
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

      const hasRepresentableSpreadMetadata =
        restIndex >= 0 &&
        tupleElements
          .slice(restIndex + 1)
          .every(
            (element) =>
              TstsSyntax.IsRestTypeNode(element) ||
              (TstsSyntax.IsNamedTupleMember(element) &&
                (TstsSyntax.AsNamedTupleMember(element)?.DotDotDotToken !==
                  undefined ||
                  TstsSyntax.IsRestTypeNode(
                    TstsSyntax.AsNamedTupleMember(element)?.Type
                  )))
          );
      const tuplePrefixElementTypes = hasRepresentableSpreadMetadata
        ? tupleElements.slice(0, restIndex).flatMap((element): IrType[] => {
            if (TstsSyntax.IsNamedTupleMember(element)) {
              const elementType = TstsSyntax.AsNamedTupleMember(element)?.Type;
              return [
                elementType
                  ? convertType(elementType, binding)
                  : { kind: "unknownType" },
              ];
            }
            if (TstsSyntax.IsRestTypeNode(element)) {
              return [];
            }
            return [convertType(element, binding)];
          })
        : undefined;
      const tupleRestElementType = hasRepresentableSpreadMetadata
        ? (() => {
            const restElement = tupleElements[restIndex];
            if (!restElement) return undefined;

            if (TstsSyntax.IsNamedTupleMember(restElement)) {
              const namedRest = TstsSyntax.AsNamedTupleMember(restElement);
              const restType = TstsSyntax.IsRestTypeNode(namedRest?.Type)
                ? TstsSyntax.AsRestTypeNode(namedRest?.Type)?.Type
                : namedRest?.Type;
              if (restType && TstsSyntax.IsArrayTypeNode(restType)) {
                const elementType = TstsSyntax.AsArrayTypeNode(restType)?.ElementType;
                return elementType
                  ? convertType(elementType, binding)
                  : undefined;
              }
              if (restType && TstsSyntax.IsTupleTypeNode(restType)) {
                const nestedRest = (
                  TstsSyntax.AsTupleTypeNode(restType)?.Elements?.Nodes ?? []
                ).find((nestedElement) =>
                  TstsSyntax.IsRestTypeNode(nestedElement)
                );
                const nestedRestType = nestedRest
                  ? TstsSyntax.AsRestTypeNode(nestedRest)?.Type
                  : undefined;
                if (
                  nestedRestType &&
                  TstsSyntax.IsArrayTypeNode(nestedRestType)
                ) {
                  const elementType =
                    TstsSyntax.AsArrayTypeNode(nestedRestType)?.ElementType;
                  return elementType
                    ? convertType(elementType, binding)
                    : undefined;
                }
              }
              return undefined;
            }

            if (TstsSyntax.IsRestTypeNode(restElement)) {
              const restType = TstsSyntax.AsRestTypeNode(restElement)?.Type;
              if (restType && TstsSyntax.IsArrayTypeNode(restType)) {
                const elementType = TstsSyntax.AsArrayTypeNode(restType)?.ElementType;
                return elementType
                  ? convertType(elementType, binding)
                  : undefined;
              }
              if (restType && TstsSyntax.IsTupleTypeNode(restType)) {
                const nestedRest = (
                  TstsSyntax.AsTupleTypeNode(restType)?.Elements?.Nodes ?? []
                ).find((nestedElement) =>
                  TstsSyntax.IsRestTypeNode(nestedElement)
                );
                const nestedRestType = nestedRest
                  ? TstsSyntax.AsRestTypeNode(nestedRest)?.Type
                  : undefined;
                if (
                  nestedRestType &&
                  TstsSyntax.IsArrayTypeNode(nestedRestType)
                ) {
                  const elementType =
                    TstsSyntax.AsArrayTypeNode(nestedRestType)?.ElementType;
                  return elementType
                    ? convertType(elementType, binding)
                    : undefined;
                }
              }
            }

            return undefined;
          })()
        : undefined;

      return {
        kind: "arrayType",
        elementType: toUnionOrSingle(elementTypes),
        origin: "explicit",
        ...((tuplePrefixElementTypes?.length ?? 0) > 0
          ? { tuplePrefixElementTypes }
          : {}),
        ...(tupleRestElementType ? { tupleRestElementType } : {}),
      };
    }

    const elementTypes = tupleElements.map((element) => {
      // Handle named tuple elements (e.g., [name: string, age: number])
      if (TstsSyntax.IsNamedTupleMember(element)) {
        const elementType = TstsSyntax.AsNamedTupleMember(element)?.Type;
        return elementType
          ? convertType(elementType, binding)
          : { kind: "unknownType" };
      }
      return convertType(element, binding);
    });
    return { kind: "tupleType", elementTypes } as IrTupleType;
  }

  // Function types
  if (TstsSyntax.IsFunctionTypeNode(typeNode)) {
    return convertFunctionType(typeNode, binding, convertType);
  }

  // Constructor types project to their constructed value type.
  // Static-side members are preserved separately by enclosing intersections.
  if (TstsSyntax.IsConstructorTypeNode(typeNode)) {
    const constructorType = TstsSyntax.Node_Type(typeNode);
    return constructorType
      ? convertType(constructorType, binding)
      : { kind: "unknownType" };
  }

  // Object/interface types
  if (TstsSyntax.IsTypeLiteralNode(typeNode)) {
    return convertObjectType(typeNode, binding, convertType);
  }

  // Union types
  if (TstsSyntax.IsUnionTypeNode(typeNode)) {
    return convertUnionType(typeNode, binding, convertType);
  }

  // Intersection types
  if (TstsSyntax.IsIntersectionTypeNode(typeNode)) {
    return convertIntersectionType(typeNode, binding, convertType);
  }

  // Mapped types
  //
  // Direct mapped syntax is TS-only and has no first-class native target type equivalent.
  // For deterministic AOT lowering we treat it as `unknown` at IR level
  // (which emits to `object?`) instead of falling back to anyType/ICE.
  if (TstsSyntax.IsMappedTypeNode(typeNode)) {
    return { kind: "unknownType" };
  }

  // Conditional types
  //
  // Utility-conditionals (Extract/Exclude/NonNullable/...) are expanded via
  // type references in convertTypeReference(). Direct conditional syntax is
  // lowered conservatively to `unknown` for stable emission.
  if (TstsSyntax.IsConditionalTypeNode(typeNode)) {
    return { kind: "unknownType" };
  }

  // infer type nodes are only valid within conditional types. If one survives
  // to direct conversion, lower conservatively to unknown.
  if (TstsSyntax.IsInferTypeNode(typeNode)) {
    return { kind: "unknownType" };
  }

  // Literal types
  if (TstsSyntax.IsLiteralTypeNode(typeNode)) {
    return convertLiteralType(typeNode);
  }

  // Parenthesized types
  if (TstsSyntax.IsParenthesizedTypeNode(typeNode)) {
    const inner = TstsSyntax.AsParenthesizedTypeNode(typeNode)?.Type;
    return inner ? convertType(inner, binding) : { kind: "unknownType" };
  }

  // Type operators
  // - `readonly T[]` should behave like `T[]` at the IR level (we do not model
  //   readonly-ness in emitted target types).
  // - `keyof T` is lowered deterministically when key information can be
  //   recovered from structural IR type data.
  if (TstsSyntax.IsTypeOperatorNode(typeNode)) {
    const operator = typeOperatorKind(typeNode);
    const targetType = TstsSyntax.AsTypeOperatorNode(typeNode)?.Type;
    if (!targetType) {
      return { kind: "unknownType" };
    }
    if (operator === TstsSyntax.KindReadonlyKeyword) {
      return convertType(targetType, binding);
    }
    if (operator === TstsSyntax.KindKeyOfKeyword) {
      const constraint = getTypeParameterConstraintNode(targetType, binding);
      const target = constraint ?? targetType;
      return resolveKeyofFromType(convertType(target, binding));
    }
  }

  // Indexed access types: T[K]
  if (TstsSyntax.IsIndexedAccessTypeNode(typeNode)) {
    const indexedAccess = TstsSyntax.AsIndexedAccessTypeNode(typeNode);
    if (!indexedAccess?.ObjectType || !indexedAccess.IndexType) {
      return { kind: "unknownType" };
    }
    const objectType = convertType(
      withTypeParameterConstraint(indexedAccess.ObjectType, binding),
      binding
    );
    const indexType = convertType(
      withTypeParameterConstraint(indexedAccess.IndexType, binding),
      binding
    );
    return resolveIndexedAccessFromTypes(objectType, indexType);
  }

  // Template literal types.
  if (TstsSyntax.IsTemplateLiteralTypeNode(typeNode)) {
    return convertTemplateLiteralType(typeNode, binding, convertType);
  }

  if (TstsSyntax.IsTypePredicateNode(typeNode)) {
    if (TstsSyntax.AsTypePredicateNode(typeNode)?.AssertsModifier !== undefined) {
      return { kind: "voidType" };
    }
    return { kind: "primitiveType", name: "boolean" };
  }

  // TypeQuery: typeof X - resolve to the type of the referenced value
  // DETERMINISTIC: Get type from declaration's TypeNode, not TS inference
  if (TstsSyntax.IsTypeQueryNode(typeNode)) {
    const exprName = TstsSyntax.AsTypeQueryNode(typeNode)?.ExprName;
    if (exprName && TstsSyntax.IsIdentifier(exprName)) {
      const declId = binding.resolveIdentifier(exprName);
      if (declId) {
        const declInfo = (binding as BindingInternal)
          ._getHandleRegistry()
          .getDecl(declId);
        const inferred = inferTypeFromValueDeclaration(
          asConverterNodeOrUndefined(
            declInfo?.declNode ??
              declInfo?.valueDeclNode ??
              declInfo?.typeDeclNode
          ),
          binding,
          new Set([declId.id]),
          convertType
        );
        if (inferred) {
          return inferred;
        }
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

const asConverterNodeOrUndefined = (node: unknown): TstsNode | undefined =>
  node === undefined ? undefined : assertConverterNode(node);

// Export types
export type { IrFunctionType, IrObjectType, IrDictionaryType, IrTupleType };
