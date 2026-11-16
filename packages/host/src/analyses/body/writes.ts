import type { DataflowResult, DataflowStop } from "../../dataflow/contract.js";
import { accountFailure, chargeResultEntries, chargeWork } from "../../dataflow/index.js";
import { requirePresent, throwInvariant } from "../../diag/index.js";
import type { LocalId, OriginsId } from "../../ids/contract.js";
import type { AppliedOriginsValue, AppliedWrite, Summary, SummaryWrite } from "../../ir-facts/contract.js";
import type { MirSite, MirTerminator } from "../../ir-mir/contract.js";
import type { BodyRoundDeps, BodyRoundInput } from "./contract.js";
import { captureLocalAtCall } from "./initialization.js";
import { bodyFrontier } from "./places.js";
import { valueKind } from "./values.js";

function frontier(operation: MirSite, message: string): never {
  return throwInvariant({ owner: "analyses/body", query: null, origin: operation.origin, message });
}

function hasReferences(value: AppliedOriginsValue): boolean {
  return value.caller.length + value.callee.length + value.boundaries.length !== 0;
}

function primitiveLocal(deps: BodyRoundDeps, input: BodyRoundInput,
  operation: Extract<MirTerminator, { readonly kind: "call" }>, summary: Summary, cell: number): DataflowResult<LocalId> {
  const local = captureLocalAtCall(deps, input.mir, operation, summary, cell);
  if (local.kind !== "complete") return local;
  const read = chargeWork(deps.account, 1);
  if (read !== null) return read;
  const storage = requirePresent(input.mir.locals[local.value], { owner: "analyses/body", query: null, origin: operation.origin,
    message: "An applied captured write retains its actual caller storage." }).storage;
  const kind = valueKind(deps, storage);
  const stopped = accountFailure(deps.account);
  if (stopped !== null) return stopped;
  if (kind !== "primitive") return frontier(operation, "BodyAnalysis requires the actual non-primitive caller-cell write transport.");
  return local;
}

export function primitiveWrites(deps: BodyRoundDeps, input: BodyRoundInput,
  operation: Extract<MirTerminator, { readonly kind: "call" }>, summary: Summary,
  source: readonly SummaryWrite[], applied: readonly AppliedWrite[]): DataflowStop | null {
  const prior = accountFailure(deps.account);
  if (prior !== null) return prior;
  for (let index = 0; index < applied.length; index += 1) {
    const read = chargeWork(deps.account, 3);
    if (read !== null) return read;
    const write = requirePresent(applied[index], { owner: "analyses/body", query: null, origin: operation.origin,
      message: "Canonical application retains every actual write." });
    const selected = requirePresent(source[index], { owner: "analyses/body", query: null, origin: operation.origin,
      message: "An applied write retains its actual source row." });
    if (write.target.same === null || write.target.targets.length !== 1 || hasReferences(write.value) || write.value.includesAbsence)
      return frontier(operation, "BodyAnalysis requires the actual non-primitive or unresolved caller-cell write transport.");
    const local = primitiveLocal(deps, input, operation, summary, selected.target);
    if (local.kind !== "complete") return local;
  }
  return null;
}

export function primitiveExitLocals(deps: BodyRoundDeps, input: BodyRoundInput,
  operation: Extract<MirTerminator, { readonly kind: "call" }>, summary: Summary): DataflowResult<readonly LocalId[]> {
  const start = chargeWork(deps.account, 1) ?? chargeResultEntries(deps.account, 1);
  if (start !== null) return start;
  const locals: LocalId[] = [];
  for (let index = 0; index < summary.contentsOnReturn.length; index += 1) {
    const read = chargeWork(deps.account, 2);
    if (read !== null) return read;
    const row = requirePresent(summary.contentsOnReturn[index], { owner: "analyses/body", query: null, origin: operation.origin,
      message: "A finite content vector retains each actual source row." });
    const value = requirePresent(summary.arena.origins[row.value], { owner: "analyses/body", query: null, origin: operation.origin,
      message: "A finite content row retains its actual source Origins." });
    if (value.kind !== "complete" || value.producers.length !== 0 || value.includesAbsence)
      return frontier(operation, "BodyAnalysis requires the actual non-primitive finite caller-cell content transport.");
    const local = primitiveLocal(deps, input, operation, summary, row.target);
    if (local.kind !== "complete") return local;
    const growth = chargeResultEntries(deps.account, 1);
    if (growth !== null) return growth;
    locals.push(local.value);
  }
  return { kind: "complete", value: locals };
}

export function recordCaptureWrite(deps: BodyRoundDeps, input: BodyRoundInput, local: LocalId, cell: number,
  value: OriginsId, writes: Map<number, OriginsId>, site: MirSite): DataflowStop | null {
  const read = chargeWork(deps.account, 1);
  if (read !== null) return read;
  const storage = requirePresent(input.mir.locals[local], { owner: "analyses/body", query: null, origin: site.origin,
    message: "A captured write retains its actual selected storage." }).storage;
  const kind = valueKind(deps, storage);
  const stopped = accountFailure(deps.account);
  if (stopped !== null) return stopped;
  if (kind !== "primitive")
    return bodyFrontier("BodyAnalysis requires the actual captured reference content and exit-write transport.");
  const lookup = chargeWork(deps.account, 1);
  if (lookup !== null) return lookup;
  const retained = chargeResultEntries(deps.account, writes.has(cell) ? 1 : 2);
  if (retained !== null) return retained;
  writes.set(cell, value);
  return null;
}

export function collectCellWrites(deps: BodyRoundDeps, count: number, boundaryCount: number,
  writes: ReadonlyMap<number, OriginsId>): DataflowResult<{ readonly body: readonly SummaryWrite[]; readonly boundary: readonly SummaryWrite[] }> {
  const setup = chargeResultEntries(deps.account, 2);
  if (setup !== null) return setup;
  const body: SummaryWrite[] = [];
  const boundary: SummaryWrite[] = [];
  for (let cell = 0; cell < count; cell += 1) {
    const read = chargeWork(deps.account, 1);
    if (read !== null) return read;
    const value = writes.get(cell);
    if (value === undefined) continue;
    const row = chargeResultEntries(deps.account, 1);
    if (row !== null) return row;
    body.push({ target: cell, value });
    if (cell < boundaryCount) {
      const entry = chargeResultEntries(deps.account, 1);
      if (entry !== null) return entry;
      boundary.push({ target: cell, value });
    }
  }
  return { kind: "complete", value: { body, boundary } };
}
