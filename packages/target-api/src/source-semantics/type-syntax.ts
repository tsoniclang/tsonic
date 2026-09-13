import type {
  AstReader,
  Node,
} from "@tsonic/tsts";

export function sourceTypeSyntaxIsCompositional(
  ast: AstReader,
  node: Node | undefined,
): boolean {
  if (node === undefined) {
    return false;
  }
  if (
    ast.is.IsKeywordTypeNode(node) &&
    ast.kindName(node) !== "KindIntrinsicKeyword"
  ) {
    return true;
  }
  if (ast.is.IsLiteralTypeNode(node) || ast.is.IsThisTypeNode(node)) {
    return true;
  }
  if (ast.is.IsTypeReferenceNode(node)) {
    return definedNodesAreCompositional(ast, ast.typeArguments(node));
  }
  if (ast.is.IsFunctionTypeNode(node)) {
    return ast.typeParameters(node).length === 0 &&
      sourceTypeSyntaxIsCompositional(ast, ast.typeNode(node)) &&
      ast.parameters(node).every(parameter => parameter !== undefined &&
        sourceTypeSyntaxIsCompositional(ast, ast.typeNode(parameter)));
  }
  if (ast.is.IsTypeLiteralNode(node)) {
    return ast.members(node).every(member => member !== undefined &&
      ast.kindName(member) === "KindPropertySignature" &&
      !ast.is.IsComputedPropertyName(ast.name(member)) &&
      sourceTypeSyntaxIsCompositional(ast, ast.typeNode(member)));
  }
  if (ast.is.IsArrayTypeNode(node)) {
    return sourceTypeSyntaxIsCompositional(
      ast,
      ast.as.AsArrayTypeNode(node)?.ElementType,
    );
  }
  if (ast.is.IsUnionTypeNode(node)) {
    return definedNodesAreCompositional(ast, ast.children(node));
  }
  if (ast.is.IsTupleTypeNode(node)) {
    return definedNodesAreCompositional(ast, ast.elements(node));
  }
  if (ast.is.IsNamedTupleMember(node)) {
    return sourceTypeSyntaxIsCompositional(
      ast,
      ast.as.AsNamedTupleMember(node)?.Type,
    );
  }
  if (ast.is.IsOptionalTypeNode(node)) {
    return sourceTypeSyntaxIsCompositional(
      ast,
      ast.as.AsOptionalTypeNode(node)?.Type,
    );
  }
  if (ast.is.IsRestTypeNode(node)) {
    return sourceTypeSyntaxIsCompositional(
      ast,
      ast.as.AsRestTypeNode(node)?.Type,
    );
  }
  if (ast.is.IsParenthesizedTypeNode(node)) {
    return sourceTypeSyntaxIsCompositional(
      ast,
      ast.as.AsParenthesizedTypeNode(node)?.Type,
    );
  }
  if (
    ast.is.IsTypeOperatorNode(node) &&
    ast.operatorKindName(node) === "KindReadonlyKeyword"
  ) {
    return sourceTypeSyntaxIsCompositional(
      ast,
      ast.as.AsTypeOperatorNode(node)?.Type,
    );
  }
  return false;
}

function definedNodesAreCompositional(
  ast: AstReader,
  nodes: readonly (Node | undefined)[],
): boolean {
  return nodes.every((node) =>
    node !== undefined && sourceTypeSyntaxIsCompositional(ast, node)
  );
}
