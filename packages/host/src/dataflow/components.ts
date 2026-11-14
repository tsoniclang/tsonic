import type { DataflowAccount, DataflowResult, DirectedGraph, GraphComponents } from "./contract.js";
import type { GraphNode } from "./graph.js";
import { buildGraph, sortRecords } from "./graph.js";
import { takeEntries, takeWork } from "./account.js";
import { walkGraph } from "./ordering.js";

interface Component {
  readonly minimum: number;
  readonly members: readonly number[];
}

export function componentsOfGraph(
  input: DirectedGraph,
  meter: DataflowAccount,
): DataflowResult<GraphComponents> {
  const priorStop = takeWork(meter, 0);
  if (priorStop !== null) return priorStop;
  const entryStop = takeEntries(meter, input.successors.length);
  if (entryStop !== null) return entryStop;
  const graph = buildGraph(input, meter);
  if (graph.kind !== "complete") return graph;
  const traversal = walkGraph(graph.value, graph.value.nodes.map(node => node.index), meter, false);
  if (traversal.kind !== "complete") return traversal;
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
    let node: GraphNode<readonly number[]> | undefined;
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
    const ordered = sortRecords(members, (left, right) => left - right, meter);
    if (ordered.kind !== "complete") return ordered;
    components.push({ minimum, members: ordered.value });
  }
  const orderedComponents = sortRecords(components, (left, right) => left.minimum - right.minimum, meter);
  if (orderedComponents.kind !== "complete") return orderedComponents;
  const componentOf: number[] = [];
  for (const [componentIndex, component] of orderedComponents.value.entries()) {
    const workStop = takeWork(meter, 1 + component.members.length);
    if (workStop !== null) return workStop;
    for (const member of component.members) componentOf[member] = componentIndex;
  }
  const resultStop = takeWork(meter, components.length);
  if (resultStop !== null) return resultStop;
  return { kind: "complete", value: { components: orderedComponents.value.map(component => component.members), componentOf } };
}
