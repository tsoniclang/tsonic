import type { SyntaxNode } from "../ir-hir/contract.js";
import { iterateSyntaxChildEdges } from "../ir-hir/index.js";
import type { TypedPhase } from "../ir-tir/contract.js";

export interface SyntaxEdge {
  readonly node: SyntaxNode<TypedPhase>;
  readonly segment: string;
}

export function syntaxEdges(node: SyntaxNode<TypedPhase>): readonly SyntaxEdge[] {
  return [...iterateSyntaxEdges(node)];
}

export function* iterateSyntaxEdges(node: SyntaxNode<TypedPhase>): Generator<SyntaxEdge, void> {
  for (const edge of iterateSyntaxChildEdges(node)) {
    let segment = "";
    for (const field of edge.fields) segment += typeof field === "number" ? "[" + field + "]" : "." + field;
    yield { node: edge.node, segment };
  }
}
