import type {
  AstReader,
  Node,
  SourceFile,
  Symbol,
} from "@tsonic/tsts";
import type {
  TargetSourceProgram,
} from "../source-semantics/types.js";
import {
  sourceBindingWriteAtReference,
} from "../source-navigation/index.js";
import type {
  SourceBindingWrite,
  SourceCallableImplementationResult,
  SourceCountedLoop,
  SourceDeclarationReference,
  SourceDeclarationUseSummary,
  SourceDeclaredHeritageResult,
  SourceExpressionEffects,
  SourceProjectMemberContractsResult,
  SourceProjectMemberDispatch,
  SourceProjectModuleDependency,
  SourceProjectModuleExport,
  SourceProjectReference,
} from "../source-navigation/index.js";

export interface TargetPlanningSourceNavigation {
  readonly sourceFiles: readonly SourceFile[];
  sourceReferenceFor(node: Node | undefined): SourceDeclarationReference | undefined;
  referenceFor(node: Node | undefined): SourceProjectReference | undefined;
  declarationFor(node: Node | undefined): Node | undefined;
  moduleDependencies(sourceFile: SourceFile): readonly SourceProjectModuleDependency[];
  moduleReferences(sourceFile: SourceFile): readonly SourceProjectModuleDependency[];
  moduleExports(sourceFile: SourceFile): readonly SourceProjectModuleExport[];
  moduleHasTopLevelAwait(sourceFile: SourceFile): boolean;
  memberDispatch(node: Node | undefined): SourceProjectMemberDispatch | undefined;
  memberContracts(node: Node): SourceProjectMemberContractsResult;
  callableImplementation(node: Node): SourceCallableImplementationResult;
  declaredHeritage(node: Node): SourceDeclaredHeritageResult;
  bindingWritesWithin(symbol: Symbol, root: Node): readonly SourceBindingWrite[];
  declarationUseSummary(node: Node): SourceDeclarationUseSummary;
  countedLoop(node: Node): SourceCountedLoop | undefined;
  expressionEffects(node: Node): SourceExpressionEffects;
  isProjectConstructibleObject(node: Node | undefined): boolean;
  isProjectDeclaration(node: Node | undefined): boolean;
}

export function snapshotTargetPlanningSourceNavigation(
  source: TargetSourceProgram,
): TargetPlanningSourceNavigation {
  const projectReferences = new WeakMap<Node, SourceProjectReference>();
  const declarations = new WeakMap<Node, Node>();
  const memberDispatch = new WeakMap<Node, SourceProjectMemberDispatch>();
  const memberContracts = new WeakMap<Node, SourceProjectMemberContractsResult>();
  const callableImplementations = new WeakMap<Node, SourceCallableImplementationResult>();
  const declaredHeritage = new WeakMap<Node, SourceDeclaredHeritageResult>();
  const declarationUses = new WeakMap<Node, SourceDeclarationUseSummary>();
  const countedLoops = new WeakMap<Node, SourceCountedLoop>();
  const effects = new WeakMap<Node, SourceExpressionEffects>();
  const projectConstructibleObjects = new WeakSet<Node>();
  const projectNodes = new WeakSet<Node>();
  const writesBySymbol = new Map<Symbol, SourceBindingWrite[]>();
  const rememberDeclaration = (declaration: Node | undefined): void => {
    if (
      declaration === undefined ||
      declarationUses.has(declaration) ||
      !source.navigation.isProjectDeclaration(declaration)
    ) {
      return;
    }
    declarationUses.set(
      declaration,
      source.navigation.declarationUseSummary(declaration),
    );
  };
  const visit = (node: Node): void => {
    if (isReferenceQueryCandidate(source.ast, node)) {
      const sourceReference = source.navigation.sourceReferenceFor(node);
      if (sourceReference !== undefined) {
        rememberDeclaration(sourceReference.declaration);
        const write = sourceBindingWriteAtReference(source.ast, node);
        if (write !== undefined && sourceReference.symbol !== undefined) {
          const writes = writesBySymbol.get(sourceReference.symbol) ?? [];
          writes.push(write);
          writesBySymbol.set(sourceReference.symbol, writes);
        }
      }
      const projectReference = source.navigation.referenceFor(node);
      if (projectReference !== undefined) {
        projectReferences.set(node, projectReference);
        rememberDeclaration(projectReference.declaration);
      }
      const declaration = source.navigation.declarationFor(node);
      if (declaration !== undefined) {
        declarations.set(node, declaration);
        rememberDeclaration(declaration);
      }
      if (source.navigation.isProjectConstructibleObject(node)) {
        projectConstructibleObjects.add(node);
      }
    }
    if (isCallableDeclaration(source.ast, node)) {
      callableImplementations.set(node, source.navigation.callableImplementation(node));
      rememberDeclaration(node);
    }
    if (isMemberDeclaration(source.ast, node)) {
      const dispatch = source.navigation.memberDispatch(node);
      if (dispatch !== undefined) memberDispatch.set(node, dispatch);
      memberContracts.set(node, source.navigation.memberContracts(node));
      rememberDeclaration(node);
    }
    const kind = source.ast.kindName(node);
    if (kind === "KindClassDeclaration" || kind === "KindInterfaceDeclaration") {
      declaredHeritage.set(node, source.navigation.declaredHeritage(node));
      rememberDeclaration(node);
    }
    if (source.navigation.isProjectDeclaration(node)) {
      projectNodes.add(node);
    }
    if (kind === "KindForStatement") {
      const counted = source.navigation.countedLoop(node);
      if (counted !== undefined) countedLoops.set(node, counted);
    }
    effects.set(node, source.navigation.expressionEffects(node));
    source.ast.forEachChild(node, (child) => {
      if (child !== undefined) visit(child);
    });
  };
  for (const sourceFile of source.navigation.sourceFiles) visit(sourceFile);
  const moduleDependencies = new Map(source.navigation.sourceFiles.map((sourceFile) => [
    sourceFile,
    Object.freeze([...source.navigation.moduleDependencies(sourceFile)]),
  ] as const));
  const moduleReferences = new Map(source.navigation.sourceFiles.map((sourceFile) => [
    sourceFile,
    Object.freeze([...source.navigation.moduleReferences(sourceFile)]),
  ] as const));
  const moduleExports = new Map(source.navigation.sourceFiles.map((sourceFile) => [
    sourceFile,
    Object.freeze([...source.navigation.moduleExports(sourceFile)]),
  ] as const));
  const topLevelAwait = new Map(source.navigation.sourceFiles.map((sourceFile) => [
    sourceFile,
    source.navigation.moduleHasTopLevelAwait(sourceFile),
  ] as const));
  const noDependencies: readonly SourceProjectModuleDependency[] = Object.freeze([]);
  const noExports: readonly SourceProjectModuleExport[] = Object.freeze([]);
  const snapshot: TargetPlanningSourceNavigation = {
    sourceFiles: Object.freeze([...source.navigation.sourceFiles]),
    sourceReferenceFor: source.navigation.sourceReferenceFor,
    referenceFor: (node) => node === undefined ? undefined : projectReferences.get(node),
    declarationFor: (node) => node === undefined ? undefined : declarations.get(node),
    moduleDependencies: (sourceFile) => moduleDependencies.get(sourceFile) ?? noDependencies,
    moduleReferences: (sourceFile) => moduleReferences.get(sourceFile) ?? noDependencies,
    moduleExports: (sourceFile) => moduleExports.get(sourceFile) ?? noExports,
    moduleHasTopLevelAwait: (sourceFile) => topLevelAwait.get(sourceFile) === true,
    memberDispatch: (node) => node === undefined ? undefined : memberDispatch.get(node),
    memberContracts: (node) => memberContracts.get(node) ?? Object.freeze({
      kind: "unresolved",
      declaration: node,
      reason: "The declaration was not classified as a source member before target planning.",
    }),
    callableImplementation: (node) => callableImplementations.get(node) ?? Object.freeze({
      kind: "unresolved",
      reason: "The callable was not classified before target planning.",
    }),
    declaredHeritage: (node) => declaredHeritage.get(node) ?? Object.freeze({
      kind: "unresolved",
      heritage: node,
      reason: "The declaration heritage was not classified before target planning.",
    }),
    bindingWritesWithin(symbol, root) {
      return Object.freeze((writesBySymbol.get(symbol) ?? []).filter((write) =>
        sourceNodeIsWithin(source.ast, write.operation, root)));
    },
    declarationUseSummary(node) {
      const summary = declarationUses.get(node);
      if (summary === undefined) {
        throw new Error("Target planning requested an unclassified source declaration-use summary.");
      }
      return summary;
    },
    countedLoop: (node) => countedLoops.get(node),
    expressionEffects(node) {
      const result = effects.get(node);
      if (result === undefined) {
        throw new Error("Target planning requested unclassified source expression effects.");
      }
      return result;
    },
    isProjectConstructibleObject: (node) =>
      node !== undefined && projectConstructibleObjects.has(node),
    isProjectDeclaration: (node) => node !== undefined && projectNodes.has(node),
  };
  return Object.freeze(snapshot);
}

function isReferenceQueryCandidate(ast: AstReader, node: Node): boolean {
  switch (ast.kindName(node)) {
    case "KindIdentifier":
    case "KindPrivateIdentifier":
    case "KindPropertyAccessExpression":
    case "KindElementAccessExpression":
    case "KindQualifiedName":
    case "KindTypeReference":
    case "KindExpressionWithTypeArguments":
      return true;
    default:
      return false;
  }
}

function sourceNodeIsWithin(ast: AstReader, node: Node, root: Node): boolean {
  let current: Node | undefined = node;
  while (current !== undefined) {
    if (current === root) return true;
    current = ast.parent(current);
  }
  return false;
}

function isCallableDeclaration(ast: AstReader, node: Node): boolean {
  switch (ast.kindName(node)) {
    case "KindFunctionDeclaration":
    case "KindFunctionExpression":
    case "KindArrowFunction":
    case "KindMethodDeclaration":
    case "KindConstructor":
    case "KindGetAccessor":
    case "KindSetAccessor":
      return true;
    default:
      return false;
  }
}

function isMemberDeclaration(ast: AstReader, node: Node): boolean {
  const parent = ast.parent(node);
  if (parent === undefined) return false;
  const kind = ast.kindName(parent);
  return kind === "KindClassDeclaration" || kind === "KindInterfaceDeclaration";
}
