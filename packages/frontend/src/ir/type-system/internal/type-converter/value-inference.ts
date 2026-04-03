/**
 * Value type inference – deterministic type recovery from value declarations
 * and expressions without relying on TypeScript's type checker inference.
 */

import * as ts from "typescript";
import type {
  IrType,
  IrFunctionType,
  IrObjectType,
  IrInterfaceMember,
  IrTypeParameter,
} from "../../../types.js";
import type { Binding, BindingInternal } from "../../../binding/index.js";
import {
  toUnionOrSingle,
  getMembersFromType,
  memberValueType,
  typesSyntacticallyEqual,
} from "./type-operators.js";

export const getTypeParameterConstraintNode = (
  typeNode: ts.TypeNode,
  binding: Binding
): ts.TypeNode | undefined => {
  if (
    !ts.isTypeReferenceNode(typeNode) ||
    !ts.isIdentifier(typeNode.typeName)
  ) {
    return undefined;
  }
  const declId = binding.resolveTypeReference(typeNode);
  if (!declId) return undefined;
  const declInfo = (binding as BindingInternal)
    ._getHandleRegistry()
    .getDecl(declId);
  const declNode = (declInfo?.typeDeclNode ?? declInfo?.declNode) as
    | ts.Declaration
    | undefined;
  if (!declNode || !ts.isTypeParameterDeclaration(declNode)) {
    return undefined;
  }
  return declNode.constraint;
};

export const withTypeParameterConstraint = (
  typeNode: ts.TypeNode,
  binding: Binding
): ts.TypeNode => getTypeParameterConstraintNode(typeNode, binding) ?? typeNode;

export function buildFunctionTypeFromSignatureDeclaration(
  declaration: ts.SignatureDeclarationBase,
  binding: Binding,
  convertTypeFn: (node: ts.TypeNode, binding: Binding) => IrType
): IrFunctionType {
  const typeParameters = convertFunctionTypeParameters(
    declaration.typeParameters,
    binding,
    convertTypeFn
  );
  return {
    kind: "functionType",
    ...(typeParameters ? { typeParameters } : {}),
    parameters: declaration.parameters.map((parameter) => ({
      kind: "parameter",
      pattern: ts.isIdentifier(parameter.name)
        ? { kind: "identifierPattern", name: parameter.name.text }
        : { kind: "identifierPattern", name: `p${parameter.pos}` },
      type: parameter.type
        ? convertTypeFn(
            withTypeParameterConstraint(parameter.type, binding),
            binding
          )
        : { kind: "unknownType" },
      isOptional: !!parameter.questionToken || !!parameter.initializer,
      isRest: !!parameter.dotDotDotToken,
      passing: "value",
    })),
    returnType: declaration.type
      ? convertTypeFn(
          withTypeParameterConstraint(declaration.type, binding),
          binding
        )
      : { kind: "voidType" },
  };
}

const convertFunctionTypeParameters = (
  typeParameters: readonly ts.TypeParameterDeclaration[] | undefined,
  binding: Binding,
  convertTypeFn: (node: ts.TypeNode, binding: Binding) => IrType
): readonly IrTypeParameter[] | undefined => {
  if (!typeParameters || typeParameters.length === 0) {
    return undefined;
  }

  return typeParameters.map((typeParameter) => ({
    kind: "typeParameter",
    name: typeParameter.name.text,
    constraint: typeParameter.constraint
      ? convertTypeFn(
          withTypeParameterConstraint(typeParameter.constraint, binding),
          binding
        )
      : undefined,
    default: typeParameter.default
      ? convertTypeFn(
          withTypeParameterConstraint(typeParameter.default, binding),
          binding
        )
      : undefined,
    variance: undefined,
    isStructuralConstraint:
      !!typeParameter.constraint && ts.isTypeLiteralNode(typeParameter.constraint),
    structuralMembers: undefined,
  }));
};

export function inferTypeFromValueDeclaration(
  declaration: ts.Declaration | undefined,
  binding: Binding,
  seenDeclIds: Set<number>,
  convertTypeFn: (node: ts.TypeNode, binding: Binding) => IrType
): IrType | undefined {
  if (!declaration) return undefined;

  if (ts.isImportSpecifier(declaration)) {
    const importedDeclId = binding.resolveImport(declaration);
    if (!importedDeclId || seenDeclIds.has(importedDeclId.id)) {
      return undefined;
    }

    seenDeclIds.add(importedDeclId.id);
    const importedDeclInfo = (binding as BindingInternal)
      ._getHandleRegistry()
      .getDecl(importedDeclId);

    return inferTypeFromValueDeclaration(
      (importedDeclInfo?.valueDeclNode ??
        importedDeclInfo?.declNode ??
        importedDeclInfo?.typeDeclNode) as ts.Declaration | undefined,
      binding,
      seenDeclIds,
      convertTypeFn
    );
  }

  if (
    ts.isFunctionDeclaration(declaration) ||
    ts.isMethodDeclaration(declaration)
  ) {
    return buildFunctionTypeFromSignatureDeclaration(
      declaration,
      binding,
      convertTypeFn
    );
  }

  if (ts.isVariableDeclaration(declaration)) {
    if (declaration.type) {
      return convertTypeFn(
        withTypeParameterConstraint(declaration.type, binding),
        binding
      );
    }
    if (declaration.initializer) {
      return inferTypeFromValueExpression(
        declaration.initializer,
        binding,
        seenDeclIds,
        convertTypeFn
      );
    }
    return undefined;
  }

  if (
    ts.isFunctionExpression(declaration) ||
    ts.isArrowFunction(declaration) ||
    ts.isGetAccessorDeclaration(declaration) ||
    ts.isSetAccessorDeclaration(declaration)
  ) {
    return buildFunctionTypeFromSignatureDeclaration(
      declaration,
      binding,
      convertTypeFn
    );
  }

  if (
    (ts.isClassDeclaration(declaration) ||
      ts.isInterfaceDeclaration(declaration)) &&
    declaration.name
  ) {
    return { kind: "referenceType", name: declaration.name.text };
  }

  return undefined;
}

function inferTypeFromObjectLiteral(
  node: ts.ObjectLiteralExpression,
  binding: Binding,
  seenDeclIds: Set<number>,
  convertTypeFn: (node: ts.TypeNode, binding: Binding) => IrType
): IrObjectType | undefined {
  const members: IrInterfaceMember[] = [];

  for (const property of node.properties) {
    if (ts.isPropertyAssignment(property)) {
      const name =
        ts.isIdentifier(property.name) ||
        ts.isStringLiteral(property.name) ||
        ts.isNumericLiteral(property.name)
          ? property.name.text
          : undefined;
      if (!name) return undefined;
      const inferredType = inferTypeFromValueExpression(
        property.initializer,
        binding,
        seenDeclIds,
        convertTypeFn
      );
      if (!inferredType) return undefined;
      members.push({
        kind: "propertySignature",
        name,
        type: inferredType,
        isReadonly: false,
        isOptional: false,
      });
      continue;
    }

    if (ts.isShorthandPropertyAssignment(property)) {
      const name = property.name.text;
      const declId = binding.resolveShorthandAssignment(property);
      if (!declId) return undefined;
      if (seenDeclIds.has(declId.id)) return undefined;
      seenDeclIds.add(declId.id);
      const declInfo = (binding as BindingInternal)
        ._getHandleRegistry()
        .getDecl(declId);
      const inferredType = inferTypeFromValueDeclaration(
        (declInfo?.declNode ??
          declInfo?.valueDeclNode ??
          declInfo?.typeDeclNode) as ts.Declaration | undefined,
        binding,
        seenDeclIds,
        convertTypeFn
      );
      seenDeclIds.delete(declId.id);
      if (!inferredType) return undefined;
      members.push({
        kind: "propertySignature",
        name,
        type: inferredType,
        isReadonly: false,
        isOptional: false,
      });
      continue;
    }

    if (ts.isMethodDeclaration(property)) {
      const name =
        property.name &&
        (ts.isIdentifier(property.name) ||
          ts.isStringLiteral(property.name) ||
          ts.isNumericLiteral(property.name))
          ? property.name.text
          : undefined;
      if (!name) return undefined;
      members.push({
        kind: "methodSignature",
        name,
        parameters: buildFunctionTypeFromSignatureDeclaration(
          property,
          binding,
          convertTypeFn
        ).parameters,
        returnType: property.type
          ? convertTypeFn(
              withTypeParameterConstraint(property.type, binding),
              binding
            )
          : { kind: "voidType" },
        typeParameters: property.typeParameters?.map((typeParameter) => ({
          kind: "typeParameter",
          name: typeParameter.name.text,
        })),
      });
      continue;
    }

    return undefined;
  }

  return { kind: "objectType", members };
}

export function inferTypeFromValueExpression(
  expression: ts.Expression,
  binding: Binding,
  seenDeclIds: Set<number>,
  convertTypeFn: (node: ts.TypeNode, binding: Binding) => IrType
): IrType | undefined {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }

  if (ts.isAsExpression(current) || ts.isTypeAssertionExpression(current)) {
    return convertTypeFn(
      withTypeParameterConstraint(current.type, binding),
      binding
    );
  }

  if (ts.isStringLiteral(current)) {
    return { kind: "primitiveType", name: "string" };
  }

  if (ts.isNumericLiteral(current)) {
    return { kind: "primitiveType", name: "number" };
  }

  if (
    current.kind === ts.SyntaxKind.TrueKeyword ||
    current.kind === ts.SyntaxKind.FalseKeyword
  ) {
    return { kind: "primitiveType", name: "boolean" };
  }

  if (current.kind === ts.SyntaxKind.NullKeyword) {
    return { kind: "primitiveType", name: "null" };
  }

  if (ts.isIdentifier(current)) {
    const declId = binding.resolveIdentifier(current);
    if (!declId || seenDeclIds.has(declId.id)) return undefined;
    seenDeclIds.add(declId.id);
    const declInfo = (binding as BindingInternal)
      ._getHandleRegistry()
      .getDecl(declId);
    const inferredType = inferTypeFromValueDeclaration(
      (declInfo?.declNode ??
        declInfo?.valueDeclNode ??
        declInfo?.typeDeclNode) as ts.Declaration | undefined,
      binding,
      seenDeclIds,
      convertTypeFn
    );
    seenDeclIds.delete(declId.id);
    return inferredType;
  }

  if (ts.isCallExpression(current)) {
    const signatureId = binding.resolveCallSignature(current);
    const signature = signatureId
      ? (binding as BindingInternal)
          ._getHandleRegistry()
          .getSignature(signatureId)
      : undefined;
    if (signature?.returnTypeNode) {
      return convertTypeFn(
        withTypeParameterConstraint(
          signature.returnTypeNode as ts.TypeNode,
          binding
        ),
        binding
      );
    }
    return undefined;
  }

  if (ts.isAwaitExpression(current)) {
    const awaitedType = inferTypeFromValueExpression(
      current.expression,
      binding,
      seenDeclIds,
      convertTypeFn
    );
    if (!awaitedType) return undefined;

    const unwrapAwaitedType = (type: IrType): IrType => {
      if (type.kind === "unionType") {
        return toUnionOrSingle(
          type.types.map((member) => unwrapAwaitedType(member))
        );
      }

      if (
        type.kind === "referenceType" &&
        type.typeArguments &&
        type.typeArguments.length >= 1
      ) {
        const promiseLikeName =
          type.typeId?.tsName ?? type.name.split(".").pop() ?? type.name;
        if (
          promiseLikeName === "Promise" ||
          promiseLikeName === "PromiseLike" ||
          promiseLikeName === "Promise_1" ||
          promiseLikeName === "PromiseLike_1"
        ) {
          const innerType = type.typeArguments[0];
          return innerType
            ? unwrapAwaitedType(innerType)
            : { kind: "unknownType" };
        }
      }

      return type;
    };

    return unwrapAwaitedType(awaitedType);
  }

  if (ts.isArrayLiteralExpression(current)) {
    if (current.elements.some(ts.isSpreadElement)) {
      return undefined;
    }
    const elementTypes = current.elements
      .map((element) =>
        inferTypeFromValueExpression(
          element as ts.Expression,
          binding,
          seenDeclIds,
          convertTypeFn
        )
      )
      .filter((element): element is IrType => element !== undefined);
    if (elementTypes.length !== current.elements.length) {
      return undefined;
    }
    if (elementTypes.length === 0) {
      return { kind: "arrayType", elementType: { kind: "unknownType" } };
    }
    const first = elementTypes[0];
    if (
      first &&
      elementTypes.every((element) => typesSyntacticallyEqual(element, first))
    ) {
      return { kind: "arrayType", elementType: first };
    }
    return { kind: "tupleType", elementTypes };
  }

  if (ts.isObjectLiteralExpression(current)) {
    return inferTypeFromObjectLiteral(
      current,
      binding,
      seenDeclIds,
      convertTypeFn
    );
  }

  if (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
    return buildFunctionTypeFromSignatureDeclaration(
      current,
      binding,
      convertTypeFn
    );
  }

  if (ts.isPropertyAccessExpression(current)) {
    const receiverType = inferTypeFromValueExpression(
      current.expression,
      binding,
      seenDeclIds,
      convertTypeFn
    );
    const members = receiverType ? getMembersFromType(receiverType) : undefined;
    const member = members?.find(
      (candidate) => candidate.name === current.name.text
    );
    return member ? memberValueType(member) : undefined;
  }

  if (ts.isElementAccessExpression(current)) {
    const receiverType = inferTypeFromValueExpression(
      current.expression,
      binding,
      seenDeclIds,
      convertTypeFn
    );
    if (!receiverType) return undefined;
    if (receiverType.kind === "arrayType") {
      return receiverType.elementType;
    }
    if (receiverType.kind === "tupleType") {
      if (
        current.argumentExpression &&
        ts.isNumericLiteral(current.argumentExpression)
      ) {
        const index = Number.parseInt(current.argumentExpression.text, 10);
        return receiverType.elementTypes[index];
      }
      return toUnionOrSingle(receiverType.elementTypes);
    }
    if (receiverType.kind === "dictionaryType") {
      return receiverType.valueType;
    }
  }

  return undefined;
}
