import * as ts from "typescript";

export const isAllowedKeyType = (typeNode: ts.TypeNode): boolean => {
  if (
    typeNode.kind === ts.SyntaxKind.StringKeyword ||
    typeNode.kind === ts.SyntaxKind.NumberKeyword
  ) {
    return true;
  }

  if (ts.isLiteralTypeNode(typeNode)) {
    const literal = typeNode.literal;
    if (
      ts.isStringLiteral(literal) ||
      ts.isNumericLiteral(literal) ||
      literal.kind === ts.SyntaxKind.NumericLiteral
    ) {
      return true;
    }
  }

  if (ts.isUnionTypeNode(typeNode)) {
    return typeNode.types.every((member) => isAllowedKeyType(member));
  }

  if (ts.isTypeReferenceNode(typeNode) && ts.isIdentifier(typeNode.typeName)) {
    const name = typeNode.typeName.text;
    return name === "string" || name === "number";
  }

  return false;
};
