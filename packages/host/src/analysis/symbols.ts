import type {
  AstReader,
  Node,
  SourceFile,
  Symbol,
  Type,
  TypeCheckerQueries,
} from "@tsonic/tsts";
import { isTypeSyntaxNode } from "./guards.js";

export function getSymbolAtReferenceNode(
  ast: AstReader,
  checker: TypeCheckerQueries,
  node: Node,
  options: { readonly sourceFile: SourceFile },
): Symbol | undefined {
  const reference = getReferenceQueryNode(ast, node);
  return reference === undefined ? undefined : checker.getSymbolAtLocation(reference, options);
}

export function getResolvedSymbolForReferenceNode(
  ast: AstReader,
  checker: TypeCheckerQueries,
  node: Node,
  options: { readonly sourceFile: SourceFile },
): Symbol | undefined {
  const reference = getResolvedReferenceQueryNode(ast, node);
  return reference === undefined ? undefined : checker.getResolvedSymbol(reference, options);
}

export function getSemanticTypeForNode(
  ast: AstReader,
  checker: TypeCheckerQueries,
  node: Node,
  options: { readonly sourceFile: SourceFile },
): Type | undefined {
  return isTypeSyntaxNode(ast, node)
    ? checker.getTypeFromTypeNode(node, options)
    : checker.getTypeAtLocation(node, options);
}

export function getReferenceQueryNode(ast: AstReader, node: Node | undefined): Node | undefined {
  if (node === undefined) {
    return undefined;
  }
  const parent = ast.parent(node);
  if (parent !== undefined && ast.is.IsPropertyAccessExpression(parent) && ast.name(parent) === node) {
    return parent;
  }
  if (ast.is.IsIdentifier(node) ||
    ast.is.IsPrivateIdentifier(node) ||
    ast.is.IsPropertyAccessExpression(node) ||
    ast.is.IsQualifiedName(node)) {
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

function getResolvedReferenceQueryNode(ast: AstReader, node: Node | undefined): Node | undefined {
  const reference = getReferenceQueryNode(ast, node);
  return reference !== undefined && ast.is.IsPropertyAccessExpression(reference)
    ? ast.name(reference)
    : reference;
}

export function isTypeReferenceQuery(ast: AstReader, node: Node): boolean {
  if (isTypeSyntaxNode(ast, node)) {
    return true;
  }
  let parent = ast.parent(node);
  let current: Node | undefined = node;
  while (parent !== undefined && ast.is.IsQualifiedName(parent)) {
    current = parent;
    parent = ast.parent(parent);
  }
  if (parent === undefined || !ast.is.IsTypeReferenceNode(parent)) {
    return false;
  }
  return ast.as.AsTypeReferenceNode(parent)?.TypeName === current;
}

export function getAliasedSymbolIfAlias(
  ast: AstReader,
  checker: TypeCheckerQueries,
  symbol: Symbol | undefined,
  options: { readonly sourceFile: SourceFile },
): Symbol | undefined {
  return symbol !== undefined && checker.getSymbolDeclarations(symbol).some((declaration) => isAliasDeclaration(ast, declaration))
    ? checker.getAliasedSymbol(symbol, options)
    : undefined;
}

function isAliasDeclaration(ast: AstReader, declaration: Node | undefined): boolean {
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

export function getPrimaryDeclaration(
  checker: TypeCheckerQueries,
  symbol: Symbol | undefined,
): Node | undefined {
  return checker.getSymbolDeclarations(symbol).find((candidate): candidate is Node => candidate !== undefined);
}
