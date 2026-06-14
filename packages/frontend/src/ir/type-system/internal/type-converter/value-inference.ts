import { TstsSyntax, type TstsNode } from "@tsonic/tsts";
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
import {
  asConverterNode,
  identifierText,
  isOptionalParameter,
  isRestParameter,
  nodeMembers,
  nodeParameters,
  nodePropertyNameText,
  nodeType,
  nodeTypeArguments,
} from "./tsts-syntax.js";

const isConstAssertionType = (node: TstsNode): boolean =>
  TstsSyntax.IsTypeReferenceNode(node) &&
  identifierText(TstsSyntax.AsTypeReferenceNode(node)?.TypeName) === "const" &&
  nodeTypeArguments(node).length === 0;

export const getTypeParameterConstraintNode = (
  typeNode: TstsNode,
  binding: Binding
): TstsNode | undefined => {
  if (!TstsSyntax.IsTypeReferenceNode(typeNode)) {
    return undefined;
  }
  const declId = binding.resolveTypeReference(typeNode);
  if (!declId) return undefined;
  const declInfo = (binding as BindingInternal)
    ._getHandleRegistry()
    .getDecl(declId);
  const declNode = asConverterNode(declInfo?.typeDeclNode ?? declInfo?.declNode);
  if (!declNode || !TstsSyntax.IsTypeParameterDeclaration(declNode)) {
    return undefined;
  }
  return TstsSyntax.AsTypeParameterDeclaration(declNode)?.Constraint;
};

export const withTypeParameterConstraint = (
  typeNode: TstsNode,
  binding: Binding
): TstsNode => getTypeParameterConstraintNode(typeNode, binding) ?? typeNode;

export function buildFunctionTypeFromSignatureDeclaration(
  declaration: TstsNode,
  binding: Binding,
  convertTypeFn: (node: TstsNode, binding: Binding) => IrType
): IrFunctionType {
  const typeParameters = convertFunctionTypeParameters(
    (TstsSyntax.Node_TypeParameters(declaration) ?? []).filter(
      (typeParameter): typeParameter is TstsNode => typeParameter !== undefined
    ),
    binding,
    convertTypeFn
  );
  return {
    kind: "functionType",
    ...(typeParameters ? { typeParameters } : {}),
    parameters: nodeParameters(declaration).map((parameter, index) => ({
      kind: "parameter",
      pattern: {
        kind: "identifierPattern",
        name:
          identifierText(TstsSyntax.Node_Name(parameter)) ??
          `p${TstsSyntax.Node_Pos(parameter) ?? index}`,
      },
      type: nodeType(parameter)
        ? convertTypeFn(
            withTypeParameterConstraint(nodeType(parameter)!, binding),
            binding
          )
        : { kind: "unknownType" },
      isOptional:
        isOptionalParameter(parameter) ||
        TstsSyntax.Node_Initializer(parameter) !== undefined,
      isRest: isRestParameter(parameter),
      passing: "value",
    })),
    returnType: nodeType(declaration)
      ? convertTypeFn(
          withTypeParameterConstraint(nodeType(declaration)!, binding),
          binding
        )
      : { kind: "voidType" },
  };
}

const convertFunctionTypeParameters = (
  typeParameters: readonly TstsNode[] | undefined,
  binding: Binding,
  convertTypeFn: (node: TstsNode, binding: Binding) => IrType
): readonly IrTypeParameter[] | undefined => {
  if (!typeParameters || typeParameters.length === 0) {
    return undefined;
  }

  return typeParameters.map((typeParameter) => {
    const parameter = TstsSyntax.AsTypeParameterDeclaration(typeParameter);
    return {
      kind: "typeParameter",
      name: identifierText(TstsSyntax.Node_Name(typeParameter)) ?? "_",
      constraint: parameter?.Constraint
        ? convertTypeFn(
            withTypeParameterConstraint(parameter.Constraint, binding),
            binding
          )
        : undefined,
      default: parameter?.DefaultType
        ? convertTypeFn(
            withTypeParameterConstraint(parameter.DefaultType, binding),
            binding
          )
        : undefined,
      variance: undefined,
      isStructuralConstraint:
        !!parameter?.Constraint &&
        TstsSyntax.IsTypeLiteralNode(parameter.Constraint),
      structuralMembers: undefined,
    };
  });
};

export function inferTypeFromValueDeclaration(
  declaration: TstsNode | undefined,
  binding: Binding,
  seenDeclIds: Set<number>,
  convertTypeFn: (node: TstsNode, binding: Binding) => IrType
): IrType | undefined {
  if (!declaration) return undefined;

  if (TstsSyntax.IsImportSpecifier(declaration)) {
    const importedDeclId = binding.resolveImport(declaration);
    if (!importedDeclId || seenDeclIds.has(importedDeclId.id)) {
      return undefined;
    }

    seenDeclIds.add(importedDeclId.id);
    const importedDeclInfo = (binding as BindingInternal)
      ._getHandleRegistry()
      .getDecl(importedDeclId);

    return inferTypeFromValueDeclaration(
      asConverterNode(
        importedDeclInfo?.valueDeclNode ??
          importedDeclInfo?.declNode ??
          importedDeclInfo?.typeDeclNode
      ),
      binding,
      seenDeclIds,
      convertTypeFn
    );
  }

  if (
    TstsSyntax.IsFunctionDeclaration(declaration) ||
    TstsSyntax.IsMethodDeclaration(declaration)
  ) {
    return buildFunctionTypeFromSignatureDeclaration(
      declaration,
      binding,
      convertTypeFn
    );
  }

  if (TstsSyntax.IsVariableDeclaration(declaration)) {
    if (nodeType(declaration)) {
      return convertTypeFn(
        withTypeParameterConstraint(nodeType(declaration)!, binding),
        binding
      );
    }
    const initializer = TstsSyntax.Node_Initializer(declaration);
    if (initializer) {
      return inferTypeFromValueExpression(
        initializer,
        binding,
        seenDeclIds,
        convertTypeFn
      );
    }
    return undefined;
  }

  if (
    TstsSyntax.IsFunctionExpression(declaration) ||
    TstsSyntax.IsArrowFunction(declaration) ||
    TstsSyntax.IsGetAccessorDeclaration(declaration) ||
    TstsSyntax.IsSetAccessorDeclaration(declaration)
  ) {
    return buildFunctionTypeFromSignatureDeclaration(
      declaration,
      binding,
      convertTypeFn
    );
  }

  if (
    TstsSyntax.IsClassDeclaration(declaration) ||
    TstsSyntax.IsInterfaceDeclaration(declaration)
  ) {
    const name = identifierText(TstsSyntax.Node_Name(declaration));
    return name ? { kind: "referenceType", name } : undefined;
  }

  return undefined;
}

function inferTypeFromObjectLiteral(
  node: TstsNode,
  binding: Binding,
  seenDeclIds: Set<number>,
  convertTypeFn: (node: TstsNode, binding: Binding) => IrType
): IrObjectType | undefined {
  const members: IrInterfaceMember[] = [];

  for (const property of nodeMembers(node)) {
    if (TstsSyntax.IsPropertyAssignment(property)) {
      const name = nodePropertyNameText(property);
      if (!name) return undefined;
      const initializer = TstsSyntax.Node_Initializer(property);
      if (!initializer) return undefined;
      const inferredType = inferTypeFromValueExpression(
        initializer,
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

    if (TstsSyntax.IsShorthandPropertyAssignment(property)) {
      const name = identifierText(TstsSyntax.Node_Name(property));
      if (!name) return undefined;
      const declId = binding.resolveShorthandAssignment(property);
      if (!declId) return undefined;
      if (seenDeclIds.has(declId.id)) return undefined;
      seenDeclIds.add(declId.id);
      const declInfo = (binding as BindingInternal)
        ._getHandleRegistry()
        .getDecl(declId);
      const inferredType = inferTypeFromValueDeclaration(
        asConverterNode(
          declInfo?.declNode ?? declInfo?.valueDeclNode ?? declInfo?.typeDeclNode
        ),
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

    if (TstsSyntax.IsMethodDeclaration(property)) {
      const name = nodePropertyNameText(property);
      if (!name) return undefined;
      members.push({
        kind: "methodSignature",
        name,
        parameters: buildFunctionTypeFromSignatureDeclaration(
          property,
          binding,
          convertTypeFn
        ).parameters,
        returnType: nodeType(property)
          ? convertTypeFn(
              withTypeParameterConstraint(nodeType(property)!, binding),
              binding
            )
          : { kind: "voidType" },
        typeParameters: (TstsSyntax.Node_TypeParameters(property) ?? []).map(
          (typeParameter) => ({
            kind: "typeParameter",
            name: identifierText(TstsSyntax.Node_Name(typeParameter)) ?? "_",
          })
        ),
      });
      continue;
    }

    return undefined;
  }

  return { kind: "objectType", members };
}

export function inferTypeFromValueExpression(
  expression: TstsNode,
  binding: Binding,
  seenDeclIds: Set<number>,
  convertTypeFn: (node: TstsNode, binding: Binding) => IrType
): IrType | undefined {
  let current = expression;
  while (
    TstsSyntax.IsParenthesizedExpression(current) ||
    TstsSyntax.IsNonNullExpression(current)
  ) {
    const inner = TstsSyntax.Node_Expression(current);
    if (!inner) return undefined;
    current = inner;
  }

  if (
    TstsSyntax.IsAsExpression(current) ||
    TstsSyntax.IsTypeAssertion(current)
  ) {
    const assertionType = nodeType(current);
    const expressionNode = TstsSyntax.Node_Expression(current);
    if (!assertionType || !expressionNode) return undefined;
    if (isConstAssertionType(assertionType)) {
      return inferTypeFromValueExpression(
        expressionNode,
        binding,
        seenDeclIds,
        convertTypeFn
      );
    }

    return convertTypeFn(
      withTypeParameterConstraint(assertionType, binding),
      binding
    );
  }

  if (TstsSyntax.IsSatisfiesExpression(current)) {
    const expressionNode = TstsSyntax.Node_Expression(current);
    return expressionNode
      ? inferTypeFromValueExpression(
          expressionNode,
          binding,
          seenDeclIds,
          convertTypeFn
        )
      : undefined;
  }

  if (TstsSyntax.IsStringLiteral(current)) {
    return { kind: "primitiveType", name: "string" };
  }

  if (TstsSyntax.IsNumericLiteral(current)) {
    return { kind: "primitiveType", name: "number" };
  }

  if (TstsSyntax.IsBigIntLiteral(current)) {
    return { kind: "primitiveType", name: "bigint" };
  }

  if (
    current.Kind === TstsSyntax.KindTrueKeyword ||
    current.Kind === TstsSyntax.KindFalseKeyword
  ) {
    return { kind: "primitiveType", name: "boolean" };
  }

  if (current.Kind === TstsSyntax.KindNullKeyword) {
    return { kind: "primitiveType", name: "null" };
  }

  if (TstsSyntax.IsIdentifier(current)) {
    const declId = binding.resolveIdentifier(current);
    if (!declId || seenDeclIds.has(declId.id)) return undefined;
    seenDeclIds.add(declId.id);
    const declInfo = (binding as BindingInternal)
      ._getHandleRegistry()
      .getDecl(declId);
    const inferredType = inferTypeFromValueDeclaration(
      asConverterNode(
        declInfo?.declNode ?? declInfo?.valueDeclNode ?? declInfo?.typeDeclNode
      ),
      binding,
      seenDeclIds,
      convertTypeFn
    );
    seenDeclIds.delete(declId.id);
    return inferredType;
  }

  if (TstsSyntax.IsCallExpression(current)) {
    const signatureId = binding.resolveCallSignature(current);
    const signature = signatureId
      ? (binding as BindingInternal)
          ._getHandleRegistry()
          .getSignature(signatureId)
      : undefined;
    const returnTypeNode = asConverterNode(signature?.returnTypeNode);
    if (returnTypeNode) {
      return convertTypeFn(
        withTypeParameterConstraint(returnTypeNode, binding),
        binding
      );
    }
    return undefined;
  }

  if (TstsSyntax.IsAwaitExpression(current)) {
    const awaitedExpression = TstsSyntax.Node_Expression(current);
    if (!awaitedExpression) return undefined;
    const awaitedType = inferTypeFromValueExpression(
      awaitedExpression,
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
          type.typeId?.sourceName ?? type.name.split(".").pop() ?? type.name;
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

  if (TstsSyntax.IsArrayLiteralExpression(current)) {
    const elements = TstsSyntax.Node_Elements(current) ?? [];
    if (elements.some((element) => element?.Kind === TstsSyntax.KindSpreadElement)) {
      return undefined;
    }
    const elementTypes = elements
      .map((element) =>
        element
          ? inferTypeFromValueExpression(
              element,
              binding,
              seenDeclIds,
              convertTypeFn
            )
          : undefined
      )
      .filter((element): element is IrType => element !== undefined);
    if (elementTypes.length !== elements.length) {
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

  if (TstsSyntax.IsObjectLiteralExpression(current)) {
    return inferTypeFromObjectLiteral(
      current,
      binding,
      seenDeclIds,
      convertTypeFn
    );
  }

  if (
    TstsSyntax.IsArrowFunction(current) ||
    TstsSyntax.IsFunctionExpression(current)
  ) {
    return buildFunctionTypeFromSignatureDeclaration(
      current,
      binding,
      convertTypeFn
    );
  }

  if (TstsSyntax.IsPropertyAccessExpression(current)) {
    const receiverExpression = TstsSyntax.Node_Expression(current);
    const receiverType = receiverExpression
      ? inferTypeFromValueExpression(
          receiverExpression,
          binding,
          seenDeclIds,
          convertTypeFn
        )
      : undefined;
    const members = receiverType ? getMembersFromType(receiverType) : undefined;
    const memberName = identifierText(TstsSyntax.Node_Name(current));
    const member = members?.find((candidate) => candidate.name === memberName);
    return member ? memberValueType(member) : undefined;
  }

  if (TstsSyntax.IsElementAccessExpression(current)) {
    const receiverExpression = TstsSyntax.Node_Expression(current);
    const receiverType = receiverExpression
      ? inferTypeFromValueExpression(
          receiverExpression,
          binding,
          seenDeclIds,
          convertTypeFn
        )
      : undefined;
    if (!receiverType) return undefined;
    if (receiverType.kind === "arrayType") {
      return receiverType.elementType;
    }
    if (receiverType.kind === "tupleType") {
      const argument = TstsSyntax.AsElementAccessExpression(current)
        ?.ArgumentExpression;
      if (argument && TstsSyntax.IsNumericLiteral(argument)) {
        const index = Number.parseInt(TstsSyntax.Node_Text(argument) ?? "", 10);
        return receiverType.elementTypes[index];
      }
      return toUnionOrSingle(receiverType.elementTypes);
    }
    if (receiverType.kind === "dictionaryType") {
      return receiverType.valueType;
    }
  }

  if (TstsSyntax.IsPrefixUnaryExpression(current)) {
    const prefix = TstsSyntax.AsPrefixUnaryExpression(current);
    if (prefix?.Operator === TstsSyntax.KindExclamationToken) {
      return { kind: "primitiveType", name: "boolean" };
    }

    return prefix?.Operand
      ? inferTypeFromValueExpression(
          prefix.Operand,
          binding,
          seenDeclIds,
          convertTypeFn
        )
      : undefined;
  }

  if (TstsSyntax.IsBinaryExpression(current)) {
    const operator = TstsSyntax.AsBinaryExpression(current)?.OperatorToken?.Kind;
    if (
      operator === TstsSyntax.KindEqualsEqualsToken ||
      operator === TstsSyntax.KindEqualsEqualsEqualsToken ||
      operator === TstsSyntax.KindExclamationEqualsToken ||
      operator === TstsSyntax.KindExclamationEqualsEqualsToken ||
      operator === TstsSyntax.KindLessThanToken ||
      operator === TstsSyntax.KindLessThanEqualsToken ||
      operator === TstsSyntax.KindGreaterThanToken ||
      operator === TstsSyntax.KindGreaterThanEqualsToken
    ) {
      return { kind: "primitiveType", name: "boolean" };
    }

    if (
      operator === TstsSyntax.KindAmpersandToken ||
      operator === TstsSyntax.KindBarToken ||
      operator === TstsSyntax.KindCaretToken ||
      operator === TstsSyntax.KindLessThanLessThanToken ||
      operator === TstsSyntax.KindGreaterThanGreaterThanToken ||
      operator === TstsSyntax.KindGreaterThanGreaterThanGreaterThanToken
    ) {
      const binary = TstsSyntax.AsBinaryExpression(current);
      const leftType = binary?.Left
        ? inferTypeFromValueExpression(
            binary.Left,
            binding,
            seenDeclIds,
            convertTypeFn
          )
        : undefined;
      const rightType = binary?.Right
        ? inferTypeFromValueExpression(
            binary.Right,
            binding,
            seenDeclIds,
            convertTypeFn
          )
        : undefined;
      if (!leftType || !rightType) return undefined;
      return { kind: "primitiveType", name: "int" };
    }
  }

  return undefined;
}
