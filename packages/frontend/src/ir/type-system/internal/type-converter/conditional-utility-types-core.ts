import { TstsSyntax, type TstsNode } from "@tsonic/tsts";
import { IrType } from "../../../types.js";
import type { Binding, BindingInternal } from "../../../binding/index.js";
import {
  isExpandableUtilityType,
  isTypeParameterNode,
  typeNodeContainsTypeParameter,
  flattenUnionIrType,
  isProvablyAssignable,
} from "./mapped-utility-types.js";
import {
  asConverterNode,
  entityNameToText,
  nodeTypeArguments,
} from "./tsts-syntax.js";

export const EXPANDABLE_CONDITIONAL_UTILITY_TYPES = new Set([
  "NonNullable",
  "Exclude",
  "Extract",
  "ReturnType",
  "Parameters",
  "Awaited",
  "ConstructorParameters",
  "InstanceType",
]);

export const isExpandableConditionalUtilityType = (name: string): boolean =>
  EXPANDABLE_CONDITIONAL_UTILITY_TYPES.has(name);

export const MAX_CONDITIONAL_UTILITY_RECURSION = 16;

export const resolveTypeAlias = (
  node: TstsNode,
  binding: Binding
): TstsNode => {
  if (!TstsSyntax.IsTypeReferenceNode(node)) return node;

  const name = entityNameToText(TstsSyntax.AsTypeReferenceNode(node)?.TypeName);
  if (
    isExpandableUtilityType(name) ||
    isExpandableConditionalUtilityType(name) ||
    name === "Record" ||
    name === "native targetOf" ||
    name === "out" ||
    name === "ref" ||
    name === "inref"
  ) {
    return node;
  }

  const declId = binding.resolveTypeReference(node);
  if (!declId) return node;

  const declInfo = (binding as BindingInternal)
    ._getHandleRegistry()
    .getDecl(declId);
  if (!declInfo) return node;

  const decl = asConverterNode(declInfo.declNode);
  if (!decl || !TstsSyntax.IsTypeAliasDeclaration(decl)) return node;
  const aliasBody = TstsSyntax.AsTypeAliasDeclaration(decl)?.Type;
  return aliasBody ? resolveTypeAlias(aliasBody, binding) : node;
};

export const unwrapParens = (node: TstsNode): TstsNode => {
  let current = node;
  while (TstsSyntax.IsParenthesizedTypeNode(current)) {
    const inner = TstsSyntax.AsParenthesizedTypeNode(current)?.Type;
    if (!inner) break;
    current = inner;
  }
  return current;
};

export const flattenUnionTypeNodes = (node: TstsNode): readonly TstsNode[] => {
  const unwrapped = unwrapParens(node);
  if (!TstsSyntax.IsUnionTypeNode(unwrapped)) return [unwrapped];

  const parts: TstsNode[] = [];
  for (const typePart of TstsSyntax.AsUnionTypeNode(unwrapped)?.Types?.Nodes ??
    []) {
    if (typePart) parts.push(...flattenUnionTypeNodes(typePart));
  }
  return parts;
};

export const expandNonNullable = (
  typeArg: TstsNode,
  binding: Binding,
  convertType: (node: TstsNode, binding: Binding) => IrType
): IrType | null => {
  if (isTypeParameterNode(typeArg, binding)) {
    return null;
  }

  const resolved = resolveTypeAlias(typeArg, binding);

  if (resolved.Kind === TstsSyntax.KindAnyKeyword) return { kind: "anyType" };
  if (resolved.Kind === TstsSyntax.KindUnknownKeyword)
    return { kind: "unknownType", explicit: true };
  if (resolved.Kind === TstsSyntax.KindNeverKeyword)
    return { kind: "neverType" };

  if (TstsSyntax.IsUnionTypeNode(resolved)) {
    const filtered = (TstsSyntax.AsUnionTypeNode(resolved)?.Types?.Nodes ?? [])
      .filter((node): node is TstsNode => node !== undefined)
      .filter((typePart) => {
        if (typePart.Kind === TstsSyntax.KindNullKeyword) return false;
        if (typePart.Kind === TstsSyntax.KindUndefinedKeyword) return false;
        if (TstsSyntax.IsLiteralTypeNode(typePart)) {
          const literal = TstsSyntax.AsLiteralTypeNode(typePart)?.Literal;
          return (
            literal?.Kind !== TstsSyntax.KindNullKeyword &&
            literal?.Kind !== TstsSyntax.KindUndefinedKeyword
          );
        }
        return true;
      });

    if (filtered.length === 0) return { kind: "neverType" };
    if (filtered.length === 1 && filtered[0]) {
      return convertType(filtered[0], binding);
    }

    return {
      kind: "unionType",
      types: filtered.map((typePart) => convertType(typePart, binding)),
    };
  }

  if (resolved.Kind === TstsSyntax.KindNullKeyword) return { kind: "neverType" };
  if (resolved.Kind === TstsSyntax.KindUndefinedKeyword)
    return { kind: "neverType" };

  return convertType(resolved, binding);
};

export const expandExcludeExtract = (
  tArg: TstsNode,
  uArg: TstsNode,
  isExtract: boolean,
  binding: Binding,
  convertType: (node: TstsNode, binding: Binding) => IrType,
  depth: number
): IrType | null => {
  if (typeNodeContainsTypeParameter(tArg, binding)) {
    return null;
  }
  if (typeNodeContainsTypeParameter(uArg, binding)) {
    return null;
  }

  if (depth > MAX_CONDITIONAL_UTILITY_RECURSION) {
    return null;
  }

  const tryExpandConditionalArg = (node: TstsNode): IrType | null => {
    const unwrapped = unwrapParens(node);
    if (!TstsSyntax.IsTypeReferenceNode(unwrapped)) {
      return null;
    }
    const name = entityNameToText(
      TstsSyntax.AsTypeReferenceNode(unwrapped)?.TypeName
    );
    if (!isExpandableConditionalUtilityType(name)) {
      return null;
    }
    if (nodeTypeArguments(unwrapped).length === 0) {
      return null;
    }
    return expandConditionalUtilityTypeInternal(
      unwrapped,
      name,
      binding,
      convertType,
      depth + 1
    );
  };

  const convertForFiltering = (node: TstsNode): IrType | null => {
    const directExpanded = tryExpandConditionalArg(node);
    if (directExpanded) return directExpanded;

    const resolved = unwrapParens(resolveTypeAlias(unwrapParens(node), binding));
    const resolvedExpanded = tryExpandConditionalArg(resolved);
    if (resolvedExpanded) return resolvedExpanded;

    if (TstsSyntax.IsUnionTypeNode(resolved)) {
      const parts = flattenUnionTypeNodes(resolved);
      const converted: IrType[] = [];
      for (const part of parts) {
        const inner = convertForFiltering(part);
        if (!inner) return null;
        converted.push(inner);
      }
      return { kind: "unionType", types: converted };
    }

    return convertType(resolved, binding);
  };

  const tType = convertForFiltering(tArg);
  const uType = convertForFiltering(uArg);
  if (!tType || !uType) {
    return null;
  }

  const tMembers = flattenUnionIrType(tType);

  const filtered: IrType[] = [];
  for (const t of tMembers) {
    const assignable = isProvablyAssignable(t, uType);
    if (isExtract) {
      if (assignable !== false) {
        filtered.push(t);
      }
    } else if (assignable !== true) {
      filtered.push(t);
    }
  }

  if (filtered.length === 0) return { kind: "neverType" };
  if (filtered.length === 1) return filtered[0] ?? { kind: "neverType" };
  return { kind: "unionType", types: filtered };
};

export const expandConditionalUtilityTypeInternal = (
  node: TstsNode,
  typeName: string,
  binding: Binding,
  convertType: (node: TstsNode, binding: Binding) => IrType,
  depth: number
): IrType | null => {
  if (depth > MAX_CONDITIONAL_UTILITY_RECURSION) {
    return null;
  }

  const typeArgs = nodeTypeArguments(node);
  if (typeArgs.length === 0) {
    return null;
  }

  for (const typeArg of typeArgs) {
    if (typeNodeContainsTypeParameter(typeArg, binding)) {
      return null;
    }
  }

  const firstArg = typeArgs[0];
  if (!firstArg) {
    return null;
  }

  switch (typeName) {
    case "NonNullable":
      return expandNonNullable(firstArg, binding, convertType);

    case "Exclude": {
      const secondArg = typeArgs[1];
      if (!secondArg) return null;
      return expandExcludeExtract(
        firstArg,
        secondArg,
        false,
        binding,
        convertType,
        depth
      );
    }

    case "Extract": {
      const secondArg = typeArgs[1];
      if (!secondArg) return null;
      return expandExcludeExtract(
        firstArg,
        secondArg,
        true,
        binding,
        convertType,
        depth
      );
    }

    case "ReturnType":
      return expandReturnTypeFromExtract(firstArg, binding, convertType);

    case "Parameters":
      return expandParametersFromExtract(firstArg, binding, convertType);

    case "Awaited":
      return expandAwaitedFromExtract(firstArg, binding, convertType);

    case "ConstructorParameters":
      return expandConstructorParametersFromExtract(
        firstArg,
        binding,
        convertType
      );

    case "InstanceType":
      return expandInstanceTypeFromExtract(firstArg, binding, convertType);

    default:
      return null;
  }
};

import {
  expandReturnType as expandReturnTypeFromExtract,
  expandParameters as expandParametersFromExtract,
  expandAwaited as expandAwaitedFromExtract,
  expandConstructorParameters as expandConstructorParametersFromExtract,
  expandInstanceType as expandInstanceTypeFromExtract,
} from "./conditional-utility-types-extract.js";
