import type { IndexSyntaxTree, Phase, SyntaxNode, WalkSyntaxTree } from "./contract.js";
import type { NodeId } from "../ids/contract.js";
import { childrenOfSyntax } from "./children.js";

interface PendingNode<PhaseType extends Phase> {
  readonly node: SyntaxNode<PhaseType>;
  readonly next: PendingNode<PhaseType> | null;
}

export const walkSyntaxTree: WalkSyntaxTree = <PhaseType extends Phase>(
  root: SyntaxNode<PhaseType>,
  stopBefore: readonly NodeId[],
): readonly SyntaxNode<PhaseType>[] => {
  const stopped = new Set(stopBefore);
  const seen = new Set<SyntaxNode<PhaseType>>();
  const result: SyntaxNode<PhaseType>[] = [];
  let pending: PendingNode<PhaseType> | null = { node: root, next: null };
  while (pending !== null) {
    const current = pending.node;
    pending = pending.next;
    if (stopped.has(current.id) || seen.has(current)) continue;
    seen.add(current);
    result.push(current);
    pending = childrenOfSyntax(current).reduceRight<PendingNode<PhaseType> | null>(
      (next, node) => ({ node, next }), pending,
    );
  }
  return Object.freeze(result);
};

export const indexSyntaxTree: IndexSyntaxTree = root => walkSyntaxTree(root, []);
