import type {
  CheckedSourceProgram,
  Node,
  SourceFile,
  Symbol,
} from "@tsonic/tsts";
import {
  createSourceMemberDispatchNavigation,
} from "./member-dispatch.js";
import {
  createSourceMemberImplementationNavigation,
} from "./member-implementation.js";
import {
  createSourceMemberContractNavigation,
} from "./member-contracts.js";
import {
  createSourceCallableImplementationNavigation,
} from "./callable-implementation.js";
import {
  sourceFileIdentity,
} from "./identity.js";
import {
  createSourceHeritageNavigation,
} from "./heritage.js";
import {
  createSourceClassConstructorNavigation,
} from "./constructors.js";
import {
  sourceFileHasTopLevelAwait,
  sourceProjectModuleExports,
  sourceProjectModuleDependencies,
  sourceProjectModuleReferences,
} from "./modules.js";
import {
  createSourceReferenceNavigation,
} from "./references.js";
import {
  createSourceDeclarationReferenceIndex,
  sourceBindingWritesWithin,
  sourceSymbolHasReferenceOutside,
  sourceSymbolReferencesWithin,
} from "./references-usage.js";
import { sourceExpressionResultUse } from "./expression-use.js";
import { sourceExpressionEffects } from "./expression-effects.js";
import { sourceDeclarationUses } from "./declaration-uses.js";
import {
  sourceDeclarationUseSummary,
  sourceParameterUseSummary,
} from "./declaration-use-summary.js";
import { sourceCountedLoop } from "./counted-loops.js";
import { sourceExpressionValueFlow } from "./value-flow.js";
import type {
  SourceProgramNavigation,
} from "./types.js";

export * from "./ast.js";
export * from "./checked-casts.js";
export * from "./kinds.js";
export * from "./node-access.js";

export function createSourceProgramNavigation(
  source: CheckedSourceProgram,
): SourceProgramNavigation {
  const sourceFiles = sourceProjectFiles(source);
  const sourceFileSet = new Set(
    sourceFiles.map((sourceFile) => sourceFileIdentity(source.ast, sourceFile)!),
  );
  const references = createSourceReferenceNavigation(source, sourceFiles);
  const referenceIndex = createSourceDeclarationReferenceIndex(
    source,
    sourceFiles,
    references.sourceReferenceFor,
  );
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
    references.sourceReferenceFor,
    references.isProjectDeclaration,
  );
  const classConstructors = createSourceClassConstructorNavigation(
    source,
    references.isProjectDeclaration,
  );
  const moduleDependencyCache = new Map<
    string,
    readonly ReturnType<typeof sourceProjectModuleDependencies>[number][]
  >();
  const moduleReferenceCache = new Map<
    string,
    readonly ReturnType<typeof sourceProjectModuleReferences>[number][]
  >();
  const topLevelAwaitCache = new Map<string, boolean>();
  const moduleExportCache = new Map<
    string,
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

  const declarationUses = (declaration: Node): ReturnType<
    SourceProgramNavigation["declarationUses"]
  > => {
    const cached = declarationUsesCache.get(declaration);
    if (cached !== undefined) {
      return cached;
    }
    const uses = sourceDeclarationUses(
      source.ast,
      declaration,
      referenceIndex.referencesToDeclaration(declaration),
    );
    declarationUsesCache.set(declaration, uses);
    return uses;
  };

  const declarationUseSummary = (declaration: Node): ReturnType<
    SourceProgramNavigation["declarationUseSummary"]
  > => {
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
    const sourceFileKey = sourceFileIdentity(source.ast, sourceFile);
    if (sourceFileKey === undefined) {
      return Object.freeze([]);
    }
    const cached = moduleDependencyCache.get(sourceFileKey);
    if (cached !== undefined) {
      return cached;
    }
    const dependencies = sourceProjectModuleDependencies(
      source,
      sourceFileSet,
      sourceFile,
    );
    moduleDependencyCache.set(sourceFileKey, dependencies);
    return dependencies;
  };

  const moduleHasTopLevelAwait = (sourceFile: SourceFile): boolean => {
    const sourceFileKey = sourceFileIdentity(source.ast, sourceFile);
    if (sourceFileKey === undefined) {
      return false;
    }
    const cached = topLevelAwaitCache.get(sourceFileKey);
    if (cached !== undefined) {
      return cached;
    }
    const result = sourceFileHasTopLevelAwait(source.ast, sourceFile);
    topLevelAwaitCache.set(sourceFileKey, result);
    return result;
  };

  const moduleReferences = (
    sourceFile: SourceFile,
  ): ReturnType<SourceProgramNavigation["moduleReferences"]> => {
    const sourceFileKey = sourceFileIdentity(source.ast, sourceFile);
    if (sourceFileKey === undefined) {
      return Object.freeze([]);
    }
    const cached = moduleReferenceCache.get(sourceFileKey);
    if (cached !== undefined) {
      return cached;
    }
    const references = sourceProjectModuleReferences(
      source,
      sourceFileSet,
      sourceFile,
    );
    moduleReferenceCache.set(sourceFileKey, references);
    return references;
  };

  const moduleExports = (
    sourceFile: SourceFile,
  ): ReturnType<SourceProgramNavigation["moduleExports"]> => {
    const sourceFileKey = sourceFileIdentity(source.ast, sourceFile);
    if (sourceFileKey === undefined) {
      return Object.freeze([]);
    }
    const cached = moduleExportCache.get(sourceFileKey);
    if (cached !== undefined) {
      return cached;
    }
    const exports = sourceProjectModuleExports(source, sourceFile);
    moduleExportCache.set(sourceFileKey, exports);
    return exports;
  };

  const isProjectShape = (node: Node | undefined): boolean => {
    const declaration = references.declarationFor(node);
    return declaration !== undefined &&
      (
        source.ast.is.IsClassDeclaration(declaration) ||
        source.ast.is.IsInterfaceDeclaration(declaration) ||
        source.ast.is.IsEnumDeclaration(declaration) ||
        source.ast.is.IsEnumMember(declaration)
      );
  };

  const isProjectConstructibleObject = (node: Node | undefined): boolean => {
    const declaration = references.referenceFor(node)?.declaration ??
      references.declarationFor(node);
    return declaration !== undefined &&
      source.ast.is.IsClassDeclaration(declaration) &&
      acceptsNoConstructorArguments(source, declaration);
  };

  return Object.freeze({
    sourceFiles,
    sourceReferenceFor: references.sourceReferenceFor,
    referenceFor: references.referenceFor,
    declarationFor: references.declarationFor,
    moduleDependencies,
    moduleReferences,
    moduleExports,
    moduleHasTopLevelAwait,
    memberDispatch: dispatch.memberDispatch,
    memberImplementation: memberImplementations.memberImplementation,
    memberContracts: memberContracts.memberContracts,
    callableImplementation: callableImplementations.callableImplementation,
    classConstructors,
    declaredHeritage: heritage.declaredHeritage,
    declaredHeritagePath: heritage.declaredHeritagePath,
    bindingWritesWithin(symbol: Symbol, root: Node) {
      return sourceBindingWritesWithin(
        source,
        symbol,
        root,
        references.sourceReferenceFor,
      );
    },
    referencesWithin(symbol: Symbol, root: Node) {
      return sourceSymbolReferencesWithin(
        source,
        symbol,
        root,
        references.sourceReferenceFor,
      );
    },
    referencesToDeclaration: referenceIndex.referencesToDeclaration,
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
      return sourceCountedLoop(
        source.ast,
        statement,
        references.sourceReferenceFor,
        (symbol, root) => sourceBindingWritesWithin(
          source,
          symbol,
          root,
          references.sourceReferenceFor,
        ),
      );
    },
    expressionValueFlow(expression: Node) {
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
    expressionResultUse(expression: Node) {
      return sourceExpressionResultUse(source.ast, expression);
    },
    expressionEffects(expression: Node) {
      const cached = expressionEffectsCache.get(expression);
      if (cached !== undefined) {
        return cached;
      }
      const effects = sourceExpressionEffects(source, expression);
      expressionEffectsCache.set(expression, effects);
      return effects;
    },
    hasReferenceOutside(symbol: Symbol, excludedNode: Node) {
      return sourceSymbolHasReferenceOutside(
        source,
        sourceFiles,
        symbol,
        excludedNode,
        references.sourceReferenceFor,
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

export type {
  SourceBindingWrite,
  SourceClassConstructorParameter,
  SourceClassConstructorResult,
  SourceClassConstructorSignature,
  SourceCountedLoop,
  SourceCallableImplementationResult,
  SourceDeclarationReference,
  SourceDeclarationUse,
  SourceDeclarationUseSummary,
  SourceExpressionEffects,
  SourceExpressionValueFlowSummary,
  SourceDeclaredHeritageEdge,
  SourceDeclaredHeritageResult,
  SourceHeritagePathResult,
  SourceProgramNavigation,
  SourceParameterUseSummary,
  SourceProjectMemberDispatch,
  SourceProjectMemberContractsResult,
  SourceProjectMemberImplementationResult,
  SourceProjectModuleDependency,
  SourceProjectModuleExport,
  SourceProjectReference,
  SourceValueEscapeKind,
} from "./types.js";
export {
  projectSourceNodeIdentity,
  sourceFileIdentity,
  sourceNodeIdentity,
  sourceNodesEqual,
  sourceSymbolIdentity,
  sourceSymbolsEqual,
} from "./identity.js";
