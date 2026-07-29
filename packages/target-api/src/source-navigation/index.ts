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
  const sourceFiles = source.sourceFiles.filter(
    (sourceFile): sourceFile is SourceFile =>
      sourceFile !== undefined &&
      !sourceFile.IsDeclarationFile &&
      !source.ast.getFileName(sourceFile).startsWith("tsts-provider://"),
  );
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
  const moduleDependencyCache = new Map<
    string,
    readonly ReturnType<typeof sourceProjectModuleDependencies>[number][]
  >();

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
    referenceFor: references.referenceFor,
    declarationFor: references.declarationFor,
    moduleDependencies,
    memberDispatch: dispatch.memberDispatch,
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
