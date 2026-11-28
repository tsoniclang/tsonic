import type { DataflowResult, DataflowStop } from "../../dataflow/contract.js";
import { accountFailure, chargeResultEntries, chargeWork } from "../../dataflow/index.js";
import { requirePresent } from "../../diag/index.js";
import type { BoundProducerId, OpenBoundaryId, OriginsId, TyId } from "../../ids/contract.js";
import { originsId } from "../../ids/index.js";
import type { AppliedOriginsValue, Origins } from "../../ir-facts/contract.js";
import type { TypeTerm } from "../../ir-types/contract.js";
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

type Tuple = Extract<TypeTerm, { readonly kind: "tuple" }>;

type OriginFreeProduct = "scalar-product" | { readonly absentSlots: ReadonlySet<TyId> };

type ValueKind = "primitive" | "absence" | "reference" | "array-reference" | "primitive-optional" | "reference-optional" | OriginFreeProduct | null;

export function isOriginFreeProduct(kind: ValueKind): kind is OriginFreeProduct {
  return kind === "scalar-product" || kind !== null && typeof kind === "object";
}

function originFreeTuple(deps: BodyRoundDeps, type: TyId, tuple: Tuple, read: (type: TyId) => TypeTerm | null): OriginFreeProduct | null {
  const { account } = deps;
  const holding = deps.carrierHoldingOf(account, "tuple");
  if (holding.kind !== "complete" || holding.value !== "in-place") return null;
  if (chargeWork(account, 1) !== null || chargeResultEntries(account, 4) !== null) return null;
  const seen = new Map<TyId, "open" | "closed">([[type, "open"]]);
  const stack = [{ type, tuple, slot: 0 }];
  let absentSlots: Set<TyId> | null = null;
  for (let frame = stack.at(-1); frame !== undefined; frame = stack.at(-1)) {
    if (chargeWork(account, 1) !== null) return null;
    if (frame.slot === frame.tuple.elements.length) {
      seen.set(frame.type, "closed");
      stack.pop();
      continue;
    }
    const element = frame.tuple.elements[frame.slot++];
    if (element?.kind !== "required") return null;
    const selected = nativeCarrierOf(deps.types, element.type, read);
    if (selected.kind === "resource-stop") return null;
    if (selected.kind === "primitive") continue;
    const prior = seen.get(selected.type);
    if (prior === "open") return null;
    if (prior === "closed") continue;
    const child = read(selected.type);
    if (child?.kind === "intrinsic" && child.intrinsic === "absence") {
      if (absentSlots === null) {
        if (chargeResultEntries(account, 3) !== null) return null;
        absentSlots = new Set<TyId>();
        absentSlots.add(element.type);
      } else {
        if (chargeWork(account, 1) !== null) return null;
        if (!absentSlots.has(element.type)) {
          if (chargeResultEntries(account, 1) !== null) return null;
          absentSlots.add(element.type);
        }
      }
      continue;
    }
    if (child?.kind !== "tuple" || chargeResultEntries(account, 2) !== null) return null;
    seen.set(selected.type, "open");
    stack.push({ type: selected.type, tuple: child, slot: 0 });
  }
  return absentSlots === null ? "scalar-product" : { absentSlots };
}

export function valueKind(deps: BodyRoundDeps, type: TyId): ValueKind {
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
  if (term.kind === "array" || term.kind === "fixed-array") {
    const holding = deps.carrierHoldingOf(deps.account, term.kind);
    return holding.kind === "complete" && holding.value === "by-reference" ? "array-reference" : null;
  }
  if (term.kind === "tuple") return originFreeTuple(deps, selected.type, term, read);
  return term.kind === "string" ? "reference"
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

export function projectOrigins(deps: BodyRoundDeps, values: ValueOrigins, source: Extract<Origins, { readonly kind: "complete" }>,
  absence: boolean, admit: AdmitOrigins, project: (reference: BoundProducerId) => BoundProducerId | DataflowStop): OriginsId | DataflowStop {
  const stop = admit(source.producers.length, false) ?? chargeResultEntries(deps.account, 1 + source.producers.length);
  if (stop !== null) return stop;
  const projected: BoundProducerId[] = [];
  for (let index = 0; index < source.producers.length; index += 1) {
    const paid = chargeWork(deps.account, 1);
    if (paid !== null) return paid;
    const actual = requirePresent(source.producers[index], { owner: "analyses/body", query: null, origin: null,
      message: "A reference projection retains every actual receiver producer." });
    const mapped = project(actual);
    if (typeof mapped !== "number") return mapped;
    projected.push(mapped);
  }
  const ordered = orderedRows(projected, (left, right) => left - right, deps.account);
  return ordered.kind !== "complete" ? ordered : internValue(deps, values, ordered.value, absence, noBoundaries, admit);
}

export function presentOrigins(deps: BodyRoundDeps, values: ValueOrigins, id: OriginsId, admit: AdmitOrigins): OriginsId | DataflowStop {
  const paid = chargeWork(deps.account, 1);
  if (paid !== null) return paid;
  const source = requirePresent(values.rows[id], { owner: "analyses/body", query: null, origin: null,
    message: "A checked value retains the Origins of its actual saved reference." });
  if (!source.includesAbsence) return id;
  return internValue(deps, values, source.producers, false, source.kind === "open" ? source.boundaries : noBoundaries, admit);
}

export function appliedOrigins(deps: BodyRoundDeps, values: ValueOrigins, value: AppliedOriginsValue,
  admit: AdmitOrigins, readBoundary: ReadCallBoundary, createdReturn: BoundProducerId | null): OriginsId | DataflowStop {
  const read = chargeWork(deps.account, 1);
  if (read !== null) return read;
  const created = value.callee.length === 0 ? null : createdReturn;
  if (value.callee.length !== 0 && created === null)
    return bodyFrontier("BodyAnalysis requires the actual created or open call-result Origins producer.");
  const alternatives = admit(value.caller.length, false);
  if (alternatives !== null) return alternatives;
  const growth = chargeWork(deps.account, value.caller.length) ?? chargeResultEntries(deps.account, value.caller.length);
  if (growth !== null) return growth;
  const producers: BoundProducerId[] = [];
  let includesCreated = false;
  for (const reference of value.caller) {
    producers.push(reference.producer);
    includesCreated ||= reference.producer === created;
  }
  if (created !== null && !includesCreated) {
    const retained = admit(producers.length + 1, false) ?? chargeWork(deps.account, 1) ?? chargeResultEntries(deps.account, 1);
    if (retained !== null) return retained;
    producers.push(created);
  }
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
