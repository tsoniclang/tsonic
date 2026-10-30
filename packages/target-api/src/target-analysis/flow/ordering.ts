import { createTargetGraphComponentQuery } from "../graph-component-query.js";
import type { SourceControlFlowGraph } from "./model.js";
import { SourceFlowFailure } from "./resources.js";

export function sourceFlowOrder(graph: SourceControlFlowGraph, direction: "forward" | "backward", step: () => void) {
  const reachable = new Set<number>();
  const visit = (roots: Iterable<number>, reverse: boolean, admitted?: ReadonlySet<number>): number[] => {
    const visited = new Set<number>();
    const postorder: number[] = [];
    const edges = (point: number) => reverse ? graph.points[point]!.predecessors : graph.points[point]!.successors;
    for (const root of roots) {
      step();
      if (visited.has(root) || admitted !== undefined && !admitted.has(root)) continue;
      if (graph.points[root]?.id !== root) throw new SourceFlowFailure("Source flow ordering requires valid graph point identities.", undefined);
      visited.add(root);
      const stack = [{ id: root, index: 0 }];
      while (stack.length > 0) {
        step();
        const current = stack[stack.length - 1]!;
        const edge = edges(current.id)[current.index++];
        if (edge === undefined) { postorder.push(current.id); stack.pop(); continue; }
        const target = reverse ? edge.from : edge.to;
        if (graph.points[target]?.id !== target || (reverse ? edge.to : edge.from) !== current.id) {
          throw new SourceFlowFailure("Source flow ordering requires owned graph edges.", graph.points[current.id]?.source);
        }
        if (visited.has(target) || admitted !== undefined && !admitted.has(target)) continue;
        visited.add(target);
        stack.push({ id: target, index: 0 });
      }
    }
    return postorder.reverse();
  };
  const forward = visit([graph.entry], false);
  for (const id of forward) reachable.add(id);
  const reversePostorder = direction === "forward" ? forward
    : visit([graph.exit, graph.exceptionExit, ...forward], true, reachable);
  const rank = new Map(reversePostorder.map((id, index) => [id, index]));
  const components: number[][] = [];
  const select = createTargetGraphComponentQuery<number, undefined, number>(id => {
    const neighbours = new Set<number>();
    for (const edge of graph.points[id]!.successors) { step(); if (reachable.has(edge.to)) neighbours.add(edge.to); }
    return { data: undefined, neighbours };
  }, members => {
    const index = components.length;
    components.push(members.map(member => member.vertex).sort((left, right) => rank.get(left)! - rank.get(right)!));
    return index;
  }, {
    step: () => { step(); return true; },
    createRows: () => ({ add: cost => { for (let index = 0; index < cost; index += 1) step(); return true; }, release: () => {} }),
  });
  for (const id of forward) {
    if (select(id) === undefined) throw new SourceFlowFailure("Source flow component ordering did not resolve.", graph.points[id]?.source);
  }
  if (direction === "forward") components.reverse();
  return { reachable, order: components.flat() };
}
