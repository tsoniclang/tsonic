import { requirePresent, throwInvariant } from "../../diag/index.js";
import type { LocalId } from "../../ids/contract.js";
import type { MirBody, MirOperand } from "../../ir-mir/contract.js";

export function bodyFrontier(message: string): never {
  return throwInvariant({ owner: "analyses/initialization", query: null, origin: null, message });
}

export function readLocal(body: MirBody, operand: Extract<MirOperand, { readonly kind: "place" }>): LocalId;
export function readLocal(body: MirBody, operand: MirOperand): LocalId | null;
export function readLocal(body: MirBody, operand: MirOperand): LocalId | null {
  if (operand.kind === "constant") return null;
  const place = requirePresent(body.places[operand.place], { owner: "analyses/initialization", query: null,
    origin: null, message: "A verified operand retains its actual place." });
  if (place.base.kind !== "local") return bodyFrontier("BodyAnalysis needs the actual selected logical-cell relation for this place.");
  return place.base.local;
}
