import { TstsSyntax, type TstsNode } from "@tsonic/tsts";
import type { IrInterfaceMember, IrObjectType, IrType } from "../../../types.js";
import type { Binding } from "../../../binding/index.js";
import { resolveIndexedAccessFromTypes } from "./type-operators.js";
import {
  resolveTypeAlias,
  unwrapParens,
} from "./conditional-utility-types-core.js";
import {
  entityNameToText,
  identifierText,
  nodeTypeArguments,
} from "./tsts-syntax.js";

const syntheticStringLiteralIrType = (value: string): IrType => ({
  kind: "literalType",
  value,
});

const resolveAliasTypeArguments = (
  declNode: TstsNode,
  refNode: TstsNode
): Map<string, TstsNode> | undefined => {
  const typeParameters = TstsSyntax.Node_TypeParameters(declNode) ?? [];
  if (typeParameters.length === 0) {
    return new Map();
  }

  const explicitArgs = nodeTypeArguments(refNode);
  const substitution = new Map<string, TstsNode>();

  for (let index = 0; index < typeParameters.length; index++) {
    const parameter = typeParameters[index];
    const parameterName = identifierText(TstsSyntax.Node_Name(parameter));
    const defaultType = TstsSyntax.AsTypeParameterDeclaration(parameter)
      ?.DefaultType;
    const resolvedArg = explicitArgs[index] ?? defaultType;
    if (!parameterName || !resolvedArg) {
      return undefined;
    }
    substitution.set(parameterName, resolvedArg);
  }

  return substitution;
};

const substituteTypeNode = (
  node: TstsNode,
  substitution: ReadonlyMap<string, TstsNode>
): TstsNode => {
  const current = unwrapParens(node);
  if (TstsSyntax.IsTypeReferenceNode(current)) {
    const name = entityNameToText(TstsSyntax.AsTypeReferenceNode(current)?.TypeName);
    if (name && nodeTypeArguments(current).length === 0) {
      return substitution.get(name) ?? current;
    }
  }
  return current;
};

const resolveConcreteSourceMembers = (
  sourceTypeNode: TstsNode,
  binding: Binding,
  convertType: (node: TstsNode, binding: Binding) => IrType
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
  mappedNode: TstsNode
): boolean => {
  const mapped = TstsSyntax.AsMappedTypeNode(mappedNode);
  if (mapped?.QuestionToken?.Kind === TstsSyntax.KindMinusToken) {
    return false;
  }
  if (mapped?.QuestionToken) {
    return true;
  }
  return member.kind === "propertySignature" ? member.isOptional : false;
};

const applyMappedReadonly = (
  member: IrInterfaceMember,
  mappedNode: TstsNode
): boolean => {
  const mapped = TstsSyntax.AsMappedTypeNode(mappedNode);
  if (mapped?.ReadonlyToken?.Kind === TstsSyntax.KindMinusToken) {
    return false;
  }
  if (mapped?.ReadonlyToken) {
    return true;
  }
  return member.kind === "propertySignature" ? member.isReadonly : false;
};

const convertWithSubstitution = (
  node: TstsNode,
  substitution: ReadonlyMap<string, TstsNode>,
  binding: Binding,
  convertType: (node: TstsNode, binding: Binding) => IrType
): IrType => {
  const current = unwrapParens(node);
  if (TstsSyntax.IsTypeReferenceNode(current)) {
    const name = entityNameToText(TstsSyntax.AsTypeReferenceNode(current)?.TypeName);
    if (name && substitution.has(name) && nodeTypeArguments(current).length === 0) {
      return convertType(substitution.get(name)!, binding);
    }
  }

  if (TstsSyntax.IsIndexedAccessTypeNode(current)) {
    const indexed = TstsSyntax.AsIndexedAccessTypeNode(current);
    if (indexed?.ObjectType && indexed.IndexType) {
      return resolveIndexedAccessFromTypes(
        convertWithSubstitution(indexed.ObjectType, substitution, binding, convertType),
        convertWithSubstitution(indexed.IndexType, substitution, binding, convertType)
      );
    }
  }

  return convertType(current, binding);
};

const expandMappedAliasType = (
  mappedNode: TstsNode,
  aliasSubstitution: ReadonlyMap<string, TstsNode>,
  binding: Binding,
  convertType: (node: TstsNode, binding: Binding) => IrType
): IrObjectType | undefined => {
  const mapped = TstsSyntax.AsMappedTypeNode(mappedNode);
  const mappedParameter = mapped?.TypeParameter;
  const mappedParameterName = identifierText(TstsSyntax.Node_Name(mappedParameter));
  const mappedConstraint = mappedParameter
    ? TstsSyntax.AsTypeParameterDeclaration(mappedParameter)?.Constraint
    : undefined;
  const substitutedConstraint = mappedConstraint
    ? substituteTypeNode(mappedConstraint, aliasSubstitution)
    : undefined;

  if (
    !mappedParameterName ||
    !substitutedConstraint ||
    !TstsSyntax.IsTypeOperatorNode(substitutedConstraint) ||
    TstsSyntax.AsTypeOperatorNode(substitutedConstraint)?.Operator !==
      TstsSyntax.KindKeyOfKeyword
  ) {
    return undefined;
  }

  const sourceTypeNode = TstsSyntax.AsTypeOperatorNode(substitutedConstraint)
    ?.Type;
  const sourceMembers = sourceTypeNode
    ? resolveConcreteSourceMembers(sourceTypeNode, binding, convertType)
    : undefined;
  if (!sourceMembers) {
    return undefined;
  }

  const mappedValueNode = mapped?.Type;
  if (!mappedValueNode) {
    return undefined;
  }

  const members = sourceMembers.map((member): IrInterfaceMember => {
    const memberSubstitution = new Map(aliasSubstitution);
    memberSubstitution.set(
      mappedParameterName,
      memberSubstitution.get(mappedParameterName) ?? mappedValueNode
    );
    const resolvedMemberType =
      TstsSyntax.IsIndexedAccessTypeNode(mappedValueNode)
        ? resolveIndexedAccessFromTypes(
            convertWithSubstitution(
              TstsSyntax.AsIndexedAccessTypeNode(mappedValueNode)!.ObjectType!,
              aliasSubstitution,
              binding,
              convertType
            ),
            syntheticStringLiteralIrType(member.name)
          )
        : convertWithSubstitution(
            mappedValueNode,
            memberSubstitution,
            binding,
            convertType
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
  actualNode: TstsNode,
  extendsNode: TstsNode,
  binding: Binding
): Map<string, TstsNode> | false | undefined => {
  const actual = unwrapParens(resolveTypeAlias(actualNode, binding));
  const expected = unwrapParens(resolveTypeAlias(extendsNode, binding));

  if (TstsSyntax.IsInferTypeNode(expected)) {
    const parameter = TstsSyntax.AsInferTypeNode(expected)?.TypeParameter;
    const name = identifierText(TstsSyntax.Node_Name(parameter));
    return name ? new Map([[name, actual]]) : undefined;
  }

  if (expected.Kind === TstsSyntax.KindNumberKeyword) {
    return actual.Kind === TstsSyntax.KindNumberKeyword ||
      (TstsSyntax.IsLiteralTypeNode(actual) &&
        TstsSyntax.AsLiteralTypeNode(actual)?.Literal?.Kind ===
          TstsSyntax.KindNumericLiteral)
      ? new Map()
      : false;
  }

  if (expected.Kind === TstsSyntax.KindStringKeyword) {
    return actual.Kind === TstsSyntax.KindStringKeyword ||
      (TstsSyntax.IsLiteralTypeNode(actual) &&
        TstsSyntax.AsLiteralTypeNode(actual)?.Literal?.Kind ===
          TstsSyntax.KindStringLiteral)
      ? new Map()
      : false;
  }

  if (expected.Kind === TstsSyntax.KindBooleanKeyword) {
    const literal = TstsSyntax.IsLiteralTypeNode(actual)
      ? TstsSyntax.AsLiteralTypeNode(actual)?.Literal
      : undefined;
    return actual.Kind === TstsSyntax.KindBooleanKeyword ||
      literal?.Kind === TstsSyntax.KindTrueKeyword ||
      literal?.Kind === TstsSyntax.KindFalseKeyword
      ? new Map()
      : false;
  }

  if (
    TstsSyntax.IsTypeReferenceNode(actual) &&
    TstsSyntax.IsTypeReferenceNode(expected)
  ) {
    const actualName = entityNameToText(TstsSyntax.AsTypeReferenceNode(actual)?.TypeName);
    const expectedName = entityNameToText(TstsSyntax.AsTypeReferenceNode(expected)?.TypeName);
    if (actualName !== expectedName) {
      return false;
    }

    const actualArgs = nodeTypeArguments(actual);
    const expectedArgs = nodeTypeArguments(expected);
    if (actualArgs.length !== expectedArgs.length) {
      return false;
    }

    const inference = new Map<string, TstsNode>();
    for (let index = 0; index < actualArgs.length; index++) {
      const actualArg = actualArgs[index];
      const expectedArg = expectedArgs[index];
      if (!actualArg || !expectedArg) {
        return undefined;
      }

      if (TstsSyntax.IsInferTypeNode(expectedArg)) {
        const parameter = TstsSyntax.AsInferTypeNode(expectedArg)?.TypeParameter;
        const name = identifierText(TstsSyntax.Node_Name(parameter));
        if (!name) return undefined;
        inference.set(name, actualArg);
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

  if (
    TstsSyntax.IsLiteralTypeNode(actual) &&
    TstsSyntax.IsLiteralTypeNode(expected)
  ) {
    return TstsSyntax.Node_Text(TstsSyntax.AsLiteralTypeNode(actual)?.Literal) ===
      TstsSyntax.Node_Text(TstsSyntax.AsLiteralTypeNode(expected)?.Literal)
      ? new Map()
      : false;
  }

  return undefined;
};

const expandConditionalAliasType = (
  conditionalNode: TstsNode,
  aliasSubstitution: ReadonlyMap<string, TstsNode>,
  binding: Binding,
  convertType: (node: TstsNode, binding: Binding) => IrType
): IrType | undefined => {
  const conditional = TstsSyntax.AsConditionalTypeNode(conditionalNode);
  if (!conditional?.CheckType || !conditional.ExtendsType) {
    return undefined;
  }
  const instantiatedCheck = substituteTypeNode(
    conditional.CheckType,
    aliasSubstitution
  );
  const instantiatedExtends = substituteTypeNode(
    conditional.ExtendsType,
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

  const branch = inferred === false ? conditional.FalseType : conditional.TrueType;
  if (!branch) {
    return undefined;
  }
  const branchSubstitution = new Map(aliasSubstitution);
  if (inferred !== false) {
    for (const [name, inferredNode] of inferred) {
      branchSubstitution.set(name, inferredNode);
    }
  }

  return convertWithSubstitution(branch, branchSubstitution, binding, convertType);
};

export const expandDirectAliasSyntax = (
  declNode: TstsNode,
  refNode: TstsNode,
  binding: Binding,
  convertType: (node: TstsNode, binding: Binding) => IrType
): IrType | undefined => {
  const aliasSubstitution = resolveAliasTypeArguments(declNode, refNode);
  if (!aliasSubstitution) {
    return undefined;
  }

  const aliasBody = TstsSyntax.AsTypeAliasDeclaration(declNode)?.Type;
  if (!aliasBody) {
    return undefined;
  }
  const unwrappedAliasBody = unwrapParens(aliasBody);

  if (TstsSyntax.IsConditionalTypeNode(unwrappedAliasBody)) {
    return expandConditionalAliasType(
      unwrappedAliasBody,
      aliasSubstitution,
      binding,
      convertType
    );
  }

  if (TstsSyntax.IsMappedTypeNode(unwrappedAliasBody)) {
    return expandMappedAliasType(
      unwrappedAliasBody,
      aliasSubstitution,
      binding,
      convertType
    );
  }

  return undefined;
};
