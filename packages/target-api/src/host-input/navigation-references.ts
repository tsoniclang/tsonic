// host-input/navigation-references: checker symbol identity -> declaration Node (I3). The reference selection behind the
// navigation reference index, and the symbol helpers other Host checker readers share. Moved whole from
// source-navigation/reference-selection.ts and the checker half of source-navigation/syntax.ts. Symbol identity is
// translated into the selected declaration; no Symbol leaves through SourceNavigationInput (navigation.ts).
import type { AstReader, Node, Symbol, TypeCheckerQueries } from "@tsonic/tsts";
import { referenceQueryNode, sourceReferenceMeaning, type SourceReferenceMeaning } from "../source-model/syntax.js";
import type { SourceNavigationReference } from "../source-model/navigation-records.js";

type ImportedDeclarationSelection =
  | { readonly kind: "not-imported" }
  | { readonly kind: "unresolved" }
  | { readonly kind: "resolved"; readonly reference: SourceNavigationReference };

const notImportedSelection: ImportedDeclarationSelection = Object.freeze({ kind: "not-imported" });
const unresolvedImportedSelection: ImportedDeclarationSelection = Object.freeze({ kind: "unresolved" });

/**
 * One selector per program. Caches by selected symbol and meaning (lifetime: the program's navigation input, I5).
 * `reserveModuleExports` is told how many module exports an import resolution examined the first time it reads a module.
 */
export function createSourceNavigationReferenceSelector(
  ast: AstReader,
): (checker: TypeCheckerQueries, node: Node, reserveModuleExports: (count: number) => void) => SourceNavigationReference | undefined {
  const referencesByMeaning = {
    value: new WeakMap<Symbol, SourceNavigationReference>(),
    type: new WeakMap<Symbol, SourceNavigationReference>(),
    namespace: new WeakMap<Symbol, SourceNavigationReference>(),
  };
  const unresolvedImportsByMeaning = {
    value: new WeakSet<Symbol>(),
    type: new WeakSet<Symbol>(),
    namespace: new WeakSet<Symbol>(),
  };
  const exportsByModule = new WeakMap<Symbol, readonly (Symbol | undefined)[]>();
  return (checker, node, reserveModuleExports) => {
    const queryNode = referenceQueryNode(ast, node);
    if (queryNode === undefined) return undefined;
    const meaning = sourceReferenceMeaning(ast, queryNode);
    if (meaning === "value" && (ast.is.IsPropertyAccessExpression(queryNode) || ast.is.IsElementAccessExpression(queryNode))) {
      return selectedAccessReference(ast, checker, queryNode);
    }
    const bySymbol = referencesByMeaning[meaning];
    const unresolvedImports = unresolvedImportsByMeaning[meaning];
    const parent = ast.parent(queryNode);
    const orderedSymbols = meaning === "value" && ast.is.IsIdentifier(queryNode) &&
        parent !== undefined && ast.is.IsShorthandPropertyAssignment(parent) && ast.name(parent) === queryNode
      ? [checker.getLexicallyResolvedSymbol(queryNode)]
      : [symbolAtReferenceNode(ast, checker, queryNode), resolvedSymbolAtReferenceNode(ast, checker, queryNode)];
    for (const selected of orderedSymbols) {
      if (selected === undefined) continue;
      const cached = bySymbol.get(selected);
      if (cached !== undefined) return cached;
      if (unresolvedImports.has(selected)) continue;
      const imported = importedDeclarationReference(ast, checker, selected, exportsByModule, reserveModuleExports, meaning);
      if (imported.kind === "resolved") {
        bySymbol.set(selected, imported.reference);
        return imported.reference;
      }
      if (imported.kind === "unresolved") {
        unresolvedImports.add(selected);
        continue;
      }
      const reference = declarationReferenceForSymbol(ast, checker, aliasedSymbol(ast, checker, selected), meaning) ??
        declarationReferenceForSymbol(ast, checker, selected, meaning);
      if (reference !== undefined) {
        bySymbol.set(selected, reference);
        return reference;
      }
    }
    return undefined;
  };
}

function importedDeclarationReference(
  ast: AstReader,
  checker: TypeCheckerQueries,
  symbol: Symbol,
  exportsByModule: WeakMap<Symbol, readonly (Symbol | undefined)[]>,
  reserveModuleExports: (count: number) => void,
  meaning: SourceReferenceMeaning,
): ImportedDeclarationSelection {
  let imported = false;
  for (const declaration of checker.getSymbolDeclarations(symbol)) {
    const binding = normalizeImportBinding(ast, declaration);
    if (binding === undefined) continue;
    imported = true;
    const importDeclaration = findImportDeclaration(ast, binding);
    if (importDeclaration === undefined || !ast.is.IsImportDeclaration(importDeclaration)) continue;
    const moduleSpecifier = ast.as.AsImportDeclaration(importDeclaration)?.ModuleSpecifier;
    const exportName = importedExportName(ast, binding);
    if (moduleSpecifier === undefined || exportName === undefined) continue;
    const moduleSymbol = checker.getModuleSymbolFromSpecifier(moduleSpecifier);
    const resolvedModule = checker.getResolvedExternalModuleSymbol(moduleSymbol, false) ?? moduleSymbol;
    if (resolvedModule === undefined) continue;
    let moduleExports = exportsByModule.get(resolvedModule);
    if (moduleExports === undefined) {
      moduleExports = checker.getExportsOfModule(resolvedModule);
      reserveModuleExports(moduleExports.length);
      exportsByModule.set(resolvedModule, moduleExports);
    }
    let exported: Symbol | undefined;
    for (const candidate of moduleExports) {
      if (candidate === undefined || checker.getSymbolName(candidate) !== exportName) continue;
      if (exported !== undefined && exported !== candidate) {
        throw new Error(`Source module exposes more than one exact '${exportName}' export symbol.`);
      }
      exported = candidate;
    }
    const exportedDeclaration = primaryDeclaration(checker, exported);
    const alias = aliasedSymbol(ast, checker, exported);
    const candidates = exportedDeclaration !== undefined && ast.is.IsExportAssignment(exportedDeclaration)
      ? [exported, alias] : [alias, exported];
    for (const candidate of candidates) {
      const reference = declarationReferenceForSymbol(ast, checker, candidate, meaning);
      if (reference !== undefined) return Object.freeze({ kind: "resolved", reference });
    }
  }
  return imported ? unresolvedImportedSelection : notImportedSelection;
}

function normalizeImportBinding(ast: AstReader, declaration: Node | undefined): Node | undefined {
  if (declaration === undefined) return undefined;
  if (ast.is.IsImportClause(declaration) || ast.is.IsImportSpecifier(declaration)) return declaration;
  const parent = ast.parent(declaration);
  return parent !== undefined && (ast.is.IsImportClause(parent) || ast.is.IsImportSpecifier(parent)) ? parent : undefined;
}

function importedExportName(ast: AstReader, binding: Node): string | undefined {
  if (ast.is.IsImportClause(binding)) return ast.as.AsImportClause(binding)?.name === undefined ? undefined : "default";
  if (ast.is.IsImportSpecifier(binding)) return ast.text(ast.as.AsImportSpecifier(binding)?.PropertyName ?? ast.name(binding));
  return undefined;
}

function findImportDeclaration(ast: AstReader, node: Node | undefined): Node | undefined {
  for (let current = node === undefined ? undefined : ast.parent(node); current !== undefined; current = ast.parent(current)) {
    if (ast.is.IsImportDeclaration(current)) return current;
  }
  return undefined;
}

function selectedAccessReference(ast: AstReader, checker: TypeCheckerQueries, access: Node): SourceNavigationReference | undefined {
  const selected = ast.is.IsPropertyAccessExpression(access)
    ? checker.getResolvedPropertyAccessInfo(access)
    : checker.getResolvedElementAccessInfo(access);
  const declaration = selected?.selectedDeclaration;
  const sourceFile = ast.getSourceFile(declaration);
  return declaration !== undefined && sourceFile !== undefined ? Object.freeze({ declaration, sourceFile }) : undefined;
}

function declarationReferenceForSymbol(
  ast: AstReader, checker: TypeCheckerQueries, symbol: Symbol | undefined, meaning: SourceReferenceMeaning,
): SourceNavigationReference | undefined {
  const declaration = referenceDeclarationForMeaning(ast, checker, symbol, meaning);
  const sourceFile = ast.getSourceFile(declaration);
  return symbol !== undefined && declaration !== undefined && sourceFile !== undefined
    ? Object.freeze({ declaration, sourceFile }) : undefined;
}

// Symbol helpers shared by the Host checker readers (host-input, and source-semantics until it moves behind host-input).

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
  return accepts(declaration) ? declaration : checker.getSymbolDeclarations(symbol).find(accepts);
}

export function symbolAtReferenceNode(ast: AstReader, checker: TypeCheckerQueries, node: Node): Symbol | undefined {
  const reference = referenceQueryNode(ast, node);
  return reference === undefined ? undefined : checker.getSymbolAtLocation(reference);
}

export function resolvedSymbolAtReferenceNode(ast: AstReader, checker: TypeCheckerQueries, node: Node): Symbol | undefined {
  const reference = referenceQueryNode(ast, node);
  const selected = reference !== undefined && ast.is.IsPropertyAccessExpression(reference) ? ast.name(reference) : reference;
  return selected === undefined ? undefined : checker.getResolvedSymbol(selected);
}

export function aliasedSymbol(ast: AstReader, checker: TypeCheckerQueries, symbol: Symbol | undefined): Symbol | undefined {
  return symbol !== undefined && checker.getSymbolDeclarations(symbol).some(declaration => isAliasDeclaration(ast, declaration))
    ? checker.getAliasedSymbol(symbol) : undefined;
}

export function primaryDeclaration(checker: TypeCheckerQueries, symbol: Symbol | undefined): Node | undefined {
  return checker.getPrimarySymbolDeclaration(symbol) ??
    checker.getSymbolDeclarations(symbol).find((declaration): declaration is Node => declaration !== undefined);
}

function isAliasDeclaration(ast: AstReader, declaration: Node | undefined): boolean {
  let current = declaration;
  for (let depth = 0; current !== undefined && depth < 3; depth += 1) {
    if (ast.is.IsImportClause(current) || ast.is.IsImportSpecifier(current) ||
      ast.is.IsNamespaceImport(current) || ast.is.IsExportSpecifier(current)) return true;
    current = ast.parent(current);
  }
  return false;
}
