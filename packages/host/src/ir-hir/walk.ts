import type { CheckedPhase, HirModule, HirNode, IndexSyntaxTree, Phase, SyntaxNode, WalkSyntaxTree } from "./contract.js";
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

export function hirSyntaxArena(module: HirModule): readonly HirNode[] {
  const seen = new Set<HirNode>();
  const nodes: HirNode[] = [];
  let pending = [module.tree, ...module.bodies.map(body => body.root)].reduceRight<PendingNode<CheckedPhase> | null>(
    (next, node) => ({ node, next }), null);
  while (pending !== null) {
    const node = pending.node;
    pending = pending.next;
    if (seen.has(node)) continue;
    seen.add(node);
    nodes.push(node);
    pending = childrenOfSyntax(node).reduceRight<PendingNode<CheckedPhase> | null>(
      (next, child) => ({ node: child, next }), pending);
  }
  return Object.freeze(nodes);
}
