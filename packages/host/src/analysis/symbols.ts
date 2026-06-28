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
  const reference = getReferenceQueryNode(ast, node);
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

const symbolFlagsAlias = 1 << 21;

export function getAliasedSymbolIfAlias(
  checker: TypeCheckerQueries,
  symbol: Symbol | undefined,
  options: { readonly sourceFile: SourceFile },
): Symbol | undefined {
  return symbol !== undefined && (symbol.Flags & symbolFlagsAlias) !== 0
    ? checker.getAliasedSymbol(symbol, options)
    : undefined;
}

export function getPrimaryDeclaration(
  checker: TypeCheckerQueries,
  symbol: Symbol | undefined,
): Node | undefined {
  return checker.getSymbolDeclarations(symbol).find((candidate): candidate is Node => candidate !== undefined);
}
