import type { DataflowResult, DataflowStop } from "../../dataflow/contract.js";
import { accountFailure, chargeResultEntries, chargeWork } from "../../dataflow/index.js";
import { requirePresent } from "../../diag/index.js";
import type { BoundProducerId, OpenBoundaryId, OriginsId, TyId } from "../../ids/contract.js";
import { originsId } from "../../ids/index.js";
import type { AppliedOriginsValue, Origins } from "../../ir-facts/contract.js";
import { nativeCarrierOf, optionalValueDomainOf } from "../../ir-types/index.js";
import type { BodyRoundDeps } from "./contract.js";
import { orderedRows } from "./source.js";
import { bodyFrontier } from "./places.js";
import type { ReadCallBoundary } from "./open-calls.js";

const maximumSafeIdDigits = 16;
const noBoundaries: readonly OpenBoundaryId[] = [];

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

function nonempty<Value>(rows: readonly Value[]): rows is readonly [Value, ...Value[]] {
  return rows.length !== 0;
}

function internValue(deps: BodyRoundDeps, values: ValueOrigins, producers: readonly BoundProducerId[], includesAbsence: boolean,
  boundaries: readonly OpenBoundaryId[], admit: AdmitOrigins): OriginsId | DataflowStop {
  const candidateWork = chargeWork(deps.account, 1) ?? chargeResultEntries(deps.account, 1);
  if (candidateWork !== null) return candidateWork;
  const id = originsId(values.rows.length);
  const row: Origins = nonempty(boundaries) ? { id, kind: "open", producers, includesAbsence, boundaries }
    : { id, kind: "complete", producers, includesAbsence };
  const key = valueKey(deps, row);
  if (key.kind !== "complete") return key;
  const known = values.index.get(key.value);
  if (known !== undefined) return known;
  const bound = admit(producers.length + boundaries.length, true);
  if (bound !== null) return bound;
  const growth = chargeResultEntries(deps.account, 1);
  if (growth !== null) return growth;
  values.rows.push(row);
  values.index.set(key.value, row.id);
  return row.id;
}

function unionCount<Reference extends number>(left: readonly Reference[], right: readonly Reference[]): number {
  let count = left.length;
  let position = 0;
  for (const reference of right) {
    while (position < left.length && Number(left[position]) < reference) position += 1;
    if (left[position] !== reference) count += 1;
  }
  return count;
}

function mergeReferences<Reference extends number>(left: readonly Reference[], right: readonly Reference[]): readonly Reference[] {
  const output: Reference[] = [];
  let earlier = 0;
  let later = 0;
  while (earlier < left.length || later < right.length) {
    const first = left[earlier];
    const second = right[later];
    if (second === undefined || first !== undefined && first < second) {
      output.push(requirePresent(first, { owner: "analyses/body", query: null, origin: null,
        message: "An admitted Origins union retains its actual reference." }));
      earlier += 1;
    } else {
      output.push(second);
      later += 1;
      if (first === second) earlier += 1;
    }
  }
  return output;
}

export function valueKind(deps: BodyRoundDeps, type: TyId): "primitive" | "absence" | "reference" | "array-reference" | "primitive-optional" | "reference-optional" | null {
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
  return term.kind === "array" ? "array-reference" : term.kind === "string" ? "reference"
    : term.kind === "intrinsic" && term.intrinsic === "absence" ? "absence" : null;
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
  if (left === right || second.kind === "complete" && second.producers.length === 0 && !second.includesAbsence) return left;
  if (first.kind === "complete" && first.producers.length === 0 && !first.includesAbsence) return right;
  const leftBoundaries = first.kind === "open" ? first.boundaries : noBoundaries;
  const rightBoundaries = second.kind === "open" ? second.boundaries : noBoundaries;
  const admission = chargeWork(account, first.producers.length + second.producers.length + leftBoundaries.length + rightBoundaries.length);
  if (admission !== null) return admission;
  const producers = unionCount(first.producers, second.producers);
  const boundaries = unionCount(leftBoundaries, rightBoundaries);
  if (producers === first.producers.length && boundaries === leftBoundaries.length && (first.includesAbsence || !second.includesAbsence)) return left;
  if (producers === second.producers.length && boundaries === rightBoundaries.length && (second.includesAbsence || !first.includesAbsence)) return right;
  const count = producers + boundaries;
  const alternatives = admit(count, false);
  if (alternatives !== null) return alternatives;
  const growth = chargeWork(account, count) ?? chargeResultEntries(account, count + (boundaries === 0 ? 0 : 1));
  if (growth !== null) return growth;
  return internValue(deps, values, mergeReferences(first.producers, second.producers), first.includesAbsence || second.includesAbsence,
    boundaries === 0 ? noBoundaries : mergeReferences(leftBoundaries, rightBoundaries), admit);
}

export function appliedOrigins(deps: BodyRoundDeps, values: ValueOrigins, value: AppliedOriginsValue,
  admit: AdmitOrigins, readBoundary: ReadCallBoundary): OriginsId | DataflowStop {
  const read = chargeWork(deps.account, 1);
  if (read !== null) return read;
  if (value.callee.length !== 0)
    return bodyFrontier("BodyAnalysis requires the actual created or open call-result Origins producer.");
  const alternatives = admit(value.caller.length, false);
  if (alternatives !== null) return alternatives;
  const growth = chargeWork(deps.account, value.caller.length) ?? chargeResultEntries(deps.account, value.caller.length);
  if (growth !== null) return growth;
  const producers: BoundProducerId[] = [];
  for (const reference of value.caller) producers.push(reference.producer);
  const sorted = orderedRows(producers, (left, right) => left - right, deps.account);
  if (sorted.kind !== "complete") return sorted;
  if (value.boundaries.length === 0) return internValue(deps, values, sorted.value, value.includesAbsence, noBoundaries, admit);
  const setup = chargeResultEntries(deps.account, 1);
  if (setup !== null) return setup;
  const opened = new Set<OpenBoundaryId>();
  for (let index = 0; index < value.boundaries.length; index += 1) {
    const step = chargeWork(deps.account, 1);
    if (step !== null) return step;
    const reference = requirePresent(value.boundaries[index], { owner: "analyses/body", query: null, origin: null,
      message: "Applied open Origins retain each actual boundary reference." });
    const mapped = readBoundary(reference);
    if (typeof mapped !== "number") return mapped;
    if (opened.has(mapped)) continue;
    const keep = chargeResultEntries(deps.account, 1);
    if (keep !== null) return keep;
    opened.add(mapped);
  }
  const retain = chargeWork(deps.account, opened.size) ?? chargeResultEntries(deps.account, 1 + opened.size);
  if (retain !== null) return retain;
  const boundaries = orderedRows([...opened], (left, right) => left - right, deps.account);
  return boundaries.kind !== "complete" ? boundaries : internValue(deps, values, sorted.value, value.includesAbsence, boundaries.value, admit);
}
