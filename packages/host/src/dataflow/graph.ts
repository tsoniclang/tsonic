import type { BlockId } from "../ids/contract.js";
import type { MirBlock, MirBody, MirSwitchTarget, MirTerminator, MirUnwind } from "../ir-mir/contract.js";
import type { DataflowAccount, DataflowResult, DirectedGraph } from "./contract.js";
import { takeWork, takeEntries } from "./account.js";

export interface GraphNode<Value> {
  readonly index: number;
  readonly value: Value;
  readonly successors: GraphNode<Value>[];
  readonly predecessors: Map<number, GraphNode<Value>>;
}

export interface GraphView<Value> {
  readonly nodes: readonly GraphNode<Value>[];
  readonly byIndex: ReadonlyMap<number, GraphNode<Value>>;
}

export function requireCallerValue<Value>(value: Value | undefined, name: string): Value {
  if (value === undefined) throw new TypeError(`${name} is missing`);
  return value;
}

export function graphNode<Value>(graph: GraphView<Value>, index: number, name: string): GraphNode<Value> {
  return requireCallerValue(graph.byIndex.get(index), `${name} ${index}`);
}

export function sortRecords<Value>(values: readonly Value[], compare: (left: Value, right: Value) => number,
  account: DataflowAccount): DataflowResult<Value[]> {
  const stop = takeWork(account, values.length);
  if (stop !== null) return stop;
  let rows = [...values];
  let buffer: Value[] = [];
  for (let width = 1; width < rows.length; width *= 2) {
    const passStop = takeWork(account, rows.length);
    if (passStop !== null) return passStop;
    const sorted = buffer;
    sorted.length = 0;
    for (let start = 0; start < rows.length; start += 2 * width) {
      let left = start;
      let right = Math.min(start + width, rows.length);
      const middle = right;
      const end = Math.min(start + 2 * width, rows.length);
      while (left < middle || right < end) {
        if (right === end || left < middle && compare(requireCallerValue(rows[left], "sort left"), requireCallerValue(rows[right], "sort right")) <= 0)
          sorted.push(requireCallerValue(rows[left++], "sort left"));
        else sorted.push(requireCallerValue(rows[right++], "sort right"));
      }
    }
    buffer = rows;
    rows = sorted;
  }
  return { kind: "complete", value: rows };
}

function graphFromRows<Value extends {}>(
  rows: Iterable<readonly [number, Value]>,
  successors: (node: GraphNode<Value>) => Iterable<number>,
  meter: DataflowAccount,
): DataflowResult<GraphView<Value>> {
  const nodes: GraphNode<Value>[] = [];
  const byIndex = new Map<number, GraphNode<Value>>();
  for (const [index, value] of rows) {
    const rowStop = takeWork(meter);
    if (rowStop !== null) return rowStop;
    if (value === undefined || value === null) throw new TypeError(`vertex ${index} is missing`);
    const node: GraphNode<Value> = { index, value, successors: [], predecessors: new Map<number, GraphNode<Value>>() };
    nodes.push(node);
    byIndex.set(index, node);
  }
  const graph: GraphView<Value> = { nodes, byIndex };
  for (const node of nodes) {
    const rowStop = takeWork(meter);
    if (rowStop !== null) return rowStop;
    const targets = successors(node);
    for (const index of targets) {
      const edgeStop = takeWork(meter);
      if (edgeStop !== null) return edgeStop;
      const target = graphNode(graph, index, "edge target");
      node.successors.push(target);
      target.predecessors.set(node.index, node);
    }
  }
  return { kind: "complete", value: graph };
}

export function buildGraph(input: DirectedGraph, meter: DataflowAccount): DataflowResult<GraphView<readonly number[]>> {
  return graphFromRows(input.successors.entries(), node => node.value, meter);
}

export function buildMirGraph(body: MirBody, meter: DataflowAccount): DataflowResult<GraphView<MirBlock>> {
  return graphFromRows(body.blocks.entries(),
    node => terminatorTargets(node.value.terminator), meter);
}

export function predecessorsOfGraph(
  input: DirectedGraph,
  meter: DataflowAccount,
): DataflowResult<readonly (readonly number[])[]> {
  const priorStop = takeWork(meter, 0);
  if (priorStop !== null) return priorStop;
  const outerStop = takeEntries(meter, input.successors.length);
  if (outerStop !== null) return outerStop;
  const graph = buildGraph(input, meter);
  if (graph.kind !== "complete") return graph;
  const value: number[][] = [];
  for (const node of graph.value.nodes) {
    const workStop = takeWork(meter, 1 + node.predecessors.size);
    if (workStop !== null) return workStop;
    const memberStop = takeEntries(meter, node.predecessors.size);
    if (memberStop !== null) return memberStop;
    value.push([...node.predecessors.values()].map(predecessor => predecessor.index));
  }
  return { kind: "complete", value };
}

function unwindTargets(unwind: MirUnwind): readonly BlockId[] {
  switch (unwind.kind) {
    case "handler": return [unwind.target];
    // A failure that leaves the body, one that ends the process, and a control point that cannot fail have no edge.
    case "escape": case "abort": case "none": return [];
  }
}

function* switchTargets(targets: readonly MirSwitchTarget[], otherwise: BlockId): IterableIterator<BlockId> {
  for (const target of targets) yield target.target;
  yield otherwise;
}

export function terminatorTargets(terminator: MirTerminator): Iterable<BlockId> {
  switch (terminator.kind) {
    case "goto": return [terminator.target];
    case "switch": return switchTargets(terminator.targets, terminator.otherwise);
    case "check":
    case "call":
    case "invoke": return [terminator.next, ...unwindTargets(terminator.unwind)];
    case "await": return [terminator.resume, ...unwindTargets(terminator.unwind)];
    case "yield":
    case "delegate": return [terminator.resume, terminator.return.target, ...unwindTargets(terminator.unwind)];
    case "throw": return unwindTargets(terminator.unwind);
    case "return":
    case "unreachable": return [];
  }
}

export function mirGraph(body: MirBody, meter: DataflowAccount): DataflowResult<DirectedGraph> {
  const priorStop = takeWork(meter, 0);
  if (priorStop !== null) return priorStop;
  const successors: (readonly number[])[] = [];
  for (const block of body.blocks) {
    const stop = takeWork(meter);
    if (stop !== null) return stop;
    const rowStop = takeEntries(meter, 1);
    if (rowStop !== null) return rowStop;
    const row: number[] = [];
    for (const target of terminatorTargets(block.terminator)) {
      const edgeStop = takeWork(meter) ?? takeEntries(meter, 1);
      if (edgeStop !== null) return edgeStop;
      row.push(target);
    }
    successors.push(row);
  }
  return { kind: "complete", value: { successors } };
}
