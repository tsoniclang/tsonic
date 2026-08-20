import type {
  AstReader,
  Node,
} from "@tsonic/tsts";
import {
  sourceNodeIdentity,
  sourceNodesEqual,
} from "./identity.js";
import type {
  SourceDeclaredHeritageResult,
  SourceProjectMemberContractsResult,
  SourceProjectMemberImplementationResult,
} from "./types.js";

export interface SourceMemberContractNavigation {
  memberContracts(
    implementationDeclaration: Node,
  ): SourceProjectMemberContractsResult;
}

export function createSourceMemberContractNavigation(
  ast: AstReader,
  isProjectDeclaration: (node: Node | undefined) => boolean,
  declaredHeritage: (declaration: Node) => SourceDeclaredHeritageResult,
  memberImplementation: (
    typeDeclaration: Node,
    contractMemberDeclaration: Node,
  ) => SourceProjectMemberImplementationResult,
): SourceMemberContractNavigation {
  const cache = new WeakMap<Node, SourceProjectMemberContractsResult>();

  const memberContracts = (
    implementationDeclaration: Node,
  ): SourceProjectMemberContractsResult => {
    const existing = cache.get(implementationDeclaration);
    if (existing !== undefined) {
      return existing;
    }
    const result = resolveMemberContracts(
      ast,
      implementationDeclaration,
      isProjectDeclaration,
      declaredHeritage,
      memberImplementation,
    );
    cache.set(implementationDeclaration, result);
    return result;
  };

  return Object.freeze({ memberContracts });
}

function resolveMemberContracts(
  ast: AstReader,
  implementationDeclaration: Node,
  isProjectDeclaration: (node: Node | undefined) => boolean,
  declaredHeritage: (declaration: Node) => SourceDeclaredHeritageResult,
  memberImplementation: (
    typeDeclaration: Node,
    contractMemberDeclaration: Node,
  ) => SourceProjectMemberImplementationResult,
): SourceProjectMemberContractsResult {
  const owner = ast.parent(implementationDeclaration);
  if (!isProjectType(ast, owner) || !isProjectMember(ast, implementationDeclaration) ||
    !isProjectDeclaration(implementationDeclaration)) {
    return Object.freeze({
      kind: "unresolved",
      declaration: implementationDeclaration,
      reason: "Project member contracts require one exact project class or interface member declaration.",
    });
  }
  const inherited = collectInheritedProjectTypes(
    ast,
    owner,
    isProjectDeclaration,
    declaredHeritage,
  );
  if (inherited.kind === "unresolved") {
    return Object.freeze({
      kind: "unresolved",
      declaration: implementationDeclaration,
      reason: inherited.reason,
    });
  }
  const contracts: Node[] = [];
  const identities = new Set<string>();
  for (const inheritedType of inherited.declarations) {
    for (const candidate of ast.members(inheritedType)) {
      if (candidate === undefined || !isProjectMember(ast, candidate) ||
        ast.hasModifierKind(candidate, "static") ||
        ast.hasModifierKind(candidate, "private")) {
        continue;
      }
      const selected = memberImplementation(owner, candidate);
      if (selected.kind === "unrelated") {
        return Object.freeze({
          kind: "unresolved",
          declaration: implementationDeclaration,
          reason: "An inherited project member contract was unrelated to its exact containing type.",
        });
      }
      if (selected.kind === "unresolved") {
        return Object.freeze({
          kind: "unresolved",
          declaration: implementationDeclaration,
          reason: selected.reason,
        });
      }
      if (!sourceNodesEqual(ast, selected.implementation.declaration, implementationDeclaration)) {
        continue;
      }
      const identity = sourceNodeIdentity(ast, candidate);
      if (identity === undefined) {
        return Object.freeze({
          kind: "unresolved",
          declaration: implementationDeclaration,
          reason: "An inherited project member contract has no exact source-node identity.",
        });
      }
      if (!identities.has(identity)) {
        identities.add(identity);
        contracts.push(candidate);
      }
    }
  }
  return Object.freeze({
    kind: "resolved",
    implementationDeclaration,
    contracts: Object.freeze(contracts),
  });
}

function collectInheritedProjectTypes(
  ast: AstReader,
  declaration: Node,
  isProjectDeclaration: (node: Node | undefined) => boolean,
  declaredHeritage: (declaration: Node) => SourceDeclaredHeritageResult,
):
  | { readonly kind: "resolved"; readonly declarations: readonly Node[] }
  | { readonly kind: "unresolved"; readonly reason: string } {
  const declarations: Node[] = [];
  const visited = new Set<string>();
  const visit = (current: Node): string | undefined => {
    const result = declaredHeritage(current);
    if (result.kind === "unresolved") {
      return result.reason;
    }
    for (const edge of result.edges) {
      if (!edge.target.project || !isProjectDeclaration(edge.target.declaration)) {
        continue;
      }
      const identity = sourceNodeIdentity(ast, edge.target.declaration);
      if (identity === undefined) {
        return "An inherited project type has no exact source-node identity.";
      }
      if (visited.has(identity)) {
        continue;
      }
      visited.add(identity);
      declarations.push(edge.target.declaration);
      const failure = visit(edge.target.declaration);
      if (failure !== undefined) {
        return failure;
      }
    }
    return undefined;
  };
  const failure = visit(declaration);
  return failure === undefined
    ? Object.freeze({ kind: "resolved", declarations: Object.freeze(declarations) })
    : Object.freeze({ kind: "unresolved", reason: failure });
}

function isProjectType(ast: AstReader, node: Node | undefined): node is Node {
  return node !== undefined &&
    (ast.is.IsClassDeclaration(node) || ast.is.IsInterfaceDeclaration(node));
}

function isProjectMember(ast: AstReader, node: Node): boolean {
  const kind = ast.kindName(node);
  return kind === "KindMethodDeclaration" || kind === "KindMethodSignature" ||
    kind === "KindGetAccessor" || kind === "KindSetAccessor" ||
    kind === "KindPropertyDeclaration" || kind === "KindPropertySignature";
}
