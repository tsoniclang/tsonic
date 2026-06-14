import type { TstsNode } from "@tsonic/tsts";
import { TstsSyntax } from "@tsonic/tsts";
import {
  getTypeArguments,
  isStringLiteralLike,
  staticPropertyNameText,
} from "./tsts-helpers.js";

export const isAllowedKeyType = (typeNode: TstsNode): boolean => {
  if (
    typeNode.Kind === TstsSyntax.KindStringKeyword ||
    typeNode.Kind === TstsSyntax.KindNumberKeyword
  ) {
    return true;
  }

  if (typeNode.Kind === TstsSyntax.KindLiteralType) {
    const literal = TstsSyntax.AsLiteralTypeNode(typeNode)?.Literal;
    if (
      isStringLiteralLike(literal) ||
      literal?.Kind === TstsSyntax.KindNumericLiteral
    ) {
      return true;
    }
  }

  if (typeNode.Kind === TstsSyntax.KindUnionType) {
    return (
      TstsSyntax.AsUnionTypeNode(typeNode)?.Types?.Nodes.every(
        (member) => member !== undefined && isAllowedKeyType(member)
      ) ?? false
    );
  }

  if (
    typeNode.Kind === TstsSyntax.KindTypeReference &&
    staticPropertyNameText(TstsSyntax.AsTypeReferenceNode(typeNode)?.TypeName) !==
      undefined
  ) {
    const name = staticPropertyNameText(
      TstsSyntax.AsTypeReferenceNode(typeNode)?.TypeName
    );
    return getTypeArguments(typeNode).length === 0
      ? name === "string" || name === "number"
      : false;
  }

  return false;
};
