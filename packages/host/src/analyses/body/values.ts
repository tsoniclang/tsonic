import type { DataflowResult, DataflowStop } from "../../dataflow/contract.js";
import { accountFailure, chargeResultEntries, chargeWork } from "../../dataflow/index.js";
import { requirePresent } from "../../diag/index.js";
import type { BoundProducerId, OriginsId, TyId } from "../../ids/contract.js";
import { originsId } from "../../ids/index.js";
import type { AppliedOriginsValue, Origins } from "../../ir-facts/contract.js";
import { nativeCarrierOf, optionalValueDomainOf } from "../../ir-types/index.js";
import type { BodyRoundDeps } from "./contract.js";
import { orderedRows } from "./source.js";
import { bodyFrontier } from "./places.js";

const maximumSafeIdDigits = 16;

export interface ValueOrigins {
  readonly rows: Origins[];
  readonly index: Map<string, OriginsId>;
}

export type AdmitOrigins = (references: number, retain: boolean) => DataflowStop | null;

function valueKey(deps: BodyRoundDeps, row: Origins): DataflowResult<string> {
  const size = row.producers.length + (row.kind === "open" ? row.boundaries.length : 0);
  const stop = chargeWork(deps.account, row.kind.length + 4 + size * (maximumSafeIdDigits + 1))
    ?? chargeResultEntries(deps.account, 1);
  if (stop !== null) return stop;
  return { kind: "complete", value: `${row.kind}:${row.includesAbsence ? 1 : 0}:${row.producers.join(",")}:${row.kind === "open" ? row.boundaries.join(",") : ""}` };
}

export function valueOrigins(deps: BodyRoundDeps, rows: Origins[]): DataflowResult<ValueOrigins> {
  const start = chargeWork(deps.account, 1) ?? chargeResultEntries(deps.account, 1);
  if (start !== null) return start;
  const index = new Map<string, OriginsId>();
  for (const row of rows) {
    const read = chargeWork(deps.account, 1);
    if (read !== null) return read;
    const key = valueKey(deps, row);
    if (key.kind !== "complete") return key;
    if (index.has(key.value))
      return bodyFrontier("A body value arena starts with distinct actual entry Origins rows.");
    const growth = chargeResultEntries(deps.account, 1);
    if (growth !== null) return growth;
    index.set(key.value, row.id);
  }
  return { kind: "complete", value: { rows, index } };
}

function internValue(deps: BodyRoundDeps, values: ValueOrigins, producers: readonly BoundProducerId[], includesAbsence: boolean,
  admit: AdmitOrigins): OriginsId | DataflowStop {
  const candidateWork = chargeWork(deps.account, 1) ?? chargeResultEntries(deps.account, 1);
  if (candidateWork !== null) return candidateWork;
  const row = { id: originsId(values.rows.length), kind: "complete", producers, includesAbsence } satisfies Origins;
  const key = valueKey(deps, row);
  if (key.kind !== "complete") return key;
  const known = values.index.get(key.value);
  if (known !== undefined) return known;
  const bound = admit(producers.length, true);
  if (bound !== null) return bound;
  const growth = chargeResultEntries(deps.account, 1);
  if (growth !== null) return growth;
  values.rows.push(row);
  values.index.set(key.value, row.id);
  return row.id;
}

export function valueKind(deps: BodyRoundDeps, type: TyId): "primitive" | "absence" | "reference" | "primitive-optional" | "reference-optional" | null {
  const read = (current: TyId) => {
    if (chargeWork(deps.account, 1) !== null) return null;
    const term = deps.typeOf(current);
    return accountFailure(deps.account) === null ? term : null;
  };
  const selected = nativeCarrierOf(deps.types, type, read);
  if (selected.kind === "resource-stop") return null;
  if (selected.kind === "primitive") return "primitive";
  const term = read(selected.type);
  if (term === null) return null;
  if (term.kind === "optional") {
    const domain = optionalValueDomainOf(term, read);
    if (domain.kind === "optional-value") return domain.payload === "string" ? "reference-optional" : "primitive-optional";
  }
  return term.kind === "string" ? "reference" : term.kind === "intrinsic" && term.intrinsic === "absence" ? "absence" : null;
}

export function joinOrigins(deps: BodyRoundDeps, values: ValueOrigins, left: OriginsId, right: OriginsId,
  admit: AdmitOrigins): OriginsId | DataflowStop {
  const account = deps.account;
  const read = chargeWork(account, 2);
  if (read !== null) return read;
  const first = requirePresent(values.rows[left], { owner: "analyses/body", query: null, origin: null,
    message: "A returned value retains its actual complete Origins row." });
  const second = requirePresent(values.rows[right], { owner: "analyses/body", query: null, origin: null,
    message: "A returned value retains its actual complete Origins row." });
  if (first.kind !== "complete" || second.kind !== "complete")
    return bodyFrontier("BodyAnalysis requires the actual open Origins boundary transport for this value join.");
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
  if (count === first.producers.length && (first.includesAbsence || !second.includesAbsence)) return left;
  if (count === second.producers.length && (second.includesAbsence || !first.includesAbsence)) return right;
  const alternatives = admit(count, false);
  if (alternatives !== null) return alternatives;
  const growth = chargeWork(account, count) ?? chargeResultEntries(account, count);
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
  return internValue(deps, values, producers, first.includesAbsence || second.includesAbsence, admit);
}

export function appliedOrigins(deps: BodyRoundDeps, values: ValueOrigins, value: AppliedOriginsValue,
  admit: AdmitOrigins): OriginsId | DataflowStop {
  const read = chargeWork(deps.account, 1);
  if (read !== null) return read;
  if (value.callee.length !== 0 || value.boundaries.length !== 0)
    return bodyFrontier("BodyAnalysis requires the actual created or open call-result Origins producer.");
  const alternatives = admit(value.caller.length, false);
  if (alternatives !== null) return alternatives;
  const growth = chargeWork(deps.account, value.caller.length) ?? chargeResultEntries(deps.account, value.caller.length);
  if (growth !== null) return growth;
  const producers: BoundProducerId[] = [];
  for (const reference of value.caller) producers.push(reference.producer);
  const sorted = orderedRows(producers, (left, right) => left - right, deps.account);
  if (sorted.kind !== "complete") return sorted;
  return internValue(deps, values, sorted.value, value.includesAbsence, admit);
}
