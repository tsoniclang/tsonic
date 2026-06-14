import { hasTstsReadonlyModifier, TstsSyntax, type TstsNode } from "@tsonic/tsts";
import { IrType, IrObjectType, IrInterfaceMember } from "../../../types.js";
import type { Binding, BindingInternal } from "../../../binding/index.js";
import {
  asConverterNode,
  entityNameToText,
  identifierText,
  isOptionalParameter,
  isRestParameter,
  nodeMembers,
  nodeParameters,
  nodeType,
  nodeTypeArguments,
} from "./tsts-syntax.js";

export const EXPANDABLE_UTILITY_TYPES = new Set([
  "Partial",
  "Required",
  "Readonly",
  "Pick",
  "Omit",
]);

export const isExpandableUtilityType = (name: string): boolean =>
  EXPANDABLE_UTILITY_TYPES.has(name);

export const isTypeParameterNode = (
  node: TstsNode,
  binding: Binding
): boolean => {
  if (!TstsSyntax.IsTypeReferenceNode(node)) return false;

  const declId = binding.resolveTypeReference(node);
  if (!declId) return false;

  const declInfo = (binding as BindingInternal)
    ._getHandleRegistry()
    .getDecl(declId);
  const decl = asConverterNode(declInfo?.declNode);
  return decl ? TstsSyntax.IsTypeParameterDeclaration(decl) : false;
};

export const typeNodeContainsTypeParameter = (
  node: TstsNode,
  binding: Binding
): boolean => {
  if (isTypeParameterNode(node, binding)) {
    return true;
  }

  if (TstsSyntax.IsUnionTypeNode(node)) {
    return (TstsSyntax.AsUnionTypeNode(node)?.Types?.Nodes ?? []).some(
      (typePart) =>
        typePart ? typeNodeContainsTypeParameter(typePart, binding) : false
    );
  }

  if (TstsSyntax.IsIntersectionTypeNode(node)) {
    return (TstsSyntax.AsIntersectionTypeNode(node)?.Types?.Nodes ?? []).some(
      (typePart) =>
        typePart ? typeNodeContainsTypeParameter(typePart, binding) : false
    );
  }

  if (TstsSyntax.IsArrayTypeNode(node)) {
    const elementType = TstsSyntax.AsArrayTypeNode(node)?.ElementType;
    return elementType
      ? typeNodeContainsTypeParameter(elementType, binding)
      : false;
  }

  if (TstsSyntax.IsTypeReferenceNode(node)) {
    return nodeTypeArguments(node).some((typeArgument) =>
      typeNodeContainsTypeParameter(typeArgument, binding)
    );
  }

  return false;
};

const isInternalMarkerMemberName = (name: string): boolean =>
  name === "__brand" ||
  name.startsWith("__tsonic_type_") ||
  name.startsWith("__tsonic_iface_") ||
  name.startsWith("__tsonic_binding_alias_");

const extractMembersFromDeclaration = (
  decl: TstsNode,
  binding: Binding,
  convertType: (node: TstsNode, binding: Binding) => IrType
): readonly IrInterfaceMember[] | null => {
  const typeElements = TstsSyntax.IsInterfaceDeclaration(decl)
    ? nodeMembers(decl)
    : TstsSyntax.IsTypeAliasDeclaration(decl) &&
        TstsSyntax.IsTypeLiteralNode(TstsSyntax.AsTypeAliasDeclaration(decl)?.Type)
      ? nodeMembers(TstsSyntax.AsTypeAliasDeclaration(decl)?.Type)
      : [];

  if (typeElements.length === 0) {
    return null;
  }

  if (typeElements.some(TstsSyntax.IsIndexSignatureDeclaration)) {
    return null;
  }

  const members: IrInterfaceMember[] = [];

  for (const member of typeElements) {
    if (TstsSyntax.IsPropertySignatureDeclaration(member)) {
      const propName = identifierText(TstsSyntax.Node_Name(member));
      const memberType = nodeType(member);

      if (!propName || !memberType || isInternalMarkerMemberName(propName)) {
        continue;
      }

      members.push({
        kind: "propertySignature",
        name: propName,
        type: convertType(memberType, binding),
        isOptional: TstsSyntax.Node_QuestionToken(member) !== undefined,
        isReadonly: hasTstsReadonlyModifier(member),
      });
    }

    if (TstsSyntax.IsMethodSignatureDeclaration(member)) {
      const methodName = identifierText(TstsSyntax.Node_Name(member));
      if (!methodName || isInternalMarkerMemberName(methodName)) {
        continue;
      }

      members.push({
        kind: "methodSignature",
        name: methodName,
        parameters: nodeParameters(member).map((param, index) => ({
          kind: "parameter" as const,
          pattern: {
            kind: "identifierPattern" as const,
            name: identifierText(TstsSyntax.Node_Name(param)) ?? `arg${index}`,
          },
          type: nodeType(param)
            ? convertType(nodeType(param)!, binding)
            : undefined,
          isOptional: isOptionalParameter(param),
          isRest: isRestParameter(param),
          passing: "value" as const,
        })),
        returnType: nodeType(member)
          ? convertType(nodeType(member)!, binding)
          : undefined,
      });
    }
  }

  return members.length > 0 ? members : null;
};

const extractLiteralKeysFromTypeNode = (
  node: TstsNode,
  binding: Binding
): Set<string> | null => {
  if (isTypeParameterNode(node, binding)) {
    return null;
  }

  if (TstsSyntax.IsLiteralTypeNode(node)) {
    const literal = TstsSyntax.AsLiteralTypeNode(node)?.Literal;
    if (
      literal?.Kind === TstsSyntax.KindStringLiteral ||
      literal?.Kind === TstsSyntax.KindNumericLiteral
    ) {
      const text = TstsSyntax.Node_Text(literal);
      return text !== undefined ? new Set([text]) : null;
    }
  }

  if (TstsSyntax.IsUnionTypeNode(node)) {
    const keys = new Set<string>();
    for (const member of TstsSyntax.AsUnionTypeNode(node)?.Types?.Nodes ?? []) {
      if (!member || !TstsSyntax.IsLiteralTypeNode(member)) {
        return null;
      }
      const literal = TstsSyntax.AsLiteralTypeNode(member)?.Literal;
      if (
        literal?.Kind === TstsSyntax.KindStringLiteral ||
        literal?.Kind === TstsSyntax.KindNumericLiteral
      ) {
        const text = TstsSyntax.Node_Text(literal);
        if (text === undefined) return null;
        keys.add(text);
      } else {
        return null;
      }
    }
    return keys;
  }

  return null;
};

export const expandUtilityType = (
  node: TstsNode,
  typeName: string,
  binding: Binding,
  convertType: (node: TstsNode, binding: Binding) => IrType
): IrObjectType | null => {
  const typeArgs = nodeTypeArguments(node);
  if (typeArgs.length === 0) {
    return null;
  }

  const targetArg = typeArgs[0];
  if (!targetArg) {
    return null;
  }

  if (isTypeParameterNode(targetArg, binding)) {
    return null;
  }

  if ((typeName === "Pick" || typeName === "Omit") && typeArgs.length >= 2) {
    const keysArg = typeArgs[1];
    if (keysArg && isTypeParameterNode(keysArg, binding)) {
      return null;
    }
  }

  let baseMembers: readonly IrInterfaceMember[] | null = null;

  if (!TstsSyntax.IsTypeReferenceNode(targetArg)) {
    return null;
  }

  const targetName = entityNameToText(
    TstsSyntax.AsTypeReferenceNode(targetArg)?.TypeName
  );
  if (!targetName) {
    return null;
  }

  if (isExpandableUtilityType(targetName) && nodeTypeArguments(targetArg).length) {
    const innerExpanded = expandUtilityType(
      targetArg,
      targetName,
      binding,
      convertType
    );
    if (!innerExpanded) {
      return null;
    }
    baseMembers = innerExpanded.members;
  } else {
    const declId = binding.resolveTypeReference(targetArg);
    if (!declId) {
      return null;
    }

    const declInfo = (binding as BindingInternal)
      ._getHandleRegistry()
      .getDecl(declId);
    const decl = asConverterNode(declInfo?.declNode);
    if (
      !decl ||
      (!TstsSyntax.IsInterfaceDeclaration(decl) &&
        !TstsSyntax.IsTypeAliasDeclaration(decl))
    ) {
      return null;
    }

    baseMembers = extractMembersFromDeclaration(decl, binding, convertType);
    if (!baseMembers) {
      return null;
    }
  }

  if (typeName === "Pick" || typeName === "Omit") {
    const keysArg = typeArgs[1];
    if (!keysArg) {
      return null;
    }

    const keys = extractLiteralKeysFromTypeNode(keysArg, binding);
    if (!keys) {
      return null;
    }

    const filteredMembers = baseMembers.filter((member) =>
      typeName === "Pick" ? keys.has(member.name) : !keys.has(member.name)
    );

    return { kind: "objectType", members: filteredMembers };
  }

  const transformedMembers = baseMembers.map((member): IrInterfaceMember => {
    if (member.kind === "propertySignature") {
      return {
        ...member,
        isOptional:
          typeName === "Partial"
            ? true
            : typeName === "Required"
              ? false
              : member.isOptional,
        isReadonly: typeName === "Readonly" ? true : member.isReadonly,
      };
    }
    return member;
  });

  return { kind: "objectType", members: transformedMembers };
};
