import type { InvariantFailure } from "../diag/contract.js";
import { requirePresent } from "../diag/index.js";
import type { DataflowAccount, DataflowResult, DirectedGraph, DominatorTree } from "./contract.js";
import type { GraphNode, GraphView } from "./graph.js";
import { buildGraph } from "./graph.js";
import { takeEntries, takeWork } from "./account.js";
import type { Traversal } from "./ordering.js";
import { walkGraph } from "./ordering.js";

const missingDfsParentRecord: InvariantFailure = ({
  owner: "dataflow", query: null, origin: null, message: "dominator DFS parent record is missing",
});
const missingImmediateDominator: InvariantFailure = ({
  owner: "dataflow", query: null, origin: null, message: "immediate dominator is missing",
});
const missingCorrectedImmediateDominator: InvariantFailure = ({
  owner: "dataflow", query: null, origin: null, message: "corrected immediate dominator is missing",
});
const missingPublishedImmediateDominator: InvariantFailure = ({
  owner: "dataflow", query: null, origin: null, message: "published immediate dominator is missing",
});

export interface DominanceNode<Vertex> {
  readonly vertex: GraphNode<Vertex>;
  readonly parent: DominanceNode<Vertex> | null;
  readonly bucket: DominanceNode<Vertex>[];
  readonly rank: number;
  semi: DominanceNode<Vertex> | null;
  ancestor: DominanceNode<Vertex> | null;
  label: DominanceNode<Vertex> | null;
  immediate: DominanceNode<Vertex> | undefined;
}

export interface Dominance<Vertex> {
  readonly traversal: Traversal<Vertex>;
  readonly records: ReadonlyMap<number, DominanceNode<Vertex>>;
}

function labelOf<Vertex>(node: DominanceNode<Vertex>): DominanceNode<Vertex> {
  return node.label === null ? node : node.label;
}

function semiOf<Vertex>(node: DominanceNode<Vertex>): DominanceNode<Vertex> {
  return node.semi === null ? node : node.semi;
}

function evaluate<Vertex>(node: DominanceNode<Vertex>, meter: DataflowAccount): DataflowResult<DominanceNode<Vertex>> {
  const evaluationStop = takeWork(meter);
  if (evaluationStop !== null) return evaluationStop;
  const pending: { readonly node: DominanceNode<Vertex>; readonly parent: DominanceNode<Vertex> }[] = [];
  let current = node;
  let ancestor = current.ancestor;
  while (ancestor !== null && ancestor.ancestor !== null) {
    const linkStop = takeWork(meter);
    if (linkStop !== null) return linkStop;
    pending.push({ node: current, parent: ancestor });
    current = ancestor;
    ancestor = current.ancestor;
  }
  for (const selected of pending.reverse()) {
    const compressionStop = takeWork(meter);
    if (compressionStop !== null) return compressionStop;
    const parent = selected.parent;
    const parentLabel = labelOf(parent);
    if (semiOf(parentLabel).rank < semiOf(labelOf(selected.node)).rank) selected.node.label = parentLabel;
    selected.node.ancestor = parent.ancestor;
  }
  return { kind: "complete", value: labelOf(node) };
}

export function dominate<Vertex>(graph: GraphView<Vertex>, entry: number, meter: DataflowAccount): DataflowResult<Dominance<Vertex>> {
  const traversal = walkGraph(graph, [entry], meter, false);
  if (traversal.kind !== "complete") return traversal;
  const records = new Map<number, DominanceNode<Vertex>>();
  const ordered: DominanceNode<Vertex>[] = [];
  for (const { vertex, parent: parentVertex } of traversal.value.preorder) {
    const recordStop = takeWork(meter);
    if (recordStop !== null) return recordStop;
    const parent = parentVertex === null ? null
      : requirePresent(records.get(parentVertex.index), missingDfsParentRecord);
    const record: DominanceNode<Vertex> = { vertex, parent, bucket: [], rank: ordered.length, semi: null,
      ancestor: null, label: null, immediate: undefined };
    records.set(vertex.index, record);
    ordered.push(record);
    if (parent === null) record.immediate = record;
  }
  for (const node of [...ordered].reverse()) {
    if (node.parent === null) continue;
    const rowStop = takeWork(meter);
    if (rowStop !== null) return rowStop;
    for (const predecessor of node.vertex.predecessors.values()) {
      const predecessorStop = takeWork(meter);
      if (predecessorStop !== null) return predecessorStop;
      const record = records.get(predecessor.index);
      if (record === undefined) continue;
      const evaluated = evaluate(record, meter);
      if (evaluated.kind !== "complete") return evaluated;
      const candidate = semiOf(evaluated.value);
      if (candidate.rank < semiOf(node).rank) node.semi = candidate;
    }
    semiOf(node).bucket.push(node);
    node.ancestor = node.parent;
    for (const member of node.parent.bucket) {
      const bucketStop = takeWork(meter);
      if (bucketStop !== null) return bucketStop;
      const evaluated = evaluate(member, meter);
      if (evaluated.kind !== "complete") return evaluated;
      member.immediate = semiOf(evaluated.value).rank < semiOf(member).rank ? evaluated.value : node.parent;
    }
    node.parent.bucket.length = 0;
  }
  for (const node of ordered) {
    if (node.parent === null) continue;
    const correctionStop = takeWork(meter);
    if (correctionStop !== null) return correctionStop;
    const semi = semiOf(node);
    const provisional = requirePresent(node.immediate, missingImmediateDominator);
    if (provisional.vertex.index !== semi.vertex.index) {
      node.immediate = requirePresent(provisional.immediate, missingCorrectedImmediateDominator);
    }
  }
  return { kind: "complete", value: { traversal: traversal.value, records } };
}

export function dominatorsOfGraph(
  input: DirectedGraph,
  entry: number,
  meter: DataflowAccount,
): DataflowResult<DominatorTree> {
  const priorStop = takeWork(meter, 0);
  if (priorStop !== null) return priorStop;
  const resultStop = takeEntries(meter, input.successors.length * 2);
  if (resultStop !== null) return resultStop;
  const graph = buildGraph(input, meter);
  if (graph.kind !== "complete") return graph;
  if (graph.value.nodes.length === 0) {
    return { kind: "complete", value: { immediate: [], reachable: [] } };
  }
  const dominance = dominate(graph.value, entry, meter);
  if (dominance.kind !== "complete") return dominance;
  const publicationStop = takeWork(meter, graph.value.nodes.length * 2);
  if (publicationStop !== null) return publicationStop;
  return { kind: "complete", value: {
    immediate: graph.value.nodes.map(vertex => {
      const node = dominance.value.records.get(vertex.index);
      return node === undefined || node.parent === null ? null
        : requirePresent(node.immediate, missingPublishedImmediateDominator).vertex.index;
    }),
    reachable: graph.value.nodes.map(vertex => dominance.value.traversal.reached.has(vertex.index)),
  } };
}
