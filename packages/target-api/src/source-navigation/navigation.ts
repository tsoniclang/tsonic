import type { CheckedSourceProgram, Node, SourceFile, Symbol } from "@tsonic/tsts";
import { createSourceMemberDispatchNavigation } from "./member-dispatch.js";
import { createSourceMemberImplementationNavigation } from "./member-implementation.js";
import { createSourceMemberContractNavigation } from "./member-contracts.js";
import { createSourceCallableImplementationNavigation } from "./callable-implementation.js";
import { sourceFileIdentity } from "./identity.js";
import { createSourceNodeInventory } from "./node-inventory.js";
import { createSourceHeritageNavigation } from "./heritage.js";
import { createSourceClassConstructorNavigation } from "./constructors.js";
import {
  sourceFileHasTopLevelAwait, sourceProjectModuleExports, sourceProjectModuleDependencies,
  sourceProjectModuleReferences, sourceProjectModuleSpecifierResolution,
} from "./modules.js";
import { createSourceReferenceNavigation } from "./references.js";
import { projectDeclarationForType } from "./reference-selection.js";
import { createSourceDeclarationSymbolQuery } from "./declaration-symbol.js";
import { semanticTypeForNode } from "./syntax.js";
import { sourceBindingWritesWithin, sourceSymbolHasReferenceOutside, sourceSymbolReferencesWithin } from "./references-usage.js";
import { sourceExpressionResultDisposition } from "./expression-use.js";
import { sourceExpressionEffects } from "./expression-effects.js";
import { sourceDeclarationUses } from "./declaration-uses.js";
import { sourceDeclarationUseSummary, sourceParameterUseSummary } from "./declaration-use-summary.js";
import { sourceCountedLoop } from "./counted-loops.js";
import { sourceExpressionValueFlow } from "./value-flow.js";
import type { SourceProgramNavigation } from "./types.js";
import { createSourceEnclosingQuery, sourceCallableRoles, type SourceCallableRole } from "./callable-boundaries.js";


export function createSourceProgramNavigation(
  source: CheckedSourceProgram,
): SourceProgramNavigation {
  const sourceFiles = sourceProjectFiles(source);
  const nodeInventory = createSourceNodeInventory(source, sourceFiles);
  const sourceFileSet = new Set(
    sourceFiles.map((sourceFile) => sourceFileIdentity(source.ast, sourceFile)!),
  );
  const requireNode = (node: Node): void => {
    if (!nodeInventory.contains(node)) throw new Error("Source navigation requires an original checked node in its own program.");
  };
  const requireFile = (file: SourceFile): void => {
    if (!source.containsSourceFile(file)) throw new Error("Source navigation requires its exact checked source-file identity.");
  };
  const enclosing = createSourceEnclosingQuery(source.ast);
  const references = createSourceReferenceNavigation(source, sourceFiles, nodeInventory.contains);
  const declarationSymbol = createSourceDeclarationSymbolQuery(source, references);
  const dispatch = createSourceMemberDispatchNavigation(
    source,
    sourceFiles,
    references.referenceFor,
    references.isProjectDeclaration,
  );
  const heritage = createSourceHeritageNavigation(
    source,
    references.isProjectDeclaration,
  );
  const memberImplementations = createSourceMemberImplementationNavigation(
    source,
    references.referenceFor,
    references.isProjectDeclaration,
    heritage.declaredHeritagePath,
  );
  const memberContracts = createSourceMemberContractNavigation(
    source.ast,
    references.isProjectDeclaration,
    heritage.declaredHeritage,
    memberImplementations.memberImplementation,
  );
  const callableImplementations = createSourceCallableImplementationNavigation(
    source,
    declarationSymbol,
    references.isProjectDeclaration,
  );
  const classConstructors = createSourceClassConstructorNavigation(
    source,
    references.isProjectDeclaration,
  );
  const moduleDependencyCache = new WeakMap<
    SourceFile,
    readonly ReturnType<typeof sourceProjectModuleDependencies>[number][]
  >();
  const moduleReferenceCache = new WeakMap<
    SourceFile,
    readonly ReturnType<typeof sourceProjectModuleReferences>[number][]
  >();
  const topLevelAwaitCache = new WeakMap<SourceFile, boolean>();
  const moduleExportCache = new WeakMap<
    SourceFile,
    readonly ReturnType<typeof sourceProjectModuleExports>[number][]
  >();
  const declarationUsesCache = new WeakMap<Node, readonly ReturnType<
    typeof sourceDeclarationUses
  >[number][]>();
  const declarationUseSummaryCache = new WeakMap<Node, ReturnType<
    typeof sourceDeclarationUseSummary
  >>();
  const expressionValueFlowCache = new WeakMap<Node, ReturnType<
    typeof sourceExpressionValueFlow
  >>();
  const expressionEffectsCache = new WeakMap<Node, ReturnType<
    typeof sourceExpressionEffects
  >>();
  const expressionResultDispositions = new WeakMap<Node, ReturnType<typeof sourceExpressionResultDisposition>>();
  const expressionResultDisposition = (expression: Node) => {
    requireNode(expression);
    const cached = expressionResultDispositions.get(expression);
    if (cached !== undefined) return cached;
    const selected = sourceExpressionResultDisposition(source.ast, expression);
    expressionResultDispositions.set(expression, selected);
    return selected;
  };

  const declarationUses = (declaration: Node): ReturnType<
    SourceProgramNavigation["declarationUses"]
  > => {
    requireNode(declaration);
    const cached = declarationUsesCache.get(declaration);
    if (cached !== undefined) {
      return cached;
    }
    const uses = sourceDeclarationUses(
      source.ast,
      declaration,
      references.referencesToDeclaration(declaration),
    );
    declarationUsesCache.set(declaration, uses);
    return uses;
  };

  const declarationUseSummary = (declaration: Node): ReturnType<
    SourceProgramNavigation["declarationUseSummary"]
  > => {
    requireNode(declaration);
    const cached = declarationUseSummaryCache.get(declaration);
    if (cached !== undefined) {
      return cached;
    }
    const summary = sourceDeclarationUseSummary(
      source.ast,
      declaration,
      declarationUses(declaration),
    );
    declarationUseSummaryCache.set(declaration, summary);
    return summary;
  };

  const moduleDependencies = (
    sourceFile: SourceFile,
  ): ReturnType<SourceProgramNavigation["moduleDependencies"]> => {
    requireFile(sourceFile);
    const cached = moduleDependencyCache.get(sourceFile);
    if (cached !== undefined) {
      return cached;
    }
    const dependencies = sourceProjectModuleDependencies(
      source,
      sourceFileSet,
      sourceFile,
    );
    moduleDependencyCache.set(sourceFile, dependencies);
    return dependencies;
  };

  const moduleHasTopLevelAwait = (sourceFile: SourceFile): boolean => {
    requireFile(sourceFile);
    const cached = topLevelAwaitCache.get(sourceFile);
    if (cached !== undefined) {
      return cached;
    }
    const result = sourceFileHasTopLevelAwait(source.ast, sourceFile);
    topLevelAwaitCache.set(sourceFile, result);
    return result;
  };

  const moduleReferences = (
    sourceFile: SourceFile,
  ): ReturnType<SourceProgramNavigation["moduleReferences"]> => {
    requireFile(sourceFile);
    const cached = moduleReferenceCache.get(sourceFile);
    if (cached !== undefined) {
      return cached;
    }
    const references = sourceProjectModuleReferences(
      source,
      sourceFileSet,
      sourceFile,
    );
    moduleReferenceCache.set(sourceFile, references);
    return references;
  };

  const moduleSpecifierResolution = (
    moduleSpecifier: Node,
  ): ReturnType<SourceProgramNavigation["moduleSpecifierResolution"]> => {
    requireNode(moduleSpecifier);
    return sourceProjectModuleSpecifierResolution(source, sourceFileSet, moduleSpecifier);
  };

  const moduleExports = (
    sourceFile: SourceFile,
  ): ReturnType<SourceProgramNavigation["moduleExports"]> => {
    requireFile(sourceFile);
    const cached = moduleExportCache.get(sourceFile);
    if (cached !== undefined) {
      return cached;
    }
    const exports = sourceProjectModuleExports(source, sourceFile);
    moduleExportCache.set(sourceFile, exports);
    return exports;
  };

  const isProjectShape = (node: Node | undefined): boolean => {
    const declaration = projectTypeDeclaration(node);
    return declaration !== undefined &&
      (
        source.ast.is.IsClassDeclaration(declaration) ||
        source.ast.is.IsClassExpression(declaration) ||
        source.ast.is.IsInterfaceDeclaration(declaration) ||
        source.ast.is.IsEnumDeclaration(declaration) ||
        source.ast.is.IsEnumMember(declaration)
      );
  };

  const isProjectConstructibleObject = (node: Node | undefined): boolean => {
    const declaration = projectTypeDeclaration(node);
    return declaration !== undefined &&
      (source.ast.is.IsClassDeclaration(declaration) || source.ast.is.IsClassExpression(declaration)) &&
      acceptsNoConstructorArguments(source, declaration);
  };

  const projectTypeDeclaration = (node: Node | undefined): Node | undefined => {
    if (node !== undefined) requireNode(node);
    const sourceFile = node === undefined ? undefined : source.ast.getSourceFile(node);
    if (node === undefined || sourceFile === undefined || sourceFile.IsDeclarationFile) {
      return undefined;
    }
    const queries = source.getSourceFileQueries(sourceFile);
    return projectDeclarationForType(
      queries.checker,
      queries.typeShape,
      semanticTypeForNode(source.ast, queries.checker, node),
      references.isProjectDeclaration,
    );
  };

  return Object.freeze({
    sourceFiles,
    nodes: nodeInventory.nodes,
    callableRoles(node: Node) {
      requireNode(node);
      return sourceCallableRoles(source.ast, node);
    },
    enclosing(node: Node | undefined, role: SourceCallableRole, visit?: (node: Node) => boolean) {
      if (node !== undefined) requireNode(node);
      const owner = enclosing(node, role, visit);
      if (owner !== undefined) requireNode(owner);
      return owner;
    },
    nodesForFiles: nodeInventory.nodesForFiles,
    referenceIndexStatistics: references.referenceIndexStatistics,
    sourceReferenceFor: references.sourceReferenceFor,
    referenceFor: references.referenceFor,
    declarationFor: references.declarationFor,
    moduleDependencies,
    moduleReferences,
    moduleSpecifierResolution,
    moduleExports,
    moduleHasTopLevelAwait,
    memberDispatch(node: Node | undefined) {
      if (node !== undefined) requireNode(node);
      return dispatch.memberDispatch(node);
    },
    memberImplementation(declaration: Node, contract: Node) {
      requireNode(declaration);
      requireNode(contract);
      return memberImplementations.memberImplementation(declaration, contract);
    },
    memberContracts(declaration: Node) {
      requireNode(declaration);
      return memberContracts.memberContracts(declaration);
    },
    declarationSymbol,
    callableImplementation(declaration: Node) {
      requireNode(declaration);
      return callableImplementations.callableImplementation(declaration);
    },
    classConstructors(declaration: Node) {
      requireNode(declaration);
      return classConstructors(declaration);
    },
    declaredHeritage(declaration: Node) {
      requireNode(declaration);
      return heritage.declaredHeritage(declaration);
    },
    declaredHeritagePath(declaration: Node, target: Node) {
      requireNode(declaration);
      requireNode(target);
      return heritage.declaredHeritagePath(declaration, target);
    },
    bindingWritesWithin(symbol: Symbol, root: Node) {
      requireNode(root);
      return sourceBindingWritesWithin(
        source.ast,
        symbol,
        root,
        references.referencesForSymbol,
      );
    },
    referencesWithin(symbol: Symbol, root: Node) {
      requireNode(root);
      return sourceSymbolReferencesWithin(
        source.ast,
        symbol,
        root,
        references.referencesForSymbol,
      );
    },
    referencesToDeclaration: references.referencesToDeclaration,
    declarationUses,
    declarationUseSummary,
    parameterUseSummary(parameter: Node) {
      return sourceParameterUseSummary(
        source.ast,
        parameter,
        declarationUses(parameter),
      );
    },
    countedLoop(statement: Node) {
      requireNode(statement);
      return sourceCountedLoop(
        source.ast,
        statement,
        references.sourceReferenceFor,
        (symbol, root) => sourceBindingWritesWithin(
          source.ast,
          symbol,
          root,
          references.referencesForSymbol,
        ),
      );
    },
    expressionValueFlow(expression: Node) {
      requireNode(expression);
      const cached = expressionValueFlowCache.get(expression);
      if (cached !== undefined) {
        return cached;
      }
      const summary = sourceExpressionValueFlow(
        source.ast,
        expression,
        references.sourceReferenceFor,
        declarationUses,
        declarationUseSummary,
      );
      expressionValueFlowCache.set(expression, summary);
      return summary;
    },
    expressionResultDisposition,
    expressionResultUse: (expression: Node) => expressionResultDisposition(expression).kind === "discarded" ? "discarded" : "consumed",
    expressionEffects(expression: Node) {
      requireNode(expression);
      const cached = expressionEffectsCache.get(expression);
      if (cached !== undefined) {
        return cached;
      }
      const effects = sourceExpressionEffects(
        source,
        expression,
        expressionEffectsCache,
      );
      expressionEffectsCache.set(expression, effects);
      return effects;
    },
    hasReferenceOutside(symbol: Symbol, excludedNode: Node) {
      requireNode(excludedNode);
      return sourceSymbolHasReferenceOutside(
        source.ast,
        symbol,
        excludedNode,
        references.referencesForSymbol,
      );
    },
    isProjectShape,
    isProjectConstructibleObject,
    isProjectDeclaration: references.isProjectDeclaration,
  });
}

export function sourceProjectFiles(
  source: CheckedSourceProgram,
): readonly SourceFile[] {
  return Object.freeze(source.sourceFiles.filter(
    (sourceFile): sourceFile is SourceFile =>
      sourceFile !== undefined &&
      !sourceFile.IsDeclarationFile &&
      !source.ast.getFileName(sourceFile).startsWith("tsts-provider://"),
  ));
}

function acceptsNoConstructorArguments(
  source: CheckedSourceProgram,
  classDeclaration: Node,
): boolean {
  const constructors = source.ast.members(classDeclaration)
    .filter((member): member is Node =>
      member !== undefined && source.ast.is.IsConstructorDeclaration(member));
  if (constructors.length === 0) {
    return true;
  }
  return constructors.some((constructor) =>
    source.ast.parameters(constructor).every((parameter) => {
      if (parameter === undefined || !source.ast.is.IsParameterDeclaration(parameter)) {
        return false;
      }
      const declaration = source.ast.as.AsParameterDeclaration(parameter);
      return declaration?.QuestionToken !== undefined ||
        declaration?.Initializer !== undefined ||
        declaration?.DotDotDotToken !== undefined;
    }));
}

