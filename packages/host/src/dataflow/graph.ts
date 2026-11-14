import type { BlockId } from "../ids/contract.js";
import type { MirBlock, MirBody, MirSwitchTarget, MirTerminator, MirUnwind } from "../ir-mir/contract.js";
import type { DataflowLimits, DataflowResult, DirectedGraph } from "./contract.js";

export interface DataflowStop {
  readonly kind: "resource-limit";
  readonly dimension: "work" | "result-entries" | "state";
  readonly maximum: number;
}

export interface Meter {
  readonly limits: DataflowLimits;
  work: number;
  entries: number;
}

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

export function checkMaximum(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a nonnegative safe integer`);
  }
}

export function createMeter(limits: DataflowLimits): Meter {
  checkMaximum(limits.maximumWork, "maximumWork");
  checkMaximum(limits.maximumResultEntries, "maximumResultEntries");
  return { limits, work: 0, entries: 0 };
}

export function takeWork(meter: Meter): DataflowStop | null {
  if (meter.work === meter.limits.maximumWork) {
    return { kind: "resource-limit", dimension: "work", maximum: meter.limits.maximumWork };
  }
  meter.work += 1;
  return null;
}

export function takeEntries(meter: Meter, count: number): DataflowStop | null {
  if (count > meter.limits.maximumResultEntries - meter.entries) {
    return { kind: "resource-limit", dimension: "result-entries", maximum: meter.limits.maximumResultEntries };
  }
  meter.entries += count;
  return null;
}

function graphFromRows<Value extends {}>(
  rows: Iterable<readonly [number, Value]>,
  successors: (node: GraphNode<Value>) => Iterable<number>,
  meter: Meter,
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

export function buildGraph(input: DirectedGraph, meter: Meter): DataflowResult<GraphView<readonly number[]>> {
  return graphFromRows(input.successors.entries(), node => node.value, meter);
}

export function buildMirGraph(body: MirBody, meter: Meter): DataflowResult<GraphView<MirBlock>> {
  return graphFromRows(body.blocks.entries(),
    node => terminatorTargets(node.value.terminator), meter);
}

export function predecessorsOfGraph(
  input: DirectedGraph,
  limits: DataflowLimits,
): DataflowResult<readonly (readonly number[])[]> {
  const meter = createMeter(limits);
  const outerStop = takeEntries(meter, input.successors.length);
  if (outerStop !== null) return outerStop;
  const graph = buildGraph(input, meter);
  if (graph.kind === "resource-limit") return graph;
  const value: number[][] = [];
  for (const node of graph.value.nodes) {
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

export function mirGraph(body: MirBody): DirectedGraph {
  const successors: (readonly number[])[] = [];
  for (const block of body.blocks) {
    successors.push([...terminatorTargets(block.terminator)]);
  }
  return { successors };
}
