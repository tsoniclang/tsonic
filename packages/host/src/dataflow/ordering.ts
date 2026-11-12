import type { DataflowResult, DirectedGraph, GraphOrdering, DataflowLimits } from "./contract.js";
import type { DataflowStop, GraphNode, GraphView, Meter } from "./graph.js";
import { buildGraph, createMeter, graphNode, takeEntries, takeWork } from "./graph.js";

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
  meter: Meter,
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
    pending.push({ node, successors: node.successors[Symbol.iterator]() });
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

export function orderingOfGraph<Vertex>(
  input: DirectedGraph<Vertex>,
  roots: readonly number[],
  limits: DataflowLimits,
): DataflowResult<GraphOrdering> {
  const meter = createMeter(limits);
  const entryStop = takeEntries(meter, input.vertices.length);
  if (entryStop !== null) return entryStop;
  const graph = buildGraph(input, meter);
  if (graph.kind === "resource-limit") return graph;
  const traversal = walkGraph(graph.value, roots, meter, true);
  if (traversal.kind === "resource-limit") return traversal;
  return { kind: "complete", value: {
    preorder: traversal.value.preorder.map(node => node.vertex.index),
    postorder: traversal.value.postorder.map(node => node.index),
    reachable: graph.value.nodes.map(node => traversal.value.reached.has(node.index)),
  } };
}
