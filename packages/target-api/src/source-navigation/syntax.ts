import type {
  AstReader,
  Node,
  SourceFile,
  Symbol,
  Type,
  TypeCheckerQueries,
} from "@tsonic/tsts";
import {
  sourceNodesEqual,
} from "./identity.js";

export function semanticTypeForNode(
  ast: AstReader,
  checker: TypeCheckerQueries,
  node: Node,
  sourceFile: SourceFile,
): Type | undefined {
  return isTypeSyntaxNode(ast, node)
    ? checker.getTypeFromTypeNode(node, { sourceFile })
    : checker.getTypeAtLocation(node, { sourceFile });
}

export function symbolAtReferenceNode(
  ast: AstReader,
  checker: TypeCheckerQueries,
  node: Node,
  sourceFile: SourceFile,
): Symbol | undefined {
  const reference = referenceQueryNode(ast, node);
  return reference === undefined
    ? undefined
    : checker.getSymbolAtLocation(reference, { sourceFile });
}

export function resolvedSymbolAtReferenceNode(
  ast: AstReader,
  checker: TypeCheckerQueries,
  node: Node,
  sourceFile: SourceFile,
): Symbol | undefined {
  const reference = referenceQueryNode(ast, node);
  const selected = reference !== undefined && ast.is.IsPropertyAccessExpression(reference)
    ? ast.name(reference)
    : reference;
  return selected === undefined
    ? undefined
    : checker.getResolvedSymbol(selected, { sourceFile });
}

export function aliasedSymbol(
  ast: AstReader,
  checker: TypeCheckerQueries,
  symbol: Symbol | undefined,
  sourceFile: SourceFile,
): Symbol | undefined {
  return symbol !== undefined &&
    checker.getSymbolDeclarations(symbol).some((declaration) =>
      isAliasDeclaration(ast, declaration))
    ? checker.getAliasedSymbol(symbol, { sourceFile })
    : undefined;
}

export function primaryDeclaration(
  checker: TypeCheckerQueries,
  symbol: Symbol | undefined,
): Node | undefined {
  return checker.getPrimarySymbolDeclaration(symbol) ??
    checker.getSymbolDeclarations(symbol)
      .find((declaration): declaration is Node => declaration !== undefined);
}

export function isTypeSyntaxNode(ast: AstReader, node: Node): boolean {
  return ast.is.IsKeywordTypeNode(node) ||
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

function referenceQueryNode(ast: AstReader, node: Node): Node | undefined {
  const parent = ast.parent(node);
  if (
    parent !== undefined &&
    ast.is.IsPropertyAccessExpression(parent) &&
    sourceNodesEqual(ast, ast.name(parent), node)
  ) {
    return parent;
  }
  if (
    ast.is.IsIdentifier(node) ||
    ast.is.IsPrivateIdentifier(node) ||
    ast.is.IsPropertyAccessExpression(node) ||
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

function isAliasDeclaration(
  ast: AstReader,
  declaration: Node | undefined,
): boolean {
  let current = declaration;
  for (let depth = 0; current !== undefined && depth < 3; depth += 1) {
    if (
      ast.is.IsImportClause(current) ||
      ast.is.IsImportSpecifier(current) ||
      ast.is.IsNamespaceImport(current) ||
      ast.is.IsExportSpecifier(current)
    ) {
      return true;
    }
    current = ast.parent(current);
  }
  return false;
}
