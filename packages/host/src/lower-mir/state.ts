import type { InvariantFailure } from "../diag/contract.js";
import { throwInvariant } from "../diag/index.js";
import type { BlockId, BodyId, ConstId, LocalId, LocalRef, Origin, PlaceId, TyId } from "../ids/contract.js";
import { blockId, constId, localId, placeId } from "../ids/index.js";
import type { ArtifactBindings } from "../ir-types/contract.js";
import type {
  MirBlock, MirBody, MirCallArgument, MirConstant, MirConstantValue, MirEntry, MirLocal, MirLocalRole, MirOperand, MirPlace,
  MirPlaceBase, MirRvalue, MirSite, MirStatement, MirTerminator,
} from "../ir-mir/contract.js";
import { constantKeyOfMir } from "../ir-mir/index.js";
import type { LowerMirLimits } from "./contract.js";

const invariant = (message: string): InvariantFailure => ({ owner: "lower-mir", query: null, origin: null, message });

interface OpenBlock {
  readonly id: BlockId;
  readonly site: MirSite;
  readonly statements: MirStatement[];
  terminator: MirTerminator | null;
}

interface PendingConstant {
  readonly provisional: ConstId;
  readonly key: string;
  readonly type: TyId;
  readonly value: MirConstantValue;
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
  readonly constants: Map<string, PendingConstant>;
  readonly blocks: OpenBlock[];
  readonly entries: MirEntry[];
  records: number;
  /** The next record would have passed the size limit. Nothing is recorded after that; the caller stops and builds the refusal. */
  refused: boolean;
  current: OpenBlock | null;
}

export function createState(body: BodyId, bindings: ArtifactBindings, result: TyId, limits: LowerMirLimits): LowerState {
  return { body, bindings, result, limits, locals: [], places: [], localPlaces: new Map(), constants: new Map(), blocks: [],
    entries: [], records: 0, refused: false, current: null };
}

/**
 * One record of the graph, charged before it is allocated. False when the limit is reached: the record is not made,
 * the identity returned in its place names nothing, and the lowering stops at its next step because `refused` is set.
 */
function charge(state: LowerState): boolean {
  if (state.refused) return false;
  if (state.records >= state.limits.maximumRecords) {
    state.refused = true;
    return false;
  }
  state.records += 1;
  return true;
}

export function newLocal(state: LowerState, storage: TyId, role: MirLocalRole, source: LocalRef | null, origin: Origin): LocalId {
  if (!charge(state)) return localId(0);
  const id = localId(state.locals.length);
  state.locals.push({ id, storage, role, source, origin });
  return id;
}

export function newPlace(state: LowerState, base: MirPlaceBase, storage: TyId, origin: Origin): PlaceId {
  if (!charge(state)) return placeId(0);
  const id = placeId(state.places.length);
  state.places.push({ id, base, storage, origin });
  return id;
}

/** The one place that is the local itself. */
export function placeOfLocal(state: LowerState, local: LocalId): PlaceId {
  const known = state.localPlaces.get(local);
  if (known !== undefined) return known;
  const selected = state.locals[local];
  if (selected === undefined) return throwInvariant(invariant("a place was asked for a local that does not exist"));
  const place = newPlace(state, { kind: "local", local }, selected.storage, selected.origin);
  state.localPlaces.set(local, place);
  return place;
}

/** A constant operand. Equal constants are one record; the final identities are assigned when the body is assembled. */
export function constantOperand(state: LowerState, type: TyId, value: MirConstantValue): MirOperand {
  const key = constantKeyOfMir(type, value);
  if (key === null) return throwInvariant(invariant("a constant's bindings are not complete"));
  const known = state.constants.get(key);
  if (known !== undefined) return { kind: "constant", constant: known.provisional };
  if (!charge(state)) return { kind: "constant", constant: constId(0) };
  const provisional = constId(state.constants.size);
  state.constants.set(key, { provisional, key, type, value });
  return { kind: "constant", constant: provisional };
}

/** A new block that nothing has entered yet. */
export function newBlock(state: LowerState, site: MirSite): BlockId {
  if (!charge(state)) return blockId(0);
  const id = blockId(state.blocks.length);
  state.blocks.push({ id, site, statements: [], terminator: null });
  return id;
}

/** Makes a block the one that receives statements. The previous block must have been terminated. */
export function enterBlock(state: LowerState, block: BlockId): void {
  if (state.current !== null) throwInvariant(invariant("a block was entered while another block was open"));
  const selected = state.blocks[block];
  if (selected === undefined || selected.terminator !== null) return throwInvariant(invariant("a block was entered that cannot receive statements"));
  state.current = selected;
}

export function emitStatement(state: LowerState, statement: MirStatement): void {
  if (state.current === null) return throwInvariant(invariant("a statement was emitted with no open block"));
  if (!charge(state)) return;
  state.current.statements.push(statement);
}

/** Ends the open block. After it no block is open. */
export function terminate(state: LowerState, terminator: MirTerminator): void {
  if (state.current === null) return throwInvariant(invariant("a terminator was emitted with no open block"));
  state.current.terminator = terminator;
  state.current = null;
}

export function addEntry(state: LowerState, entry: MirEntry): void {
  state.entries.push(entry);
}

/** Assembles the body: constants take their canonical order and every reference to a constant follows. */
export function finishBody(state: LowerState): MirBody {
  const ordered = [...state.constants.values()].sort((left, right) => left.key < right.key ? -1 : left.key > right.key ? 1 : 0);
  const final = new Map<ConstId, ConstId>();
  const constants: MirConstant[] = [];
  for (const [position, pending] of ordered.entries()) {
    final.set(pending.provisional, constId(position));
    constants.push({ id: constId(position), type: pending.type, value: pending.value });
  }
  const constant = (provisional: ConstId): ConstId => {
    const selected = final.get(provisional);
    return selected === undefined ? throwInvariant(invariant("an operand names a constant that was never emitted")) : selected;
  };
  const operand = (value: MirOperand): MirOperand => value.kind === "place" ? value : { kind: "constant", constant: constant(value.constant) };
  const rvalue = (value: MirRvalue): MirRvalue => {
    switch (value.kind) {
      case "use": return { ...value, operand: operand(value.operand) };
      case "unary": case "convert": return { ...value, operand: operand(value.operand) };
      case "binary": return { ...value, left: operand(value.left), right: operand(value.right) };
      case "aggregate":
        switch (value.aggregate.kind) {
          case "array": case "tuple": case "fixed-array":
            return { ...value, aggregate: { kind: value.aggregate.kind, elements: value.aggregate.elements.map(operand) } };
          case "object": case "record":
            return { ...value, aggregate: { kind: value.aggregate.kind,
              fields: value.aggregate.fields.map(field => ({ member: field.member, value: operand(field.value) })) } };
        }
      case "address-of": case "closure": return value;
    }
  };
  const argument = (value: MirCallArgument): MirCallArgument => value.kind === "value" ? { ...value, operand: operand(value.operand) } : value;
  const terminator = (value: MirTerminator): MirTerminator => {
    switch (value.kind) {
      case "goto": case "check": case "unreachable": return value;
      case "switch": return { ...value, operand: operand(value.operand),
        targets: value.targets.map(target => ({ constant: constant(target.constant), target: target.target }))
          .sort((left, right) => left.constant - right.constant) };
      case "call": return { ...value, receiver: value.receiver === null ? null : operand(value.receiver),
        callee: value.callee.kind === "indirect" ? { ...value.callee, operand: operand(value.callee.operand) } : value.callee,
        arguments: value.arguments.map(argument) };
      case "invoke": return { ...value, operands: value.operands.map(operand) };
      case "await": return { ...value, operand: operand(value.operand) };
      case "yield": return { ...value, operand: value.operand === null ? null : operand(value.operand) };
      case "delegate": return { ...value, iterator: operand(value.iterator) };
      case "throw": return { ...value, operand: operand(value.operand) };
      case "return": return { ...value, value: value.value === null ? null : operand(value.value) };
    }
  };
  const base = (value: MirPlaceBase): MirPlaceBase =>
    (value.kind === "place" || value.kind === "checked") && value.projection.kind === "index"
      ? { ...value, projection: { kind: "index", operand: operand(value.projection.operand) } } : value;
  const blocks: MirBlock[] = state.blocks.map(block => {
    if (block.terminator === null) return throwInvariant(invariant("a block was left without a terminator"));
    return { ...block.site, id: block.id,
      statements: block.statements.map(statement => statement.kind === "assign" ? { ...statement, value: rvalue(statement.value) } : statement),
      terminator: terminator(block.terminator) };
  });
  return { body: state.body, bindings: state.bindings, entries: state.entries, locals: state.locals, constants,
    places: state.places.map(place => ({ ...place, base: base(place.base) })), blocks, result: state.result };
}
