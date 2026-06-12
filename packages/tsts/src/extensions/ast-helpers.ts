import type { GoPtr } from "../go/compat.js";
import type { Node } from "../internal/ast/spine.js";
import { Node_ForEachChild } from "../internal/ast/spine.js";
import type { TypeReferenceNode } from "../internal/ast/generated/data.js";
import { AsIdentifier, AsTypeReferenceNode } from "../internal/ast/generated/casts.js";
import { KindIdentifier, KindTypeReference } from "../internal/ast/generated/kinds.js";

export const forEachTstsChild = (
  node: GoPtr<Node>,
  visit: (child: GoPtr<Node>) => void,
): void => {
  if (!node) return;
  Node_ForEachChild(node, (child): boolean => {
    visit(child);
    return false;
  });
};

export const visitTstsSubtree = (
  node: GoPtr<Node>,
  visit: (current: GoPtr<Node>) => void,
): void => {
  if (!node) return;
  visit(node);
  forEachTstsChild(node, (child) => visitTstsSubtree(child, visit));
};

export const getTstsIdentifierText = (
  node: GoPtr<Node>,
): string | undefined => {
  if (node?.Kind !== KindIdentifier) return undefined;
  return AsIdentifier(node)?.Text;
};

export const asTstsTypeReferenceNode = (
  node: GoPtr<Node>,
): GoPtr<TypeReferenceNode> =>
  node?.Kind === KindTypeReference ? AsTypeReferenceNode(node) : undefined;

export const getTstsTypeReferenceName = (
  node: GoPtr<Node>,
): string | undefined => {
  const typeReference = asTstsTypeReferenceNode(node);
  return getTstsIdentifierText(typeReference?.TypeName);
};
