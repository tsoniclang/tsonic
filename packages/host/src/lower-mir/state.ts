import type { InvariantFailure } from "../diag/contract.js";
import { throwInvariant } from "../diag/index.js";
import type { BlockId, BodyId, DefId, LocalId, LocalRef, Origin, PlaceId, TyId } from "../ids/contract.js";
import { blockId, constId, localId, placeId } from "../ids/index.js";
import type { ArtifactBindings } from "../ir-types/contract.js";
import type {
  MirBlock, MirBody, MirConstantValue, MirCopyOps, MirEntry, MirKeyedConstant, MirLocal, MirLocalRole, MirLocalStorageMode, MirOperand,
  MirPlace, MirPlaceBase, MirSite, MirStatement, MirTerminator,
} from "../ir-mir/contract.js";
import { constantKeyOfMir, projectMirConstantOrdinals, projectMirValues } from "../ir-mir/index.js";
import type { LowerMirLimits } from "./contract.js";

const invariant = (message: string): InvariantFailure => ({ owner: "lower-mir", query: null, origin: null, message });

export interface ReadAnchor {
  readonly kind: "read-anchor";
  statements: MirStatement[] | null;
}

interface OpenBlock {
  readonly id: BlockId;
  readonly site: MirSite;
  readonly statements: (MirStatement | ReadAnchor)[];
  terminator: MirTerminator | null;
}

/** The output of one lowering while it grows. It lives for one call and is dropped when the body is assembled. */
export interface LowerState {
  readonly body: BodyId;
  readonly bindings: ArtifactBindings;
  readonly result: TyId;
  readonly limits: LowerMirLimits;
  readonly locals: MirLocal[];
  readonly places: MirPlace[];
  readonly localPlaces: Map<LocalId, PlaceId>;
  readonly staticPlaces: Map<DefId, PlaceId>;
  readonly constants: Map<string, MirKeyedConstant>;
  readonly blocks: OpenBlock[];
  readonly entries: MirEntry[];
  indexChecks: { epoch: number; readonly exposed: ReadonlySet<LocalId>; readonly writes: Map<LocalId, number> } | null;
  records: number;
  /**
   * The next record would have passed the size limit. From then on every primitive answers null and records nothing,
   * and `finishBody` gives no body: the lowering ends in its one refusal and no partly recorded graph leaves it.
   */
  refused: boolean;
  current: OpenBlock | null;
}

export function createState(body: BodyId, bindings: ArtifactBindings, result: TyId, limits: LowerMirLimits): LowerState {
  return { body, bindings, result, limits, locals: [], places: [], localPlaces: new Map(), staticPlaces: new Map(), constants: new Map(), blocks: [],
    entries: [], indexChecks: null, records: 0, refused: false, current: null };
}

export interface IndexCheckStamp {
  readonly epoch: number;
  readonly local: LocalId | null;
  readonly version: number;
}

export function indexCheckStamp(state: LowerState, exposed: ReadonlySet<LocalId>, local: LocalId | null): IndexCheckStamp {
  const checks = state.indexChecks ??= { epoch: 0, exposed, writes: new Map() };
  if (local !== null && !checks.writes.has(local)) checks.writes.set(local, 0);
  return { epoch: checks.epoch, local, version: local === null ? 0 : checks.writes.get(local) ?? 0 };
}

export function indexCheckChange(state: LowerState, stamp: IndexCheckStamp): "unchanged" | "mutable" | "root" {
  const checks = state.indexChecks;
  if (checks === null) return throwInvariant(invariant("a saved check requires its actual lowering account"));
  if (stamp.local !== null && checks.writes.get(stamp.local) !== stamp.version) return "root";
  return checks.epoch === stamp.epoch ? "unchanged" : "mutable";
}

function indexCellWrite(state: LowerState, local: LocalId): void {
  const checks = state.indexChecks;
  if (checks === null) return;
  const version = checks.writes.get(local);
  if (version !== undefined) checks.writes.set(local, version + 1);
}

function indexPlaceWrite(state: LowerState, place: PlaceId | null): void {
  const checks = state.indexChecks;
  if (checks === null || place === null) return;
  const base = state.places[place]?.base;
  if (base?.kind === "local") indexCellWrite(state, base.local);
  if (base?.kind !== "local" || checks.exposed.has(base.local)) checks.epoch += 1;
}

/** One record of the graph, charged before it is allocated. False when the limit is reached: the record is not made. */
function charge(state: LowerState): boolean {
  if (state.refused) return false;
  if (state.records >= state.limits.maximumRecords) {
    state.refused = true;
    return false;
  }
  state.records += 1;
  return true;
}

/** A new local, or null when the lowering is refused. */
export function newLocal(state: LowerState, storage: TyId, role: MirLocalRole, mode: MirLocalStorageMode, source: LocalRef | null, origin: Origin): LocalId | null {
  if (!charge(state)) return null;
  const id = localId(state.locals.length);
  state.locals.push({ id, storage, role, mode, source, origin });
  return id;
}

/** A new place, or null when the lowering is refused. */
export function newPlace(state: LowerState, base: MirPlaceBase, storage: TyId, origin: Origin): PlaceId | null {
  if (!charge(state)) return null;
  const id = placeId(state.places.length);
  state.places.push({ id, base, storage, origin });
  return id;
}

/** The one place that is the local itself, or null when the lowering is refused. */
export function placeOfLocal(state: LowerState, local: LocalId): PlaceId | null {
  // After a refusal a known place is not answered either: no identity is handed to a caller of a refused lowering.
  if (state.refused) return null;
  const known = state.localPlaces.get(local);
  if (known !== undefined) return known;
  const selected = state.locals[local];
  if (selected === undefined) return throwInvariant(invariant("a place was asked for a local that does not exist"));
  const place = newPlace(state, { kind: "local", local }, selected.storage, selected.origin);
  if (place !== null) state.localPlaces.set(local, place);
  return place;
}

export function placeOfStatic(state: LowerState, definition: DefId, storage: TyId, origin: Origin): PlaceId | null {
  if (state.refused) return null;
  const known = state.staticPlaces.get(definition);
  if (known !== undefined) {
    if (state.places[known]?.storage !== storage)
      return throwInvariant(invariant("one static definition must retain one actual storage type"));
    return known;
  }
  const place = newPlace(state, { kind: "static", definition }, storage, origin);
  if (place !== null) state.staticPlaces.set(definition, place);
  return place;
}

/**
 * A constant operand, or null when the lowering is refused. Equal constants are one record; the final identities are
 * assigned when the body is assembled.
 */
export function constantOperand(state: LowerState, type: TyId, value: MirConstantValue): Extract<MirOperand, { readonly kind: "constant" }> | null {
  if (state.refused) return null;
  const key = constantKeyOfMir(type, value);
  if (key === null) return throwInvariant(invariant("a constant's bindings are not complete"));
  const known = state.constants.get(key);
  if (known !== undefined) return { kind: "constant", constant: known.id };
  if (!charge(state)) return null;
  const id = constId(state.constants.size);
  state.constants.set(key, { id, key, type, value });
  return { kind: "constant", constant: id };
}

/** A new block that nothing has entered yet, or null when the lowering is refused. A block is one record with its terminator. */
export function newBlock(state: LowerState, site: MirSite): BlockId | null {
  if (!charge(state)) return null;
  const id = blockId(state.blocks.length);
  state.blocks.push({ id, site, statements: [], terminator: null });
  return id;
}

/** Makes a block the one that receives statements. The previous block must have been terminated. */
export function enterBlock(state: LowerState, block: BlockId): void {
  // After a refusal nothing is entered, ended or added: the caller has one refusal to return, and a state that was
  // cut short is not a defect of the caller.
  if (state.refused) return;
  if (state.current !== null) throwInvariant(invariant("a block was entered while another block was open"));
  const selected = state.blocks[block];
  if (selected === undefined || selected.terminator !== null) return throwInvariant(invariant("a block was entered that cannot receive statements"));
  state.current = selected;
}

export function buildDetachedBlock(state: LowerState, block: BlockId, build: () => boolean): boolean {
  const current = state.current;
  const checks = state.indexChecks;
  state.current = null;
  state.indexChecks = null;
  enterBlock(state, block);
  const done = build();
  state.indexChecks = checks;
  if (!done) return false;
  if (state.current !== null) return throwInvariant(invariant("a detached block must be terminated before resuming its source"));
  state.current = current;
  return true;
}

/** Adds a statement to the open block. False when the lowering is refused: nothing was added. */
export function emitStatement(state: LowerState, statement: MirStatement): boolean {
  if (state.refused) return false;
  if (state.current === null) return throwInvariant(invariant("a statement was emitted with no open block"));
  if (!charge(state)) return false;
  state.current.statements.push(statement);
  if (state.indexChecks !== null) {
    if (statement.kind === "assign") indexPlaceWrite(state, statement.place);
    else indexCellWrite(state, statement.local);
  }
  return true;
}

export function markRead(state: LowerState): ReadAnchor {
  if (state.current === null) return throwInvariant(invariant("a pending read has no open block"));
  const anchor: ReadAnchor = { kind: "read-anchor", statements: null };
  state.current.statements.push(anchor);
  return anchor;
}

export function emitAtRead(state: LowerState, anchor: ReadAnchor, statement: MirStatement): boolean {
  if (!charge(state)) return false;
  (anchor.statements ??= []).push(statement);
  return true;
}

export function emitBeforeTerminator(state: LowerState, block: BlockId, statement: MirStatement): boolean {
  if (state.refused) return false;
  const target = state.blocks[block];
  if (target === undefined || target.terminator === null) return throwInvariant(invariant("a dominating read needs its actual terminated split block"));
  if (!charge(state)) return false;
  target.statements.push(statement);
  return true;
}

/** Ends the open block. After it no block is open. */
export function terminate(state: LowerState, terminator: MirTerminator): void {
  if (state.refused) return;
  if (state.current === null) return throwInvariant(invariant("a terminator was emitted with no open block"));
  state.current.terminator = terminator;
  const checks = state.indexChecks;
  if (checks !== null) {
    switch (terminator.kind) {
      case "call": case "await": case "yield": case "delegate":
        checks.epoch += 1;
        indexPlaceWrite(state, terminator.destination);
        break;
      case "switch": checks.epoch += 1; break;
      case "invoke":
        if (terminator.operation.decision.execution.kind === "invocation" && terminator.operation.decision.execution.writesStorage) checks.epoch += 1;
        indexPlaceWrite(state, terminator.destination);
        break;
      default: break;
    }
  }
  state.current = null;
}

export function addEntry(state: LowerState, entry: MirEntry): void {
  if (state.refused) return;
  state.entries.push(entry);
}

function copied<Value>(value: Value): { readonly kind: "copied"; readonly value: Value } {
  return { kind: "copied", value };
}

function orderEmitted<Value>(values: Value[], compare: (left: Value, right: Value) => { readonly value: number }) {
  return copied(values.sort((left, right) => compare(left, right).value));
}

const ownedEmittedRows: MirCopyOps<never, never> = {
  read: build => build(),
  record: (_fields, build) => build(),
  rows: (source, row) => copied(source.map((value, position) => row(() => value, position).value)),
  orderedRows: (source, row, compare) => orderEmitted(source.map((value, position) => row(() => value, position).value), compare),
  work: () => null,
  type: type => type,
  member: copied,
  instance: copied,
  operation: copied,
  callee: copied,
};

/**
 * Assembles the body: constants take their canonical order and every reference to a constant follows. Null when the
 * lowering was refused: what was recorded until then is not a body.
 */
export function finishBody(state: LowerState): MirBody | null {
  if (state.refused) return null;
  const image = projectMirConstantOrdinals(compare => orderEmitted([...state.constants.values()], compare), ownedEmittedRows,
    () => invariant("an operand names a constant that was never emitted")).value;
  const projection = projectMirValues(ownedEmittedRows, image.constantOf);
  const blocks: MirBlock[] = state.blocks.map(block => {
    const terminator = block.terminator ?? throwInvariant(invariant("a block was left without a terminator"));
    const statements: MirStatement[] = [];
    for (const record of block.statements) {
      if (record.kind !== "read-anchor") statements.push(projection.statement(() => record, "").value);
      else if (record.statements !== null) for (const saved of record.statements) statements.push(projection.statement(() => saved, "").value);
    }
    return { ...block.site, id: block.id, statements, terminator: projection.terminator(() => terminator, "").value };
  });
  return { body: state.body, bindings: state.bindings, entries: state.entries, locals: state.locals, constants: image.constants,
    places: state.places.map(place => ({ ...place, base: projection.placeBase(() => place.base).value })), blocks, result: state.result };
}
