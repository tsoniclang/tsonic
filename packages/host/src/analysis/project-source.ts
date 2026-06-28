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
  TargetProjectSourceModuleDependency,
  TargetSourceAnalysisQueries,
} from "@tsonic/target-api";
import { asNode } from "./guards.js";
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
  return getProjectSourceDeclarationForType(ast, checker, types, type, sourceFiles);
}

export function getProjectSourceReferenceForNode(
  ast: AstReader,
  checker: TypeCheckerQueries,
  types: TypeShapeQueries,
  node: Node | undefined,
  options: { readonly sourceFile: SourceFile },
  sourceFiles: readonly SourceFile[],
): ReturnType<TargetSourceAnalysisQueries["getProjectSourceReferenceForNode"]> {
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
    const reference = getProjectSourceReferenceForSymbol(ast, checker, symbol, sourceFiles);
    if (reference !== undefined) {
      return reference;
    }
  }
  const declaration = getProjectSourceDeclarationForType(ast, checker, types, getSemanticTypeForNode(ast, checker, node, options), sourceFiles);
  const symbol = declaration === undefined ? undefined : checker.getSymbolAtLocation(declaration, options);
  const sourceFile = ast.getSourceFile(declaration);
  if (declaration !== undefined && symbol !== undefined && sourceFile !== undefined) {
    return { symbol, declaration, sourceFile };
  }
  return undefined;
}

export function getProjectSourceReferenceForSymbol(
  ast: AstReader,
  checker: TypeCheckerQueries,
  symbol: Symbol | undefined,
  sourceFiles: readonly SourceFile[],
): ReturnType<TargetSourceAnalysisQueries["getProjectSourceReferenceForNode"]> {
  if (symbol === undefined) {
    return undefined;
  }
  const declaration = getPrimaryDeclaration(checker, symbol);
  if (declaration === undefined || !isProjectSourceDeclaration(ast, declaration, sourceFiles)) {
    return undefined;
  }
  const declarationFile = ast.getSourceFile(declaration);
  return declarationFile === undefined ? undefined : { symbol, declaration, sourceFile: declarationFile };
}

export function getProjectSourceDeclarationForType(
  ast: AstReader,
  checker: TypeCheckerQueries,
  types: TypeShapeQueries,
  type: Type | undefined,
  sourceFiles: readonly SourceFile[],
): Node | undefined {
  const direct = getPrimaryDeclaration(checker, type?.symbol);
  if (isProjectSourceDeclaration(ast, direct, sourceFiles)) {
    return direct;
  }
  if (type === undefined || !types.isUnion(type)) {
    return undefined;
  }
  const nonNullish = types.getUnionOrIntersectionTypes(type)
    .filter((candidate) => !types.isNullish(candidate));
  return nonNullish.length === 1
    ? getProjectSourceDeclarationForType(ast, checker, types, nonNullish[0], sourceFiles)
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

export function getProjectSourceModuleDependencies(
  ast: AstReader,
  checker: TypeCheckerQueries,
  sourceFile: SourceFile,
  sourceFiles: readonly SourceFile[],
): ReturnType<TargetSourceAnalysisQueries["getProjectSourceModuleDependencies"]> {
  const dependencies: TargetProjectSourceModuleDependency[] = [];
  const seen = new Set<SourceFile>();
  for (const statement of ast.statements(sourceFile)) {
    if (statement === undefined) {
      continue;
    }
    const dependency = getRuntimeModuleDependency(ast, checker, statement, sourceFile, sourceFiles);
    if (dependency === undefined || seen.has(dependency.sourceFile)) {
      continue;
    }
    seen.add(dependency.sourceFile);
    dependencies.push(dependency);
  }
  return dependencies;
}

function getRuntimeModuleDependency(
  ast: AstReader,
  checker: TypeCheckerQueries,
  statement: Node,
  sourceFile: SourceFile,
  sourceFiles: readonly SourceFile[],
): TargetProjectSourceModuleDependency | undefined {
  if (ast.is.IsImportDeclaration(statement)) {
    if (isTypeOnlyImportDeclaration(ast, statement)) {
      return undefined;
    }
    return resolveRuntimeModuleDependency(ast, checker, statement, getModuleSpecifier(statement), "import", sourceFile, sourceFiles);
  }
  if (ast.is.IsExportDeclaration(statement)) {
    if ((statement as { readonly IsTypeOnly?: boolean }).IsTypeOnly === true) {
      return undefined;
    }
    return resolveRuntimeModuleDependency(ast, checker, statement, getModuleSpecifier(statement), "export", sourceFile, sourceFiles);
  }
  return undefined;
}

function resolveRuntimeModuleDependency(
  ast: AstReader,
  checker: TypeCheckerQueries,
  declaration: Node,
  moduleSpecifier: Node | undefined,
  kind: "import" | "export",
  sourceFile: SourceFile,
  sourceFiles: readonly SourceFile[],
): TargetProjectSourceModuleDependency | undefined {
  if (moduleSpecifier === undefined) {
    return undefined;
  }
  const resolvedSourceFile = getResolvedRuntimeModuleSourceFile(ast, checker, moduleSpecifier, { sourceFile });
  if (!isProjectSourceFile(ast, resolvedSourceFile, sourceFiles)) {
    return undefined;
  }
  return {
    sourceFile: resolvedSourceFile,
    declaration,
    moduleSpecifier,
    kind,
  };
}

function getResolvedRuntimeModuleSourceFile(
  ast: AstReader,
  checker: TypeCheckerQueries,
  moduleSpecifier: Node,
  options: { readonly sourceFile: SourceFile },
): SourceFile | undefined {
  const moduleSymbol = checker.getModuleSymbolFromSpecifier(moduleSpecifier, options);
  const resolvedModuleSymbol = checker.getResolvedExternalModuleSymbol(moduleSymbol, false, options) ?? moduleSymbol;
  return ast.getSourceFile(getPrimaryDeclaration(checker, resolvedModuleSymbol) ?? getPrimaryDeclaration(checker, moduleSymbol));
}

function isTypeOnlyImportDeclaration(ast: AstReader, declaration: Node): boolean {
  const importClause = (declaration as { readonly ImportClause?: Node }).ImportClause;
  if (importClause === undefined) {
    return false;
  }
  const phaseModifier = asNode((importClause as { readonly PhaseModifier?: unknown }).PhaseModifier);
  if (phaseModifier !== undefined && ast.text(phaseModifier) === "type") {
    return true;
  }
  const name = ast.name(importClause);
  if (name !== undefined) {
    return false;
  }
  const namedBindings = (importClause as { readonly NamedBindings?: Node }).NamedBindings;
  if (namedBindings === undefined) {
    return false;
  }
  if (ast.is.IsNamespaceImport(namedBindings)) {
    return false;
  }
  if (!ast.is.IsNamedImports(namedBindings)) {
    return false;
  }
  const elements = ast.elements(namedBindings);
  return elements.length > 0 &&
    elements.every((element) => element === undefined || (element as { readonly IsTypeOnly?: boolean }).IsTypeOnly === true);
}

function getModuleSpecifier(node: Node): Node | undefined {
  const moduleSpecifier = (node as { readonly ModuleSpecifier?: unknown }).ModuleSpecifier;
  return asNode(moduleSpecifier);
}

function isProjectSourceFile(
  ast: AstReader,
  sourceFile: SourceFile | undefined,
  sourceFiles: readonly SourceFile[],
): sourceFile is SourceFile {
  return sourceFile !== undefined &&
    !sourceFile.IsDeclarationFile &&
    !ast.getFileName(sourceFile).startsWith("tsts-provider://") &&
    sourceFiles.some((candidate) => candidate === sourceFile);
}

export function hasParameterlessConstruction(ast: AstReader, classDeclaration: Node): boolean {
  const constructors = ast.members(classDeclaration).filter((member): member is Node => ast.is.IsConstructorDeclaration(member));
  if (constructors.length === 0) {
    return true;
  }
  return constructors.some((constructor) => ast.parameters(constructor).every((parameter) => parameter === undefined));
}

const modifierFlagsPrivate = 1 << 1;
const modifierFlagsStatic = 1 << 8;

export function getProjectSourceMethodDispatch(
  ast: AstReader,
  checker: TypeCheckerQueries,
  types: TypeShapeQueries,
  node: Node | undefined,
  options: { readonly sourceFile: SourceFile },
  sourceFiles: readonly SourceFile[],
): ReturnType<TargetSourceAnalysisQueries["getProjectSourceMethodDispatch"]> {
  if (node === undefined || !ast.is.IsMethodDeclaration(node) || !isProjectSourceDispatchMethod(ast, node, sourceFiles)) {
    return undefined;
  }
  const classDeclaration = ast.parent(node);
  if (classDeclaration === undefined || !ast.is.IsClassDeclaration(classDeclaration)) {
    return undefined;
  }
  const methodName = ast.text(ast.name(node));
  if (methodName.length === 0) {
    return { overridesBase: false, hasDerivedOverride: false };
  }
  return {
    overridesBase: methodOverridesBaseProjectSourceMethod(ast, checker, types, classDeclaration, methodName, options, sourceFiles),
    hasDerivedOverride: projectSourceMethodHasDerivedOverride(ast, checker, types, classDeclaration, methodName, options, sourceFiles),
  };
}

function isProjectSourceDispatchMethod(ast: AstReader, node: Node, sourceFiles: readonly SourceFile[]): boolean {
  if (!isProjectSourceDeclaration(ast, node, sourceFiles)) {
    return false;
  }
  if ((ast.modifierFlags(node) & (modifierFlagsPrivate | modifierFlagsStatic)) !== 0) {
    return false;
  }
  const name = ast.name(node);
  return !ast.is.IsPrivateIdentifier(name);
}

function methodOverridesBaseProjectSourceMethod(
  ast: AstReader,
  checker: TypeCheckerQueries,
  types: TypeShapeQueries,
  classDeclaration: Node,
  methodName: string,
  options: { readonly sourceFile: SourceFile },
  sourceFiles: readonly SourceFile[],
): boolean {
  const baseType = getProjectSourceBaseClassType(ast, checker, types, classDeclaration, options, sourceFiles);
  if (baseType === undefined) {
    return false;
  }
  const baseSymbol = checker.getPropertyOfType(baseType, methodName, options);
  const baseDeclaration = getPrimaryDeclaration(checker, baseSymbol);
  return baseDeclaration !== undefined &&
    ast.is.IsMethodDeclaration(baseDeclaration) &&
    isProjectSourceDispatchMethod(ast, baseDeclaration, sourceFiles);
}

function projectSourceMethodHasDerivedOverride(
  ast: AstReader,
  checker: TypeCheckerQueries,
  types: TypeShapeQueries,
  classDeclaration: Node,
  methodName: string,
  options: { readonly sourceFile: SourceFile },
  sourceFiles: readonly SourceFile[],
): boolean {
  for (const candidate of getProjectSourceClassDeclarations(ast, sourceFiles)) {
    if (candidate === classDeclaration) {
      continue;
    }
    const candidateMethod = ast.members(candidate).find((member) =>
      member !== undefined &&
      ast.is.IsMethodDeclaration(member) &&
      ast.text(ast.name(member)) === methodName &&
      isProjectSourceDispatchMethod(ast, member, sourceFiles));
    if (candidateMethod === undefined) {
      continue;
    }
    const candidateFile = ast.getSourceFile(candidate) ?? options.sourceFile;
    if (projectSourceClassExtends(ast, checker, types, candidate, classDeclaration, { sourceFile: candidateFile }, sourceFiles) &&
      methodOverridesBaseProjectSourceMethod(ast, checker, types, candidate, methodName, { sourceFile: candidateFile }, sourceFiles)) {
      return true;
    }
  }
  return false;
}

function projectSourceClassExtends(
  ast: AstReader,
  checker: TypeCheckerQueries,
  types: TypeShapeQueries,
  candidate: Node,
  expectedBase: Node,
  options: { readonly sourceFile: SourceFile },
  sourceFiles: readonly SourceFile[],
): boolean {
  const directBase = getProjectSourceBaseClassDeclaration(ast, checker, types, candidate, options, sourceFiles);
  if (directBase === undefined) {
    return false;
  }
  if (directBase === expectedBase) {
    return true;
  }
  const directBaseFile = ast.getSourceFile(directBase) ?? options.sourceFile;
  return projectSourceClassExtends(ast, checker, types, directBase, expectedBase, { sourceFile: directBaseFile }, sourceFiles);
}

function getProjectSourceBaseClassType(
  ast: AstReader,
  checker: TypeCheckerQueries,
  types: TypeShapeQueries,
  classDeclaration: Node,
  options: { readonly sourceFile: SourceFile },
  sourceFiles: readonly SourceFile[],
): Type | undefined {
  const baseClassReferenceNode = getBaseClassReferenceNode(ast, classDeclaration);
  const baseReference = getProjectSourceReferenceForNode(ast, checker, types, baseClassReferenceNode, options, sourceFiles);
  if (baseReference === undefined || !ast.is.IsClassDeclaration(baseReference.declaration)) {
    return undefined;
  }
  return checker.getDeclaredTypeOfSymbol(baseReference.symbol, {
    sourceFile: baseReference.sourceFile,
  });
}

function getProjectSourceBaseClassDeclaration(
  ast: AstReader,
  checker: TypeCheckerQueries,
  types: TypeShapeQueries,
  classDeclaration: Node,
  options: { readonly sourceFile: SourceFile },
  sourceFiles: readonly SourceFile[],
): Node | undefined {
  const baseClassReferenceNode = getBaseClassReferenceNode(ast, classDeclaration);
  const baseReference = getProjectSourceReferenceForNode(ast, checker, types, baseClassReferenceNode, options, sourceFiles);
  return baseReference !== undefined && ast.is.IsClassDeclaration(baseReference.declaration)
    ? baseReference.declaration
    : undefined;
}

function getBaseClassReferenceNode(ast: AstReader, classDeclaration: Node): Node | undefined {
  for (const heritageType of ast.extendsHeritageElements(classDeclaration)) {
    const expression = ast.as.AsExpressionWithTypeArguments(heritageType)?.Expression;
    if (expression !== undefined) {
      return expression;
    }
  }
  return undefined;
}

function getProjectSourceClassDeclarations(ast: AstReader, sourceFiles: readonly SourceFile[]): readonly Node[] {
  const declarations: Node[] = [];
  for (const sourceFile of sourceFiles) {
    collectProjectSourceClassDeclarations(ast, sourceFile, declarations);
  }
  return declarations;
}

function collectProjectSourceClassDeclarations(ast: AstReader, node: Node | undefined, declarations: Node[]): void {
  if (node === undefined) {
    return;
  }
  if (ast.is.IsClassDeclaration(node)) {
    declarations.push(node);
  }
  ast.forEachChild(node, (child) => {
    collectProjectSourceClassDeclarations(ast, child, declarations);
  });
}

function getProjectSourceReferenceForNamespacePropertyAccess(
  ast: AstReader,
  checker: TypeCheckerQueries,
  node: Node,
  options: { readonly sourceFile: SourceFile },
  sourceFiles: readonly SourceFile[],
): ReturnType<TargetSourceAnalysisQueries["getProjectSourceReferenceForNode"]> {
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
    const reference = getProjectSourceReferenceForSymbol(ast, checker, candidate, sourceFiles);
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
): ReturnType<TargetSourceAnalysisQueries["getProjectSourceReferenceForNode"]> {
  if (symbol === undefined) {
    return undefined;
  }
  for (const declaration of checker.getSymbolDeclarations(symbol)) {
    const imported = getImportedModuleExport(ast, checker, declaration, options);
    if (imported === undefined) {
      continue;
    }
    const alias = getAliasedSymbolIfAlias(checker, imported.symbol, { sourceFile: imported.sourceFile });
    const candidates = ast.is.IsExportAssignment(getPrimaryDeclaration(checker, imported.symbol))
      ? [imported.symbol, alias]
      : [alias, imported.symbol];
    for (const candidate of candidates) {
      const reference = getProjectSourceReferenceForSymbol(ast, checker, candidate, sourceFiles);
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
  const sourceFile = ast.getSourceFile(getPrimaryDeclaration(checker, exportSymbol));
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
