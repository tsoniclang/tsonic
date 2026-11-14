import type { InvariantFailure } from "../diag/contract.js";
import { requirePresent } from "../diag/index.js";
import type { PlaceId, TyId } from "../ids/contract.js";
import type { MirSite } from "../ir-mir/contract.js";
import type { Evaluated, Lowering } from "./model.js";
import { failure } from "./model.js";
import { emitStatement, newLocal, placeOfLocal } from "./state.js";

/** Pushes an evaluated operand; one read in place from a handed-out local is also exposed. */
export function pushOperand(lowering: Lowering, evaluated: Evaluated): void {
  if (evaluated.inPlace !== null) {
    let positions = lowering.reads.get(evaluated.inPlace);
    if (positions === undefined) { positions = new Set(); lowering.reads.set(evaluated.inPlace, positions); }
    positions.add(lowering.operands.length);
    if (lowering.preservedLocals.has(evaluated.inPlace)) lowering.exposed.add(lowering.operands.length);
  }
  lowering.operands.push(evaluated);
}

function forgetRead(lowering: Lowering, position: number, evaluated: Evaluated): void {
  lowering.exposed.delete(position);
  if (evaluated.inPlace === null) return;
  const positions = requirePresent(lowering.reads.get(evaluated.inPlace), failure("a waiting read has no owning local relation", null));
  positions.delete(position);
  if (positions.size === 0) lowering.reads.delete(evaluated.inPlace);
}

/** Pops the top operand, and its exposure with it. */
export function popOperand(lowering: Lowering, missing: InvariantFailure): Evaluated {
  const evaluated = requirePresent(lowering.operands.pop(), missing);
  forgetRead(lowering, lowering.operands.length, evaluated);
  return evaluated;
}

/** The place of a new temporary whose slot begins here. Null: refused. */
export function temporary(lowering: Lowering, storage: TyId, site: MirSite): PlaceId | null {
  const local = newLocal(lowering.state, storage, { kind: "temporary" }, "local", null, site.origin);
  if (local === null) return null;
  const place = placeOfLocal(lowering.state, local);
  return place !== null && emitStatement(lowering.state, { ...site, kind: "storage-live", local }) ? place : null;
}

/** A temporary as an operand. It is written by one record and by nothing else, so it is read in place and never saved. */
export const held = (place: PlaceId, storage: TyId, site: MirSite): Evaluated => ({ operand: { kind: "place", place }, inPlace: null, storage, site });

/**
 * Saves each waiting operand read in place from a handed-out local, once: a saved operand is a temporary and is not
 * exposed again. Each evaluated read is saved by itself, also when two read the same local. False: refused.
 */
export function saveReads(lowering: Lowering, positions: Iterable<number>): boolean {
  for (const position of positions) {
    const pending = requirePresent(lowering.operands[position], failure("an exposed operand is not on the stack", null));
    const saved = temporary(lowering, pending.storage, pending.site);
    if (saved === null) return false;
    if (!emitStatement(lowering.state, { ...pending.site, kind: "assign", place: saved, value: { kind: "use", operand: pending.operand }, step: null }))
      return false;
    forgetRead(lowering, position, pending);
    lowering.operands[position] = held(saved, pending.storage, pending.site);
  }
  return true;
}

export function saveHandedOut(lowering: Lowering): boolean {
  return saveReads(lowering, lowering.exposed);
}
