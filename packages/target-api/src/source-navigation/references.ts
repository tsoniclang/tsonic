import type {
  AstReader,
  CheckedSourceProgram,
  Node,
  SourceFile,
  Symbol,
  Type,
  TypeCheckerQueries,
  TypeShapeQueries,
} from "@tsonic/tsts";
import type {
  SourceProjectReference,
} from "./types.js";
import {
  aliasedSymbol,
  primaryDeclaration,
  resolvedSymbolAtReferenceNode,
  semanticTypeForNode,
  symbolAtReferenceNode,
} from "./syntax.js";
import {
  sourceFileIdentity,
  sourceNodeIdentity,
} from "./identity.js";

export interface SourceReferenceNavigation {
  referenceFor(node: Node | undefined): SourceProjectReference | undefined;
  declarationFor(node: Node | undefined): Node | undefined;
  isProjectDeclaration(node: Node | undefined): boolean;
}

export function createSourceReferenceNavigation(
  source: CheckedSourceProgram,
  sourceFiles: readonly SourceFile[],
): SourceReferenceNavigation {
  const ast = source.ast;
  const sourceFileSet = new Set(
    sourceFiles.map((sourceFile) => sourceFileIdentity(ast, sourceFile)!),
  );
  const referenceCache = new Map<string, SourceProjectReference | null>();
  const declarationCache = new Map<string, Node | null>();

  const isProjectDeclaration = (declaration: Node | undefined): boolean => {
    const declarationFile = declaration === undefined
      ? undefined
      : ast.getSourceFile(declaration);
    return declarationFile !== undefined &&
      !declarationFile.IsDeclarationFile &&
      sourceFileSet.has(sourceFileIdentity(ast, declarationFile) ?? "");
  };

  const declarationFor = (node: Node | undefined): Node | undefined => {
    if (node === undefined) {
      return undefined;
    }
    const nodeKey = sourceNodeIdentity(ast, node);
    const cached = nodeKey === undefined
      ? undefined
      : declarationCache.get(nodeKey);
    if (cached !== undefined) {
      return cached ?? undefined;
    }
    const sourceFile = ast.getSourceFile(node);
    if (sourceFile === undefined) {
      if (nodeKey !== undefined) {
        declarationCache.set(nodeKey, null);
      }
      return undefined;
    }
    const queries = source.getSourceFileQueries(sourceFile);
    const type = semanticTypeForNode(ast, queries.checker, node);
    const declaration = projectDeclarationForType(
      ast,
      queries.checker,
      queries.typeShape,
      type,
      isProjectDeclaration,
    );
    if (nodeKey !== undefined) {
      declarationCache.set(nodeKey, declaration ?? null);
    }
    return declaration;
  };

  const referenceFor = (node: Node | undefined): SourceProjectReference | undefined => {
    if (node === undefined) {
      return undefined;
    }
    const nodeKey = sourceNodeIdentity(ast, node);
    const cached = nodeKey === undefined
      ? undefined
      : referenceCache.get(nodeKey);
    if (cached !== undefined) {
      return cached ?? undefined;
    }
    const sourceFile = ast.getSourceFile(node);
    if (sourceFile === undefined) {
      if (nodeKey !== undefined) {
        referenceCache.set(nodeKey, null);
      }
      return undefined;
    }
    const queries = source.getSourceFileQueries(sourceFile);
    const directSymbol = symbolAtReferenceNode(
      ast,
      queries.checker,
      node,
    );
    const imported = importedProjectReference(
      ast,
      queries.checker,
      directSymbol,
      isProjectDeclaration,
    );
    if (imported !== undefined) {
      if (nodeKey !== undefined) {
        referenceCache.set(nodeKey, imported);
      }
      return imported;
    }
    const resolvedSymbol = resolvedSymbolAtReferenceNode(
      ast,
      queries.checker,
      node,
    );
    const symbols = [directSymbol, resolvedSymbol].flatMap((symbol) =>
      symbol === undefined
        ? []
        : [
            aliasedSymbol(ast, queries.checker, symbol),
            symbol,
          ]);
    for (const symbol of symbols) {
      const reference = projectReferenceForSymbol(
        ast,
        queries.checker,
        symbol,
        isProjectDeclaration,
      );
      if (reference !== undefined) {
        if (nodeKey !== undefined) {
          referenceCache.set(nodeKey, reference);
        }
        return reference;
      }
    }
    const declaration = declarationFor(node);
    const declarationFile = ast.getSourceFile(declaration);
    const symbol = declaration === undefined
      ? undefined
      : source.getSourceFileQueries(declarationFile ?? sourceFile).checker
        .getSymbolAtLocation(declaration);
    const reference = declaration !== undefined &&
      declarationFile !== undefined &&
      symbol !== undefined
      ? { symbol, declaration, sourceFile: declarationFile }
      : undefined;
    if (nodeKey !== undefined) {
      referenceCache.set(nodeKey, reference ?? null);
    }
    return reference;
  };

  return Object.freeze({
    referenceFor,
    declarationFor,
    isProjectDeclaration,
  });
}

function projectDeclarationForType(
  ast: AstReader,
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
        ast,
        checker,
        types,
        nonNullish[0],
        isProjectDeclaration,
      )
    : undefined;
}

function projectReferenceForSymbol(
  ast: AstReader,
  checker: TypeCheckerQueries,
  symbol: Symbol | undefined,
  isProjectDeclaration: (declaration: Node | undefined) => boolean,
): SourceProjectReference | undefined {
  const declaration = primaryDeclaration(checker, symbol);
  const sourceFile = ast.getSourceFile(declaration);
  return symbol !== undefined &&
    declaration !== undefined &&
    sourceFile !== undefined &&
    isProjectDeclaration(declaration)
    ? { symbol, declaration, sourceFile }
    : undefined;
}

function importedProjectReference(
  ast: AstReader,
  checker: TypeCheckerQueries,
  symbol: Symbol | undefined,
  isProjectDeclaration: (declaration: Node | undefined) => boolean,
): SourceProjectReference | undefined {
  if (symbol === undefined) {
    return undefined;
  }
  for (const declaration of checker.getSymbolDeclarations(symbol)) {
    const imported = importedModuleExport(
      ast,
      checker,
      declaration,
    );
    if (imported === undefined) {
      continue;
    }
    const alias = aliasedSymbol(
      ast,
      checker,
      imported.symbol,
    );
    const candidates = ast.is.IsExportAssignment(
      primaryDeclaration(checker, imported.symbol),
    )
      ? [imported.symbol, alias]
      : [alias, imported.symbol];
    for (const candidate of candidates) {
      const reference = projectReferenceForSymbol(
        ast,
        checker,
        candidate,
        isProjectDeclaration,
      );
      if (reference !== undefined) {
        return reference;
      }
    }
  }
  return undefined;
}

function importedModuleExport(
  ast: AstReader,
  checker: TypeCheckerQueries,
  declaration: Node | undefined,
): { readonly symbol: Symbol; readonly sourceFile: SourceFile } | undefined {
  const binding = normalizeImportBinding(ast, declaration);
  if (binding === undefined) {
    return undefined;
  }
  const exportName = importedExportName(ast, binding);
  const importDeclaration = findImportDeclaration(ast, binding);
  if (
    exportName === undefined ||
    importDeclaration === undefined ||
    !ast.is.IsImportDeclaration(importDeclaration)
  ) {
    return undefined;
  }
  const moduleSpecifier = ast.as.AsImportDeclaration(importDeclaration)
    ?.ModuleSpecifier;
  const moduleSymbol = checker.getModuleSymbolFromSpecifier(moduleSpecifier);
  const resolvedModuleSymbol = checker.getResolvedExternalModuleSymbol(
    moduleSymbol,
    false,
  );
  const exported = checker.getExportsOfModule(
    resolvedModuleSymbol ?? moduleSymbol,
  ).find((candidate) =>
    candidate !== undefined && checker.getSymbolName(candidate) === exportName);
  const exportedSourceFile = ast.getSourceFile(
    primaryDeclaration(checker, exported),
  );
  return exported !== undefined && exportedSourceFile !== undefined
    ? { symbol: exported, sourceFile: exportedSourceFile }
    : undefined;
}

function normalizeImportBinding(
  ast: AstReader,
  declaration: Node | undefined,
): Node | undefined {
  if (
    ast.is.IsImportClause(declaration) ||
    ast.is.IsImportSpecifier(declaration)
  ) {
    return declaration;
  }
  const parent = ast.parent(declaration);
  return ast.is.IsImportClause(parent) || ast.is.IsImportSpecifier(parent)
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
  node: Node,
): Node | undefined {
  let current = ast.parent(node);
  while (current !== undefined) {
    if (ast.is.IsImportDeclaration(current)) {
      return current;
    }
    current = ast.parent(current);
  }
  return undefined;
}
