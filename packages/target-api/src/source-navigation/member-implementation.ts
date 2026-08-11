import type {
  CheckedSourceProgram,
  Node,
} from "@tsonic/tsts";
import {
  sourceNodeIdentity,
} from "./identity.js";
import {
  primaryDeclaration,
} from "./syntax.js";
import type {
  SourceHeritagePathResult,
  SourceProjectMemberImplementationResult,
  SourceProjectReference,
} from "./types.js";

export interface SourceMemberImplementationNavigation {
  memberImplementation(
    classDeclaration: Node,
    contractMemberDeclaration: Node,
  ): SourceProjectMemberImplementationResult;
}

export function createSourceMemberImplementationNavigation(
  source: CheckedSourceProgram,
  referenceFor: (node: Node | undefined) => SourceProjectReference | undefined,
  isProjectDeclaration: (node: Node | undefined) => boolean,
  declaredHeritagePath: (
    sourceDeclaration: Node,
    targetDeclaration: Node,
  ) => SourceHeritagePathResult,
): SourceMemberImplementationNavigation {
  const { ast } = source;
  const cache = new Map<string, SourceProjectMemberImplementationResult>();

  const memberImplementation = (
    classDeclaration: Node,
    contractMemberDeclaration: Node,
  ): SourceProjectMemberImplementationResult => {
    const classIdentity = sourceNodeIdentity(ast, classDeclaration);
    const memberIdentity = sourceNodeIdentity(ast, contractMemberDeclaration);
    const cacheKey = classIdentity === undefined || memberIdentity === undefined
      ? undefined
      : `${classIdentity}::${memberIdentity}`;
    const cached = cacheKey === undefined ? undefined : cache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const result = resolveMemberImplementation(
      source,
      classDeclaration,
      contractMemberDeclaration,
      referenceFor,
      isProjectDeclaration,
      declaredHeritagePath,
    );
    if (cacheKey !== undefined) {
      cache.set(cacheKey, result);
    }
    return result;
  };

  return Object.freeze({ memberImplementation });
}

function resolveMemberImplementation(
  source: CheckedSourceProgram,
  classDeclaration: Node,
  contractMemberDeclaration: Node,
  referenceFor: (node: Node | undefined) => SourceProjectReference | undefined,
  isProjectDeclaration: (node: Node | undefined) => boolean,
  declaredHeritagePath: (
    sourceDeclaration: Node,
    targetDeclaration: Node,
  ) => SourceHeritagePathResult,
): SourceProjectMemberImplementationResult {
  const { ast } = source;
  const contractOwner = ast.parent(contractMemberDeclaration);
  if (
    !ast.is.IsClassDeclaration(classDeclaration) ||
    contractOwner === undefined ||
    (
      !ast.is.IsClassDeclaration(contractOwner) &&
      !ast.is.IsInterfaceDeclaration(contractOwner)
    ) ||
    !isProjectDeclaration(classDeclaration) ||
    !isProjectDeclaration(contractMemberDeclaration)
  ) {
    return Object.freeze({
      kind: "unresolved",
      reason:
        "Project member implementation requires one project class and one project class/interface member declaration.",
    });
  }

  const relation = declaredHeritagePath(classDeclaration, contractOwner);
  if (relation.kind === "unrelated") {
    return Object.freeze({ kind: "unrelated" });
  }
  if (relation.kind === "unresolved") {
    return Object.freeze({ kind: "unresolved", reason: relation.reason });
  }

  const className = ast.name(classDeclaration);
  const classReference = referenceFor(className);
  if (className === undefined || classReference === undefined) {
    return Object.freeze({
      kind: "unresolved",
      reason: "The checked source program did not expose the project class declaration symbol.",
    });
  }

  const memberNameNode = ast.name(contractMemberDeclaration);
  const memberName = memberNameNode !== undefined &&
      (
        ast.is.IsIdentifier(memberNameNode) ||
        ast.is.IsStringLiteral(memberNameNode) ||
        ast.is.IsNumericLiteral(memberNameNode)
      )
    ? ast.text(memberNameNode)
    : undefined;
  if (memberName === undefined) {
    return Object.freeze({
      kind: "unresolved",
      reason: "The project member contract has no exact checker-queryable property name.",
    });
  }

  const checker = source.getSourceFileQueries(classReference.sourceFile).checker;
  const classType = checker.getDeclaredTypeOfSymbol(classReference.symbol);
  const implementationSymbol = checker.getPropertyOfType(classType, memberName);
  const implementationDeclaration = primaryDeclaration(checker, implementationSymbol);
  const implementationSourceFile = ast.getSourceFile(implementationDeclaration);
  if (
    implementationSymbol === undefined ||
    implementationDeclaration === undefined ||
    implementationSourceFile === undefined ||
    !isProjectDeclaration(implementationDeclaration)
  ) {
    return Object.freeze({
      kind: "unresolved",
      reason:
        "The checked project class has no exact project declaration implementing the selected member contract.",
    });
  }

  return Object.freeze({
    kind: "resolved",
    contractDeclaration: contractMemberDeclaration,
    implementation: Object.freeze({
      symbol: implementationSymbol,
      declaration: implementationDeclaration,
      sourceFile: implementationSourceFile,
      project: true,
    }),
  });
}
