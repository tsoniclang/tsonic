import type { DataflowLimits, DataflowResult, DirectedGraph, GraphComponents } from "./contract.js";
import type { GraphNode } from "./graph.js";
import { buildGraph, createMeter, takeEntries, takeWork } from "./graph.js";
import { walkGraph } from "./ordering.js";

interface Component {
  readonly minimum: number;
  readonly members: readonly number[];
}

export function componentsOfGraph<Vertex>(
  input: DirectedGraph<Vertex>,
  limits: DataflowLimits,
): DataflowResult<GraphComponents> {
  const meter = createMeter(limits);
  const entryStop = takeEntries(meter, input.vertices.length);
  if (entryStop !== null) return entryStop;
  const graph = buildGraph(input, meter);
  if (graph.kind === "resource-limit") return graph;
  const traversal = walkGraph(graph.value, graph.value.nodes.map(node => node.index), meter, false);
  if (traversal.kind === "resource-limit") return traversal;
  const visited = new Set<number>();
  const components: Component[] = [];
  for (const root of [...traversal.value.postorder].reverse()) {
    const rootStop = takeWork(meter);
    if (rootStop !== null) return rootStop;
    if (visited.has(root.index)) continue;
    const componentStop = takeEntries(meter, 1);
    if (componentStop !== null) return componentStop;
    const pending = [root];
    const members: number[] = [];
    let minimum = root.index;
    visited.add(root.index);
    let node: GraphNode<Vertex> | undefined;
    while ((node = pending.pop()) !== undefined) {
      const memberWork = takeWork(meter);
      if (memberWork !== null) return memberWork;
      const memberEntry = takeEntries(meter, 1);
      if (memberEntry !== null) return memberEntry;
      minimum = Math.min(minimum, node.index);
      members.push(node.index);
      for (const predecessor of node.predecessors.values()) {
        const edgeStop = takeWork(meter);
        if (edgeStop !== null) return edgeStop;
        if (!visited.has(predecessor.index)) {
          visited.add(predecessor.index);
          pending.push(predecessor);
        }
      }
    }
    members.sort((left, right) => left - right);
    components.push({ minimum, members });
  }
  components.sort((left, right) => left.minimum - right.minimum);
  const componentOf: number[] = [];
  for (const [componentIndex, component] of components.entries()) {
    for (const member of component.members) componentOf[member] = componentIndex;
  }
  return { kind: "complete", value: { components: components.map(component => component.members), componentOf } };
}
