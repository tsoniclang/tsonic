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
  IrInterfaceMember,
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

const getTypeParameterConstraintNode = (
  typeNode: ts.TypeNode,
  binding: Binding
): ts.TypeNode | undefined => {
  if (!ts.isTypeReferenceNode(typeNode) || !ts.isIdentifier(typeNode.typeName)) {
    return undefined;
  }
  const declId = binding.resolveTypeReference(typeNode);
  if (!declId) return undefined;
  const declInfo = (binding as BindingInternal)._getHandleRegistry().getDecl(declId);
  const declNode = (declInfo?.typeDeclNode ?? declInfo?.declNode) as
    | ts.Declaration
    | undefined;
  if (!declNode || !ts.isTypeParameterDeclaration(declNode)) {
    return undefined;
  }
  return declNode.constraint;
};

const withTypeParameterConstraint = (
  typeNode: ts.TypeNode,
  binding: Binding
): ts.TypeNode => getTypeParameterConstraintNode(typeNode, binding) ?? typeNode;

const getMembersFromType = (
  type: IrType
): readonly IrInterfaceMember[] | undefined => {
  if (type.kind === "objectType") return type.members;
  if (type.kind === "referenceType" && type.structuralMembers) {
    return type.structuralMembers;
  }
  return undefined;
};

const memberValueType = (member: IrInterfaceMember): IrType =>
  member.kind === "propertySignature"
    ? member.type
    : ({
        kind: "functionType",
        parameters: member.parameters,
        returnType: member.returnType ?? { kind: "voidType" },
      } as IrFunctionType);

const resolveKeyofFromType = (type: IrType): IrType => {
  if (type.kind === "unionType") {
    // TS semantics for keyof unions are intersection-like; for deterministic AOT
    // lowering we conservatively use the union of keys from all members.
    const memberKeys = type.types.map((member) => resolveKeyofFromType(member));
    return toUnionOrSingle(memberKeys);
  }

  const members = getMembersFromType(type);
  if (members && members.length > 0) {
    return toUnionOrSingle(
      members.map((m) => ({ kind: "literalType", value: m.name } as IrType))
    );
  }

  if (type.kind === "dictionaryType") {
    if (type.keyType.kind === "primitiveType" && type.keyType.name === "string") {
      return toUnionOrSingle([
        { kind: "primitiveType", name: "string" },
        { kind: "primitiveType", name: "number" },
      ]);
    }
    return type.keyType;
  }

  if (type.kind === "arrayType" || type.kind === "tupleType") {
    return { kind: "primitiveType", name: "number" };
  }

  if (type.kind === "typeParameterType") {
    return toUnionOrSingle([
      { kind: "primitiveType", name: "string" },
      { kind: "primitiveType", name: "number" },
      { kind: "referenceType", name: "object" },
    ]);
  }

  return { kind: "unknownType" };
};

const lookupMemberTypeByKey = (
  type: IrType,
  key: string
): IrType | undefined => {
  if (type.kind === "tupleType") {
    const index = Number(key);
    if (Number.isInteger(index) && index >= 0 && index < type.elementTypes.length) {
      const element = type.elementTypes[index];
      return element ?? undefined;
    }
    return undefined;
  }

  if (type.kind === "arrayType") {
    const index = Number(key);
    if (Number.isInteger(index)) return type.elementType;
    return undefined;
  }

  const members = getMembersFromType(type);
  if (!members || members.length === 0) return undefined;

  const hits = members.filter((m) => m.name === key).map(memberValueType);
  if (hits.length === 0) return undefined;
  return toUnionOrSingle(hits);
};

const resolveIndexedAccessFromTypes = (
  objectType: IrType,
  indexType: IrType
): IrType => {
  if (objectType.kind === "unionType") {
    return toUnionOrSingle(
      objectType.types.map((member) => resolveIndexedAccessFromTypes(member, indexType))
    );
  }

  if (indexType.kind === "unionType") {
    return toUnionOrSingle(
      indexType.types.map((member) => resolveIndexedAccessFromTypes(objectType, member))
    );
  }

  if (indexType.kind === "literalType") {
    const key = String(indexType.value);
    const hit = lookupMemberTypeByKey(objectType, key);
    if (hit) return hit;

    if (objectType.kind === "dictionaryType") {
      return objectType.valueType;
    }

    if (
      objectType.kind === "arrayType" &&
      typeof indexType.value === "number"
    ) {
      return objectType.elementType;
    }

    if (
      objectType.kind === "tupleType" &&
      typeof indexType.value === "number"
    ) {
      const element = objectType.elementTypes[indexType.value];
      return element ?? { kind: "unknownType" };
    }

    return { kind: "unknownType" };
  }

  if (indexType.kind === "primitiveType") {
    if (
      objectType.kind === "dictionaryType" &&
      (indexType.name === "string" ||
        indexType.name === "number" ||
        indexType.name === "int")
    ) {
      return objectType.valueType;
    }
    if (
      objectType.kind === "arrayType" &&
      (indexType.name === "number" || indexType.name === "int")
    ) {
      return objectType.elementType;
    }
    if (
      objectType.kind === "tupleType" &&
      (indexType.name === "number" || indexType.name === "int")
    ) {
      return toUnionOrSingle(objectType.elementTypes);
    }
    const members = getMembersFromType(objectType);
    if (members && members.length > 0) {
      return toUnionOrSingle(members.map(memberValueType));
    }
    return { kind: "unknownType" };
  }

  if (indexType.kind === "typeParameterType" || indexType.kind === "unknownType") {
    if (objectType.kind === "dictionaryType") {
      return objectType.valueType;
    }
    const members = getMembersFromType(objectType);
    if (members && members.length > 0) {
      return toUnionOrSingle(members.map(memberValueType));
    }
    return { kind: "unknownType" };
  }

  return { kind: "unknownType" };
};

const finiteTemplateTypeStrings = (type: IrType): readonly string[] | undefined => {
  if (type.kind === "literalType") {
    return [String(type.value)];
  }
  if (type.kind === "unionType") {
    const all: string[] = [];
    for (const member of type.types) {
      const expanded = finiteTemplateTypeStrings(member);
      if (!expanded) return undefined;
      all.push(...expanded);
    }
    return all;
  }
  return undefined;
};

const convertTemplateLiteralType = (
  node: ts.TemplateLiteralTypeNode,
  binding: Binding,
  convertTypeFn: (node: ts.TypeNode, binding: Binding) => IrType
): IrType => {
  const MAX_COMBINATIONS = 64;
  let current = [node.head.text];
  for (const span of node.templateSpans) {
    const options = finiteTemplateTypeStrings(convertTypeFn(span.type, binding));
    if (!options || options.length === 0) {
      return { kind: "primitiveType", name: "string" };
    }
    const next: string[] = [];
    for (const prefix of current) {
      for (const option of options) {
        next.push(`${prefix}${option}${span.literal.text}`);
        if (next.length > MAX_COMBINATIONS) {
          return { kind: "primitiveType", name: "string" };
        }
      }
    }
    current = next;
  }
  return toUnionOrSingle(
    current.map((value) => ({ kind: "literalType", value } as IrType))
  );
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
  // - `keyof T` is lowered deterministically when key information can be
  //   recovered from structural IR type data.
  if (ts.isTypeOperatorNode(typeNode)) {
    if (typeNode.operator === ts.SyntaxKind.ReadonlyKeyword) {
      return convertType(typeNode.type, binding);
    }
    if (typeNode.operator === ts.SyntaxKind.KeyOfKeyword) {
      const constraint = getTypeParameterConstraintNode(typeNode.type, binding);
      const target = constraint ?? typeNode.type;
      return resolveKeyofFromType(convertType(target, binding));
    }
  }

  // Indexed access types: T[K]
  if (ts.isIndexedAccessTypeNode(typeNode)) {
    const objectType = convertType(
      withTypeParameterConstraint(typeNode.objectType, binding),
      binding
    );
    const indexType = convertType(
      withTypeParameterConstraint(typeNode.indexType, binding),
      binding
    );
    return resolveIndexedAccessFromTypes(objectType, indexType);
  }

  // Template literal types.
  if (ts.isTemplateLiteralTypeNode(typeNode)) {
    return convertTemplateLiteralType(typeNode, binding, convertType);
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
