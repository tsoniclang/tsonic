import type { InvariantFailure } from "../diag/contract.js";
import { requirePresent } from "../diag/index.js";
import type { BlockId, LocalId, PlaceId, TyId } from "../ids/contract.js";
import type { MirOperand, MirSite, MirStatement } from "../ir-mir/contract.js";
import { localOwnershipOfMir } from "../ir-mir/index.js";
import type { DiscardRead, Evaluated, Lowering } from "./model.js";
import { failure } from "./model.js";
import type { ReadAnchor } from "./state.js";
import { emitAtRead, emitBeforeTerminator, emitStatement, markRead, newLocal, placeOfLocal } from "./state.js";

/** Pushes an evaluated operand; one read in place from a handed-out local is also exposed. */
export function pushOperand(lowering: Lowering, evaluated: Evaluated): void {
  if (evaluated.kind !== "plain") {
    evaluated.anchor ??= markRead(lowering.state);
    let positions = lowering.reads.get(evaluated.root);
    if (positions === undefined) { positions = new Set(); lowering.reads.set(evaluated.root, positions); }
    const position = lowering.operands.length;
    positions.add(position);
    if (evaluated.kind === "shared-field") lowering.sharedReads.add(position);
    else if (lowering.preservedLocals.has(evaluated.local)) lowering.exposed.add(position);
  }
  lowering.operands.push(evaluated);
}

function forgetRead(lowering: Lowering, position: number, evaluated: Evaluated): void {
  if (evaluated.kind === "plain") return;
  if (evaluated.kind === "shared-field") lowering.sharedReads.delete(position);
  else lowering.exposed.delete(position);
  const positions = requirePresent(lowering.reads.get(evaluated.root), failure("a waiting read has no owning place relation", null));
  positions.delete(position);
  if (positions.size === 0) lowering.reads.delete(evaluated.root);
}

/** Pops the top operand, and its exposure with it. */
export function popOperand(lowering: Lowering, missing: InvariantFailure): Evaluated {
  const evaluated = requirePresent(lowering.operands.pop(), missing);
  forgetRead(lowering, lowering.operands.length, evaluated);
  return evaluated;
}

/** The place of a new temporary whose slot begins here. Null: refused. */
export function temporary(lowering: Lowering, storage: TyId, site: MirSite, before: BlockId | ReadAnchor | null = null): PlaceId | null {
  const local = newLocal(lowering.state, storage, { kind: "temporary" }, "local", null, site.origin);
  if (local === null) return null;
  const place = placeOfLocal(lowering.state, local);
  if (place === null) return null;
  const statement: MirStatement = { ...site, kind: "storage-live", local };
  const emitted = emitReadRecord(lowering, before, statement);
  return emitted ? place : null;
}

/** A temporary as an operand. It is written by one record and by nothing else, so it is read in place and never saved. */
export const held = (place: PlaceId, storage: TyId, site: MirSite): Evaluated => ({ kind: "plain", operand: { kind: "place", place }, pendingRead: false, storage, site });

function materializeReadPlace(lowering: Lowering, operand: MirOperand, storage: TyId, site: MirSite, anchor: ReadAnchor | null): PlaceId | null {
  const saved = temporary(lowering, storage, site, anchor);
  return saved !== null && copyRead(lowering, operand, saved, site, anchor) ? saved : null;
}

function materializeRead(lowering: Lowering, operand: MirOperand, storage: TyId, site: MirSite, anchor: ReadAnchor | null): Evaluated | null {
  const place = materializeReadPlace(lowering, operand, storage, site, anchor);
  return place === null ? null : held(place, storage, site);
}

export function readPlace(lowering: Lowering, place: PlaceId, storage: TyId, site: MirSite): Evaluated | null {
  return materializeRead(lowering, { kind: "place", place }, storage, site, null);
}

export function saveRead(lowering: Lowering, pending: Evaluated): Evaluated | null {
  const anchor = requirePresent(pending.anchor, failure("a pending place read has no authored position", pending.site.origin));
  return materializeRead(lowering, pending.operand, pending.storage, pending.site, anchor);
}

export function holdReceiver(lowering: Lowering, value: Evaluated): PlaceId | null {
  if (value.kind === "plain" && !value.pendingRead && value.operand.kind === "place") {
    const source = requirePresent(lowering.state.places[value.operand.place], failure("an evaluated receiver has no place", value.site.origin));
    if (source.base.kind === "local") {
      const local = requirePresent(lowering.state.locals[source.base.local], failure("an evaluated receiver has no local", value.site.origin));
      if (local.role.kind === "temporary") return source.id;
    }
  }
  return materializeReadPlace(lowering, value.operand, value.storage, value.site, value.anchor ?? null);
}

function emitReadRecord(lowering: Lowering, before: BlockId | ReadAnchor | null, statement: MirStatement): boolean {
  if (before === null) return emitStatement(lowering.state, statement);
  return typeof before === "number" ? emitBeforeTerminator(lowering.state, before, statement) : emitAtRead(lowering.state, before, statement);
}

function copyRead(lowering: Lowering, operand: MirOperand, destination: PlaceId, site: MirSite, before: ReadAnchor | null = null): boolean {
  const assignment: MirStatement = { ...site, kind: "assign", place: destination, value: { kind: "use", operand }, step: null };
  return emitReadRecord(lowering, before, assignment);
}

export function observePendingRead(lowering: Lowering, value: Evaluated, shared: DiscardRead | null = null): boolean {
  if (!value.pendingRead) return true;
  let saved: PlaceId | null;
  if (shared === null || shared.storage !== value.storage) saved = temporary(lowering, value.storage, value.site);
  else saved = shared.place ??= temporary(lowering, shared.storage, shared.site, shared.block);
  return saved !== null && copyRead(lowering, value.operand, saved, value.site);
}

/**
 * Saves each waiting operand read in place from a handed-out local, once: a saved operand is a temporary and is not
 * exposed again. Each evaluated read is saved by itself, also when two read the same local. False: refused.
 */
function saveReads(lowering: Lowering, positions: Set<number> | undefined): boolean {
  if (positions === undefined) return true;
  for (const position of positions) {
    const pending = requirePresent(lowering.operands[position], failure("an exposed operand is not on the stack", null));
    const saved = saveRead(lowering, pending);
    if (saved === null) return false;
    forgetRead(lowering, position, pending);
    lowering.operands[position] = saved;
  }
  return true;
}

export function saveBeforeControl(lowering: Lowering, writesStorage: boolean, canLeave: boolean): boolean {
  if (writesStorage && !saveReads(lowering, lowering.exposed)) return false;
  return !writesStorage && !canLeave || saveReads(lowering, lowering.sharedReads);
}

export function saveBeforeStore(lowering: Lowering, place: PlaceId, local: LocalId | null): boolean {
  if (local === null || !lowering.preservedLocals.has(local)) return saveReads(lowering, lowering.reads.get(place));
  if (!saveReads(lowering, lowering.exposed)) return false;
  const owner = requirePresent(lowering.state.locals[local], failure("a written local has no storage", null));
  return localOwnershipOfMir(owner.mode) === "body" || saveReads(lowering, lowering.sharedReads);
}

export function exposeLocal(lowering: Lowering, local: LocalId): void {
  lowering.preservedLocals.add(local);
  const root = requirePresent(lowering.state.localPlaces.get(local), failure("an exposed local has no place", null));
  const reads = lowering.reads.get(root);
  if (reads !== undefined) for (const position of reads) lowering.exposed.add(position);
}
