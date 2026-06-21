import {
  createCompilerSession,
  createExtensionConsumerQueries,
  formatDiagnostics,
} from "@tsonic/tsts";
import type {
  AstReader,
  CompilerSession,
  ExtensionConsumerQueries,
  ExtensionFactSubject,
  ExtensionHost,
  Node,
  Program,
  ProgramOptions,
  SourceFile,
  Symbol,
  TargetTypeRef,
  Type,
  TypeCheckerQueries,
  TypeShapeQueries,
} from "@tsonic/tsts";
import type {
  TargetCompileInput,
  TargetCompileResult,
  TargetCompilationPaths,
  TargetDiagnostic,
  TargetPack,
  TargetSemanticQueries,
  TargetSelection,
  TsonicProjectConfig,
} from "@tsonic/target-api";

export interface TsonicSemanticSession {
  readonly compiler: CompilerSession;
  readonly program: Program;
  readonly ast: AstReader;
  readonly types: TypeShapeQueries;
  readonly sourceFiles: readonly SourceFile[];
  readonly extensionHost: ExtensionHost;
  readonly checker: TypeCheckerQueries;
  readonly facts: ExtensionConsumerQueries;
}

export interface CreateTsonicSemanticSessionOptions {
  readonly programOptions: ProgramOptions;
  readonly project: TsonicProjectConfig;
  readonly target: TargetSelection;
  readonly targetPack: TargetPack;
}

export function createTsonicSemanticSession(options: CreateTsonicSemanticSessionOptions): TsonicSemanticSession {
  const extensions = options.targetPack.createExtensions({
    project: options.project,
    target: options.target,
  });
  const compiler = createCompilerSession({
    programOptions: options.programOptions,
    extensionHostOptions: {
      activeTarget: options.target.id,
      extensions,
    },
  });
  if (compiler.program === undefined) {
    throw new Error("TSTS createCompilerSession returned no program.");
  }
  compiler.ensureBound();
  forceDiagnostics(compiler);
  const extensionHost = compiler.finalizeExtensions() ?? compiler.extensionHost;
  if (extensionHost === undefined) {
    throw new Error("TSTS extension finalization returned no extension host.");
  }
  const sourceFiles = compiler.getSourceFiles().filter((sourceFile): sourceFile is SourceFile => sourceFile !== undefined);
  return {
    compiler,
    program: compiler.program,
    ast: compiler.ast,
    types: compiler.types,
    sourceFiles,
    extensionHost,
    checker: compiler.checker,
    facts: createExtensionConsumerQueries(extensionHost, "tsonic-host"),
  };
}

export function compileTargetFromSemanticSession(
  session: TsonicSemanticSession,
  project: TsonicProjectConfig,
  target: TargetSelection,
  targetPack: TargetPack,
  paths: TargetCompilationPaths,
): TargetCompileResult {
  const input: TargetCompileInput = {
    program: session.program,
    ast: session.ast,
    types: session.types,
    sourceFiles: session.sourceFiles,
    facts: session.facts,
    semantics: createTargetSemanticQueries(session.ast, session.checker, session.types, session.facts, session.sourceFiles),
    project,
    target,
    paths,
  };
  return targetPack.createBackend({ project, target }).compile(input);
}

function createTargetSemanticQueries(
  ast: AstReader,
  checker: TypeCheckerQueries,
  types: TypeShapeQueries,
  facts: ExtensionConsumerQueries,
  sourceFiles: readonly SourceFile[],
): TargetSemanticQueries {
  return {
    getRuntimeCarrier(subject) {
      return getRuntimeCarrier(facts, subject);
    },
    getRuntimeCarrierForNode(subject, options) {
      const node = asNode(subject);
      if (node === undefined) {
        return undefined;
      }
      if (isTypeSyntaxNode(ast, node)) {
        return getRuntimeCarrier(facts, node) ??
          getRuntimeCarrierForSemanticType(ast, checker, types, facts, node, options) ??
          getRuntimeCarrierFromDeclaredFactGraph(ast, checker, types, facts, node, options, sourceFiles);
      }
      return getRuntimeCarrier(facts, node) ??
        getRuntimeCarrier(facts, getSymbolAtReferenceNode(ast, checker, node, options)) ??
        getRuntimeCarrier(facts, getAliasedSymbolIfAlias(checker, getSymbolAtReferenceNode(ast, checker, node, options), options)) ??
        getRuntimeCarrier(facts, getResolvedSymbolForReferenceNode(ast, checker, node, options)) ??
        getRuntimeCarrier(facts, getAliasedSymbolIfAlias(checker, getResolvedSymbolForReferenceNode(ast, checker, node, options), options)) ??
        getRuntimeCarrierForSemanticType(ast, checker, types, facts, node, options) ??
        getRuntimeCarrierFromDeclaredFactGraph(ast, checker, types, facts, node, options, sourceFiles);
    },
    getTargetBinding(subject) {
      return facts.getTargetBindingFact(subject);
    },
    getTargetBindingForReference(subject, options) {
      const node = asNode(subject);
      if (node === undefined) {
        return undefined;
      }
      const semanticType = getSemanticTypeForNode(ast, checker, node, options);
      const typeBinding = facts.getTargetBindingFact(semanticType) ??
        facts.getTargetBindingFact(semanticType?.symbol);
      if (isTypeReferenceQuery(ast, node)) {
        return facts.getTargetBindingFact(node) ?? typeBinding;
      }
      return facts.getTargetBindingFact(node) ??
        facts.getTargetBindingFact(getSymbolAtReferenceNode(ast, checker, node, options)) ??
        facts.getTargetBindingFact(getAliasedSymbolIfAlias(checker, getSymbolAtReferenceNode(ast, checker, node, options), options)) ??
        facts.getTargetBindingFact(getResolvedSymbolForReferenceNode(ast, checker, node, options)) ??
        facts.getTargetBindingFact(getAliasedSymbolIfAlias(checker, getResolvedSymbolForReferenceNode(ast, checker, node, options), options)) ??
        typeBinding;
    },
    getSymbolAtLocation(subject, options) {
      const node = asNode(subject);
      return node === undefined ? undefined : getSymbolAtReferenceNode(ast, checker, node, options);
    },
    getResolvedSymbol(subject, options) {
      const node = asNode(subject);
      return node === undefined ? undefined : getResolvedSymbolForReferenceNode(ast, checker, node, options);
    },
    getTypeOfSymbol(subject, options) {
      const symbol = asSymbol(subject);
      return symbol === undefined ? undefined : checker.getTypeOfSymbol(symbol, options);
    },
    getTypeAtLocation(subject, options) {
      const node = asNode(subject);
      return node === undefined ? undefined : getSemanticTypeForNode(ast, checker, node, options);
    },
    getTypeFromTypeNode(subject, options) {
      const node = asNode(subject);
      return node === undefined ? undefined : checker.getTypeFromTypeNode(node, options);
    },
    getEnumMemberConstant(subject, options) {
      const node = asNode(subject);
      let value: unknown;
      try {
        value = node === undefined ? undefined : checker.getConstantValue(node, options);
      } catch {
        value = undefined;
      }
      return typeof value === "number" || typeof value === "string" || value === undefined ? { value } : undefined;
    },
    getReturnTypeCarrierFromDeclaration(subject, options) {
      const node = asNode(subject);
      if (node === undefined) {
        return undefined;
      }
      const declarationType = checker.getTypeAtLocation(node, options);
      const signature = types.getCallSignatures(declarationType, options)[0];
      const returnType = types.getReturnTypeOfSignature(signature, options);
      return getRuntimeCarrier(facts, returnType) ?? getRuntimeCarrier(facts, returnType?.symbol);
    },
    isProjectSourceShapeForNode(subject, options) {
      const declaration = getProjectSourceDeclarationForNode(ast, checker, types, asNode(subject), options, sourceFiles);
      return declaration !== undefined && (
        ast.is.IsClassDeclaration(declaration) ||
        ast.is.IsInterfaceDeclaration(declaration) ||
        ast.is.IsEnumDeclaration(declaration) ||
        ast.is.IsEnumMember(declaration)
      );
    },
    isProjectSourceConstructibleObjectForNode(subject, options) {
      const declaration = getProjectSourceReferenceForNode(ast, checker, types, asNode(subject), options, sourceFiles)?.declaration ??
        getProjectSourceDeclarationForNode(ast, checker, types, asNode(subject), options, sourceFiles);
      return declaration !== undefined &&
        ast.is.IsClassDeclaration(declaration) &&
        hasParameterlessConstruction(ast, declaration);
    },
    getProjectSourceDeclarationForNode(subject, options) {
      return getProjectSourceDeclarationForNode(ast, checker, types, asNode(subject), options, sourceFiles);
    },
    getProjectSourceReferenceForNode(subject, options) {
      return getProjectSourceReferenceForNode(ast, checker, types, asNode(subject), options, sourceFiles);
    },
    describeTypeAtLocation(subject, options) {
      const node = asNode(subject);
      const type = node === undefined ? undefined : getSemanticTypeForNode(ast, checker, node, options);
      if (type === undefined) {
        return undefined;
      }
      try {
        return checker.typeToString(type, options);
      } catch {
        return undefined;
      }
    },
  };
}

function getSymbolAtReferenceNode(
  ast: AstReader,
  checker: TypeCheckerQueries,
  node: Node,
  options: { readonly sourceFile: SourceFile },
): Symbol | undefined {
  const reference = getReferenceQueryNode(ast, node);
  return reference === undefined ? undefined : checker.getSymbolAtLocation(reference, options);
}

function getResolvedSymbolForReferenceNode(
  ast: AstReader,
  checker: TypeCheckerQueries,
  node: Node,
  options: { readonly sourceFile: SourceFile },
): Symbol | undefined {
  const reference = getReferenceQueryNode(ast, node);
  return reference === undefined ? undefined : checker.getResolvedSymbol(reference, options);
}

function getRuntimeCarrier(
  facts: ExtensionConsumerQueries,
  subject: ExtensionFactSubject | undefined,
): TargetTypeRef | undefined {
  const runtimeCarrier = facts.getRuntimeCarrierFact(subject)?.carrier;
  if (runtimeCarrier !== undefined) {
    return runtimeCarrier;
  }
  const primitive = facts.getSourcePrimitiveFact(subject);
  return primitive === undefined ? undefined : { kind: "source-primitive", name: primitive.kind };
}

function getRuntimeCarrierFromDeclaredFactGraph(
  ast: AstReader,
  checker: TypeCheckerQueries,
  types: TypeShapeQueries,
  facts: ExtensionConsumerQueries,
  node: Node,
  options: { readonly sourceFile: SourceFile },
  sourceFiles: readonly SourceFile[],
  seen: ReadonlySet<Node> = new Set(),
): TargetTypeRef | undefined {
  if (seen.has(node)) {
    return undefined;
  }
  const nextSeen = new Set(seen).add(node);
  const direct = getRuntimeCarrier(facts, node) ??
    (isTypeReferenceQuery(ast, node)
      ? getRuntimeCarrier(facts, getSymbolAtReferenceNode(ast, checker, node, options))
      : getRuntimeCarrier(facts, getSymbolAtReferenceNode(ast, checker, node, options)) ??
        getRuntimeCarrier(facts, getResolvedSymbolForReferenceNode(ast, checker, node, options)));
  if (direct !== undefined && !(direct.kind === "target-named" && ast.is.IsTypeReferenceNode(node) && ast.typeArguments(node).length > 0)) {
    return direct;
  }
  if (ast.is.IsTypeReferenceNode(node)) {
    const aliasCarrier = getRuntimeCarrierFromTypeAliasFactGraph(
      ast,
      checker,
      types,
      facts,
      getSymbolAtReferenceNode(ast, checker, node, options),
      node,
      options,
      sourceFiles,
      nextSeen,
    );
    if (aliasCarrier !== undefined) {
      return aliasCarrier;
    }
    const type = getSemanticTypeForNode(ast, checker, node, options);
    const binding = facts.getTargetBindingFact(type) ?? facts.getTargetBindingFact(type?.symbol);
    if (binding !== undefined) {
      const typeArguments = ast.typeArguments(node)
        .map((argument) => argument === undefined
          ? undefined
          : getTargetTypeRefFromDeclaredTypeNode(ast, checker, types, facts, argument, options, sourceFiles, nextSeen));
      if (typeArguments.some((argument) => argument === undefined)) {
        return { kind: "target-named", id: binding.id };
      }
      return {
        kind: "target-named",
        id: binding.id,
        ...(typeArguments.length > 0 ? { typeArguments: typeArguments as readonly TargetTypeRef[] } : {}),
      };
    }
    return direct;
  }
  const reference = getProjectSourceReferenceForNode(ast, checker, types, node, options, sourceFiles);
  const declaration = reference?.declaration as (Node & { readonly Type?: Node; readonly Initializer?: Node }) | undefined;
  const declarationSubject = declaration?.Type ?? declaration?.Initializer;
  return declarationSubject === undefined
    ? direct
    : getRuntimeCarrierFromDeclaredFactGraph(ast, checker, types, facts, declarationSubject, options, sourceFiles, nextSeen) ?? direct;
}

function getRuntimeCarrierFromTypeAliasFactGraph(
  ast: AstReader,
  checker: TypeCheckerQueries,
  types: TypeShapeQueries,
  facts: ExtensionConsumerQueries,
  symbol: Symbol | undefined,
  currentNode: Node,
  options: { readonly sourceFile: SourceFile },
  sourceFiles: readonly SourceFile[],
  seen: ReadonlySet<Node>,
): TargetTypeRef | undefined {
  for (const declaration of symbol?.Declarations ?? []) {
    const typeNode = getDeclarationTypeNode(declaration);
    if (typeNode === undefined || typeNode === currentNode) {
      continue;
    }
    const declarationSourceFile = ast.getSourceFile(typeNode) ?? options.sourceFile;
    const declarationOptions = { sourceFile: declarationSourceFile };
    const declaredCarrier = getRuntimeCarrierFromDeclaredFactGraph(
      ast,
      checker,
      types,
      facts,
      typeNode,
      declarationOptions,
      sourceFiles,
      seen,
    );
    if (declaredCarrier !== undefined) {
      return declaredCarrier;
    }
    const semanticCarrier = getRuntimeCarrierForSemanticType(ast, checker, types, facts, typeNode, declarationOptions);
    if (semanticCarrier !== undefined) {
      return semanticCarrier;
    }
  }
  return undefined;
}

function getDeclarationTypeNode(declaration: Node | undefined): Node | undefined {
  return asNode((declaration as { readonly Type?: unknown; readonly type?: unknown } | undefined)?.Type) ??
    asNode((declaration as { readonly Type?: unknown; readonly type?: unknown } | undefined)?.type);
}

function getTargetTypeRefFromDeclaredTypeNode(
  ast: AstReader,
  checker: TypeCheckerQueries,
  types: TypeShapeQueries,
  facts: ExtensionConsumerQueries,
  node: Node,
  options: { readonly sourceFile: SourceFile },
  sourceFiles: readonly SourceFile[],
  seen: ReadonlySet<Node>,
): TargetTypeRef | undefined {
  return getRuntimeCarrierFromDeclaredFactGraph(ast, checker, types, facts, node, options, sourceFiles, seen) ??
    getRuntimeCarrierForSemanticType(ast, checker, types, facts, node, options);
}

function getRuntimeCarrierForSemanticType(
  ast: AstReader,
  checker: TypeCheckerQueries,
  types: TypeShapeQueries,
  facts: ExtensionConsumerQueries,
  node: Node,
  options: { readonly sourceFile: SourceFile },
): TargetTypeRef | undefined {
  const type = getSemanticTypeForNode(ast, checker, node, options);
  return getRuntimeCarrier(facts, type) ??
    getRuntimeCarrier(facts, type?.symbol) ??
    getTargetTypeRefForSemanticType(types, facts, type, options);
}

function getTargetTypeRefForSemanticType(
  types: TypeShapeQueries,
  facts: ExtensionConsumerQueries,
  type: Type | undefined,
  options: { readonly sourceFile: SourceFile },
  seen: ReadonlySet<Type> = new Set(),
): TargetTypeRef | undefined {
  if (type === undefined || seen.has(type)) {
    return undefined;
  }
  const directCarrier = getRuntimeCarrier(facts, type) ?? getRuntimeCarrier(facts, type.symbol);
  if (directCarrier !== undefined) {
    return directCarrier;
  }
  if (!types.isTypeReference(type)) {
    return undefined;
  }
  const target = types.getTypeReferenceTarget(type);
  const binding = facts.getTargetBindingFact(target?.symbol);
  if (binding === undefined) {
    return undefined;
  }
  const nextSeen = new Set(seen).add(type);
  const typeArguments = types.getTypeArguments(type, options)
    .map((argument) => getTargetTypeRefForSemanticType(types, facts, argument, options, nextSeen));
  if (typeArguments.some((argument) => argument === undefined)) {
    return { kind: "target-named", id: binding.id };
  }
  return {
    kind: "target-named",
    id: binding.id,
    ...(typeArguments.length > 0 ? { typeArguments: typeArguments as readonly TargetTypeRef[] } : {}),
  };
}

function getSemanticTypeForNode(
  ast: AstReader,
  checker: TypeCheckerQueries,
  node: Node,
  options: { readonly sourceFile: SourceFile },
): Type | undefined {
  return isTypeSyntaxNode(ast, node)
    ? checker.getTypeFromTypeNode(node, options)
    : checker.getTypeAtLocation(node, options);
}

function getReferenceQueryNode(ast: AstReader, node: Node | undefined): Node | undefined {
  if (node === undefined) {
    return undefined;
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

function isTypeReferenceQuery(ast: AstReader, node: Node): boolean {
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

function isTypeSyntaxNode(ast: AstReader, node: Node): boolean {
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

function getProjectSourceDeclarationForNode(
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

function getProjectSourceReferenceForNode(
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
  const symbol = asSymbol((declaration as { readonly Symbol?: ExtensionFactSubject; readonly symbol?: ExtensionFactSubject } | undefined)?.Symbol) ??
    asSymbol((declaration as { readonly Symbol?: ExtensionFactSubject; readonly symbol?: ExtensionFactSubject } | undefined)?.symbol);
  const sourceFile = ast.getSourceFile(declaration);
  if (declaration !== undefined && symbol !== undefined && sourceFile !== undefined) {
    return { symbol, declaration, sourceFile };
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

function getProjectSourceReferenceForSymbol(
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

const symbolFlagsAlias = 1 << 21;

function getAliasedSymbolIfAlias(
  checker: TypeCheckerQueries,
  symbol: Symbol | undefined,
  options: { readonly sourceFile: SourceFile },
): Symbol | undefined {
  return symbol !== undefined && (symbol.Flags & symbolFlagsAlias) !== 0
    ? checker.getAliasedSymbol(symbol, options)
    : undefined;
}

function getPrimaryDeclaration(symbol: Symbol | undefined): Node | undefined {
  return symbol?.ValueDeclaration ?? symbol?.Declarations?.find((candidate): candidate is Node => candidate !== undefined);
}

function getProjectSourceDeclarationForType(
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

function isProjectSourceDeclaration(ast: AstReader, declaration: Node | undefined, sourceFiles: readonly SourceFile[]): boolean {
  if (declaration === undefined) {
    return false;
  }
  const declarationFile = ast.getSourceFile(declaration);
  return declarationFile !== undefined &&
    !declarationFile.IsDeclarationFile &&
    sourceFiles.some((sourceFile) => sourceFile === declarationFile);
}

function hasParameterlessConstruction(ast: AstReader, classDeclaration: Node): boolean {
  const constructors = ast.members(classDeclaration).filter((member): member is Node => ast.is.IsConstructorDeclaration(member));
  if (constructors.length === 0) {
    return true;
  }
  return constructors.some((constructor) => ast.parameters(constructor).every((parameter) => parameter === undefined));
}

function asNode(subject: unknown): Node | undefined {
  return typeof subject === "object" &&
    subject !== null &&
    typeof (subject as { readonly Kind?: unknown }).Kind === "number"
    ? subject as Node
    : undefined;
}

function asSymbol(subject: ExtensionFactSubject | undefined): Symbol | undefined {
  return typeof subject === "object" &&
    subject !== null &&
    typeof (subject as { readonly Name?: unknown }).Name === "string" &&
    typeof (subject as { readonly Flags?: unknown }).Flags === "number"
    ? subject as Symbol
    : undefined;
}

export function collectTstsDiagnostics(session: TsonicSemanticSession, currentDirectory: string): readonly TargetDiagnostic[] {
  const diagnostics = session.compiler.getDiagnostics("all")
    .filter((diagnostic): diagnostic is NonNullable<typeof diagnostic> => diagnostic !== undefined);
  const message = formatDiagnostics(diagnostics, currentDirectory);
  if (message.length === 0) {
    return [];
  }
  return [{
    code: "TSTS_DIAGNOSTIC",
    category: "error",
    message,
    source: "tsts",
  }];
}

function forceDiagnostics(session: CompilerSession): void {
  session.getDiagnostics("program");
  for (const sourceFile of session.getSourceFiles()) {
    session.getDiagnostics("syntactic", sourceFile);
    session.getDiagnostics("semantic", sourceFile);
  }
}
