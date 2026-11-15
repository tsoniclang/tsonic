import type { DataflowStop } from "../../dataflow/contract.js";
import { accountFailure, chargeResultEntries, chargeWork } from "../../dataflow/index.js";
import { requirePresent } from "../../diag/index.js";
import type { BoundProducerId, OriginsId, TyId } from "../../ids/contract.js";
import { originsId } from "../../ids/index.js";
import type { Origins } from "../../ir-facts/contract.js";
import { nativeCarrierOf } from "../../ir-types/index.js";
import type { BodyRoundDeps } from "./contract.js";

export function valueKind(deps: BodyRoundDeps, type: TyId): "primitive" | "absence" | "reference" | null {
  const selected = nativeCarrierOf(deps.types, type, current => {
    if (chargeWork(deps.account, 1) !== null) return null;
    const term = deps.typeOf(current);
    return accountFailure(deps.account) === null ? term : null;
  });
  if (selected.kind === "resource-stop") return null;
  if (selected.kind === "primitive") return "primitive";
  if (chargeWork(deps.account, 1) !== null) return null;
  const term = deps.typeOf(selected.type);
  if (accountFailure(deps.account) !== null) return null;
  return term.kind === "string" ? "reference" : term.kind === "intrinsic" && term.intrinsic === "absence" ? "absence" : null;
}

export function joinOrigins(deps: BodyRoundDeps, rows: Origins[], left: OriginsId, right: OriginsId,
  admit: (references: number) => DataflowStop | null): OriginsId | DataflowStop {
  const account = deps.account;
  const read = chargeWork(account, 2);
  if (read !== null) return read;
  const first = requirePresent(rows[left], { owner: "analyses/body", query: null, origin: null,
    message: "A returned value retains its actual complete Origins row." });
  const second = requirePresent(rows[right], { owner: "analyses/body", query: null, origin: null,
    message: "A returned value retains its actual complete Origins row." });
  if (left === right || second.producers.length === 0 && !second.includesAbsence) return left;
  if (first.producers.length === 0 && !first.includesAbsence) return right;
  const admission = chargeWork(account, first.producers.length + second.producers.length);
  if (admission !== null) return admission;
  let count = first.producers.length;
  let position = 0;
  for (const producer of second.producers) {
    while (position < first.producers.length && Number(first.producers[position]) < producer) position += 1;
    if (first.producers[position] !== producer) count += 1;
  }
  const bound = admit(count);
  if (bound !== null) return bound;
  const growth = chargeWork(account, count) ?? chargeResultEntries(account, count + 2);
  if (growth !== null) return growth;
  const producers: BoundProducerId[] = [];
  let earlier = 0;
  let later = 0;
  while (earlier < first.producers.length || later < second.producers.length) {
    const left = first.producers[earlier];
    const right = second.producers[later];
    if (right === undefined || left !== undefined && left < right) {
      producers.push(requirePresent(left, { owner: "analyses/body", query: null, origin: null,
        message: "An admitted Origins union retains its actual producer." }));
      earlier += 1;
    } else {
      producers.push(right);
      later += 1;
      if (left === right) earlier += 1;
    }
  }
  const id = originsId(rows.length);
  rows.push({ id, kind: "complete", producers, includesAbsence: first.includesAbsence || second.includesAbsence });
  return id;
}
