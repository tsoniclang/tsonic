import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "./types.js";
import { isSourceCallableBodyBoundary } from "./callable-boundaries.js";

const repeatedKinds: ReadonlySet<string> = new Set([
  "KindForStatement", "KindForInStatement", "KindForOfStatement", "KindWhileStatement", "KindDoStatement",
]);

export type SourceSubtreeParticipation =
  | { readonly kind: "resolved"; readonly nodes: readonly Node[] }
  | { readonly kind: "unresolved"; readonly reason: string };

export function sourceNodesOutsideErasedSubtrees(
  ast: Pick<AstReader, "parent">,
  nodes: readonly Node[],
  isErased: (node: Node) => boolean,
): SourceSubtreeParticipation {
  const domain = new Set(nodes);
  if (domain.size !== nodes.length) return Object.freeze({ kind: "unresolved",
    reason: "Source participation requires one occurrence of each checked source node." });
  const parents = new Map<Node, Node | undefined>();
  for (const node of nodes) {
    const parent = ast.parent(node);
    if (parent !== undefined && !domain.has(parent)) return Object.freeze({ kind: "unresolved",
      reason: "Source participation requires every checked parent in its finite source domain." });
    parents.set(node, parent);
  }
  const ordered: Node[] = [];
  const completed = new Set<Node>();
  for (const node of nodes) {
    const path: Node[] = [];
    const visiting = new Set<Node>();
    for (let current: Node | undefined = node; current !== undefined && !completed.has(current); current = parents.get(current)) {
      if (visiting.has(current)) return Object.freeze({ kind: "unresolved",
        reason: "Source participation requires acyclic checked parent correspondence." });
      visiting.add(current);
      path.push(current);
    }
    while (path.length !== 0) {
      const current = path.pop()!;
      completed.add(current);
      ordered.push(current);
    }
  }
  const selected = new Map<Node, boolean>();
  for (const node of ordered) {
    const parent = parents.get(node);
    selected.set(node, (parent === undefined || selected.get(parent) === true) && !isErased(node));
  }
  return Object.freeze({ kind: "resolved", nodes: Object.freeze(nodes.filter(node => selected.get(node) === true)) });
}

export function sourceEnclosingCallable(node: Node | undefined, ast: AstReader): Node | undefined {
  const visited = new Set<Node>();
  for (let current = node; current !== undefined; current = ast.parent(current)) {
    if (visited.has(current) || visited.size >= 128) return undefined;
    visited.add(current);
    if (isSourceCallableBodyBoundary(ast, current)) return current;
  }
  return undefined;
}

export function sourceLexicalFunctionIsUnused(
  declaration: Node,
  ast: AstReader,
  navigation: Pick<SourceProgramNavigation, "declarationUseSummary">,
): boolean {
  if (!ast.is.IsFunctionDeclaration(declaration) ||
    sourceEnclosingCallable(ast.parent(declaration), ast) === undefined) return false;
  const summary = navigation.declarationUseSummary(declaration);
  return !summary.exported && !summary.bindingWritten && !summary.hasUnclassifiedValueUse &&
    summary.uses.every(use => use.kind === "type-only");
}

export function createSourceSingleInvocationQuery(
  ast: AstReader,
  navigation: Pick<SourceProgramNavigation, "declarationUseSummary">,
): (declaration: Node) => boolean {
  const memo = new WeakMap<Node, boolean>();
  return declaration => select(declaration, new Set());

  function select(declaration: Node, active: Set<Node>): boolean {
    const previous = memo.get(declaration);
    if (previous !== undefined) return previous;
    if (active.has(declaration) || active.size >= 128 || !ast.is.IsFunctionDeclaration(declaration)) return false;
    active.add(declaration);
    const result = classify(declaration, active);
    active.delete(declaration);
    memo.set(declaration, result);
    return result;
  }

  function classify(declaration: Node, active: Set<Node>): boolean {
    const owner = sourceEnclosingCallable(ast.parent(declaration), ast);
    if (owner === undefined) return false;
    const summary = navigation.declarationUseSummary(declaration);
    const uses = summary.uses.filter(use => use.kind !== "type-only" && use.kind !== "source-linkage");
    if (summary.exported || summary.bindingWritten || summary.hasUnclassifiedValueUse ||
      uses.length !== 1 || uses[0]!.kind !== "direct-call" || uses[0]!.role !== "call-target") return false;
    const visited = new Set<Node>();
    for (let current = ast.parent(uses[0]!.reference); current !== undefined; current = ast.parent(current)) {
      if (visited.has(current) || visited.size >= 128) return false;
      visited.add(current);
      if (current === owner) return true;
      const kind = ast.kindName(current);
      if (repeatedKinds.has(kind)) return false;
      if (isSourceCallableBodyBoundary(ast, current)) return ast.is.IsFunctionDeclaration(current) &&
        sourceEnclosingCallable(ast.parent(current), ast) === owner && select(current, active);
    }
    return false;
  }
}
