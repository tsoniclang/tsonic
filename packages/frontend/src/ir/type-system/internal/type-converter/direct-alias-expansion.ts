import * as ts from "typescript";
import type {
  IrInterfaceMember,
  IrObjectType,
  IrType,
} from "../../../types.js";
import type { Binding } from "../../../binding/index.js";
import { resolveTypeAlias, unwrapParens } from "./conditional-utility-types-core.js";

const entityNameToText = (entityName: ts.EntityName): string =>
  ts.isIdentifier(entityName)
    ? entityName.text
    : `${entityNameToText(entityName.left)}.${entityName.right.text}`;

const createStringLiteralTypeNode = (value: string): ts.TypeNode =>
  ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(value));

const resolveAliasTypeArguments = (
  declNode: ts.TypeAliasDeclaration,
  refNode: ts.TypeReferenceNode
): Map<string, ts.TypeNode> | undefined => {
  const typeParameters = declNode.typeParameters ?? [];
  if (typeParameters.length === 0) {
    return new Map();
  }

  const explicitArgs = refNode.typeArguments ?? [];
  const substitution = new Map<string, ts.TypeNode>();

  for (let index = 0; index < typeParameters.length; index++) {
    const parameter = typeParameters[index];
    const parameterName = parameter?.name.text;
    const explicitArg = explicitArgs[index];
    const fallbackArg = parameter?.default;
    const resolvedArg = explicitArg ?? fallbackArg;
    if (!parameterName || !resolvedArg) {
      return undefined;
    }
    substitution.set(parameterName, resolvedArg);
  }

  return substitution;
};

const substituteTypeNode = (
  node: ts.TypeNode,
  substitution: ReadonlyMap<string, ts.TypeNode>
): ts.TypeNode => {
  const current = unwrapParens(node);

  if (ts.isTypeReferenceNode(current)) {
    if (
      ts.isIdentifier(current.typeName) &&
      !current.typeArguments?.length &&
      substitution.has(current.typeName.text)
    ) {
      return substitution.get(current.typeName.text) ?? current;
    }

    const typeArguments = current.typeArguments?.map((typeArgument) =>
      substituteTypeNode(typeArgument, substitution)
    );
    return ts.factory.updateTypeReferenceNode(
      current,
      current.typeName,
      typeArguments ? ts.factory.createNodeArray(typeArguments) : undefined
    );
  }

  if (ts.isUnionTypeNode(current)) {
    return ts.factory.updateUnionTypeNode(
      current,
      ts.factory.createNodeArray(
        current.types.map((typePart) => substituteTypeNode(typePart, substitution))
      )
    );
  }

  if (ts.isIntersectionTypeNode(current)) {
    return ts.factory.updateIntersectionTypeNode(
      current,
      ts.factory.createNodeArray(
        current.types.map((typePart) => substituteTypeNode(typePart, substitution))
      )
    );
  }

  if (ts.isArrayTypeNode(current)) {
    return ts.factory.updateArrayTypeNode(
      current,
      substituteTypeNode(current.elementType, substitution)
    );
  }

  if (ts.isParenthesizedTypeNode(current)) {
    return ts.factory.updateParenthesizedType(
      current,
      substituteTypeNode(current.type, substitution)
    );
  }

  if (ts.isIndexedAccessTypeNode(current)) {
    return ts.factory.updateIndexedAccessTypeNode(
      current,
      substituteTypeNode(current.objectType, substitution),
      substituteTypeNode(current.indexType, substitution)
    );
  }

  if (ts.isTypeOperatorNode(current)) {
    return ts.factory.updateTypeOperatorNode(
      current,
      substituteTypeNode(current.type, substitution)
    );
  }

  if (ts.isConditionalTypeNode(current)) {
    return ts.factory.updateConditionalTypeNode(
      current,
      substituteTypeNode(current.checkType, substitution),
      substituteTypeNode(current.extendsType, substitution),
      substituteTypeNode(current.trueType, substitution),
      substituteTypeNode(current.falseType, substitution)
    );
  }

  return current;
};

const resolveConcreteSourceMembers = (
  sourceTypeNode: ts.TypeNode,
  binding: Binding,
  convertType: (node: ts.TypeNode, binding: Binding) => IrType
): readonly IrInterfaceMember[] | undefined => {
  const resolvedSource = resolveTypeAlias(sourceTypeNode, binding);
  const irType = convertType(resolvedSource, binding);

  if (irType.kind === "objectType") {
    return irType.members;
  }

  if (
    irType.kind === "referenceType" &&
    irType.structuralMembers &&
    irType.structuralMembers.length > 0
  ) {
    return irType.structuralMembers;
  }

  return undefined;
};

const applyMappedOptionality = (
  member: IrInterfaceMember,
  mappedNode: ts.MappedTypeNode
): boolean => {
  if (mappedNode.questionToken?.kind === ts.SyntaxKind.MinusToken) {
    return false;
  }
  if (mappedNode.questionToken) {
    return true;
  }
  return member.kind === "propertySignature" ? member.isOptional : false;
};

const applyMappedReadonly = (
  member: IrInterfaceMember,
  mappedNode: ts.MappedTypeNode
): boolean => {
  if (mappedNode.readonlyToken?.kind === ts.SyntaxKind.MinusToken) {
    return false;
  }
  if (mappedNode.readonlyToken) {
    return true;
  }
  return member.kind === "propertySignature" ? member.isReadonly : false;
};

const expandMappedAliasType = (
  mappedNode: ts.MappedTypeNode,
  aliasSubstitution: ReadonlyMap<string, ts.TypeNode>,
  binding: Binding,
  convertType: (node: ts.TypeNode, binding: Binding) => IrType
): IrObjectType | undefined => {
  const mappedParameterName = mappedNode.typeParameter.name.text;
  const mappedConstraint = mappedNode.typeParameter.constraint
    ? substituteTypeNode(mappedNode.typeParameter.constraint, aliasSubstitution)
    : undefined;

  if (
    !mappedConstraint ||
    !ts.isTypeOperatorNode(mappedConstraint) ||
    mappedConstraint.operator !== ts.SyntaxKind.KeyOfKeyword
  ) {
    return undefined;
  }

  const sourceTypeNode = mappedConstraint.type;
  const sourceMembers = resolveConcreteSourceMembers(
    sourceTypeNode,
    binding,
    convertType
  );
  if (!sourceMembers) {
    return undefined;
  }

  const mappedValueNode = mappedNode.type;
  if (!mappedValueNode) {
    return undefined;
  }

  const members = sourceMembers.map((member): IrInterfaceMember => {
    const keyTypeNode = createStringLiteralTypeNode(member.name);
    const memberSubstitution = new Map(aliasSubstitution);
    memberSubstitution.set(mappedParameterName, keyTypeNode);

    const resolvedMemberType = convertType(
      substituteTypeNode(mappedValueNode, memberSubstitution),
      binding
    );

    return {
      kind: "propertySignature",
      name: member.name,
      type: resolvedMemberType,
      isOptional: applyMappedOptionality(member, mappedNode),
      isReadonly: applyMappedReadonly(member, mappedNode),
    };
  });

  return {
    kind: "objectType",
    members,
  };
};

const matchConditionalExtends = (
  actualNode: ts.TypeNode,
  extendsNode: ts.TypeNode,
  binding: Binding
): Map<string, ts.TypeNode> | false | undefined => {
  const actual = unwrapParens(resolveTypeAlias(actualNode, binding));
  const expected = unwrapParens(resolveTypeAlias(extendsNode, binding));

  if (ts.isInferTypeNode(expected)) {
    return new Map([[expected.typeParameter.name.text, actual]]);
  }

  if (expected.kind === ts.SyntaxKind.NumberKeyword) {
    return actual.kind === ts.SyntaxKind.NumberKeyword ||
      (ts.isLiteralTypeNode(actual) && ts.isNumericLiteral(actual.literal))
      ? new Map()
      : false;
  }

  if (expected.kind === ts.SyntaxKind.StringKeyword) {
    return actual.kind === ts.SyntaxKind.StringKeyword ||
      (ts.isLiteralTypeNode(actual) && ts.isStringLiteral(actual.literal))
      ? new Map()
      : false;
  }

  if (expected.kind === ts.SyntaxKind.BooleanKeyword) {
    return actual.kind === ts.SyntaxKind.BooleanKeyword ||
      (ts.isLiteralTypeNode(actual) &&
        (actual.literal.kind === ts.SyntaxKind.TrueKeyword ||
          actual.literal.kind === ts.SyntaxKind.FalseKeyword))
      ? new Map()
      : false;
  }

  if (ts.isTypeReferenceNode(actual) && ts.isTypeReferenceNode(expected)) {
    const actualName = entityNameToText(actual.typeName);
    const expectedName = entityNameToText(expected.typeName);
    if (actualName !== expectedName) {
      return false;
    }

    const actualArgs = actual.typeArguments ?? [];
    const expectedArgs = expected.typeArguments ?? [];
    if (actualArgs.length !== expectedArgs.length) {
      return false;
    }

    const inference = new Map<string, ts.TypeNode>();
    for (let index = 0; index < actualArgs.length; index++) {
      const actualArg = actualArgs[index];
      const expectedArg = expectedArgs[index];
      if (!actualArg || !expectedArg) {
        return undefined;
      }

      if (ts.isInferTypeNode(expectedArg)) {
        inference.set(expectedArg.typeParameter.name.text, actualArg);
        continue;
      }

      const nested = matchConditionalExtends(actualArg, expectedArg, binding);
      if (nested === false) {
        return false;
      }
      if (nested === undefined) {
        return undefined;
      }
      for (const [name, inferredNode] of nested) {
        inference.set(name, inferredNode);
      }
    }

    return inference;
  }

  if (ts.isLiteralTypeNode(actual) && ts.isLiteralTypeNode(expected)) {
    if (
      ts.isStringLiteral(actual.literal) &&
      ts.isStringLiteral(expected.literal)
    ) {
      return actual.literal.text === expected.literal.text ? new Map() : false;
    }
    if (
      ts.isNumericLiteral(actual.literal) &&
      ts.isNumericLiteral(expected.literal)
    ) {
      return actual.literal.text === expected.literal.text ? new Map() : false;
    }
  }

  return undefined;
};

const expandConditionalAliasType = (
  conditionalNode: ts.ConditionalTypeNode,
  aliasSubstitution: ReadonlyMap<string, ts.TypeNode>,
  binding: Binding,
  convertType: (node: ts.TypeNode, binding: Binding) => IrType
): IrType | undefined => {
  const instantiatedCheck = substituteTypeNode(
    conditionalNode.checkType,
    aliasSubstitution
  );
  const instantiatedExtends = substituteTypeNode(
    conditionalNode.extendsType,
    aliasSubstitution
  );

  const inferred = matchConditionalExtends(
    instantiatedCheck,
    instantiatedExtends,
    binding
  );
  if (inferred === undefined) {
    return undefined;
  }

  const branch =
    inferred === false ? conditionalNode.falseType : conditionalNode.trueType;
  const branchSubstitution = new Map(aliasSubstitution);
  if (inferred !== false) {
    for (const [name, inferredNode] of inferred) {
      branchSubstitution.set(name, inferredNode);
    }
  }

  return convertType(substituteTypeNode(branch, branchSubstitution), binding);
};

export const expandDirectAliasSyntax = (
  declNode: ts.TypeAliasDeclaration,
  refNode: ts.TypeReferenceNode,
  binding: Binding,
  convertType: (node: ts.TypeNode, binding: Binding) => IrType
): IrType | undefined => {
  const aliasSubstitution = resolveAliasTypeArguments(declNode, refNode);
  if (!aliasSubstitution) {
    return undefined;
  }

  const aliasBody = unwrapParens(declNode.type);

  if (ts.isConditionalTypeNode(aliasBody)) {
    return expandConditionalAliasType(
      aliasBody,
      aliasSubstitution,
      binding,
      convertType
    );
  }

  if (ts.isMappedTypeNode(aliasBody)) {
    return expandMappedAliasType(
      aliasBody,
      aliasSubstitution,
      binding,
      convertType
    );
  }

  return undefined;
};
