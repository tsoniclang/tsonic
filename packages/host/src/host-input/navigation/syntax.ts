import type { AstReader, Node, Symbol, Type, TypeCheckerQueries } from "@tsonic/tsts";

import { isTypeSyntaxNode, referenceQueryNode, type SourceReferenceMeaning } from "@tsonic/target-api/host";

export function referenceDeclarationForMeaning(
  ast: AstReader, checker: TypeCheckerQueries, symbol: Symbol | undefined, meaning: SourceReferenceMeaning,
): Node | undefined {
  const declaration = primaryDeclaration(checker, symbol);
  if (meaning === "value") return declaration;
  const accepts = (candidate: Node | undefined): boolean => candidate !== undefined &&
    (meaning === "namespace" ? ast.is.IsModuleDeclaration(candidate) || ast.is.IsSourceFile(candidate)
      : ast.is.IsClassDeclaration(candidate) || ast.is.IsInterfaceDeclaration(candidate) ||
        ast.is.IsTypeAliasDeclaration(candidate) || ast.is.IsEnumDeclaration(candidate) ||
        ast.is.IsTypeParameterDeclaration(candidate));
  if (accepts(declaration)) return declaration;
  const candidates = checker.getSymbolDeclarations(symbol).filter((candidate): candidate is Node => accepts(candidate));
  return candidates.length === 1 ? candidates[0] : undefined;
}

export function semanticTypeForNode(
  ast: AstReader,
  checker: TypeCheckerQueries,
  node: Node,
): Type | undefined {
  // `import type { A } from "..."` has an unnamed type-only import clause. TS-Go classifies it as a type declaration
  // but binds no symbol for it, so it declares no type and the checker cannot be asked for one.
  if (ast.is.IsImportClause(node) && ast.name(node) === undefined) return undefined;
  return isTypeSyntaxNode(ast, node)
    ? checker.getTypeFromTypeNode(node)
    : checker.getTypeAtLocation(node);
}

export function symbolAtReferenceNode(
  ast: AstReader,
  checker: TypeCheckerQueries,
  node: Node,
): Symbol | undefined {
  const reference = referenceQueryNode(ast, node);
  return reference === undefined
    ? undefined
    : checker.getSymbolAtLocation(reference);
}

export function resolvedSymbolAtReferenceNode(
  ast: AstReader,
  checker: TypeCheckerQueries,
  node: Node,
): Symbol | undefined {
  const reference = referenceQueryNode(ast, node);
  const selected = reference !== undefined && ast.is.IsPropertyAccessExpression(reference)
    ? ast.name(reference)
    : reference;
  return selected === undefined
    ? undefined
    : checker.getResolvedSymbol(selected);
}

export function aliasedSymbol(
  ast: AstReader,
  checker: TypeCheckerQueries,
  symbol: Symbol | undefined,
): Symbol | undefined {
  return symbol !== undefined &&
    checker.getSymbolDeclarations(symbol).some((declaration) =>
      isAliasDeclaration(ast, declaration))
    ? checker.getAliasedSymbol(symbol)
    : undefined;
}

export function primaryDeclaration(
  checker: TypeCheckerQueries,
  symbol: Symbol | undefined,
): Node | undefined {
  return checker.getPrimarySymbolDeclaration(symbol);
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
