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
// The call-free kernel (unit O-1a). A record that needs a family not written yet is a named compiler-development
// frontier (R6 G-3, G-4, G-7): statics (the uncontrolled-time symbol is not in the Facts record yet), calls, invokes
// and suspensions, closures, `address-of`, a place through `deref`, the `capture` projection, captured locations,
// definition and metadata constants, a non-scalar operation result, and a handled check failure.
import type { InvariantFailure } from "../../diag/contract.js";
import { requirePresent } from "../../diag/index.js";
import type { Origin } from "../../ids/contract.js";
import type { BlockState, ForwardProblem, Lattice } from "../../dataflow/contract.js";
import type { MirConstant, MirLocal, MirOperand, MirPlace, MirProjection, MirRvalue, MirStatement, MirTerminator } from "../../ir-mir/contract.js";
import type { TypeOf, TypeTerm } from "../../ir-types/contract.js";
import type { ProducerSpec, SegmentSpec } from "./keys.js";
import { childSpec, fieldSegment, frontier, rootSpec } from "./keys.js";

export interface Value {
  // Sorted provisional producer numbers.
  readonly producers: readonly number[];
  readonly absent: boolean;
}

export interface State {
  readonly reached: boolean;
  readonly cells: ReadonlyMap<number, Value>;
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
// is kept. A value open from complete evidence is a different thing; none arises in O-1a.
export interface Charges {
  readonly maximumAlternatives: number;
  readonly maximumDepth: number;
  readonly maximumRecords: number;
}

export interface Exhaustion {
  readonly limit: "analysis.maximumOriginAlternatives" | "analysis.maximumProjectionDepth" | "analysis.maximumRelationalRecordsPerBody";
  readonly maximum: number;
  readonly origin: Origin | null;
}

export interface Kernel {
  readonly locals: ReadonlyMap<number, MirLocal>;
  readonly places: ReadonlyMap<number, MirPlace>;
  readonly constants: ReadonlyMap<number, MirConstant>;
  readonly typeOf: TypeOf;
  readonly charges: Charges;
  // The interned producers: provisional number -> spec, and canonical key -> provisional number.
  readonly specs: ProducerSpec[];
  readonly numbers: Map<string, number>;
  // The first limit passed. Once set nothing grows, and the analysis returns the refusal.
  exhaustion: Exhaustion | null;
}

const exhaust = (kernel: Kernel, exhaustion: Exhaustion): void => {
  if (kernel.exhaustion === null) kernel.exhaustion = exhaustion;
};

// The provisional number of a producer, or null when interning it would pass the record limit (charged before the
// record is made).
const intern = (kernel: Kernel, spec: ProducerSpec, origin: Origin | null): number | null => {
  const known = kernel.numbers.get(spec.key);
  if (known !== undefined) return known;
  if (kernel.specs.length + 1 > kernel.charges.maximumRecords) {
    exhaust(kernel, { limit: "analysis.maximumRelationalRecordsPerBody", maximum: kernel.charges.maximumRecords, origin });
    return null;
  }
  kernel.numbers.set(spec.key, kernel.specs.length);
  kernel.specs.push(spec);
  return kernel.specs.length - 1;
};

const single = (producer: number | null): Value => producer === null ? EMPTY : { producers: [producer], absent: false };

const sameValue = (left: Value, right: Value): boolean =>
  left.absent === right.absent && left.producers.length === right.producers.length
    && left.producers.every((producer, index) => producer === right.producers[index]);

// Charged before the merged set is built: its size is counted first; over the limit the run is exhausted and the
// left value is returned unchanged.
const union = (kernel: Kernel, left: Value, right: Value, origin: Origin | null): Value => {
  if (kernel.exhaustion !== null) return left;
  const present = new Set(left.producers);
  const added = right.producers.filter(producer => !present.has(producer));
  if (left.producers.length + added.length > kernel.charges.maximumAlternatives) {
    exhaust(kernel, { limit: "analysis.maximumOriginAlternatives", maximum: kernel.charges.maximumAlternatives, origin });
    return left;
  }
  const absent = left.absent || right.absent;
  return added.length === 0 && absent === left.absent ? left
    : { producers: [...left.producers, ...added].sort((a, b) => a - b), absent };
};

const scalarTerm = (kernel: Kernel, term: TypeTerm): boolean => {
  switch (term.kind) {
    case "primitive": case "enum": case "string": return true;
    case "literal": return scalarTerm(kernel, kernel.typeOf(term.base));
    default: return false;
  }
};

// C1: a value of a primitive, string, enum or literal type refers to no storage; its origins are the empty set.
export const isScalar = (kernel: Kernel, place: MirPlace): boolean => scalarTerm(kernel, kernel.typeOf(place.storage));

const entryRoot = (local: MirLocal): ProducerSpec | null => {
  switch (local.role.kind) {
    case "receiver": return rootSpec({ kind: "receiver" });
    case "parameter": return rootSpec({ kind: "parameter", index: local.role.index });
    default: return null;
  }
};

// The entry value of a local present on entry, or nothing.
export const entryValue = (kernel: Kernel, local: MirLocal): Value => {
  const root = scalarTerm(kernel, kernel.typeOf(local.storage)) ? null : entryRoot(local);
  return root === null ? EMPTY : single(intern(kernel, root, local.origin));
};

const cellDefault = (kernel: Kernel, cell: number): Value => {
  const spec = requirePresent(kernel.specs[cell], uninterned());
  return spec.root.kind === "allocation" ? EMPTY : { producers: [cell], absent: false };
};

const localCell = (local: number): number => -1 - local;

const requireLocal = (kernel: Kernel, id: number): MirLocal => requirePresent(kernel.locals.get(id), unknownLocal());

export const requirePlace = (kernel: Kernel, id: number): MirPlace => requirePresent(kernel.places.get(id), unknownPlace());

const defaultOf = (kernel: Kernel, cell: number): Value =>
  cell < 0 ? entryValue(kernel, requireLocal(kernel, -1 - cell)) : cellDefault(kernel, cell);

const content = (kernel: Kernel, state: State, cell: number): Value => state.cells.get(cell) ?? defaultOf(kernel, cell);

const segmentOf = (projection: Exclude<MirProjection, { readonly kind: "refined" }>, origin: Origin): SegmentSpec => {
  switch (projection.kind) {
    case "field": return fieldSegment(projection.member);
    case "element": return { kind: "index", index: projection.index };
    case "index": return { kind: "element" };
    case "deref": return frontier(origin, "a place through deref is not analysed yet");
    case "capture": return frontier(origin, "the capture projection of a closure value is not analysed yet");
  }
};

// The cell under `parent` reached by `segment`, or null when the path would pass `maximumProjectionDepth` or the
// record limit: the run is exhausted before the deeper path is made.
const childOf = (kernel: Kernel, parent: number, segment: SegmentSpec, origin: Origin): number | null => {
  const spec = requirePresent(kernel.specs[parent], uninterned());
  if (spec.segments.length + 1 > kernel.charges.maximumDepth) {
    exhaust(kernel, { limit: "analysis.maximumProjectionDepth", maximum: kernel.charges.maximumDepth, origin });
    return null;
  }
  return intern(kernel, childSpec(spec, segment), origin);
};

// The cells a dynamic index can reach under one producer: its `element` cell and every constant-index cell written.
const dynamicCells = (kernel: Kernel, state: State, parent: number, origin: Origin): readonly number[] => {
  const element = childOf(kernel, parent, { kind: "element" }, origin);
  const prefix = `${requirePresent(kernel.specs[parent], uninterned()).key}/i`;
  const indexChild = (key: string): boolean => key.startsWith(prefix) && !key.slice(prefix.length).includes("/");
  const written = [...state.cells.keys()].filter(cell => cell >= 0 && indexChild(requirePresent(kernel.specs[cell], uninterned()).key));
  return element === null ? written : [element, ...written];
};

const reachedCells = (kernel: Kernel, state: State, parent: number, segment: SegmentSpec, origin: Origin): readonly number[] => {
  if (segment.kind === "element") return dynamicCells(kernel, state, parent, origin);
  const cell = childOf(kernel, parent, segment, origin);
  return cell === null ? [] : [cell];
};

export function readPlace(kernel: Kernel, state: State, place: MirPlace): Value {
  if (isScalar(kernel, place)) return EMPTY;
  const base = place.base;
  switch (base.kind) {
    case "local": {
      const local = requireLocal(kernel, base.local);
      if (local.role.kind === "capture") return frontier(place.origin, "a captured location is not analysed yet");
      return content(kernel, state, localCell(base.local));
    }
    case "static": return frontier(place.origin, "a static place needs the uncontrolled-time symbol, not in the Facts record yet");
    case "place": case "checked": {
      // A refined view denotes its parent's storage: the same cell, the same value.
      if (base.projection.kind === "refined") return readPlace(kernel, state, requirePlace(kernel, base.place));
      const parent = readPlace(kernel, state, requirePlace(kernel, base.place));
      const segment = segmentOf(base.projection, place.origin);
      let value = EMPTY;
      for (const producer of parent.producers) {
        for (const cell of reachedCells(kernel, state, producer, segment, place.origin)) {
          value = union(kernel, value, content(kernel, state, cell), place.origin);
        }
      }
      return value;
    }
  }
}

export const readOperand = (kernel: Kernel, state: State, operand: MirOperand, origin: Origin): Value => {
  if (operand.kind === "place") return readPlace(kernel, state, requirePlace(kernel, operand.place));
  const constant = requirePresent(kernel.constants.get(operand.constant), unknownConstant());
  switch (constant.value.kind) {
    case "literal": return constant.value.value.kind === "absence" ? ABSENT : EMPTY;
    case "observation": case "constant": return EMPTY;
    case "definition": return frontier(origin, "a definition constant (a callable value) is not analysed yet");
    case "metadata": return frontier(origin, "a metadata constant is not analysed yet");
  }
};

const withCell = (state: State, cell: number, value: Value): State => {
  const cells = new Map(state.cells);
  cells.set(cell, value);
  return { reached: true, cells };
};

// A store to a local's own slot replaces it; a store to a cell under a producer adds to it (origins chapter 9b.3).
function writePlace(kernel: Kernel, state: State, place: MirPlace, value: Value): State {
  if (isScalar(kernel, place)) return state;
  const base = place.base;
  switch (base.kind) {
    case "local": {
      const local = requireLocal(kernel, base.local);
      if (local.role.kind === "capture") return frontier(place.origin, "a captured location is not analysed yet");
      return withCell(state, localCell(base.local), value);
    }
    case "static": return frontier(place.origin, "a static place needs the uncontrolled-time symbol, not in the Facts record yet");
    case "place": case "checked": {
      if (base.projection.kind === "refined") return writePlace(kernel, state, requirePlace(kernel, base.place), value);
      const parent = readPlace(kernel, state, requirePlace(kernel, base.place));
      const segment = segmentOf(base.projection, place.origin);
      let next = state;
      for (const producer of parent.producers) {
        for (const cell of reachedCells(kernel, next, producer, segment, place.origin)) {
          next = withCell(next, cell, union(kernel, content(kernel, next, cell), value, place.origin));
        }
      }
      return next;
    }
  }
}

function allocate(kernel: Kernel, state: State, statement: MirStatement, value: Extract<MirRvalue, { kind: "aggregate" }>): [State, Value] {
  const producer = intern(kernel, rootSpec({ kind: "allocation", node: statement.tir.node }), statement.origin);
  if (producer === null) return [state, EMPTY];
  let next = state;
  const store = (segment: SegmentSpec, operand: MirOperand): void => {
    const cell = childOf(kernel, producer, segment, statement.origin);
    if (cell === null) return;
    next = withCell(next, cell, union(kernel, content(kernel, next, cell), readOperand(kernel, next, operand, statement.origin), statement.origin));
  };
  const aggregate = value.aggregate;
  switch (aggregate.kind) {
    case "object": case "record":
      for (const field of aggregate.fields) store(fieldSegment(field.member), field.value);
      break;
    case "array":
      for (const element of aggregate.elements) store({ kind: "element" }, element);
      break;
    case "tuple": case "fixed-array":
      aggregate.elements.forEach((element, index) => { store({ kind: "index", index }, element); });
      break;
  }
  return [next, single(producer)];
}

function evaluate(kernel: Kernel, state: State, statement: MirStatement, destination: MirPlace, value: MirRvalue): [State, Value] {
  switch (value.kind) {
    case "use": return [state, readOperand(kernel, state, value.operand, statement.origin)];
    case "unary": case "binary": case "convert":
      if (isScalar(kernel, destination)) return [state, EMPTY];
      return frontier(statement.origin, `a ${value.kind} operation with a non-scalar result is not analysed yet`);
    case "aggregate": return allocate(kernel, state, statement, value);
    case "address-of": return frontier(statement.origin, "address-of is not analysed yet");
    case "closure": return frontier(statement.origin, "a closure value is not analysed yet");
  }
}

export function transferStatement(kernel: Kernel, statement: MirStatement, state: State): State {
  if (!state.reached || kernel.exhaustion !== null) return state;
  switch (statement.kind) {
    case "assign": {
      const destination = requirePlace(kernel, statement.place);
      const [next, value] = evaluate(kernel, state, statement, destination, statement.value);
      return writePlace(kernel, next, destination, value);
    }
    case "storage-live": case "storage-dead":
      return withCell(state, localCell(statement.local), EMPTY);
  }
}

export function transferTerminator(kernel: Kernel, terminator: MirTerminator, state: State): readonly BlockState<State>[] {
  if (!state.reached) return [];
  switch (terminator.kind) {
    case "goto": return [{ target: terminator.target, state }];
    case "switch": return [...terminator.targets.map(target => ({ target: target.target, state })), { target: terminator.otherwise, state }];
    case "check":
      if (terminator.unwind.kind === "handler") return frontier(terminator.origin, "a handled check failure is not analysed yet");
      return [{ target: terminator.next, state }];
    case "throw": {
      if (terminator.unwind.kind !== "handler") return [];
      const thrown = readOperand(kernel, state, terminator.operand, terminator.origin);
      const exception = requirePlace(kernel, terminator.unwind.exception);
      return [{ target: terminator.unwind.target, state: writePlace(kernel, state, exception, thrown) }];
    }
    case "return": case "unreachable": return [];
    case "call": case "invoke": case "await": case "yield": case "delegate":
      return frontier(terminator.origin, `a ${terminator.kind} terminator is not analysed yet (unit O-2 and later)`);
  }
}

const cellKeys = (left: State, right: State): ReadonlySet<number> => new Set([...left.cells.keys(), ...right.cells.keys()]);

const sameState = (kernel: Kernel, left: State, right: State): boolean => {
  if (left.reached !== right.reached) return false;
  for (const cell of cellKeys(left, right)) if (!sameValue(content(kernel, left, cell), content(kernel, right, cell))) return false;
  return true;
};

// Join is cellwise union. A cell present in one state only is joined with the other's default for it.
const joinStates = (kernel: Kernel, left: State, right: State): State => {
  if (!left.reached) return right;
  if (!right.reached) return left;
  const cells = new Map<number, Value>();
  for (const cell of cellKeys(left, right)) cells.set(cell, union(kernel, content(kernel, left, cell), content(kernel, right, cell), null));
  return { reached: true, cells };
};

export function originsProblem(kernel: Kernel, stateBound: number): ForwardProblem<State> {
  const bottom: State = { reached: false, cells: new Map<number, Value>() };
  const lattice: Lattice<State> = {
    bottom, overflow: bottom, stateBound,
    join: (left, right) => joinStates(kernel, left, right),
    equals: (left, right) => sameState(kernel, left, right),
    isOverflow: () => false,
  };
  return {
    direction: "forward", lattice, boundary: { reached: true, cells: new Map<number, Value>() },
    statement: (statement, state) => transferStatement(kernel, statement, state),
    terminator: (terminator, state) => transferTerminator(kernel, terminator, state),
  };
}
