import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceNavigationInput } from "../host-input/navigation.js";
import { sourceNodeIdentity } from "./identity.js";
import type { SourceDeclarationReference, SourceDeclaredHeritageEdge, SourceDeclaredHeritageResult, SourceHeritagePathResult } from "./types.js";

export interface SourceHeritageNavigation {
  declaredHeritage(declaration: Node): SourceDeclaredHeritageResult;
  declaredHeritagePath(
    sourceDeclaration: Node,
    targetDeclaration: Node,
  ): SourceHeritagePathResult;
}

const maximumHeritageDepth = 512;

/**
 * Declared heritage: each clause element, the declaration it names (host-input heritage target) and its authored type
 * argument nodes. Type arguments are syntax; their Source meaning is the Host value model's (object facts).
 */
export function createSourceHeritageNavigation(
  source: Pick<SourceNavigationInput, "ast" | "heritageTarget">,
  isProjectDeclaration: (node: Node | undefined) => boolean,
): SourceHeritageNavigation {
  const cache = new Map<string, SourceDeclaredHeritageResult>();

  const declaredHeritage = (
    declaration: Node,
  ): SourceDeclaredHeritageResult => {
    const identity = sourceNodeIdentity(source.ast, declaration);
    const cached = identity === undefined ? undefined : cache.get(identity);
    if (cached !== undefined) {
      return cached;
    }
    const clauses = [
      ...source.ast.extendsHeritageElements(declaration).map((heritage) => ({
        kind: "extends" as const,
        heritage,
      })),
      ...source.ast.implementsHeritageElements(declaration).map((heritage) => ({
        kind: "implements" as const,
        heritage,
      })),
    ].filter(
      (entry): entry is { readonly kind: "extends" | "implements"; readonly heritage: Node } =>
        entry.heritage !== undefined,
    );
    const edges: SourceDeclaredHeritageEdge[] = [];
    for (const clause of clauses) {
      const target = heritageTarget(source, clause.heritage, isProjectDeclaration);
      if (target === undefined) {
        const unresolved = Object.freeze({
          kind: "unresolved" as const,
          heritage: clause.heritage,
          reason:
            "The checked source program did not provide one exact declaration for a declared heritage type.",
        });
        if (identity !== undefined) {
          cache.set(identity, unresolved);
        }
        return unresolved;
      }
      edges.push(Object.freeze({
        kind: clause.kind,
        sourceDeclaration: declaration,
        heritage: clause.heritage,
        target,
        typeArguments: Object.freeze(
          source.ast.typeArguments(clause.heritage).filter(
            (argument): argument is Node => argument !== undefined,
          ),
        ),
      }));
    }
    const resolved = Object.freeze({
      kind: "resolved" as const,
      edges: Object.freeze(edges),
    });
    if (identity !== undefined) {
      cache.set(identity, resolved);
    }
    return resolved;
  };

  const declaredHeritagePath = (
    sourceDeclaration: Node,
    targetDeclaration: Node,
  ): SourceHeritagePathResult => {
    if (sameDeclaration(source, sourceDeclaration, targetDeclaration)) {
      return { kind: "related", edges: Object.freeze([]) };
    }
    return findHeritagePath(
      source,
      declaredHeritage,
      sourceDeclaration,
      targetDeclaration,
      new Set(),
      0,
    );
  };

  return Object.freeze({ declaredHeritage, declaredHeritagePath });
}

function heritageTarget(
  source: Pick<SourceNavigationInput, "ast" | "heritageTarget">,
  heritage: Node,
  isProjectDeclaration: (node: Node | undefined) => boolean,
): SourceDeclarationReference | undefined {
  const declaration = source.heritageTarget(heritage);
  const sourceFile = source.ast.getSourceFile(declaration);
  return declaration === undefined || sourceFile === undefined ? undefined
    : Object.freeze({ declaration, sourceFile, project: isProjectDeclaration(declaration) });
}

function findHeritagePath(
  source: { readonly ast: AstReader },
  declaredHeritage: (declaration: Node) => SourceDeclaredHeritageResult,
  current: Node,
  target: Node,
  path: Set<string>,
  depth: number,
): SourceHeritagePathResult {
  if (depth > maximumHeritageDepth) {
    return {
      kind: "unresolved",
      heritage: current,
      reason:
        `Declared source heritage exceeds its finite ${maximumHeritageDepth}-edge traversal depth.`,
    };
  }
  const currentIdentity = sourceNodeIdentity(source.ast, current);
  if (currentIdentity === undefined || path.has(currentIdentity)) {
    return { kind: "unrelated" };
  }
  const nextPath = new Set(path);
  nextPath.add(currentIdentity);
  const result = declaredHeritage(current);
  if (result.kind === "unresolved") {
    return result;
  }
  let unresolved: Extract<SourceHeritagePathResult, { readonly kind: "unresolved" }> | undefined;
  for (const edge of result.edges) {
    if (sameDeclaration(source, edge.target.declaration, target)) {
      return { kind: "related", edges: Object.freeze([edge]) };
    }
    const nested = findHeritagePath(
      source,
      declaredHeritage,
      edge.target.declaration,
      target,
      nextPath,
      depth + 1,
    );
    if (nested.kind === "related") {
      return {
        kind: "related",
        edges: Object.freeze([edge, ...nested.edges]),
      };
    }
    if (nested.kind === "unresolved") {
      unresolved ??= nested;
    }
  }
  return unresolved ?? { kind: "unrelated" };
}

function sameDeclaration(
  source: { readonly ast: AstReader },
  left: Node,
  right: Node,
): boolean {
  const leftIdentity = sourceNodeIdentity(source.ast, left);
  return leftIdentity !== undefined &&
    leftIdentity === sourceNodeIdentity(source.ast, right);
}
