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
  sourceProjectModuleDependencies,
} from "./modules.js";
import {
  createSourceReferenceNavigation,
} from "./references.js";
import {
  sourceSymbolHasReferenceOutside,
} from "./references-usage.js";
import type {
  SourceProgramNavigation,
} from "./types.js";

export function createSourceProgramNavigation(
  source: CheckedSourceProgram,
): SourceProgramNavigation {
  const sourceFiles = sourceProjectFiles(source);
  const sourceFileSet = new Set(
    sourceFiles.map((sourceFile) => sourceFileIdentity(source.ast, sourceFile)!),
  );
  const references = createSourceReferenceNavigation(source, sourceFiles);
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
  const classConstructors = createSourceClassConstructorNavigation(
    source,
    references.isProjectDeclaration,
  );
  const moduleDependencyCache = new Map<
    string,
    readonly ReturnType<typeof sourceProjectModuleDependencies>[number][]
  >();
  const topLevelAwaitCache = new Map<string, boolean>();

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
    referenceFor: references.referenceFor,
    declarationFor: references.declarationFor,
    moduleDependencies,
    moduleHasTopLevelAwait,
    memberDispatch: dispatch.memberDispatch,
    classConstructors,
    declaredHeritage: heritage.declaredHeritage,
    declaredHeritagePath: heritage.declaredHeritagePath,
    hasReferenceOutside(symbol: Symbol, excludedNode: Node) {
      return sourceSymbolHasReferenceOutside(
        source,
        sourceFiles,
        symbol,
        excludedNode,
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
  SourceClassConstructorParameter,
  SourceClassConstructorResult,
  SourceClassConstructorSignature,
  SourceDeclarationReference,
  SourceDeclaredHeritageEdge,
  SourceDeclaredHeritageResult,
  SourceHeritagePathResult,
  SourceProgramNavigation,
  SourceProjectMemberDispatch,
  SourceProjectModuleDependency,
  SourceProjectReference,
} from "./types.js";
export {
  sourceFileIdentity,
  sourceNodeIdentity,
  sourceNodesEqual,
  sourceSymbolIdentity,
  sourceSymbolsEqual,
} from "./identity.js";
