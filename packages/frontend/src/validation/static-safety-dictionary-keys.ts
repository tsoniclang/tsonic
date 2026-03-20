import * as ts from "typescript";

/**
 * Check if a type node represents an allowed dictionary key type.
 * Allowed: string, number, symbol (matches TypeScript's PropertyKey constraint)
 *
 * Note: TypeScript's Record<K, V> only allows K extends keyof any (string | number | symbol).
 * We support all three PropertyKey primitives.
 */
export const isAllowedKeyType = (typeNode: ts.TypeNode): boolean => {
  if (
    typeNode.kind === ts.SyntaxKind.StringKeyword ||
    typeNode.kind === ts.SyntaxKind.NumberKeyword ||
    typeNode.kind === ts.SyntaxKind.SymbolKeyword
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
    return name === "string" || name === "number" || name === "symbol";
  }

  return false;
};
