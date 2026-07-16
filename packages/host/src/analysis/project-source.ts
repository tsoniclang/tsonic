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
import {
  getAliasedSymbolIfAlias,
  getPrimaryDeclaration,
  getResolvedSymbolForReferenceNode,
  getSemanticTypeForNode,
  getSymbolAtReferenceNode,
} from "./symbols.js";
import { getStaticModuleReference } from "./module-reference.js";

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
    : [getAliasedSymbolIfAlias(ast, checker, symbol, options), symbol]);
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
  const reference = getStaticModuleReference(ast, statement);
  if (reference === undefined || !reference.hasRuntimeValue) {
    return undefined;
  }
  return resolveRuntimeModuleDependency(
    ast,
    checker,
    reference.declaration,
    reference.moduleSpecifier,
    reference.kind,
    sourceFile,
    sourceFiles,
  );
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

export function getProjectSourceMemberDispatch(
  ast: AstReader,
  checker: TypeCheckerQueries,
  types: TypeShapeQueries,
  node: Node | undefined,
  options: { readonly sourceFile: SourceFile },
  sourceFiles: readonly SourceFile[],
): ReturnType<TargetSourceAnalysisQueries["getProjectSourceMemberDispatch"]> {
  if (node === undefined || !isProjectSourceDispatchMember(ast, node, sourceFiles)) {
    return undefined;
  }
  const classDeclaration = ast.parent(node);
  if (classDeclaration === undefined || !ast.is.IsClassDeclaration(classDeclaration)) {
    return undefined;
  }
  const memberName = ast.text(ast.name(node));
  if (memberName.length === 0) {
    return { overridesBase: false, hasDerivedOverride: false };
  }
  return {
    overridesBase: memberOverridesBaseProjectSourceMember(ast, checker, types, classDeclaration, memberName, options, sourceFiles),
    hasDerivedOverride: projectSourceMemberHasDerivedOverride(ast, checker, types, classDeclaration, memberName, options, sourceFiles),
  };
}

function isProjectSourceDispatchMember(ast: AstReader, node: Node, sourceFiles: readonly SourceFile[]): boolean {
  if (!isProjectSourceDeclaration(ast, node, sourceFiles)) {
    return false;
  }
  if (!isProjectSourceDispatchMemberKind(ast, node)) {
    return false;
  }
  if ((ast.modifierFlags(node) & (modifierFlagsPrivate | modifierFlagsStatic)) !== 0) {
    return false;
  }
  const name = ast.name(node);
  return !ast.is.IsPrivateIdentifier(name);
}

function isProjectSourceDispatchMemberKind(ast: AstReader, node: Node): boolean {
  return ast.is.IsMethodDeclaration(node) ||
    ast.is.IsGetAccessorDeclaration(node) ||
    ast.is.IsSetAccessorDeclaration(node) ||
    ast.is.IsPropertyDeclaration(node);
}

function memberOverridesBaseProjectSourceMember(
  ast: AstReader,
  checker: TypeCheckerQueries,
  types: TypeShapeQueries,
  classDeclaration: Node,
  memberName: string,
  options: { readonly sourceFile: SourceFile },
  sourceFiles: readonly SourceFile[],
): boolean {
  const baseType = getProjectSourceBaseClassType(ast, checker, types, classDeclaration, options, sourceFiles);
  if (baseType === undefined) {
    return false;
  }
  const baseSymbol = checker.getPropertyOfType(baseType, memberName, options);
  const baseDeclaration = getPrimaryDeclaration(checker, baseSymbol);
  return (baseDeclaration !== undefined &&
    isProjectSourceDispatchMember(ast, baseDeclaration, sourceFiles)) ||
    projectSourceBaseClassHasDispatchMember(ast, checker, types, classDeclaration, memberName, options, sourceFiles);
}

function projectSourceBaseClassHasDispatchMember(
  ast: AstReader,
  checker: TypeCheckerQueries,
  types: TypeShapeQueries,
  classDeclaration: Node,
  memberName: string,
  options: { readonly sourceFile: SourceFile },
  sourceFiles: readonly SourceFile[],
): boolean {
  const baseClass = getProjectSourceBaseClassDeclaration(ast, checker, types, classDeclaration, options, sourceFiles);
  if (baseClass === undefined) {
    return false;
  }
  return ast.members(baseClass).some((member) =>
    member !== undefined &&
    ast.text(ast.name(member)) === memberName &&
    isProjectSourceDispatchMember(ast, member, sourceFiles));
}

function projectSourceMemberHasDerivedOverride(
  ast: AstReader,
  checker: TypeCheckerQueries,
  types: TypeShapeQueries,
  classDeclaration: Node,
  memberName: string,
  options: { readonly sourceFile: SourceFile },
  sourceFiles: readonly SourceFile[],
): boolean {
  for (const candidate of getProjectSourceClassDeclarations(ast, sourceFiles)) {
    if (candidate === classDeclaration) {
      continue;
    }
    const candidateMember = ast.members(candidate).find((member) =>
      member !== undefined &&
      ast.text(ast.name(member)) === memberName &&
      isProjectSourceDispatchMember(ast, member, sourceFiles));
    if (candidateMember === undefined) {
      continue;
    }
    const candidateFile = ast.getSourceFile(candidate) ?? options.sourceFile;
    if (projectSourceClassExtends(ast, checker, types, candidate, classDeclaration, { sourceFile: candidateFile }, sourceFiles) &&
      memberOverridesBaseProjectSourceMember(ast, checker, types, candidate, memberName, { sourceFile: candidateFile }, sourceFiles)) {
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
    if (heritageType === undefined || !ast.is.IsExpressionWithTypeArguments(heritageType)) {
      continue;
    }
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
    const alias = getAliasedSymbolIfAlias(ast, checker, imported.symbol, { sourceFile: imported.sourceFile });
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
  if (importDeclaration === undefined || !ast.is.IsImportDeclaration(importDeclaration)) {
    return undefined;
  }
  const moduleSpecifier = ast.as.AsImportDeclaration(importDeclaration)?.ModuleSpecifier;
  const moduleSymbol = checker.getModuleSymbolFromSpecifier(moduleSpecifier, options);
  const resolvedModuleSymbol = checker.getResolvedExternalModuleSymbol(moduleSymbol, false, options);
  const exportSymbol = checker.getExportsOfModule(resolvedModuleSymbol, options)
    .find((candidate) => candidate !== undefined && checker.getSymbolName(candidate) === exportName);
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

export function getDeclarationTypeNode(ast: AstReader, declaration: Node | undefined): Node | undefined {
  if (declaration === undefined) {
    return undefined;
  }
  if (ast.is.IsVariableDeclaration(declaration)) {
    return ast.as.AsVariableDeclaration(declaration)?.Type;
  }
  if (ast.is.IsParameterDeclaration(declaration)) {
    return ast.as.AsParameterDeclaration(declaration)?.Type;
  }
  if (ast.is.IsTypeAliasDeclaration(declaration)) {
    return ast.as.AsTypeAliasDeclaration(declaration)?.Type;
  }
  if (ast.is.IsPropertyDeclaration(declaration)) {
    return ast.as.AsPropertyDeclaration(declaration)?.Type;
  }
  if (ast.is.IsPropertySignatureDeclaration(declaration)) {
    return ast.as.AsPropertySignatureDeclaration(declaration)?.Type;
  }
  if (ast.is.IsMethodDeclaration(declaration)) {
    return ast.as.AsMethodDeclaration(declaration)?.Type;
  }
  if (ast.is.IsMethodSignatureDeclaration(declaration)) {
    return ast.as.AsMethodSignatureDeclaration(declaration)?.Type;
  }
  if (ast.is.IsFunctionDeclaration(declaration)) {
    return ast.as.AsFunctionDeclaration(declaration)?.Type;
  }
  if (ast.is.IsFunctionExpression(declaration)) {
    return ast.as.AsFunctionExpression(declaration)?.Type;
  }
  if (ast.is.IsArrowFunction(declaration)) {
    return ast.as.AsArrowFunction(declaration)?.Type;
  }
  if (ast.is.IsCallSignatureDeclaration(declaration)) {
    return ast.as.AsCallSignatureDeclaration(declaration)?.Type;
  }
  if (ast.is.IsConstructSignatureDeclaration(declaration)) {
    return ast.as.AsConstructSignatureDeclaration(declaration)?.Type;
  }
  if (ast.is.IsGetAccessorDeclaration(declaration)) {
    return ast.as.AsGetAccessorDeclaration(declaration)?.Type;
  }
  if (ast.is.IsSetAccessorDeclaration(declaration)) {
    return ast.as.AsSetAccessorDeclaration(declaration)?.Type;
  }
  if (ast.is.IsIndexSignatureDeclaration(declaration)) {
    return ast.as.AsIndexSignatureDeclaration(declaration)?.Type;
  }
  if (ast.is.IsFunctionTypeNode(declaration)) {
    return ast.as.AsFunctionTypeNode(declaration)?.Type;
  }
  if (ast.is.IsConstructorTypeNode(declaration)) {
    return ast.as.AsConstructorTypeNode(declaration)?.Type;
  }
  return undefined;
}

export function getDeclarationCarrierSubject(ast: AstReader, declaration: Node | undefined): Node | undefined {
  const type = getDeclarationTypeNode(ast, declaration);
  if (type !== undefined || declaration === undefined) {
    return type;
  }
  if (ast.is.IsVariableDeclaration(declaration)) {
    return ast.as.AsVariableDeclaration(declaration)?.Initializer;
  }
  if (ast.is.IsParameterDeclaration(declaration)) {
    return ast.as.AsParameterDeclaration(declaration)?.Initializer;
  }
  if (ast.is.IsPropertyDeclaration(declaration)) {
    return ast.as.AsPropertyDeclaration(declaration)?.Initializer;
  }
  return undefined;
}
