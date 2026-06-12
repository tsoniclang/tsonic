import type { GoPtr } from "../go/compat.js";
import type { SourceFile } from "../internal/ast/ast.js";
import type { Node } from "../internal/ast/spine.js";
import { Node_ForEachChild, Node_Name } from "../internal/ast/spine.js";
import {
  Node_Arguments,
  Node_Expression,
  Node_Type,
  Node_TypeArguments,
} from "../internal/ast/ast.js";
import type { TypeReferenceNode } from "../internal/ast/generated/data.js";
import {
  AsClassDeclaration,
  AsHeritageClause,
  AsIdentifier,
  AsInterfaceDeclaration,
  AsTypeReferenceNode,
} from "../internal/ast/generated/casts.js";
import {
  KindCallExpression,
  KindClassDeclaration,
  KindExpressionWithTypeArguments,
  KindIdentifier,
  KindInterfaceDeclaration,
  KindParameter,
  KindPropertyAccessExpression,
  KindPropertyDeclaration,
  KindPropertySignature,
  KindTypeReference,
} from "../internal/ast/generated/kinds.js";

export type TstsTypeReferenceDetails = {
  readonly name: string;
  readonly typeArguments: readonly GoPtr<Node>[];
};

export type TstsCallExpressionDetails = {
  readonly calleeName: string | undefined;
  readonly expression: GoPtr<Node>;
  readonly arguments: readonly GoPtr<Node>[];
  readonly typeArguments: readonly GoPtr<Node>[];
};

export type TstsNodeSpan = {
  readonly pos: number;
  readonly end: number;
};

export const getTstsSourceFileName = (
  sourceFile: GoPtr<SourceFile>
): string | undefined => sourceFile?.FileName();

export const getTstsNodeSpan = (
  node: GoPtr<Node>
): TstsNodeSpan | undefined =>
  node?.Loc ? { pos: node.Loc.pos, end: node.Loc.end } : undefined;

export const forEachTstsChild = (
  node: GoPtr<Node>,
  visit: (child: GoPtr<Node>) => void
): void => {
  if (!node) return;
  Node_ForEachChild(node, (child): boolean => {
    visit(child);
    return false;
  });
};

export const visitTstsSubtree = (
  node: GoPtr<Node>,
  visit: (current: GoPtr<Node>) => void
): void => {
  if (!node) return;
  visit(node);
  forEachTstsChild(node, (child) => visitTstsSubtree(child, visit));
};

export const getTstsIdentifierText = (
  node: GoPtr<Node>
): string | undefined => {
  if (node?.Kind !== KindIdentifier) return undefined;
  return AsIdentifier(node)?.Text;
};

export const getTstsNodeNameText = (node: GoPtr<Node>): string | undefined =>
  node ? getTstsIdentifierText(Node_Name(node)) : undefined;

export const asTstsTypeReferenceNode = (
  node: GoPtr<Node>
): GoPtr<TypeReferenceNode> =>
  node?.Kind === KindTypeReference ? AsTypeReferenceNode(node) : undefined;

export const getTstsTypeReferenceName = (
  node: GoPtr<Node>
): string | undefined => {
  const typeReference = asTstsTypeReferenceNode(node);
  return getTstsIdentifierText(typeReference?.TypeName);
};

export const getTstsTypeArguments = (
  node: GoPtr<Node>
): readonly GoPtr<Node>[] =>
  node &&
  (node.Kind === KindTypeReference ||
    node.Kind === KindCallExpression ||
    node.Kind === KindExpressionWithTypeArguments)
    ? (Node_TypeArguments(node) ?? [])
    : [];

export const getTstsTypeReferenceDetails = (
  node: GoPtr<Node>
): TstsTypeReferenceDetails | undefined => {
  const name = getTstsTypeReferenceName(node);
  return name
    ? {
        name,
        typeArguments: getTstsTypeArguments(node),
      }
    : undefined;
};

export const getTstsDeclaredTypeNode = (node: GoPtr<Node>): GoPtr<Node> => {
  if (
    node?.Kind !== KindParameter &&
    node?.Kind !== KindPropertyDeclaration &&
    node?.Kind !== KindPropertySignature
  ) {
    return undefined;
  }
  return Node_Type(node);
};

export const isTstsParameterDeclaration = (node: GoPtr<Node>): boolean =>
  node?.Kind === KindParameter;

export const isTstsPropertyDeclarationLike = (node: GoPtr<Node>): boolean =>
  node?.Kind === KindPropertyDeclaration ||
  node?.Kind === KindPropertySignature;

export const isTstsClassDeclaration = (node: GoPtr<Node>): boolean =>
  node?.Kind === KindClassDeclaration;

export const isTstsInterfaceDeclaration = (node: GoPtr<Node>): boolean =>
  node?.Kind === KindInterfaceDeclaration;

export const isTstsCallExpression = (node: GoPtr<Node>): boolean =>
  node?.Kind === KindCallExpression;

export const getTstsExpressionName = (
  node: GoPtr<Node>
): string | undefined => {
  const identifierText = getTstsIdentifierText(node);
  if (identifierText) return identifierText;
  return node?.Kind === KindPropertyAccessExpression
    ? getTstsNodeNameText(node)
    : undefined;
};

export const getTstsExpressionWithTypeArgumentsName = (
  node: GoPtr<Node>
): string | undefined =>
  node?.Kind === KindExpressionWithTypeArguments
    ? getTstsExpressionName(Node_Expression(node))
    : undefined;

export const getTstsCallExpressionDetails = (
  node: GoPtr<Node>
): TstsCallExpressionDetails | undefined =>
  node?.Kind === KindCallExpression
    ? {
        calleeName: getTstsExpressionName(Node_Expression(node)),
        expression: Node_Expression(node),
        arguments: Node_Arguments(node) ?? [],
        typeArguments: getTstsTypeArguments(node),
      }
    : undefined;

export const getTstsHeritageTypeNodes = (
  node: GoPtr<Node>
): readonly GoPtr<Node>[] => {
  const heritageClauses =
    node?.Kind === KindInterfaceDeclaration
      ? AsInterfaceDeclaration(node)?.HeritageClauses
      : node?.Kind === KindClassDeclaration
        ? AsClassDeclaration(node)?.HeritageClauses
        : undefined;

  const types: GoPtr<Node>[] = [];
  for (const clauseNode of heritageClauses?.Nodes ?? []) {
    const clause = AsHeritageClause(clauseNode);
    types.push(...(clause?.Types?.Nodes ?? []));
  }
  return types;
};
