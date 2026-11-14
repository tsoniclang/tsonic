import type { InvariantFailure } from "../diag/contract.js";
import { requirePresent } from "../diag/index.js";
import type { DataflowAccount, DataflowResult, DirectedGraph, NaturalLoop } from "./contract.js";
import type { Dominance, DominanceNode } from "./dominators.js";
import { dominate } from "./dominators.js";
import type { DataflowStop } from "./account.js";
import type { GraphNode } from "./graph.js";
import { buildGraph, sortRecords } from "./graph.js";
import { takeEntries, takeWork } from "./account.js";

const missingLoopDominatorParent: InvariantFailure = ({
  owner: "dataflow", query: null, origin: null, message: "loop dominator parent is missing",
});
const missingLoopDominatorRow: InvariantFailure = ({
  owner: "dataflow", query: null, origin: null, message: "loop dominator row is missing",
});
const missingLoopTargetInterval: InvariantFailure = ({
  owner: "dataflow", query: null, origin: null, message: "loop target interval is missing",
});

interface Interval {
  start: number;
  end: number;
}

interface IntervalRow<Vertex> {
  readonly node: DominanceNode<Vertex>;
  readonly interval: Interval;
  readonly children: IntervalRow<Vertex>[];
}

interface LoopGroup {
  readonly header: number;
  readonly backEdges: Set<number>;
  readonly members: Set<number>;
}

function intervalsOf<Vertex>(dominance: Dominance<Vertex>, meter: DataflowAccount): DataflowResult<ReadonlyMap<number, Interval>> {
  const rows = new Map<number, IntervalRow<Vertex>>();
  for (const node of dominance.records.values()) {
    const rowStop = takeWork(meter);
    if (rowStop !== null) return rowStop;
    rows.set(node.vertex.index, { node, interval: { start: 0, end: 0 }, children: [] });
  }
  const roots: IntervalRow<Vertex>[] = [];
  for (const row of rows.values()) {
    const rowStop = takeWork(meter);
    if (rowStop !== null) return rowStop;
    if (row.node.parent === null) roots.push(row);
    else {
      const parent = requirePresent(row.node.immediate, missingLoopDominatorParent);
      requirePresent(rows.get(parent.vertex.index), missingLoopDominatorRow).children.push(row);
    }
  }
  const intervals = new Map<number, Interval>();
  const pending: { readonly row: IntervalRow<Vertex>; readonly finish: boolean }[] = roots.map(row => ({ row, finish: false }));
  let next = 0;
  let frame: { readonly row: IntervalRow<Vertex>; readonly finish: boolean } | undefined;
  while ((frame = pending.pop()) !== undefined) {
    const visitStop = takeWork(meter);
    if (visitStop !== null) return visitStop;
    if (frame.finish) {
      frame.row.interval.end = next++;
      continue;
    }
    frame.row.interval.start = next++;
    intervals.set(frame.row.node.vertex.index, frame.row.interval);
    pending.push({ row: frame.row, finish: true });
    for (const child of [...frame.row.children].reverse()) {
      const edgeStop = takeWork(meter);
      if (edgeStop !== null) return edgeStop;
      pending.push({ row: child, finish: false });
    }
  }
  return { kind: "complete", value: intervals };
}

function addMembers<Vertex>(
  source: GraphNode<Vertex>,
  header: GraphNode<Vertex>,
  group: LoopGroup,
  reachable: ReadonlySet<number>,
  meter: DataflowAccount,
): DataflowStop | null {
  const headerWork = takeWork(meter);
  if (headerWork !== null) return headerWork;
  if (!group.members.has(header.index)) {
    const headerEntry = takeEntries(meter, 1);
    if (headerEntry !== null) return headerEntry;
    group.members.add(header.index);
  }
  const pending: GraphNode<Vertex>[] = [];
  const admit = (node: GraphNode<Vertex>): DataflowStop | null => {
    const memberWork = takeWork(meter);
    if (memberWork !== null) return memberWork;
    const memberEntry = takeEntries(meter, 1);
    if (memberEntry !== null) return memberEntry;
    group.members.add(node.index);
    pending.push(node);
    return null;
  };
  if (!group.members.has(source.index)) {
    const sourceStop = admit(source);
    if (sourceStop !== null) return sourceStop;
  }
  let node: GraphNode<Vertex> | undefined;
  while ((node = pending.pop()) !== undefined) {
    for (const predecessor of node.predecessors.values()) {
      const edgeStop = takeWork(meter);
      if (edgeStop !== null) return edgeStop;
      if (reachable.has(predecessor.index) && !group.members.has(predecessor.index)) {
        const predecessorStop = admit(predecessor);
        if (predecessorStop !== null) return predecessorStop;
      }
    }
  }
  return null;
}

export function loopsOfGraph(
  input: DirectedGraph,
  entry: number,
  meter: DataflowAccount,
): DataflowResult<readonly NaturalLoop[]> {
  const priorStop = takeWork(meter, 0);
  if (priorStop !== null) return priorStop;
  const graph = buildGraph(input, meter);
  if (graph.kind !== "complete") return graph;
  if (graph.value.nodes.length === 0) return { kind: "complete", value: [] };
  const dominance = dominate(graph.value, entry, meter);
  if (dominance.kind !== "complete") return dominance;
  const intervals = intervalsOf(dominance.value, meter);
  if (intervals.kind !== "complete") return intervals;
  const loops = new Map<number, LoopGroup>();
  for (const source of graph.value.nodes) {
    const rowStop = takeWork(meter);
    if (rowStop !== null) return rowStop;
    const sourceInterval = intervals.value.get(source.index);
    if (sourceInterval === undefined) continue;
    for (const target of source.successors) {
      const edgeStop = takeWork(meter);
      if (edgeStop !== null) return edgeStop;
      const targetInterval = requirePresent(intervals.value.get(target.index), missingLoopTargetInterval);
      if (targetInterval.start > sourceInterval.start || targetInterval.end < sourceInterval.end) continue;
      let group = loops.get(target.index);
      if (group === undefined) {
        const groupEntry = takeEntries(meter, 1);
        if (groupEntry !== null) return groupEntry;
        group = { header: target.index, backEdges: new Set<number>(), members: new Set<number>() };
        loops.set(target.index, group);
      }
      if (group.backEdges.has(source.index)) continue;
      const backEdgeEntry = takeEntries(meter, 1);
      if (backEdgeEntry !== null) return backEdgeEntry;
      group.backEdges.add(source.index);
      const memberStop = addMembers(source, target, group, dominance.value.traversal.reached, meter);
      if (memberStop !== null) return memberStop;
    }
  }
  const rowStop = takeWork(meter, loops.size);
  if (rowStop !== null) return rowStop;
  const ordered = sortRecords([...loops.values()], (left, right) => left.header - right.header, meter);
  if (ordered.kind !== "complete") return ordered;
  const value: NaturalLoop[] = [];
  for (const group of ordered.value) {
    const workStop = takeWork(meter, 1 + group.backEdges.size + group.members.size);
    if (workStop !== null) return workStop;
    const backEdges = sortRecords([...group.backEdges], (left, right) => left - right, meter);
    if (backEdges.kind !== "complete") return backEdges;
    const members = sortRecords([...group.members], (left, right) => left - right, meter);
    if (members.kind !== "complete") return members;
    value.push({ header: group.header, backEdges: backEdges.value, members: members.value });
  }
  return { kind: "complete", value };
}
