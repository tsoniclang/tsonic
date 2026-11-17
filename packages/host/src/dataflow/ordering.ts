import type { DataflowResult, DirectedGraph, GraphOrdering, DataflowAccount } from "./contract.js";
import type { DataflowStop } from "./account.js";
import type { GraphNode, GraphView } from "./graph.js";
import { buildGraph, graphNode } from "./graph.js";
import { takeEntries, takeWork } from "./account.js";

export interface TraversalNode<Vertex> {
  readonly vertex: GraphNode<Vertex>;
  readonly parent: GraphNode<Vertex> | null;
}

export interface Traversal<Vertex> {
  readonly preorder: readonly TraversalNode<Vertex>[];
  readonly postorder: readonly GraphNode<Vertex>[];
  readonly reached: ReadonlySet<number>;
}

interface Frame<Vertex> {
  readonly node: GraphNode<Vertex>;
  readonly successors: Iterator<GraphNode<Vertex>, undefined, undefined>;
}

export function walkGraph<Vertex>(
  graph: GraphView<Vertex>,
  roots: Iterable<number>,
  meter: DataflowAccount,
  published: boolean,
): DataflowResult<Traversal<Vertex>> {
  const reached = new Set<number>();
  const preorder: TraversalNode<Vertex>[] = [];
  const postorder: GraphNode<Vertex>[] = [];
  const pending: Frame<Vertex>[] = [];
  const admit = (node: GraphNode<Vertex>, parent: GraphNode<Vertex> | null): DataflowStop | null => {
    const workStop = takeWork(meter);
    if (workStop !== null) return workStop;
    if (published) {
      const entryStop = takeEntries(meter, 2);
      if (entryStop !== null) return entryStop;
    }
    reached.add(node.index);
    preorder.push({ vertex: node, parent });
    pending.push({ node, successors: node.successors.values() });
    return null;
  };
  for (const rootIndex of roots) {
    const rootStop = takeWork(meter);
    if (rootStop !== null) return rootStop;
    const root = graphNode(graph, rootIndex, "root");
    if (reached.has(root.index)) continue;
    const rootAdmission = admit(root, null);
    if (rootAdmission !== null) return rootAdmission;
    let frame: Frame<Vertex> | undefined;
    while ((frame = pending.pop()) !== undefined) {
      const successor = frame.successors.next();
      if (successor.done) {
        postorder.push(frame.node);
        continue;
      }
      const edgeStop = takeWork(meter);
      if (edgeStop !== null) return edgeStop;
      pending.push(frame);
      if (!reached.has(successor.value.index)) {
        const admission = admit(successor.value, frame.node);
        if (admission !== null) return admission;
      }
    }
  }
  return { kind: "complete", value: { preorder, postorder, reached } };
}

export function orderingOfGraph(
  input: DirectedGraph,
  roots: readonly number[],
  meter: DataflowAccount,
): DataflowResult<GraphOrdering> {
  const priorStop = takeWork(meter, 0);
  if (priorStop !== null) return priorStop;
  const entryStop = takeEntries(meter, input.successors.length);
  if (entryStop !== null) return entryStop;
  const graph = buildGraph(input, meter);
  if (graph.kind !== "complete") return graph;
  const traversal = walkGraph(graph.value, roots, meter, true);
  if (traversal.kind !== "complete") return traversal;
  const publicationStop = takeWork(meter, traversal.value.preorder.length + traversal.value.postorder.length + graph.value.nodes.length);
  if (publicationStop !== null) return publicationStop;
  return { kind: "complete", value: {
    preorder: traversal.value.preorder.map(node => node.vertex.index),
    postorder: traversal.value.postorder.map(node => node.index),
    reachable: graph.value.nodes.map(node => traversal.value.reached.has(node.index)),
  } };
}
