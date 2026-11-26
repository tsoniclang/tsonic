import type { BlockId } from "../ids/contract.js";
import type { MirBlock, MirBody } from "../ir-mir/contract.js";
import { visitMirControlEdges } from "../ir-mir/index.js";
import type { DataflowAccount, DataflowResult, DataflowStop, DirectedGraph, OrderRows } from "./contract.js";
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

export function graphNode<Value>(graph: GraphView<Value>, index: number | undefined, name: string): GraphNode<Value> {
  return requireCallerValue(index === undefined ? undefined : graph.byIndex.get(index), `${name} ${index}`);
}

export function sortRecords<Value>(values: readonly Value[], compare: (left: Value, right: Value) => number | DataflowStop,
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
        let comparison = left < middle ? 0 : 1;
        if (left < middle && right < end) {
          const compared = compare(requireCallerValue(rows[left], "sort left"), requireCallerValue(rows[right], "sort right"));
          if (typeof compared !== "number") return compared;
          comparison = compared;
        }
        if (comparison <= 0) sorted.push(requireCallerValue(rows[left++], "sort left"));
        else sorted.push(requireCallerValue(rows[right++], "sort right"));
      }
    }
    buffer = rows;
    rows = sorted;
  }
  return { kind: "complete", value: rows };
}

export const orderRows: OrderRows = (values, compare, account) => {
  const room = takeEntries(account, 2 + 2 * values.length);
  return room ?? sortRecords(values, compare, account);
};

function graphFromRows<Value extends {}>(
  rows: Iterable<readonly [number, Value]>,
  successors: (value: Value, visit: (index: number | undefined) => void) => DataflowStop | null,
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
    const edgeStop = successors(node.value, index => {
      const target = graphNode(graph, index, "edge target");
      node.successors.push(target);
      target.predecessors.set(node.index, node);
    });
    if (edgeStop !== null) return edgeStop;
  }
  return { kind: "complete", value: graph };
}

export function buildGraph(input: DirectedGraph, meter: DataflowAccount): DataflowResult<GraphView<readonly number[]>> {
  return graphFromRows(input.successors.entries(), (row, visit) => {
    for (let index = 0; index < row.length; index += 1) {
      const stop = takeWork(meter);
      if (stop !== null) return stop;
      visit(row[index]);
    }
    return null;
  }, meter);
}

export function buildMirGraph(body: MirBody, meter: DataflowAccount): DataflowResult<GraphView<MirBlock>> {
  return graphFromRows(body.blocks.entries(),
    (block, visit) => visitMirControlEdges(block.terminator, { kind: "targets", admit: () => takeWork(meter), visit }), meter);
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

export function mirGraph(body: MirBody, meter: DataflowAccount): DataflowResult<DirectedGraph> {
  const priorStop = takeWork(meter, 0);
  if (priorStop !== null) return priorStop;
  const successors: (readonly number[])[] = [];
  for (const block of body.blocks) {
    const stop = takeWork(meter);
    if (stop !== null) return stop;
    const rowStop = takeEntries(meter, 1);
    if (rowStop !== null) return rowStop;
    const row: BlockId[] = [];
    const edgeStop = visitMirControlEdges(block.terminator, { kind: "targets",
      admit: () => takeWork(meter) ?? takeEntries(meter, 1), visit: target => { row.push(target); } });
    if (edgeStop !== null) return edgeStop;
    successors.push(row);
  }
  return { kind: "complete", value: { successors } };
}
