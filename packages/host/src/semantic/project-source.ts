import type {
  AstReader,
  Node,
  SourceFile,
  Symbol,
  Type,
  TypeCheckerQueries,
  TypeShapeQueries,
} from "@tsonic/tsts";
import type { TargetSemanticQueries } from "@tsonic/target-api";
import { asNode, asSymbol } from "./guards.js";
import {
  getAliasedSymbolIfAlias,
  getPrimaryDeclaration,
  getResolvedSymbolForReferenceNode,
  getSemanticTypeForNode,
  getSymbolAtReferenceNode,
} from "./symbols.js";

export function getProjectSourceDeclarationForNode(
  ast: AstReader,
  checker: TypeCheckerQueries,
  types: TypeShapeQueries,
  node: Node | undefined,
  options: { readonly sourceFile: SourceFile },
  sourceFiles: readonly SourceFile[],
): Node | undefined {
  if (node === undefined) {
    return undefined;
  }
  const type = getSemanticTypeForNode(ast, checker, node, options);
  return getProjectSourceDeclarationForType(ast, types, type, sourceFiles);
}

export function getProjectSourceReferenceForNode(
  ast: AstReader,
  checker: TypeCheckerQueries,
  types: TypeShapeQueries,
  node: Node | undefined,
  options: { readonly sourceFile: SourceFile },
  sourceFiles: readonly SourceFile[],
): ReturnType<TargetSemanticQueries["getProjectSourceReferenceForNode"]> {
  if (node === undefined) {
    return undefined;
  }
  const namespacePropertyReference = getProjectSourceReferenceForNamespacePropertyAccess(ast, checker, node, options, sourceFiles);
  if (namespacePropertyReference !== undefined) {
    return namespacePropertyReference;
  }
  const directSymbol = getSymbolAtReferenceNode(ast, checker, node, options);
  const importedReference = getImportedProjectSourceReferenceForSymbol(ast, checker, directSymbol, options, sourceFiles);
  if (importedReference !== undefined) {
    return importedReference;
  }
  const symbols = [
    getResolvedSymbolForReferenceNode(ast, checker, node, options),
    directSymbol,
  ].flatMap((symbol) => symbol === undefined
    ? []
    : [getAliasedSymbolIfAlias(checker, symbol, options), symbol]);
  for (const symbol of symbols) {
    const reference = getProjectSourceReferenceForSymbol(ast, symbol, sourceFiles);
    if (reference !== undefined) {
      return reference;
    }
  }
  const declaration = getProjectSourceDeclarationForType(ast, types, getSemanticTypeForNode(ast, checker, node, options), sourceFiles);
  const symbol = asSymbol((declaration as { readonly Symbol?: unknown } | undefined)?.Symbol);
  const sourceFile = ast.getSourceFile(declaration);
  if (declaration !== undefined && symbol !== undefined && sourceFile !== undefined) {
    return { symbol, declaration, sourceFile };
  }
  return undefined;
}

export function getProjectSourceReferenceForSymbol(
  ast: AstReader,
  symbol: Symbol | undefined,
  sourceFiles: readonly SourceFile[],
): ReturnType<TargetSemanticQueries["getProjectSourceReferenceForNode"]> {
  if (symbol === undefined) {
    return undefined;
  }
  const declaration = getPrimaryDeclaration(symbol);
  if (declaration === undefined || !isProjectSourceDeclaration(ast, declaration, sourceFiles)) {
    return undefined;
  }
  const declarationFile = ast.getSourceFile(declaration);
  return declarationFile === undefined ? undefined : { symbol, declaration, sourceFile: declarationFile };
}

export function getProjectSourceDeclarationForType(
  ast: AstReader,
  types: TypeShapeQueries,
  type: Type | undefined,
  sourceFiles: readonly SourceFile[],
): Node | undefined {
  const direct = getPrimaryDeclaration(type?.symbol);
  if (isProjectSourceDeclaration(ast, direct, sourceFiles)) {
    return direct;
  }
  if (type === undefined || !types.isUnion(type)) {
    return undefined;
  }
  const nonNullish = types.getUnionOrIntersectionTypes(type)
    .filter((candidate) => !types.isNullish(candidate));
  return nonNullish.length === 1
    ? getProjectSourceDeclarationForType(ast, types, nonNullish[0], sourceFiles)
    : undefined;
}

export function isProjectSourceDeclaration(ast: AstReader, declaration: Node | undefined, sourceFiles: readonly SourceFile[]): boolean {
  if (declaration === undefined) {
    return false;
  }
  const declarationFile = ast.getSourceFile(declaration);
  return declarationFile !== undefined &&
    !declarationFile.IsDeclarationFile &&
    !ast.getFileName(declarationFile).startsWith("tsts-provider://") &&
    sourceFiles.some((sourceFile) => sourceFile === declarationFile);
}

export function hasParameterlessConstruction(ast: AstReader, classDeclaration: Node): boolean {
  const constructors = ast.members(classDeclaration).filter((member): member is Node => ast.is.IsConstructorDeclaration(member));
  if (constructors.length === 0) {
    return true;
  }
  return constructors.some((constructor) => ast.parameters(constructor).every((parameter) => parameter === undefined));
}

function getProjectSourceReferenceForNamespacePropertyAccess(
  ast: AstReader,
  checker: TypeCheckerQueries,
  node: Node,
  options: { readonly sourceFile: SourceFile },
  sourceFiles: readonly SourceFile[],
): ReturnType<TargetSemanticQueries["getProjectSourceReferenceForNode"]> {
  if (!ast.is.IsPropertyAccessExpression(node)) {
    return undefined;
  }
  const propertyAccess = ast.as.AsPropertyAccessExpression(node);
  const receiver = propertyAccess?.Expression;
  const propertyName = ast.text(propertyAccess?.name ?? ast.name(node));
  if (receiver === undefined || propertyName.length === 0) {
    return undefined;
  }
  const receiverType = getSemanticTypeForNode(ast, checker, receiver, options);
  const propertySymbol = checker.getPropertyOfType(receiverType, propertyName, options);
  const candidates = [
    getAliasedSymbolIfAlias(checker, propertySymbol, options),
    propertySymbol,
  ];
  for (const candidate of candidates) {
    const reference = getProjectSourceReferenceForSymbol(ast, candidate, sourceFiles);
    if (reference !== undefined) {
      return reference;
    }
  }
  return undefined;
}

function getImportedProjectSourceReferenceForSymbol(
  ast: AstReader,
  checker: TypeCheckerQueries,
  symbol: Symbol | undefined,
  options: { readonly sourceFile: SourceFile },
  sourceFiles: readonly SourceFile[],
): ReturnType<TargetSemanticQueries["getProjectSourceReferenceForNode"]> {
  if (symbol === undefined) {
    return undefined;
  }
  for (const declaration of symbol.Declarations ?? []) {
    const imported = getImportedModuleExport(ast, checker, declaration, options);
    if (imported === undefined) {
      continue;
    }
    const alias = getAliasedSymbolIfAlias(checker, imported.symbol, { sourceFile: imported.sourceFile });
    const candidates = ast.is.IsExportAssignment(getPrimaryDeclaration(imported.symbol))
      ? [imported.symbol, alias]
      : [alias, imported.symbol];
    for (const candidate of candidates) {
      const reference = getProjectSourceReferenceForSymbol(ast, candidate, sourceFiles);
      if (reference !== undefined) {
        return reference;
      }
    }
  }
  return undefined;
}

function getImportedModuleExport(
  ast: AstReader,
  checker: TypeCheckerQueries,
  declaration: Node | undefined,
  options: { readonly sourceFile: SourceFile },
): { readonly symbol: Symbol; readonly sourceFile: SourceFile } | undefined {
  const importBinding = normalizeImportBindingDeclaration(ast, declaration);
  if (importBinding === undefined) {
    return undefined;
  }
  const exportName = getImportedExportName(ast, importBinding);
  if (exportName === undefined) {
    return undefined;
  }
  const importDeclaration = findImportDeclaration(ast, importBinding);
  const moduleSpecifier = ast.as.AsImportDeclaration(importDeclaration)?.ModuleSpecifier;
  const moduleSymbol = checker.getModuleSymbolFromSpecifier(moduleSpecifier, options);
  const resolvedModuleSymbol = checker.getResolvedExternalModuleSymbol(moduleSymbol, false, options);
  const exportSymbol = checker.getExportsOfModule(resolvedModuleSymbol, options)
    .find((candidate) => candidate?.Name === exportName);
  const sourceFile = ast.getSourceFile(exportSymbol?.ValueDeclaration ?? exportSymbol?.Declarations?.[0]);
  return exportSymbol === undefined || sourceFile === undefined ? undefined : { symbol: exportSymbol, sourceFile };
}

function normalizeImportBindingDeclaration(ast: AstReader, declaration: Node | undefined): Node | undefined {
  if (declaration === undefined) {
    return undefined;
  }
  if (ast.is.IsImportClause(declaration) || ast.is.IsImportSpecifier(declaration)) {
    return declaration;
  }
  const parent = ast.parent(declaration);
  return ast.is.IsImportClause(parent) || ast.is.IsImportSpecifier(parent) ? parent : undefined;
}

function getImportedExportName(ast: AstReader, importBinding: Node): string | undefined {
  if (ast.is.IsImportClause(importBinding)) {
    return ast.as.AsImportClause(importBinding)?.name === undefined ? undefined : "default";
  }
  if (ast.is.IsImportSpecifier(importBinding)) {
    const specifier = ast.as.AsImportSpecifier(importBinding);
    return ast.text(specifier?.PropertyName ?? ast.name(importBinding));
  }
  return undefined;
}

function findImportDeclaration(ast: AstReader, node: Node): Node | undefined {
  let current = ast.parent(node);
  while (current !== undefined) {
    if (ast.is.IsImportDeclaration(current)) {
      return current;
    }
    current = ast.parent(current);
  }
  return undefined;
}

export function getDeclarationTypeNode(declaration: Node | undefined): Node | undefined {
  return asNode((declaration as { readonly Type?: unknown } | undefined)?.Type);
}
