// The forward problem of the Origins kernel over `dataflow.solve` (origins chapter 9b.1, 9b.2; COMPONENTS row 1496:
// "the Dataflow foundation is the solver"). The state at a position maps cells to values; a value is the set of
// producers it may be and whether it may be absent. Join is union, so every transfer is monotone.
//
// Producers are interned: each canonical key gets a dense provisional number when first seen (R5 BA-4), the solve
// works on sorted number sets, and the arena renumbers by sorted canonical key at close (R6 G-5), so the arena does
// not depend on how the lowered graph numbers its blocks.
//
// Cells: a local's own slot (cell -1 - local), and the cell under a producer reached by one projection segment,
// numbered as the projected producer. A cell with no entry in the map holds its default: for a local of the receiver
// or a parameter, its entry producer; for a cell under an entry producer, the entry symbol (the projected producer
// itself); for any other cell, nothing.
//
// Elements (R6 O-2). Under one producer, a constant index i has its own cell and every other element position shares
// the element cell `e`. A store at index i adds to cell i; a store at a dynamic index, and an array literal's
// elements, add to `e`. A read at index i is cell i together with what was written into `e`; a read at a dynamic
// index is `e` together with what was written into every constant-index cell. "What was written" is a cell's content
// without its own entry symbol, which the other cell's own entry symbol already stands for.
//
// States (R5 OR-1). A transfer owns the state it is building: the first store of a block copies the map once, later
// stores of the same block change that copy in place. A state that leaves through a terminator is sealed (the
// kernel's stamp moves on), so no later store changes a state the solver holds.
//
// The call-free kernel (unit O-1a). A record that needs a family not written yet is a named compiler-development
// frontier (R6 G-3, G-4, G-7): statics (the uncontrolled-time symbol is not in the Facts record yet), calls, invokes
// and suspensions, closures, `address-of`, a place through `deref`, the `capture` projection, captured locations,
// definition and metadata constants, a non-scalar operation result, and a handled check failure.
import type { InvariantFailure } from "../../diag/contract.js";
import { requirePresent, resourceLimitDiagnostic } from "../../diag/index.js";
import type { Origin, TyId } from "../../ids/contract.js";
import type { BlockState, CallerRefusal, DataflowAccount, ForwardProblem, Lattice } from "../../dataflow/contract.js";
import { accountFailure, chargeWork, refuseAccount } from "../../dataflow/index.js";
import type { MirConstant, MirLocal, MirOperand, MirPlace, MirProjection, MirRvalue, MirStatement, MirTerminator } from "../../ir-mir/contract.js";
import type { Execution, TypeOf } from "../../ir-types/contract.js";
import { executionKey } from "../../ir-types/index.js";
import type { ProducerSpec, SegmentSpec } from "./keys.js";
import { childSpec, fieldSegment, frontier, memberWork, representativeKey, rootSpec, segmentWork } from "./keys.js";

export interface Value {
  // Sorted provisional producer numbers.
  readonly producers: readonly number[];
  readonly absent: boolean;
}

export interface State {
  readonly reached: boolean;
  readonly cells: Map<number, Value>;
  // The kernel stamp of the transfer that owns this state; -1 for a state no transfer owns (entry, join, bottom).
  readonly stamp: number;
}

// Records the MIR verifier guarantees; a miss is a defect of the caller or of the kernel, not a frontier.
const defect = (message: string): InvariantFailure => ({ owner: "analyses/origins", query: null, origin: null, message: `origins: ${message}` });
const unknownLocal = (): InvariantFailure => defect("a record names a local that is not a local of the body");
const unknownPlace = (): InvariantFailure => defect("a record names a place that is not a place of the body");
const unknownConstant = (): InvariantFailure => defect("an operand names a constant that is not a constant of the body");
const uninterned = (): InvariantFailure => defect("a cell or producer was used before it was interned");

export const EMPTY: Value = { producers: [], absent: false };
const ABSENT: Value = { producers: [], absent: true };

// The limits charged before the growth they bound (K-3366). Passing one refuses the run with the structured resource
// refusal: the value does not become open, a deep cell is not read as its parent's, and no truncated or partial fact
// is kept. Arena records and references are charged when the arena is closed, against exactly what it holds (R6
// O-3); interning is bounded by the solver's work, since each transfer interns at most the producers it touches.
export interface Charges {
  readonly maximumAlternatives: number;
  readonly maximumDepth: number;
}

export interface Exhaustion {
  readonly limit: "analysis.maximumOriginAlternatives" | "analysis.maximumProjectionDepth";
  readonly maximum: number;
  readonly origin: Origin | null;
}

export interface Kernel {
  readonly account: DataflowAccount;
  readonly execution: Execution;
  readonly locals: ReadonlyMap<number, MirLocal>;
  readonly places: ReadonlyMap<number, MirPlace>;
  readonly constants: ReadonlyMap<number, MirConstant>;
  readonly typeOf: TypeOf;
  readonly charges: Charges;
  // The interned producers: provisional number -> spec, and canonical key -> provisional number.
  readonly specs: ProducerSpec[];
  readonly numbers: Map<string, number>;
  // Each producer's interned constant-index children (R5 OR-2), so a dynamic index reads them directly.
  readonly indexChildren: Map<number, number[]>;
  // The stamp of the transfer now running; moved on whenever a state leaves through a terminator.
  stamp: number;
}

export const originRefusal = (execution: Execution, limit: string, maximum: number, origin: Origin | null): CallerRefusal => ({
  kind: "refused", diagnostics: [resourceLimitDiagnostic({ owner: "analyses/origins", limit, maximum,
    site: origin === null ? { kind: "none" } : { kind: "source", origin },
    unit: { request: { query: "analyses/origins.values", key: executionKey(execution) }, position: { kind: "result" } } })],
});

const stopped = (kernel: Kernel): boolean => accountFailure(kernel.account) !== null;

const exhaust = (kernel: Kernel, exhaustion: Exhaustion): void => {
  refuseAccount(kernel.account, originRefusal(kernel.execution, exhaustion.limit, exhaustion.maximum, exhaustion.origin));
};

export const takeOriginWork = (kernel: Kernel, units = 1): boolean => chargeWork(kernel.account, units) === null;

const intern = (kernel: Kernel, spec: ProducerSpec): number | null => {
  if (!takeOriginWork(kernel, 1 + spec.key.length)) return null;
  const known = kernel.numbers.get(spec.key);
  if (known !== undefined) {
    const previous = requirePresent(kernel.specs[known], uninterned());
    if (!segmentWork(kernel.account, spec.segment) || !segmentWork(kernel.account, previous.segment)) return null;
    if (representativeKey(spec.segment) < representativeKey(previous.segment)) kernel.specs[known] = spec;
    return known;
  }
  kernel.numbers.set(spec.key, kernel.specs.length);
  kernel.specs.push(spec);
  return kernel.specs.length - 1;
};

const sameValue = (kernel: Kernel, left: Value, right: Value): boolean =>
  left.absent === right.absent && left.producers.length === right.producers.length
    && takeOriginWork(kernel, left.producers.length)
    && left.producers.every((producer, index) => producer === right.producers[index]);

const isEmpty = (value: Value): boolean => value.producers.length === 0 && !value.absent;

// Charged before the merged set is built: its size is counted first; over the limit the run is exhausted and the
// left value is returned unchanged.
const union = (kernel: Kernel, left: Value, right: Value, origin: Origin | null): Value => {
  if (stopped(kernel)) return left;
  if (!takeOriginWork(kernel, 1 + left.producers.length + right.producers.length)) return left;
  let count = left.producers.length;
  let position = 0;
  for (const producer of right.producers) {
    while (position < left.producers.length && Number(left.producers[position]) < producer) position += 1;
    if (left.producers[position] !== producer) count += 1;
    if (count > kernel.charges.maximumAlternatives) {
      exhaust(kernel, { limit: "analysis.maximumOriginAlternatives", maximum: kernel.charges.maximumAlternatives, origin });
      return left;
    }
  }
  const absent = left.absent || right.absent;
  if (count === left.producers.length && absent === left.absent) return left;
  const producers: number[] = [];
  if (!takeOriginWork(kernel, count)) return left;
  let leftPosition = 0;
  let rightPosition = 0;
  while (leftPosition < left.producers.length || rightPosition < right.producers.length) {
    const first = left.producers[leftPosition];
    const second = right.producers[rightPosition];
    if (second === undefined || first !== undefined && first < second) {
      producers.push(Number(first));
      leftPosition += 1;
    } else {
      producers.push(second);
      rightPosition += 1;
      if (first === second) leftPosition += 1;
    }
  }
  return { producers, absent };
};

const admitsProducer = (kernel: Kernel, origin: Origin): boolean => {
  if (kernel.charges.maximumAlternatives >= 1) return true;
  exhaust(kernel, { limit: "analysis.maximumOriginAlternatives", maximum: kernel.charges.maximumAlternatives, origin });
  return false;
};

const scalarType = (kernel: Kernel, type: TyId): boolean => {
  let current = type;
  while (takeOriginWork(kernel)) {
    const term = kernel.typeOf(current);
    switch (term.kind) {
      case "primitive": case "enum": case "string": return true;
      case "literal": current = term.base; break;
      default: return false;
    }
  }
  return false;
};

// C1: a value of a primitive, string, enum or literal type refers to no storage; its origins are the empty set.
export const isScalar = (kernel: Kernel, place: MirPlace): boolean => scalarType(kernel, place.storage);

const entryRoot = (local: MirLocal): ProducerSpec | null => {
  switch (local.role.kind) {
    case "receiver": return rootSpec({ kind: "receiver" });
    case "parameter": return rootSpec({ kind: "parameter", index: local.role.index });
    default: return null;
  }
};

// The entry value of a local present on entry, or nothing.
export const entryValue = (kernel: Kernel, local: MirLocal): Value => {
  if (!takeOriginWork(kernel, 1)) return EMPTY;
  const root = scalarType(kernel, local.storage) ? null : entryRoot(local);
  if (stopped(kernel)) return EMPTY;
  if (root === null || !admitsProducer(kernel, local.origin)) return EMPTY;
  const producer = intern(kernel, root);
  return producer === null ? EMPTY : { producers: [producer], absent: false };
};

const entryRooted = (kernel: Kernel, cell: number): boolean => requirePresent(kernel.specs[cell], uninterned()).root.kind !== "allocation";

const localCell = (local: number): number => -1 - local;

const requireLocal = (kernel: Kernel, id: number): MirLocal => requirePresent(kernel.locals.get(id), unknownLocal());

export const requirePlace = (kernel: Kernel, id: number): MirPlace => requirePresent(kernel.places.get(id), unknownPlace());

const defaultOf = (kernel: Kernel, cell: number): Value => {
  if (cell < 0) return entryValue(kernel, requireLocal(kernel, -1 - cell));
  return entryRooted(kernel, cell) ? { producers: [cell], absent: false } : EMPTY;
};

const content = (kernel: Kernel, state: State, cell: number): Value => state.cells.get(cell) ?? defaultOf(kernel, cell);

// What was written into a cell: its content without its own entry symbol.
const written = (kernel: Kernel, state: State, cell: number): Value => {
  const value = content(kernel, state, cell);
  if (!takeOriginWork(kernel, value.producers.length)) return EMPTY;
  return { producers: value.producers.filter(producer => producer !== cell), absent: value.absent };
};

const segmentOf = (kernel: Kernel, projection: Exclude<MirProjection, { readonly kind: "refined" }>, origin: Origin): SegmentSpec | null => {
  switch (projection.kind) {
    case "field": return memberWork(kernel.account, projection.member) ? fieldSegment(projection.member) : null;
    case "element": return { kind: "index", index: projection.index };
    case "index": return { kind: "element" };
    case "deref": return frontier(origin, "a place through deref is not analysed yet");
    case "capture": return frontier(origin, "the capture projection of a closure value is not analysed yet");
  }
};

// The cell under `parent` reached by `segment`, or null when the path would pass `maximumProjectionDepth`: the run
// is exhausted before the deeper path is made.
const childOf = (kernel: Kernel, parent: number, segment: SegmentSpec, origin: Origin): number | null => {
  const spec = requirePresent(kernel.specs[parent], uninterned());
  if (spec.depth + 1 > kernel.charges.maximumDepth) {
    exhaust(kernel, { limit: "analysis.maximumProjectionDepth", maximum: kernel.charges.maximumDepth, origin });
    return null;
  }
  if (!takeOriginWork(kernel, 1 + (segment.kind === "field" ? segment.key.length : 1))) return null;
  const child = childSpec(spec, parent, segment);
  const known = kernel.numbers.has(child.key);
  const cell = intern(kernel, child);
  if (cell === null) return null;
  if (!known && segment.kind === "index") {
    const children = kernel.indexChildren.get(parent) ?? [];
    children.push(cell);
    kernel.indexChildren.set(parent, children);
  }
  return cell;
};

// A read of one producer's cell by segment (see "Elements" above).
const readCell = (kernel: Kernel, state: State, parent: number, segment: SegmentSpec, origin: Origin): Value => {
  const cell = childOf(kernel, parent, segment, origin);
  if (cell === null) return EMPTY;
  switch (segment.kind) {
    case "field": return content(kernel, state, cell);
    case "index": {
      // The element cell is at the depth the index cell already passed.
      const element = intern(kernel, childSpec(requirePresent(kernel.specs[parent], uninterned()), parent, { kind: "element" }));
      if (element === null) return EMPTY;
      return union(kernel, content(kernel, state, cell), written(kernel, state, element), origin);
    }
    case "element": {
      let value = content(kernel, state, cell);
      for (const child of kernel.indexChildren.get(parent) ?? []) {
        if (!takeOriginWork(kernel, 1)) return EMPTY;
        value = union(kernel, value, written(kernel, state, child), origin);
        if (stopped(kernel)) return EMPTY;
      }
      return value;
    }
  }
};

export function readPlace(kernel: Kernel, state: State, place: MirPlace): Value {
  if (!takeOriginWork(kernel, 1)) return EMPTY;
  let pending: { readonly projection: Exclude<MirProjection, { readonly kind: "refined" }>; readonly origin: Origin }[] | null = null;
  let current = place;
  let parent = EMPTY;
  walk: for (;;) {
    if (isScalar(kernel, current)) break;
    if (stopped(kernel)) return EMPTY;
    const base = current.base;
    switch (base.kind) {
      case "local": {
        const local = requireLocal(kernel, base.local);
        if (local.role.kind === "capture") return frontier(current.origin, "a captured location is not analysed yet");
        parent = content(kernel, state, localCell(base.local));
        break walk;
      }
      case "static": return frontier(current.origin, "a static place needs the uncontrolled-time symbol, not in the Facts record yet");
      case "place": case "checked":
        if (base.projection.kind !== "refined") {
          pending ??= [];
          pending.push({ projection: base.projection, origin: current.origin });
        }
        if (!takeOriginWork(kernel, 1)) return EMPTY;
        current = requirePlace(kernel, base.place);
        break;
    }
  }
  if (stopped(kernel)) return EMPTY;
  if (pending !== null) for (let frame = pending.pop(); frame !== undefined; frame = pending.pop()) {
    const segment = segmentOf(kernel, frame.projection, frame.origin);
    if (segment === null) return EMPTY;
    let value = EMPTY;
    for (const producer of parent.producers) {
      if (!takeOriginWork(kernel, 1)) return EMPTY;
      value = union(kernel, value, readCell(kernel, state, producer, segment, frame.origin), frame.origin);
      if (stopped(kernel)) return EMPTY;
    }
    parent = value;
  }
  return parent;
}

export const readOperand = (kernel: Kernel, state: State, operand: MirOperand, origin: Origin): Value => {
  if (!takeOriginWork(kernel, 1)) return EMPTY;
  if (operand.kind === "place") return readPlace(kernel, state, requirePlace(kernel, operand.place));
  const constant = requirePresent(kernel.constants.get(operand.constant), unknownConstant());
  switch (constant.value.kind) {
    case "literal": return constant.value.value.kind === "absence" ? ABSENT : EMPTY;
    case "observation": case "constant": return EMPTY;
    case "definition": return frontier(origin, "a definition constant (a callable value) is not analysed yet");
    case "metadata": return frontier(origin, "a metadata constant is not analysed yet");
  }
};

// The state with one cell set: in place when the running transfer owns the state, else on one copy it then owns.
const withCell = (kernel: Kernel, state: State, cell: number, value: Value): State => {
  if (stopped(kernel)) return state;
  if (state.stamp === kernel.stamp) {
    if (!takeOriginWork(kernel)) return state;
    state.cells.set(cell, value);
    return state;
  }
  if (!takeOriginWork(kernel, state.cells.size + 1)) return state;
  const cells = new Map(state.cells);
  cells.set(cell, value);
  return { reached: true, cells, stamp: kernel.stamp };
};

// Adds a value to one producer's cell by segment. Storing nothing changes nothing, so it makes no cell (R6 O-3).
const addToCell = (kernel: Kernel, state: State, parent: number, segment: SegmentSpec, value: Value, origin: Origin): State => {
  if (stopped(kernel) || isEmpty(value)) return state;
  const cell = childOf(kernel, parent, segment, origin);
  return cell === null ? state : withCell(kernel, state, cell, union(kernel, content(kernel, state, cell), value, origin));
};

// A store to a local's own slot replaces it; a store to a cell under a producer adds to it (origins chapter 9b.3).
function writePlace(kernel: Kernel, state: State, place: MirPlace, value: Value): State {
  if (!takeOriginWork(kernel, 1)) return state;
  let current = place;
  for (;;) {
    if (isScalar(kernel, current)) return state;
    if (stopped(kernel)) return state;
    const base = current.base;
    switch (base.kind) {
      case "local": {
        const local = requireLocal(kernel, base.local);
        if (local.role.kind === "capture") return frontier(current.origin, "a captured location is not analysed yet");
        return withCell(kernel, state, localCell(base.local), value);
      }
      case "static": return frontier(current.origin, "a static place needs the uncontrolled-time symbol, not in the Facts record yet");
      case "place": case "checked": {
        if (base.projection.kind === "refined") {
          if (!takeOriginWork(kernel, 1)) return state;
          current = requirePlace(kernel, base.place);
          continue;
        }
        const parent = readPlace(kernel, state, requirePlace(kernel, base.place));
        if (stopped(kernel)) return state;
        const segment = segmentOf(kernel, base.projection, current.origin);
        if (segment === null) return state;
        let next = state;
        for (const producer of parent.producers) {
          if (!takeOriginWork(kernel, 1)) return state;
          next = addToCell(kernel, next, producer, segment, value, current.origin);
          if (stopped(kernel)) return state;
        }
        return next;
      }
    }
  }
}

function allocate(kernel: Kernel, state: State, statement: MirStatement, value: Extract<MirRvalue, { kind: "aggregate" }>): [State, Value] {
  if (!admitsProducer(kernel, statement.origin)) return [state, EMPTY];
  const producer = intern(kernel, rootSpec({ kind: "allocation", node: statement.tir.node }));
  if (producer === null) return [state, EMPTY];
  let next = state;
  const store = (segment: SegmentSpec, operand: MirOperand): void => {
    next = addToCell(kernel, next, producer, segment, readOperand(kernel, next, operand, statement.origin), statement.origin);
  };
  const aggregate = value.aggregate;
  switch (aggregate.kind) {
    case "object": case "record":
      for (const field of aggregate.fields) {
        if (!takeOriginWork(kernel, 1)) return [state, EMPTY];
        if (!memberWork(kernel.account, field.member)) return [state, EMPTY];
        store(fieldSegment(field.member), field.value);
        if (stopped(kernel)) return [state, EMPTY];
      }
      break;
    case "array":
      for (const element of aggregate.elements) {
        if (!takeOriginWork(kernel, 1)) return [state, EMPTY];
        store({ kind: "element" }, element);
        if (stopped(kernel)) return [state, EMPTY];
      }
      break;
    case "tuple": case "fixed-array":
      for (const [index, element] of aggregate.elements.entries()) {
        if (!takeOriginWork(kernel, 1)) return [state, EMPTY];
        store({ kind: "index", index }, element);
        if (stopped(kernel)) return [state, EMPTY];
      }
      break;
  }
  return [next, { producers: [producer], absent: false }];
}

function evaluate(kernel: Kernel, state: State, statement: MirStatement, destination: MirPlace, value: MirRvalue): [State, Value] {
  switch (value.kind) {
    case "use": return [state, readOperand(kernel, state, value.operand, statement.origin)];
    case "unary": case "binary": case "convert":
      if (isScalar(kernel, destination)) return [state, EMPTY];
      if (stopped(kernel)) return [state, EMPTY];
      return frontier(statement.origin, `a ${value.kind} operation with a non-scalar result is not analysed yet`);
    case "aggregate": return allocate(kernel, state, statement, value);
    case "address-of": return frontier(statement.origin, "address-of is not analysed yet");
    case "closure": return frontier(statement.origin, "a closure value is not analysed yet");
  }
}

export function transferStatement(kernel: Kernel, statement: MirStatement, state: State): State {
  if (!state.reached || stopped(kernel)) return state;
  if (!takeOriginWork(kernel, 1)) return state;
  switch (statement.kind) {
    case "assign": {
      const destination = requirePlace(kernel, statement.place);
      const [next, value] = evaluate(kernel, state, statement, destination, statement.value);
      if (stopped(kernel)) return state;
      return writePlace(kernel, next, destination, value);
    }
    case "storage-live": case "storage-dead":
      return withCell(kernel, state, localCell(statement.local), EMPTY);
  }
}

function edges(kernel: Kernel, terminator: MirTerminator, state: State): readonly BlockState<State>[] {
  switch (terminator.kind) {
    case "goto": return [{ target: terminator.target, state }];
    case "switch":
      if (!takeOriginWork(kernel, terminator.targets.length + 1)) return [];
      return [...terminator.targets.map(target => ({ target: target.target, state })), { target: terminator.otherwise, state }];
    case "check":
      if (terminator.unwind.kind === "handler") return frontier(terminator.origin, "a handled check failure is not analysed yet");
      return [{ target: terminator.next, state }];
    case "throw": {
      if (terminator.unwind.kind !== "handler") return [];
      const thrown = readOperand(kernel, state, terminator.operand, terminator.origin);
      if (stopped(kernel)) return [];
      const exception = requirePlace(kernel, terminator.unwind.exception);
      // The block's own state stays as the solver holds it: seal it first, so the store makes the handler edge a copy.
      seal(kernel);
      if (stopped(kernel)) return [];
      const handler = writePlace(kernel, state, exception, thrown);
      if (stopped(kernel)) return [];
      return [{ target: terminator.unwind.target, state: handler }];
    }
    case "return": case "unreachable": return [];
    case "call": case "invoke": case "await": case "yield": case "delegate":
      return frontier(terminator.origin, `a ${terminator.kind} terminator is not analysed yet (unit O-2 and later)`);
  }
}

// The states that leave through a terminator are sealed: the stamp moves on, so the next block copies before it stores.
export function transferTerminator(kernel: Kernel, terminator: MirTerminator, state: State): readonly BlockState<State>[] {
  if (!takeOriginWork(kernel, 1)) return [];
  const leaving = state.reached ? edges(kernel, terminator, state) : [];
  if (!stopped(kernel)) kernel.stamp += 1;
  return leaving;
}

// Seals every state handed out so far (the analysis calls it before it replays a block's statements for its rows).
export const seal = (kernel: Kernel): void => { if (takeOriginWork(kernel)) kernel.stamp += 1; };

const cellKeys = (left: State, right: State): Iterable<number> => (function* () {
  yield* left.cells.keys();
  for (const key of right.cells.keys()) if (!left.cells.has(key)) yield key;
})();

const sameState = (kernel: Kernel, left: State, right: State): boolean => {
  if (stopped(kernel)) return true;
  if (left.reached !== right.reached) return false;
  if (!takeOriginWork(kernel, left.cells.size + right.cells.size)) return true;
  for (const cell of cellKeys(left, right)) {
    if (!takeOriginWork(kernel)) return true;
    if (!sameValue(kernel, content(kernel, left, cell), content(kernel, right, cell))) return false;
  }
  return true;
};

// Join is cellwise union. A cell present in one state only is joined with the other's default for it.
const joinStates = (kernel: Kernel, left: State, right: State): State => {
  if (stopped(kernel)) return left;
  if (!left.reached) return right;
  if (!right.reached) return left;
  if (!takeOriginWork(kernel, left.cells.size + right.cells.size)) return left;
  const cells = new Map<number, Value>();
  for (const cell of cellKeys(left, right)) {
    if (!takeOriginWork(kernel)) return left;
    const value = union(kernel, content(kernel, left, cell), content(kernel, right, cell), null);
    if (stopped(kernel)) return left;
    cells.set(cell, value);
  }
  return { reached: true, cells, stamp: -1 };
};

export function originsProblem(kernel: Kernel, stateBound: number): ForwardProblem<State> {
  const bottom: State = { reached: false, cells: new Map<number, Value>(), stamp: -1 };
  const lattice: Lattice<State> = {
    bottom, overflow: bottom, stateBound,
    join: (left, right) => joinStates(kernel, left, right),
    equals: (left, right) => sameState(kernel, left, right),
    isOverflow: () => false,
  };
  return {
    direction: "forward", lattice, boundary: { reached: true, cells: new Map<number, Value>(), stamp: -1 },
    statement: (statement, state) => transferStatement(kernel, statement, state),
    terminator: (terminator, state) => transferTerminator(kernel, terminator, state),
  };
}
