import type { BlockId } from "../ids/contract.js";
import type { MirBlock, MirBody, MirFixedControlEdge } from "../ir-mir/contract.js";
import { isMirCompletionControl, prepareMirExecutionGraph, visitMirControlEdges } from "../ir-mir/index.js";
import type { DataflowAccount, DataflowResult, DataflowStop, DirectedGraph, MirDirectedGraph, OrderRows } from "./contract.js";
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

export interface MirGraphView extends GraphView<MirBlock> {
  readonly qualified: boolean;
  readonly startOf: (block: BlockId) => number;
  readonly originalPositionOf: (node: GraphNode<MirBlock>) => number;
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

function createGraphRows<Value extends {}>(
  rows: Iterable<readonly [number, Value]>,
  inspect: (value: Value) => void,
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
    inspect(value);
  }
  return { kind: "complete", value: { nodes, byIndex } };
}

function wireGraph<Value>(graph: GraphView<Value>, successors: (node: GraphNode<Value>, visit: (index: number | undefined) => void) => DataflowStop | null,
  meter: DataflowAccount): DataflowStop | null {
  for (const node of graph.nodes) {
    const rowStop = takeWork(meter);
    if (rowStop !== null) return rowStop;
    const edgeStop = successors(node, index => {
      const target = graphNode(graph, index, "edge target");
      node.successors.push(target);
      target.predecessors.set(node.index, node);
    });
    if (edgeStop !== null) return edgeStop;
  }
  return null;
}

export function buildGraph(input: DirectedGraph, meter: DataflowAccount): DataflowResult<GraphView<readonly number[]>> {
  const graph = createGraphRows(input.successors.entries(), () => {}, meter);
  if (graph.kind !== "complete") return graph;
  const failure = wireGraph(graph.value, ({ value: row }, visit) => {
    for (let index = 0; index < row.length; index += 1) {
      const stop = takeWork(meter);
      if (stop !== null) return stop;
      visit(row[index]);
    }
    return null;
  }, meter);
  return failure ?? graph;
}

function executionRoots(body: MirBody, meter: DataflowAccount): DataflowResult<BlockId[]> {
  const capacity = takeEntries(meter, 1);
  if (capacity !== null) return capacity;
  const roots: BlockId[] = [];
  for (let index = 0; index < body.entries.length; index += 1) {
    const stop = takeWork(meter) ?? takeEntries(meter, 1);
    if (stop !== null) return stop;
    roots.push(requireCallerValue(body.entries[index], "MIR execution entry").block);
  }
  return { kind: "complete", value: roots };
}

function completionGraph(body: MirBody, physical: GraphView<MirBlock>, meter: DataflowAccount): DataflowResult<MirGraphView> {
  const capacity = takeEntries(meter, 2);
  if (capacity !== null) return capacity;
  const controls: MirFixedControlEdge[][] = [];
  for (const node of physical.nodes) {
    const blockRoom = takeWork(meter) ?? takeEntries(meter, 1);
    if (blockRoom !== null) return blockRoom;
    const edges: MirFixedControlEdge[] = [];
    const stopped = visitMirControlEdges(node.value.terminator, { kind: "topology", admit: () => takeWork(meter) ?? takeEntries(meter, 1),
      visit: (kind, target) => { edges.push({ kind, target, destination: null }); } });
    if (stopped !== null) return stopped;
    controls[node.index] = edges;
  }
  const offered = executionRoots(body, meter);
  if (offered.kind !== "complete") return offered;
  const roots = offered.value;
  const prepared = prepareMirExecutionGraph(body, roots, block => requireCallerValue(controls[block], "MIR ordered successors"),
    (work, records) => takeWork(meter, work) ?? takeEntries(meter, records));
  if (prepared.kind === "resource-stop") return prepared.stop;
  if (prepared.kind === "invalid") throw new TypeError(`Invalid cleanup graph at block ${prepared.block}: ${prepared.reason}`);
  const rows = function* (): IterableIterator<readonly [number, MirBlock]> {
    for (const point of prepared.points) yield [point.id, point.block];
  };
  const graph = createGraphRows(rows(), () => {}, meter);
  if (graph.kind !== "complete") return graph;
  const wired = wireGraph(graph.value, (node, visit) => {
    const point = requireCallerValue(prepared.points[node.index], "qualified MIR point");
    for (const edge of point.edges) {
      const stopped = takeWork(meter);
      if (stopped !== null) return stopped;
      visit(edge.point);
    }
    return null;
  }, meter);
  if (wired !== null) return wired;
  const starts = new Map<BlockId, number>();
  for (let index = 0; index < roots.length; index += 1) {
    const stopped = takeWork(meter) ?? takeEntries(meter, 1);
    if (stopped !== null) return stopped;
    starts.set(requireCallerValue(roots[index], "original MIR root"), requireCallerValue(prepared.roots[index], "qualified MIR root"));
  }
  return { kind: "complete", value: { ...graph.value, qualified: true, startOf: root => requireCallerValue(starts.get(root), "qualified MIR entry"),
    originalPositionOf: node => node.value.id } };
}

export function buildMirGraph(body: MirBody, meter: DataflowAccount): DataflowResult<MirGraphView> {
  let qualified = false;
  const graph = createGraphRows(body.blocks.entries(), block => { qualified ||= isMirCompletionControl(block.terminator); }, meter);
  if (graph.kind !== "complete") return graph;
  if (qualified) return completionGraph(body, graph.value, meter);
  const wired = wireGraph(graph.value, ({ value: block }, visit) =>
    visitMirControlEdges(block.terminator, { kind: "targets", admit: () => takeWork(meter), visit }), meter);
  return wired ?? { kind: "complete", value: { ...graph.value, qualified: false, startOf: block => block, originalPositionOf: node => node.index } };
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

export function mirGraph(body: MirBody, meter: DataflowAccount): DataflowResult<MirDirectedGraph> {
  const priorStop = takeWork(meter, 0);
  if (priorStop !== null) return priorStop;
  const successors: BlockId[][] = [];
  let carriers: Set<number> | null = null;
  let qualified = false;
  for (let index = 0; index < body.blocks.length; index += 1) {
    const stop = takeWork(meter);
    if (stop !== null) return stop;
    const rowStop = takeEntries(meter, 1);
    if (rowStop !== null) return rowStop;
    const block = requireCallerValue(body.blocks[index], "MIR graph block");
    const terminator = block.terminator;
    qualified ||= isMirCompletionControl(terminator);
    const row: BlockId[] = [];
    const carries = "unwind" in terminator && terminator.unwind.kind === "carry";
    if (carries) {
      const carry = takeEntries(meter, carriers === null ? 2 : 1);
      if (carry !== null) return carry;
      (carriers ??= new Set()).add(index);
    }
    const edgeStop = visitMirControlEdges(terminator, { kind: "targets", admit: () => takeWork(meter) ?? takeEntries(meter, 1),
      visit: target => { row.push(target); } });
    if (edgeStop !== null) return edgeStop;
    successors.push(row);
  }
  if (!qualified) return { kind: "complete", value: { successors } };
  const preparedRoom = takeEntries(meter, 1);
  if (preparedRoom !== null) return preparedRoom;
  const controls: MirFixedControlEdge[][] = [];
  for (let index = 0; index < successors.length; index += 1) {
    const read = takeWork(meter);
    if (read !== null) return read;
    const row = requireCallerValue(successors[index], "retained physical successor row");
    const room = takeWork(meter, row.length) ?? takeEntries(meter, row.length + 1);
    if (room !== null) return room;
    controls.push(row.map((target, position) => ({ kind: position === row.length - 1 && carriers?.has(index) === true ? "carry" : "normal",
      target, destination: null })));
  }
  const roots = executionRoots(body, meter);
  if (roots.kind !== "complete") return roots;
  const prepared = prepareMirExecutionGraph(body, roots.value, block => requireCallerValue(controls[block], "MIR graph successors"),
    (work, retained) => takeWork(meter, work) ?? takeEntries(meter, retained));
  if (prepared.kind === "resource-stop") return prepared.stop;
  if (prepared.kind === "invalid") throw new TypeError(`Invalid cleanup graph at block ${prepared.block}: ${prepared.reason}`);
  const result = takeEntries(meter, prepared.points.length * 3 + 3);
  if (result !== null) return result;
  const qualifiedSuccessors: number[][] = [], blocks: BlockId[] = [];
  for (let position = 0; position < prepared.points.length; position += 1) {
    const read = takeWork(meter);
    if (read !== null) return read;
    const point = requireCallerValue(prepared.points[position], "qualified MIR graph point");
    const room = takeWork(meter, point.edges.length) ?? takeEntries(meter, point.edges.length);
    if (room !== null) return room;
    qualifiedSuccessors.push(point.edges.map(edge => edge.point));
    blocks.push(point.block.id);
  }
  return { kind: "complete", value: { successors: qualifiedSuccessors, qualification: { blocks, entries: prepared.roots } } };
}
