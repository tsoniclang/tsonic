import type { SourceControlFlowGraph, SourceFlowLimits, SourceFlowProblem, SourceFlowSolution } from "./model.js";
import { sourceFlowOrder } from "./ordering.js";
import { createSourceFlowBudget, SourceFlowFailure, sourceFlowLimits } from "./resources.js";

export function solveSourceFlow<State>(graph: SourceControlFlowGraph, problem: SourceFlowProblem<State>,
  limits: Partial<SourceFlowLimits> = {}): SourceFlowSolution<State> {
  try {
    const selected = sourceFlowLimits(limits);
    if (graph.points.length > selected.maximumPoints) throw new SourceFlowFailure("Source flow exceeds its finite point budget.", graph.declaration);
    const budget = createSourceFlowBudget(selected);
    let edges = 0;
    for (const point of graph.points) {
      budget.step();
      edges += point.successors.length;
      if (edges > selected.maximumEdges) throw new SourceFlowFailure("Source flow exceeds its finite edge budget.", point.source);
    }
    const { order, reachable } = sourceFlowOrder(graph, problem.direction, budget.step);
    const ranks = new Map(order.map((id, index) => [id, index]));
    const before = new Map<number, State>();
    const after = new Map<number, State>();
    const work = createSourceFlowWorklist(order.length);
    for (const id of order) {
      budget.step();
      before.set(id, problem.lattice.empty());
      after.set(id, problem.lattice.empty());
      work.add(ranks.get(id)!);
    }
    let rank: number | undefined;
    while ((rank = work.take()) !== undefined) {
      budget.step();
      const point = graph.points[order[rank]!]!;
      const incoming = problem.direction === "forward" ? point.predecessors : point.successors;
      let input = problem.lattice.empty();
      const boundary = problem.boundary?.get(point.id);
      if (boundary !== undefined) input = required(problem.lattice.join(input, boundary, budget), point.source);
      for (const edge of incoming) {
        budget.step();
        const adjacent = problem.direction === "forward" ? edge.from : edge.to;
        if (!reachable.has(adjacent)) continue;
        const value = (problem.direction === "forward" ? after : before).get(adjacent)!;
        input = required(problem.lattice.join(input, value, budget), point.source);
      }
      const output = required(problem.transfer(point, input, budget), point.source);
      const previous = (problem.direction === "forward" ? after : before).get(point.id)!;
      before.set(point.id, problem.direction === "forward" ? input : output);
      after.set(point.id, problem.direction === "forward" ? output : input);
      if (problem.lattice.equals(previous, output, budget)) continue;
      const outgoing = problem.direction === "forward" ? point.successors : point.predecessors;
      for (const edge of outgoing) {
        budget.step();
        const adjacent = problem.direction === "forward" ? edge.to : edge.from;
        const adjacentRank = ranks.get(adjacent);
        if (adjacentRank !== undefined) work.add(adjacentRank);
      }
    }
    return Object.freeze({ kind: "resolved", before, after, reachable, steps: budget.steps() });
  } catch (error) {
    if (!(error instanceof SourceFlowFailure)) throw error;
    return Object.freeze({ kind: "unresolved", reason: error.message, source: error.source });
  }
}

function required<State>(state: State | undefined, source: import("@tsonic/tsts").Node | undefined): State {
  if (state === undefined) throw new SourceFlowFailure("Source flow lattice or transfer did not resolve within its premises and budget.", source);
  return state;
}

function createSourceFlowWorklist(size: number) {
  const queued = new Uint8Array(size);
  const heap: number[] = [];
  return {
    add(rank: number): void {
      if (queued[rank] !== 0) return;
      queued[rank] = 1;
      let index = heap.length;
      heap.push(rank);
      while (index > 0) {
        const parent = (index - 1) >>> 1;
        if (heap[parent]! <= rank) break;
        heap[index] = heap[parent]!;
        index = parent;
      }
      heap[index] = rank;
    },
    take(): number | undefined {
      const root = heap[0];
      if (root === undefined) return undefined;
      const last = heap.pop()!;
      queued[root] = 0;
      if (heap.length === 0) return root;
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        if (left >= heap.length) break;
        const right = left + 1;
        const child = right < heap.length && heap[right]! < heap[left]! ? right : left;
        if (heap[child]! >= last) break;
        heap[index] = heap[child]!;
        index = child;
      }
      heap[index] = last;
      return root;
    },
  };
}
