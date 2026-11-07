import type { AstReader, Node } from "@tsonic/tsts";

export type SourceReferenceMeaning = "value" | "type" | "namespace";

export function sourceReferenceMeaning(ast: AstReader, node: Node): SourceReferenceMeaning {
  let reference = node;
  let parent = ast.parent(reference);
  let propertyQualifier = false;
  while (parent !== undefined &&
    (ast.is.IsQualifiedName(parent) || ast.is.IsPropertyAccessExpression(parent))) {
    if (ast.is.IsQualifiedName(parent) && ast.as.AsQualifiedName(parent)?.Left === reference) return "namespace";
    if (ast.is.IsPropertyAccessExpression(parent) &&
      ast.as.AsPropertyAccessExpression(parent)?.Expression === reference) propertyQualifier = true;
    reference = parent;
    parent = ast.parent(reference);
  }
  if (parent !== undefined && ast.is.IsTypeReferenceNode(parent) &&
    ast.as.AsTypeReferenceNode(parent)?.TypeName === reference) return "type";
  if (parent !== undefined && ast.is.IsImportTypeNode(parent) &&
    ast.as.AsImportTypeNode(parent)?.Qualifier === reference) {
    return ast.as.AsImportTypeNode(parent)?.IsTypeOf ? "value" : "type";
  }
  if (parent !== undefined && ast.is.IsExpressionWithTypeArguments(parent) &&
    ast.as.AsExpressionWithTypeArguments(parent)?.Expression === reference) {
    const clause = ast.parent(parent);
    const owner = ast.parent(clause);
    if (owner !== undefined && (ast.is.IsInterfaceDeclaration(owner) ||
      ast.implementsHeritageElements(owner).includes(parent))) return propertyQualifier ? "namespace" : "type";
  }
  if (parent !== undefined && ast.name(parent) === reference) {
    if (ast.is.IsTypeAliasDeclaration(parent) || ast.is.IsInterfaceDeclaration(parent) ||
      ast.is.IsTypeParameterDeclaration(parent)) return "type";
    if (ast.is.IsModuleDeclaration(parent)) return "namespace";
  }
  return "value";
}

export function isTypeSyntaxNode(ast: AstReader, node: Node): boolean {
  return ast.is.IsTypeQueryNode(node) ||
    ast.is.IsKeywordTypeNode(node) ||
    ast.is.IsTypeReferenceNode(node) ||
    ast.is.IsUnionTypeNode(node) ||
    ast.is.IsIntersectionTypeNode(node) ||
    ast.is.IsConditionalTypeNode(node) ||
    ast.is.IsInferTypeNode(node) ||
    ast.is.IsArrayTypeNode(node) ||
    ast.is.IsIndexedAccessTypeNode(node) ||
    ast.is.IsLiteralTypeNode(node) ||
    ast.is.IsThisTypeNode(node) ||
    ast.is.IsMappedTypeNode(node) ||
    ast.is.IsTupleTypeNode(node) ||
    ast.is.IsOptionalTypeNode(node) ||
    ast.is.IsRestTypeNode(node) ||
    ast.is.IsParenthesizedTypeNode(node) ||
    ast.is.IsFunctionTypeNode(node) ||
    ast.is.IsConstructorTypeNode(node) ||
    ast.is.IsTemplateLiteralTypeNode(node) ||
    ast.is.IsImportTypeNode(node);
}

export function referenceQueryNode(ast: AstReader, node: Node): Node | undefined {
  if (ast.is.IsTypeQueryNode(node)) {
    return ast.as.AsTypeQueryNode(node)?.ExprName;
  }
  const parent = ast.parent(node);
  if (
    parent !== undefined &&
    ast.is.IsPropertyAccessExpression(parent) &&
    ast.name(parent) === node
  ) {
    return parent;
  }
  if (
    ast.is.IsIdentifier(node) ||
    ast.is.IsPrivateIdentifier(node) ||
    ast.is.IsPropertyAccessExpression(node) ||
    ast.is.IsElementAccessExpression(node) ||
    ast.is.IsQualifiedName(node)
  ) {
    return node;
  }
  if (ast.is.IsTypeReferenceNode(node)) {
    return ast.as.AsTypeReferenceNode(node)?.TypeName;
  }
  if (ast.is.IsExpressionWithTypeArguments(node)) {
    return ast.as.AsExpressionWithTypeArguments(node)?.Expression;
  }
  return undefined;
}
