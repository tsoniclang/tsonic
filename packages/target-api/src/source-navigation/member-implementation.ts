import type { Node } from "@tsonic/tsts";
import type { SourceNavigationInput } from "../source-model/navigation-records.js";
import { sourceNodeIdentity } from "./identity.js";
import { sourceMemberOwner } from "../source-model/class-members.js";
import { selectCallableImplementationDeclaration } from "./callable-implementation.js";
import type { SourceHeritagePathResult, SourceProjectMemberImplementationResult, SourceProjectReference } from "./types.js";

export interface SourceMemberImplementationNavigation {
  memberImplementation(
    typeDeclaration: Node,
    contractMemberDeclaration: Node,
  ): SourceProjectMemberImplementationResult;
}

export function createSourceMemberImplementationNavigation(
  source: Pick<SourceNavigationInput, "ast" | "declaredMember">,
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
    typeDeclaration: Node,
    contractMemberDeclaration: Node,
  ): SourceProjectMemberImplementationResult => {
    const typeIdentity = sourceNodeIdentity(ast, typeDeclaration);
    const memberIdentity = sourceNodeIdentity(ast, contractMemberDeclaration);
    const cacheKey = typeIdentity === undefined || memberIdentity === undefined
      ? undefined
      : `${typeIdentity}::${memberIdentity}`;
    const cached = cacheKey === undefined ? undefined : cache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const result = resolveMemberImplementation(
      source,
      typeDeclaration,
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
  source: Pick<SourceNavigationInput, "ast" | "declaredMember">,
  typeDeclaration: Node,
  contractMemberDeclaration: Node,
  referenceFor: (node: Node | undefined) => SourceProjectReference | undefined,
  isProjectDeclaration: (node: Node | undefined) => boolean,
  declaredHeritagePath: (
    sourceDeclaration: Node,
    targetDeclaration: Node,
  ) => SourceHeritagePathResult,
): SourceProjectMemberImplementationResult {
  const { ast } = source;
  const contractOwner = sourceMemberOwner(ast, contractMemberDeclaration);
  if (
    (
      !ast.is.IsClassDeclaration(typeDeclaration) &&
      !ast.is.IsClassExpression(typeDeclaration) &&
      !ast.is.IsInterfaceDeclaration(typeDeclaration)
    ) ||
    contractOwner === undefined ||
    (
      !ast.is.IsClassDeclaration(contractOwner) &&
      !ast.is.IsClassExpression(contractOwner) &&
      !ast.is.IsInterfaceDeclaration(contractOwner)
    ) ||
    !isProjectDeclaration(typeDeclaration) ||
    !isProjectDeclaration(contractMemberDeclaration)
  ) {
    return Object.freeze({
      kind: "unresolved",
      reason:
        "Project member implementation requires one project class/interface type and one project class/interface member declaration.",
    });
  }

  const relation = declaredHeritagePath(typeDeclaration, contractOwner);
  if (relation.kind === "unrelated") {
    return Object.freeze({ kind: "unrelated" });
  }
  if (relation.kind === "unresolved") {
    return Object.freeze({ kind: "unresolved", reason: relation.reason });
  }

  const typeReference = referenceFor(ast.name(typeDeclaration));
  if (!ast.is.IsClassExpression(typeDeclaration) && typeReference === undefined) {
    return Object.freeze({
      kind: "unresolved",
      reason: "The checked source program did not expose the project type declaration.",
    });
  }

  const members = source.declaredMember(typeDeclaration, contractMemberDeclaration);
  if (members === undefined) {
    return Object.freeze({
      kind: "unresolved",
      reason: "The checked source program did not expose the exact project member contract.",
    });
  }
  const implementationDeclaration = selectCallableImplementationDeclaration(
    ast,
    contractMemberDeclaration,
    members,
  ) ?? members[0];
  const implementationSourceFile = ast.getSourceFile(implementationDeclaration);
  if (
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
      declaration: implementationDeclaration,
      sourceFile: implementationSourceFile,
      project: true,
    }),
  });
}
