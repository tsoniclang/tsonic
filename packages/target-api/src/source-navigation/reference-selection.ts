import type {
  AstReader,
  Node,
  SourceFile,
  Symbol,
  Type,
  TypeCheckerQueries,
  TypeShapeQueries,
} from "@tsonic/tsts";
import type {
  SourceDeclarationReference,
} from "./types.js";
import {
  aliasedSymbol,
  primaryDeclaration,
  referenceQueryNode,
  resolvedSymbolAtReferenceNode,
  symbolAtReferenceNode,
} from "./syntax.js";

type ImportedDeclarationSelection =
  | { readonly kind: "not-imported" }
  | { readonly kind: "unresolved" }
  | {
      readonly kind: "resolved";
      readonly reference: SourceDeclarationReference;
    };

const notImportedSelection: ImportedDeclarationSelection = Object.freeze({
  kind: "not-imported",
});
const unresolvedImportedSelection: ImportedDeclarationSelection = Object.freeze({
  kind: "unresolved",
});

export function createSourceDeclarationReferenceSelector(
  ast: AstReader,
  isProjectDeclaration: (declaration: Node | undefined) => boolean,
  reserveModuleExports: (count: number) => void,
): (checker: TypeCheckerQueries, node: Node) => SourceDeclarationReference | undefined {
  const referencesBySelectedSymbol = new WeakMap<
    Symbol,
    SourceDeclarationReference
  >();
  const unresolvedImportedSymbols = new WeakSet<Symbol>();
  const exportsByModule = new WeakMap<
    Symbol,
    readonly (Symbol | undefined)[]
  >();
  return (checker, node) => selectSourceDeclarationReferenceForNode(
    ast,
    checker,
    node,
    isProjectDeclaration,
    referencesBySelectedSymbol,
    unresolvedImportedSymbols,
    exportsByModule,
    reserveModuleExports,
  );
}

function selectSourceDeclarationReferenceForNode(
  ast: AstReader,
  checker: TypeCheckerQueries,
  node: Node,
  isProjectDeclaration: (declaration: Node | undefined) => boolean,
  referencesBySelectedSymbol: WeakMap<Symbol, SourceDeclarationReference>,
  unresolvedImportedSymbols: WeakSet<Symbol>,
  exportsByModule: WeakMap<Symbol, readonly (Symbol | undefined)[]>,
  reserveModuleExports: (count: number) => void,
): SourceDeclarationReference | undefined {
  const queryNode = referenceQueryNode(ast, node);
  if (queryNode === undefined) {
    return undefined;
  }
  if (
    ast.is.IsPropertyAccessExpression(queryNode) ||
    ast.is.IsElementAccessExpression(queryNode)
  ) {
    return selectedAccessDeclarationReference(
      ast,
      checker,
      queryNode,
      isProjectDeclaration,
    );
  }
  const directSymbol = symbolAtReferenceNode(ast, checker, queryNode);
  const resolvedSymbol = resolvedSymbolAtReferenceNode(ast, checker, queryNode);
  const parent = ast.parent(queryNode);
  const orderedSymbols = parent !== undefined &&
      ast.is.IsShorthandPropertyAssignment(parent)
    ? [resolvedSymbol, directSymbol]
    : [directSymbol, resolvedSymbol];
  for (const selected of orderedSymbols) {
    if (selected === undefined) {
      continue;
    }
    const cached = referencesBySelectedSymbol.get(selected);
    if (cached !== undefined) {
      return cached;
    }
    if (unresolvedImportedSymbols.has(selected)) {
      continue;
    }
    const importedSelection = importedDeclarationReference(
      ast,
      checker,
      selected,
      isProjectDeclaration,
      exportsByModule,
      reserveModuleExports,
    );
    if (importedSelection.kind === "resolved") {
      referencesBySelectedSymbol.set(selected, importedSelection.reference);
      return importedSelection.reference;
    }
    if (importedSelection.kind === "unresolved") {
      unresolvedImportedSymbols.add(selected);
      continue;
    }
    const alias = aliasedSymbol(ast, checker, selected);
    const aliasReference = declarationReferenceForSymbol(
      ast,
      checker,
      alias,
      isProjectDeclaration,
    );
    if (aliasReference !== undefined) {
      referencesBySelectedSymbol.set(selected, aliasReference);
      return aliasReference;
    }
    const directReference = declarationReferenceForSymbol(
      ast,
      checker,
      selected,
      isProjectDeclaration,
    );
    if (directReference !== undefined) {
      referencesBySelectedSymbol.set(selected, directReference);
      return directReference;
    }
  }
  return undefined;
}

function importedDeclarationReference(
  ast: AstReader,
  checker: TypeCheckerQueries,
  symbol: Symbol,
  isProjectDeclaration: (declaration: Node | undefined) => boolean,
  exportsByModule: WeakMap<Symbol, readonly (Symbol | undefined)[]>,
  reserveModuleExports: (count: number) => void,
): ImportedDeclarationSelection {
  let imported = false;
  for (const declaration of checker.getSymbolDeclarations(symbol)) {
    const binding = normalizeImportBinding(ast, declaration);
    if (binding === undefined) {
      continue;
    }
    imported = true;
    const importDeclaration = findImportDeclaration(ast, binding);
    if (
      importDeclaration === undefined ||
      !ast.is.IsImportDeclaration(importDeclaration)
    ) {
      continue;
    }
    const importNode = ast.as.AsImportDeclaration(importDeclaration);
    const moduleSpecifier = importNode?.ModuleSpecifier;
    const exportName = importedExportName(ast, binding);
    if (moduleSpecifier === undefined || exportName === undefined) {
      continue;
    }
    const moduleSymbol = checker.getModuleSymbolFromSpecifier(moduleSpecifier);
    const resolvedModule = checker.getResolvedExternalModuleSymbol(
      moduleSymbol,
      false,
    ) ?? moduleSymbol;
    if (
      resolvedModule === undefined
    ) {
      continue;
    }
    let moduleExports = exportsByModule.get(resolvedModule);
    if (moduleExports === undefined) {
      moduleExports = checker.getExportsOfModule(resolvedModule);
      reserveModuleExports(moduleExports.length);
      exportsByModule.set(resolvedModule, moduleExports);
    }
    let exported: Symbol | undefined;
    for (const candidate of moduleExports) {
      if (
        candidate === undefined ||
        checker.getSymbolName(candidate) !== exportName
      ) {
        continue;
      }
      if (exported !== undefined && exported !== candidate) {
        throw new Error(
          `Source module exposes more than one exact '${exportName}' export symbol.`,
        );
      }
      exported = candidate;
    }
    const exportedDeclaration = primaryDeclaration(checker, exported);
    const alias = aliasedSymbol(ast, checker, exported);
    const candidates = exportedDeclaration !== undefined &&
        ast.is.IsExportAssignment(exportedDeclaration)
      ? [exported, alias]
      : [alias, exported];
    for (const candidate of candidates) {
      const reference = declarationReferenceForSymbol(
        ast,
        checker,
        candidate,
        isProjectDeclaration,
      );
      if (reference !== undefined) {
        return Object.freeze({ kind: "resolved", reference });
      }
    }
  }
  return imported ? unresolvedImportedSelection : notImportedSelection;
}

function normalizeImportBinding(
  ast: AstReader,
  declaration: Node | undefined,
): Node | undefined {
  if (declaration === undefined) {
    return undefined;
  }
  if (
    ast.is.IsImportClause(declaration) ||
    ast.is.IsImportSpecifier(declaration)
  ) {
    return declaration;
  }
  const parent = ast.parent(declaration);
  return parent !== undefined &&
      (ast.is.IsImportClause(parent) || ast.is.IsImportSpecifier(parent))
    ? parent
    : undefined;
}

function importedExportName(
  ast: AstReader,
  binding: Node,
): string | undefined {
  if (ast.is.IsImportClause(binding)) {
    return ast.as.AsImportClause(binding)?.name === undefined
      ? undefined
      : "default";
  }
  if (ast.is.IsImportSpecifier(binding)) {
    const specifier = ast.as.AsImportSpecifier(binding);
    return ast.text(specifier?.PropertyName ?? ast.name(binding));
  }
  return undefined;
}

function findImportDeclaration(
  ast: AstReader,
  node: Node | undefined,
): Node | undefined {
  if (node === undefined) {
    return undefined;
  }
  let current = ast.parent(node);
  while (current !== undefined) {
    if (ast.is.IsImportDeclaration(current)) {
      return current;
    }
    current = ast.parent(current);
  }
  return undefined;
}

export function projectDeclarationForType(
  checker: TypeCheckerQueries,
  types: TypeShapeQueries,
  type: Type | undefined,
  isProjectDeclaration: (declaration: Node | undefined) => boolean,
): Node | undefined {
  const direct = primaryDeclaration(checker, checker.getTypeSymbol(type));
  if (isProjectDeclaration(direct)) {
    return direct;
  }
  if (type === undefined || !types.isUnion(type)) {
    return undefined;
  }
  const nonNullish = types.getUnionOrIntersectionTypes(type)
    .filter((candidate) => !types.isNullish(candidate));
  return nonNullish.length === 1
    ? projectDeclarationForType(
        checker,
        types,
        nonNullish[0],
        isProjectDeclaration,
      )
    : undefined;
}

function selectedAccessDeclarationReference(
  ast: AstReader,
  checker: TypeCheckerQueries,
  access: Node,
  isProjectDeclaration: (declaration: Node | undefined) => boolean,
): SourceDeclarationReference | undefined {
  const selected = ast.is.IsPropertyAccessExpression(access)
    ? checker.getResolvedPropertyAccessInfo(access)
    : checker.getResolvedElementAccessInfo(access);
  const declaration = selected?.selectedDeclaration;
  const sourceFile = ast.getSourceFile(declaration);
  return declaration !== undefined && sourceFile !== undefined
    ? sourceDeclarationReference(
        selected?.selectedSymbol,
        declaration,
        sourceFile,
        isProjectDeclaration(declaration),
      )
    : undefined;
}

function declarationReferenceForSymbol(
  ast: AstReader,
  checker: TypeCheckerQueries,
  symbol: Symbol | undefined,
  isProjectDeclaration: (declaration: Node | undefined) => boolean,
): SourceDeclarationReference | undefined {
  const declaration = primaryDeclaration(checker, symbol);
  const sourceFile = ast.getSourceFile(declaration);
  return symbol !== undefined && declaration !== undefined && sourceFile !== undefined
    ? sourceDeclarationReference(
        symbol,
        declaration,
        sourceFile,
        isProjectDeclaration(declaration),
      )
    : undefined;
}

function sourceDeclarationReference(
  symbol: Symbol | undefined,
  declaration: Node,
  sourceFile: SourceFile,
  project: boolean,
): SourceDeclarationReference {
  return Object.freeze({
    ...(symbol === undefined ? {} : { symbol }),
    declaration,
    sourceFile,
    project,
  });
}
