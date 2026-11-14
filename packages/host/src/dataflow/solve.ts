import type { InvariantFailure } from "../diag/contract.js";
import { requirePresent } from "../diag/index.js";
import type { MirBlock, MirBody, MirStatement } from "../ir-mir/contract.js";
import type {
  BackwardProblem, BlockState, DataflowAccount, DataflowResult, FlowSolution, ForwardProblem, Lattice, Problem,
} from "./contract.js";
import type { DataflowStop } from "./account.js";
import type { GraphNode, GraphView } from "./graph.js";
import { buildMirGraph, requireCallerValue } from "./graph.js";
import { checkMaximum, failureOf, stopState, takeEntries, takeWork } from "./account.js";
import type { Traversal } from "./ordering.js";
import { walkGraph } from "./ordering.js";

const missingWorklistParent: InvariantFailure = ({
  owner: "dataflow", query: null, origin: null, message: "worklist parent is missing",
});
const missingWorklistTail: InvariantFailure = ({
  owner: "dataflow", query: null, origin: null, message: "worklist tail is missing",
});
const missingWorklistLeftChild: InvariantFailure = ({
  owner: "dataflow", query: null, origin: null, message: "worklist left child is missing",
});
const missingWorklistRightChild: InvariantFailure = ({
  owner: "dataflow", query: null, origin: null, message: "worklist right child is missing",
});
const missingWorklistCell: InvariantFailure = ({
  owner: "dataflow", query: null, origin: null, message: "worklist cell is missing",
});
const missingForwardTargetEdgeRow: InvariantFailure = ({
  owner: "dataflow", query: null, origin: null, message: "forward target edge row is missing",
});
const missingForwardEdgeRow: InvariantFailure = ({
  owner: "dataflow", query: null, origin: null, message: "forward edge row is missing",
});
const missingEntry: InvariantFailure = ({
  owner: "dataflow", query: null, origin: null, message: "the body offers no entry for the supplied count",
});
const missingBackwardSuccessorCell: InvariantFailure = ({
  owner: "dataflow", query: null, origin: null, message: "backward successor cell is missing",
});

interface Cell<State> {
  readonly block: MirBlock;
  readonly vertex: GraphNode<MirBlock>;
  entry: State;
  exit: State;
}

interface StateBox<State> {
  readonly value: State;
}

interface ForwardEdges<State> {
  readonly item: WorkItem<State>;
  readonly inputs: Map<number, StateBox<State>>;
  readonly targets: Map<number, ForwardEdges<State>>;
}

interface WorkItem<State> {
  readonly rank: number;
  readonly cell: Cell<State>;
}

interface Queue<State> {
  readonly heap: WorkItem<State>[];
  readonly queued: Set<number>;
}

interface Context<State> {
  readonly meter: DataflowAccount;
  readonly cells: ReadonlyMap<number, Cell<State>>;
  readonly items: ReadonlyMap<number, WorkItem<State>>;
  readonly queue: Queue<State>;
  readonly reachable: ReadonlySet<number>;
  readonly start: number;
}

function enqueue<State>(queue: Queue<State>, item: WorkItem<State>): void {
  if (queue.queued.has(item.cell.vertex.index)) return;
  queue.queued.add(item.cell.vertex.index);
  let position = queue.heap.length;
  queue.heap.push(item);
  while (position > 0) {
    const parentPosition = Math.floor((position - 1) / 2);
    const parent = requirePresent(queue.heap[parentPosition], missingWorklistParent);
    if (parent.rank <= item.rank) break;
    queue.heap[position] = parent;
    position = parentPosition;
  }
  queue.heap[position] = item;
}

function dequeue<State>(queue: Queue<State>): WorkItem<State> {
  const first = requirePresent(queue.heap[0], missingWorklistCell);
  const last = requirePresent(queue.heap.pop(), missingWorklistTail);
  queue.queued.delete(first.cell.vertex.index);
  if (queue.heap.length > 0) {
    let position = 0;
    while (position * 2 + 1 < queue.heap.length) {
      const leftPosition = position * 2 + 1;
      const rightPosition = leftPosition + 1;
      const left = requirePresent(queue.heap[leftPosition], missingWorklistLeftChild);
      let child = left;
      let childPosition = leftPosition;
      if (rightPosition < queue.heap.length) {
        const right = requirePresent(queue.heap[rightPosition], missingWorklistRightChild);
        if (right.rank < left.rank) {
          child = right;
          childPosition = rightPosition;
        }
      }
      if (last.rank <= child.rank) break;
      queue.heap[position] = child;
      position = childPosition;
    }
    queue.heap[position] = last;
  }
  return first;
}

function schedule<State>(context: Context<State>, index: number): void {
  const item = context.items.get(index);
  if (item !== undefined) enqueue(context.queue, item);
}

function checkState<State>(lattice: Lattice<State>, state: State, meter: DataflowAccount): DataflowStop | null {
  const stop = takeWork(meter);
  if (stop !== null) return stop;
  const overflow = lattice.isOverflow(state, meter);
  return failureOf(meter) ?? (overflow ? stopState(meter, lattice.stateBound) : null);
}

function equalStates<State>(lattice: Lattice<State>, left: State, right: State, meter: DataflowAccount): DataflowResult<boolean> {
  const stop = takeWork(meter);
  if (stop !== null) return stop;
  const value = lattice.equals(left, right, meter);
  return failureOf(meter) ?? { kind: "complete", value };
}

function joined<State>(lattice: Lattice<State>, left: State, right: State, meter: DataflowAccount): DataflowResult<State> {
  const workStop = takeWork(meter);
  if (workStop !== null) return workStop;
  const value = lattice.join(left, right, meter);
  const stateStop = failureOf(meter) ?? checkState(lattice, value, meter);
  if (stateStop !== null) return stateStop;
  return { kind: "complete", value };
}

function transferred<State>(problem: Problem<State>, statement: MirStatement, state: State, meter: DataflowAccount): DataflowResult<State> {
  const workStop = takeWork(meter);
  if (workStop !== null) return workStop;
  const value = problem.statement(statement, state, meter);
  const stateStop = failureOf(meter) ?? checkState(problem.lattice, value, meter);
  if (stateStop !== null) return stateStop;
  return { kind: "complete", value };
}

function createContext<State>(
  graph: GraphView<MirBlock>,
  traversal: Traversal<MirBlock>,
  start: number,
  problem: Problem<State>,
  meter: DataflowAccount,
): DataflowResult<Context<State>> {
  const cells = new Map<number, Cell<State>>();
  let boundaryChecked = false;
  for (const vertex of graph.nodes) {
    const rowStop = takeWork(meter);
    if (rowStop !== null) return rowStop;
    if (vertex.index === start) {
      const bottomStop = checkState(problem.lattice, problem.lattice.bottom, meter);
      if (bottomStop !== null) return bottomStop;
    }
    const boundaryApplies = problem.direction === "forward" ? vertex.index === start : vertex.successors.length === 0;
    if (!boundaryChecked && traversal.reached.has(vertex.index) && boundaryApplies) {
      const boundaryStop = checkState(problem.lattice, problem.boundary, meter);
      if (boundaryStop !== null) return boundaryStop;
      boundaryChecked = true;
    }
    cells.set(vertex.index, { vertex, block: vertex.value,
      entry: problem.lattice.bottom, exit: problem.lattice.bottom });
  }
  const queue: Queue<State> = { heap: [], queued: new Set<number>() };
  const items = new Map<number, WorkItem<State>>();
  const order = problem.direction === "forward" ? [...traversal.postorder].reverse() : traversal.postorder;
  for (const [rank, vertex] of order.entries()) {
    const stop = takeWork(meter, 1 + Math.ceil(Math.log2(queue.heap.length + 1)));
    if (stop !== null) return stop;
    const cell = requirePresent(cells.get(vertex.index), missingWorklistCell);
    const item = { rank, cell };
    items.set(vertex.index, item);
    enqueue(queue, item);
  }
  return { kind: "complete", value: { meter, cells, items, queue, reachable: traversal.reached, start } };
}

function forwardEdges<State>(context: Context<State>): DataflowResult<ReadonlyMap<number, ForwardEdges<State>>> {
  const edges = new Map<number, ForwardEdges<State>>();
  for (const item of context.items.values()) {
    const rowStop = takeWork(context.meter);
    if (rowStop !== null) return rowStop;
    edges.set(item.cell.vertex.index, { item, targets: new Map<number, ForwardEdges<State>>(), inputs: new Map<number, StateBox<State>>() });
  }
  for (const row of edges.values()) {
    for (const successor of row.item.cell.vertex.successors) {
      const edgeStop = takeWork(context.meter);
      if (edgeStop !== null) return edgeStop;
      row.targets.set(successor.index, requirePresent(edges.get(successor.index), missingForwardTargetEdgeRow));
    }
  }
  return { kind: "complete", value: edges };
}

function runQueue<State>(context: Context<State>, step: (cell: Cell<State>) => DataflowStop | null): DataflowStop | null {
  while (context.queue.heap.length !== 0) {
    const workStop = takeWork(context.meter, 1 + 2 * Math.ceil(Math.log2(context.queue.heap.length)));
    if (workStop !== null) return workStop;
    const item = dequeue(context.queue);
    const stepStop = step(item.cell);
    if (stepStop !== null) return stepStop;
  }
  return null;
}

function forwardStep<State>(
  context: Context<State>,
  problem: ForwardProblem<State>,
  edges: ReadonlyMap<number, ForwardEdges<State>>,
  cell: Cell<State>,
): DataflowStop | null {
  const incoming = requirePresent(edges.get(cell.vertex.index), missingForwardEdgeRow);
  let state = problem.lattice.bottom;
  if (cell.vertex.index === context.start) {
    const boundary = joined(problem.lattice, state, problem.boundary, context.meter);
    if (boundary.kind !== "complete") return boundary;
    state = boundary.value;
  }
  for (const predecessor of cell.vertex.predecessors.values()) {
    const edgeStop = takeWork(context.meter);
    if (edgeStop !== null) return edgeStop;
    const input = incoming.inputs.get(predecessor.index);
    if (input === undefined) continue;
    const merged = joined(problem.lattice, state, input.value, context.meter);
    if (merged.kind !== "complete") return merged;
    state = merged.value;
  }
  cell.entry = state;
  for (let position = 0; position < cell.block.statements.length; position += 1) {
    const statement = requireCallerValue(cell.block.statements[position], `statement ${position}`);
    const result = transferred(problem, statement, state, context.meter);
    if (result.kind !== "complete") return result;
    state = result.value;
  }
  cell.exit = state;
  const terminatorWork = takeWork(context.meter);
  if (terminatorWork !== null) return terminatorWork;
  const outputs = problem.terminator(cell.block.terminator, state, context.meter);
  const callbackStop = failureOf(context.meter);
  if (callbackStop !== null) return callbackStop;
  const next = new Map<number, StateBox<State>>();
  for (let position = 0; position < outputs.length; position += 1) {
    const edgeStop = takeWork(context.meter);
    if (edgeStop !== null) return edgeStop;
    const output = requireCallerValue(outputs[position], `terminator edge ${position}`);
    if (!incoming.targets.has(output.target)) {
      throw new TypeError(`forward terminator target ${output.target} is not an outgoing edge`);
    }
    const stateStop = checkState(problem.lattice, output.state, context.meter);
    if (stateStop !== null) return stateStop;
    const previous = next.get(output.target);
    if (previous === undefined) next.set(output.target, { value: output.state });
    else {
      const merged = joined(problem.lattice, previous.value, output.state, context.meter);
      if (merged.kind !== "complete") return merged;
      next.set(output.target, { value: merged.value });
    }
  }
  for (const target of incoming.targets.values()) {
    const edgeStop = takeWork(context.meter);
    if (edgeStop !== null) return edgeStop;
    const inputs = target.inputs;
    const previous = inputs.get(cell.vertex.index);
    const current = next.get(target.item.cell.vertex.index);
    let previousState = problem.lattice.bottom;
    let currentState = problem.lattice.bottom;
    if (previous !== undefined) previousState = previous.value;
    if (current === undefined) inputs.delete(cell.vertex.index);
    else {
      currentState = current.value;
      inputs.set(cell.vertex.index, current);
    }
    const equal = equalStates(problem.lattice, previousState, currentState, context.meter);
    if (equal.kind !== "complete") return equal;
    if (!equal.value) {
      const queueStop = takeWork(context.meter, 1 + Math.ceil(Math.log2(context.queue.heap.length + 1)));
      if (queueStop !== null) return queueStop;
      enqueue(context.queue, target.item);
    }
  }
  return null;
}

function backwardStep<State>(context: Context<State>, problem: BackwardProblem<State>, cell: Cell<State>): DataflowStop | null {
  const successors: BlockState<State>[] = [];
  let exit = problem.lattice.bottom;
  for (const successor of cell.vertex.successors) {
    const edgeStop = takeWork(context.meter);
    if (edgeStop !== null) return edgeStop;
    const target = requirePresent(context.cells.get(successor.index), missingBackwardSuccessorCell);
    successors.push({ target: target.block.id, state: target.entry });
    const merged = joined(problem.lattice, exit, target.entry, context.meter);
    if (merged.kind !== "complete") return merged;
    exit = merged.value;
  }
  if (successors.length === 0) {
    const boundary = joined(problem.lattice, exit, problem.boundary, context.meter);
    if (boundary.kind !== "complete") return boundary;
    exit = boundary.value;
  }
  cell.exit = exit;
  const terminatorWork = takeWork(context.meter);
  if (terminatorWork !== null) return terminatorWork;
  let state = problem.terminator(cell.block.terminator, successors,
    successors.length === 0 ? problem.boundary : null, context.meter);
  const terminatorStop = failureOf(context.meter) ?? checkState(problem.lattice, state, context.meter);
  if (terminatorStop !== null) return terminatorStop;
  for (let position = cell.block.statements.length - 1; position >= 0; position -= 1) {
    const statement = requireCallerValue(cell.block.statements[position], `statement ${position}`);
    const result = transferred(problem, statement, state, context.meter);
    if (result.kind !== "complete") return result;
    state = result.value;
  }
  const previous = cell.entry;
  cell.entry = state;
  const equal = equalStates(problem.lattice, previous, state, context.meter);
  if (equal.kind !== "complete") return equal;
  if (!equal.value) {
    for (const predecessor of cell.vertex.predecessors.values()) {
      const edgeStop = takeWork(context.meter);
      if (edgeStop !== null) return edgeStop;
      const queueStop = takeWork(context.meter, 1 + Math.ceil(Math.log2(context.queue.heap.length + 1)));
      if (queueStop !== null) return queueStop;
      schedule(context, predecessor.index);
    }
  }
  return null;
}

function solveDirection<State>(context: Context<State>, problem: Problem<State>): DataflowStop | null {
  switch (problem.direction) {
    case "forward": {
      const edges = forwardEdges(context);
      if (edges.kind !== "complete") return edges;
      return runQueue(context, cell => forwardStep(context, problem, edges.value, cell));
    }
    case "backward": return runQueue(context, cell => backwardStep(context, problem, cell));
  }
}

export function solveProblem<State>(
  body: MirBody,
  provided: number,
  problem: Problem<State>,
  meter: DataflowAccount,
): DataflowResult<FlowSolution<State>> {
  const priorStop = takeWork(meter, 0);
  if (priorStop !== null) return priorStop;
  checkMaximum(problem.lattice.stateBound, "stateBound");
  const entryStop = takeEntries(meter, body.blocks.length * 3);
  if (entryStop !== null) return entryStop;
  const graph = buildMirGraph(body, meter);
  if (graph.kind !== "complete") return graph;
  // The body must offer an entry for the supplied count; no other block stands in for it.
  let selected: MirBody["entries"][number] | undefined;
  for (const entry of body.entries) {
    const stop = takeWork(meter);
    if (stop !== null) return stop;
    if (Object.is(entry.provided, provided)) { selected = entry; break; }
  }
  const start = requirePresent(selected, missingEntry).block;
  const traversal = walkGraph(graph.value, [start], meter, false);
  if (traversal.kind !== "complete") return traversal;
  const context = createContext(graph.value, traversal.value, start, problem, meter);
  if (context.kind !== "complete") return context;
  const stop = solveDirection(context.value, problem);
  if (stop !== null) return stop;
  const entryStates: State[] = [];
  const exitStates: State[] = [];
  const reachable: boolean[] = [];
  for (const cell of context.value.cells.values()) {
    const stop = takeWork(meter);
    if (stop !== null) return stop;
    entryStates.push(cell.entry);
    exitStates.push(cell.exit);
    reachable.push(context.value.reachable.has(cell.vertex.index));
  }
  return { kind: "complete", value: { entry: entryStates, exit: exitStates, reachable } };
}
