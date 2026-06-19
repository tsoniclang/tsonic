import {
  attachExtensionHost,
  AsClassDeclaration,
  AsConstructorDeclaration,
  AsImportClause,
  AsImportSpecifier,
  Background,
  createExtensionConsumerQueries,
  createTypeCheckerQueries,
  finalizeExtensionSemantics,
  formatDiagnostics,
  getExtensionHost,
  GetSourceFileOfNode,
  IsTypeNode,
  KindClassDeclaration,
  KindConstructor,
  KindElementAccessExpression,
  KindEnumDeclaration,
  KindEnumMember,
  KindExportAssignment,
  KindIdentifier,
  KindImportClause,
  KindInterfaceDeclaration,
  KindImportDeclaration,
  KindImportSpecifier,
  KindPropertyAccessExpression,
  NewProgram,
  Node_ModuleSpecifier,
  Node_Name,
  Node_Text,
  Program_BindSourceFiles,
  Program_GetConfigFileParsingDiagnostics,
  Program_GetProgramDiagnostics,
  Program_GetSemanticDiagnostics,
  Program_GetSourceFiles,
  Program_GetSyntacticDiagnostics,
} from "@tsonic/tsts";
import type {
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
  readonly program: Program;
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
  const extended = attachExtensionHost(options.programOptions, {
    activeTarget: options.target.id,
    extensions,
  });
  const program = NewProgram(options.programOptions);
  if (program === undefined) {
    throw new Error("TSTS NewProgram returned undefined.");
  }
  const sourceFiles = Program_GetSourceFiles(program).filter((sourceFile): sourceFile is SourceFile => sourceFile !== undefined);
  Program_BindSourceFiles(program);
  forceDiagnostics(program, sourceFiles);
  const extensionHost = finalizeExtensionSemantics(program) ?? getExtensionHost(program) ?? extended.extensionHost;
  return {
    program,
    sourceFiles,
    extensionHost,
    checker: createTypeCheckerQueries(program),
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
    sourceFiles: session.sourceFiles,
    facts: session.facts,
    semantics: createTargetSemanticQueries(session.checker, session.facts, session.sourceFiles),
    project,
    target,
    paths,
  };
  return targetPack.createBackend({ project, target }).compile(input);
}

function createTargetSemanticQueries(
  checker: TypeCheckerQueries,
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
      return getRuntimeCarrier(facts, node) ??
        getRuntimeCarrier(facts, getSymbolAtReferenceNode(checker, node, options)) ??
        getRuntimeCarrier(facts, getResolvedSymbolForReferenceNode(checker, node, options)) ??
        getRuntimeCarrierForSemanticType(checker, facts, node, options);
    },
    getObjectShape(subject) {
      return facts.getObjectShapeFact(subject);
    },
    getObjectShapeForNode(subject, options) {
      const node = asNode(subject);
      if (node === undefined) {
        return undefined;
      }
      const direct = facts.getObjectShapeFact(node);
      if (direct !== undefined) {
        return direct;
      }
      const type = getSemanticTypeForNode(checker, node, options);
      return facts.getObjectShapeFact(type) ?? facts.getObjectShapeFact(type?.symbol);
    },
    getTargetBinding(subject) {
      return facts.getTargetBindingFact(subject);
    },
    getTargetBindingForReference(subject, options) {
      const node = asNode(subject);
      if (node === undefined) {
        return undefined;
      }
      return facts.getTargetBindingFact(node) ??
        facts.getTargetBindingFact(getSymbolAtReferenceNode(checker, node, options)) ??
        facts.getTargetBindingFact(getResolvedSymbolForReferenceNode(checker, node, options)) ??
        facts.getTargetBindingFact(getSemanticTypeForNode(checker, node, options)?.symbol);
    },
    getSymbolAtLocation(subject, options) {
      const node = asNode(subject);
      return node === undefined ? undefined : getSymbolAtReferenceNode(checker, node, options);
    },
    getResolvedSymbol(subject, options) {
      const node = asNode(subject);
      return node === undefined ? undefined : getResolvedSymbolForReferenceNode(checker, node, options);
    },
    getEnumMemberConstant(subject, options) {
      const node = asNode(subject);
      return node === undefined ? undefined : checker.getEnumMemberValue(node, options);
    },
    getReturnTypeCarrierFromDeclaration(subject, options) {
      const node = asNode(subject);
      if (node === undefined) {
        return undefined;
      }
      const signature = checker.getSignatureFromDeclaration(node, options);
      const returnType = checker.getReturnTypeOfSignature(signature, options);
      return getRuntimeCarrier(facts, returnType) ?? getRuntimeCarrier(facts, returnType?.symbol);
    },
    isProjectSourceShapeForNode(subject, options) {
      const declaration = getProjectSourceDeclarationForNode(checker, asNode(subject), options, sourceFiles);
      return declaration?.Kind === KindClassDeclaration ||
        declaration?.Kind === KindInterfaceDeclaration ||
        declaration?.Kind === KindEnumDeclaration ||
        declaration?.Kind === KindEnumMember;
    },
    isProjectSourceConstructibleObjectForNode(subject, options) {
      const declaration = getProjectSourceDeclarationForNode(checker, asNode(subject), options, sourceFiles);
      return declaration?.Kind === KindClassDeclaration && hasParameterlessConstruction(declaration);
    },
    getProjectSourceDeclarationForNode(subject, options) {
      return getProjectSourceDeclarationForNode(checker, asNode(subject), options, sourceFiles);
    },
    getProjectSourceReferenceForNode(subject, options) {
      return getProjectSourceReferenceForNode(checker, asNode(subject), options, sourceFiles);
    },
    describeTypeAtLocation(subject, options) {
      const node = asNode(subject);
      const type = node === undefined ? undefined : getSemanticTypeForNode(checker, node, options);
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
  checker: TypeCheckerQueries,
  node: Node,
  options: { readonly sourceFile: SourceFile },
): Symbol | undefined {
  return isSymbolQueryableNode(node) ? checker.getSymbolAtLocation(node, options) : undefined;
}

function getResolvedSymbolForReferenceNode(
  checker: TypeCheckerQueries,
  node: Node,
  options: { readonly sourceFile: SourceFile },
): Symbol | undefined {
  return isSymbolQueryableNode(node) ? checker.getResolvedSymbol(node, options) : undefined;
}

function isSymbolQueryableNode(node: Node): boolean {
  return node.Kind === KindIdentifier ||
    node.Kind === KindPropertyAccessExpression ||
    node.Kind === KindElementAccessExpression;
}

function getRuntimeCarrier(
  facts: ExtensionConsumerQueries,
  subject: ExtensionFactSubject | undefined,
): TargetTypeRef | undefined {
  return facts.getRuntimeCarrierFact(subject)?.carrier;
}

function getRuntimeCarrierForSemanticType(
  checker: TypeCheckerQueries,
  facts: ExtensionConsumerQueries,
  node: Node,
  options: { readonly sourceFile: SourceFile },
): TargetTypeRef | undefined {
  const type = getSemanticTypeForNode(checker, node, options);
  return getRuntimeCarrier(facts, type) ?? getRuntimeCarrier(facts, type?.symbol);
}

function getSemanticTypeForNode(
  checker: TypeCheckerQueries,
  node: Node,
  options: { readonly sourceFile: SourceFile },
): Type | undefined {
  return IsTypeNode(node)
    ? checker.getTypeFromTypeNode(node, options)
    : checker.getTypeAtLocation(node, options);
}

function getProjectSourceDeclarationForNode(
  checker: TypeCheckerQueries,
  node: Node | undefined,
  options: { readonly sourceFile: SourceFile },
  sourceFiles: readonly SourceFile[],
): Node | undefined {
  if (node === undefined) {
    return undefined;
  }
  const type = getSemanticTypeForNode(checker, node, options);
  const declaration = getPrimaryDeclaration(type?.symbol);
  return isProjectSourceDeclaration(declaration, sourceFiles) ? declaration : undefined;
}

function getProjectSourceReferenceForNode(
  checker: TypeCheckerQueries,
  node: Node | undefined,
  options: { readonly sourceFile: SourceFile },
  sourceFiles: readonly SourceFile[],
): ReturnType<TargetSemanticQueries["getProjectSourceReferenceForNode"]> {
  if (node === undefined) {
    return undefined;
  }
  const directSymbol = getSymbolAtReferenceNode(checker, node, options);
  const importedReference = getImportedProjectSourceReferenceForSymbol(checker, directSymbol, options, sourceFiles);
  if (importedReference !== undefined) {
    return importedReference;
  }
  const symbols = [
    getResolvedSymbolForReferenceNode(checker, node, options),
    directSymbol,
  ].flatMap((symbol) => symbol === undefined
    ? []
    : [checker.getAliasedSymbol(symbol, options), symbol]);
  for (const symbol of symbols) {
    const reference = getProjectSourceReferenceForSymbol(symbol, sourceFiles);
    if (reference !== undefined) {
      return reference;
    }
  }
  return undefined;
}

function getImportedProjectSourceReferenceForSymbol(
  checker: TypeCheckerQueries,
  symbol: Symbol | undefined,
  options: { readonly sourceFile: SourceFile },
  sourceFiles: readonly SourceFile[],
): ReturnType<TargetSemanticQueries["getProjectSourceReferenceForNode"]> {
  if (symbol === undefined) {
    return undefined;
  }
  for (const declaration of symbol.Declarations ?? []) {
    const imported = getImportedModuleExport(checker, declaration, options);
    if (imported === undefined) {
      continue;
    }
    const alias = checker.getAliasedSymbol(imported.symbol, { sourceFile: imported.sourceFile });
    const candidates = getPrimaryDeclaration(imported.symbol)?.Kind === KindExportAssignment
      ? [imported.symbol, alias]
      : [alias, imported.symbol];
    for (const candidate of candidates) {
      const reference = getProjectSourceReferenceForSymbol(candidate, sourceFiles);
      if (reference !== undefined) {
        return reference;
      }
    }
  }
  return undefined;
}

function getImportedModuleExport(
  checker: TypeCheckerQueries,
  declaration: Node | undefined,
  options: { readonly sourceFile: SourceFile },
): { readonly symbol: Symbol; readonly sourceFile: SourceFile } | undefined {
  const importBinding = normalizeImportBindingDeclaration(declaration);
  if (importBinding === undefined) {
    return undefined;
  }
  const exportName = getImportedExportName(importBinding);
  if (exportName === undefined) {
    return undefined;
  }
  const importDeclaration = findImportDeclaration(importBinding);
  const moduleSpecifier = importDeclaration === undefined ? undefined : Node_ModuleSpecifier(importDeclaration);
  const sourceFile = checker.getResolvedModuleSourceFile(options.sourceFile, moduleSpecifier);
  if (sourceFile === undefined) {
    return undefined;
  }
  const symbol = checker.getModuleExportSymbol(sourceFile, exportName, { sourceFile });
  return symbol === undefined ? undefined : { symbol, sourceFile };
}

function normalizeImportBindingDeclaration(declaration: Node | undefined): Node | undefined {
  if (declaration === undefined) {
    return undefined;
  }
  if (declaration.Kind === KindImportClause || declaration.Kind === KindImportSpecifier) {
    return declaration;
  }
  const parent = declaration.Parent;
  return parent?.Kind === KindImportClause || parent?.Kind === KindImportSpecifier
    ? parent
    : undefined;
}

function getImportedExportName(importBinding: Node): string | undefined {
  if (importBinding.Kind === KindImportClause) {
    return AsImportClause(importBinding)?.name === undefined ? undefined : "default";
  }
  if (importBinding.Kind === KindImportSpecifier) {
    const specifier = AsImportSpecifier(importBinding);
    const exportNameNode = specifier?.PropertyName ?? Node_Name(importBinding);
    return exportNameNode === undefined ? undefined : Node_Text(exportNameNode);
  }
  return undefined;
}

function findImportDeclaration(node: Node): Node | undefined {
  let current = node.Parent;
  while (current !== undefined) {
    if (current.Kind === KindImportDeclaration) {
      return current;
    }
    current = current.Parent;
  }
  return undefined;
}

function getProjectSourceReferenceForSymbol(
  symbol: Symbol | undefined,
  sourceFiles: readonly SourceFile[],
): ReturnType<TargetSemanticQueries["getProjectSourceReferenceForNode"]> {
  if (symbol === undefined) {
    return undefined;
  }
  const declaration = getPrimaryDeclaration(symbol);
  if (declaration === undefined || !isProjectSourceDeclaration(declaration, sourceFiles)) {
    return undefined;
  }
  const declarationFile = GetSourceFileOfNode(declaration);
  return declarationFile === undefined
    ? undefined
    : { symbol, declaration, sourceFile: declarationFile };
}

function getPrimaryDeclaration(symbol: Symbol | undefined): Node | undefined {
  return symbol?.ValueDeclaration ?? symbol?.Declarations?.find((candidate): candidate is Node => candidate !== undefined);
}

function isProjectSourceDeclaration(declaration: Node | undefined, sourceFiles: readonly SourceFile[]): boolean {
  if (declaration === undefined) {
    return false;
  }
  const declarationFile = GetSourceFileOfNode(declaration);
  return declarationFile !== undefined &&
    !declarationFile.IsDeclarationFile &&
    sourceFiles.some((sourceFile) => sourceFile === declarationFile);
}

function hasParameterlessConstruction(classDeclaration: Node): boolean {
  const constructors = (AsClassDeclaration(classDeclaration)?.Members?.Nodes ?? [])
    .filter((member): member is Node => member?.Kind === KindConstructor);
  if (constructors.length === 0) {
    return true;
  }
  return constructors.some((constructor) => {
    const parameters = AsConstructorDeclaration(constructor)?.Parameters?.Nodes ?? [];
    return parameters.every((parameter) => parameter === undefined);
  });
}

function asNode(subject: ExtensionFactSubject | undefined): Node | undefined {
  return typeof subject === "object" &&
    subject !== null &&
    typeof (subject as { readonly Kind?: unknown }).Kind === "number"
    ? subject as Node
    : undefined;
}

export function collectTstsDiagnostics(program: Program, sourceFiles: readonly SourceFile[], currentDirectory: string): readonly TargetDiagnostic[] {
  const diagnostics = [
    ...(Program_GetConfigFileParsingDiagnostics(program) ?? []),
    ...(Program_GetProgramDiagnostics(program) ?? []),
  ].filter((diagnostic): diagnostic is NonNullable<typeof diagnostic> => diagnostic !== undefined);
  const context = Background();
  for (const sourceFile of sourceFiles) {
    diagnostics.push(...(Program_GetSyntacticDiagnostics(program, context, sourceFile) ?? [])
      .filter((diagnostic): diagnostic is NonNullable<typeof diagnostic> => diagnostic !== undefined));
    diagnostics.push(...(Program_GetSemanticDiagnostics(program, context, sourceFile) ?? [])
      .filter((diagnostic): diagnostic is NonNullable<typeof diagnostic> => diagnostic !== undefined));
  }
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

function forceDiagnostics(program: Program, sourceFiles: readonly SourceFile[]): void {
  Program_GetProgramDiagnostics(program);
  const context = Background();
  for (const sourceFile of sourceFiles) {
    Program_GetSyntacticDiagnostics(program, context, sourceFile);
    Program_GetSemanticDiagnostics(program, context, sourceFile);
  }
}
