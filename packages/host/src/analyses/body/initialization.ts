import type { DataflowResult, DataflowStop } from "../../dataflow/contract.js";
import { accountFailure, chargeResultEntries, chargeWork } from "../../dataflow/index.js";
import { requirePresent } from "../../diag/index.js";
import type { LocalId } from "../../ids/contract.js";
import type { InitializationPoint, InitializationRow, InitializationTable, Summary } from "../../ir-facts/contract.js";
import type { MirBody, MirTerminator } from "../../ir-mir/contract.js";
import type { BodyRoundDeps } from "./contract.js";
import { bodyFrontier, readLocal } from "./places.js";

function constantPointState(deps: BodyRoundDeps, table: InitializationTable, first: number):
  DataflowResult<{ readonly otherwise: boolean; readonly cells: ReadonlyMap<number, boolean> }> {
  const start = chargeWork(deps.account, 1) ?? chargeResultEntries(deps.account, 1);
  if (start !== null) return start;
  if (table.events.length !== 0)
    return bodyFrontier("Initialization requires the actual completion-event substitution for this call's point state.");
  const initial = requirePresent(table.rows[first], { owner: "analyses/body", query: null, origin: null,
    message: "An actual initialization point retains its canonical default row." });
  if (initial.cell !== null || initial.condition !== 0 && initial.condition !== 1)
    return bodyFrontier("Initialization requires the actual constant point-state condition and default.");
  const cells = new Map<number, boolean>();
  for (let index = first + 1; index < table.rows.length; index += 1) {
    const read = chargeWork(deps.account, 1);
    if (read !== null) return read;
    const row = requirePresent(table.rows[index], { owner: "analyses/body", query: null, origin: null,
      message: "A point's sparse state retains its actual dense row inventory." });
    if (row.point !== initial.point) break;
    if (row.cell === null || row.condition !== 0 && row.condition !== 1)
      return bodyFrontier("Initialization requires the actual constant point-state condition and default.");
    const entry = chargeResultEntries(deps.account, 1);
    if (entry !== null) return entry;
    cells.set(row.cell, row.condition === 1);
  }
  return { kind: "complete", value: { otherwise: initial.condition === 1, cells } };
}

export function captureLocalAtCall(deps: BodyRoundDeps, mir: MirBody,
  operation: Extract<MirTerminator, { readonly kind: "call" }>, summary: Summary, cell: number): DataflowResult<LocalId> {
  const read = chargeWork(deps.account, 3);
  if (read !== null) return read;
  const selected = summary.arena.cells[cell];
  const capture = selected?.role.kind === "capture" && operation.callee.kind === "body"
    ? operation.callee.captures[selected.role.index] : undefined;
  if (capture === undefined)
    return bodyFrontier("Initialization requires the actual immediate captured-slot binding for this callee cell.");
  return { kind: "complete", value: readLocal(mir, { kind: "place", place: capture.place }) };
}

export function callReturnAssigned(deps: BodyRoundDeps, mir: MirBody,
  operation: Extract<MirTerminator, { readonly kind: "call" }>, summary: Summary,
  assigned: ReadonlySet<LocalId>): DataflowResult<ReadonlySet<LocalId>> {
  const read = chargeWork(deps.account, 1);
  if (read !== null) return read;
  const table = summary.initialization;
  if (table.cells.length === 0) return { kind: "complete", value: assigned };
  let first: number | null = null;
  for (let index = 0; index < table.rows.length; index += 1) {
    const read = chargeWork(deps.account, 2);
    if (read !== null) return read;
    const row = requirePresent(table.rows[index], { owner: "analyses/body", query: null, origin: null,
      message: "A returning callee retains its actual initialization table rows." });
    if (row.cell === null && table.points[row.point]?.kind === "return") { first = index; break; }
  }
  if (first === null) return bodyFrontier("Initialization requires the actual finite-return point state for this callee.");
  const state = constantPointState(deps, table, first);
  if (state.kind !== "complete") return state;
  let next: Set<LocalId> | null = null;
  for (let formal = 0; formal < table.cells.length; formal += 1) {
    const read = chargeWork(deps.account, 1);
    if (read !== null) return read;
    if (!(state.value.cells.get(formal) ?? state.value.otherwise)) continue;
    const source = requirePresent(table.cells[formal], { owner: "analyses/body", query: null, origin: null,
      message: "A guaranteed return state retains its actual source cell." });
    const local = captureLocalAtCall(deps, mir, operation, summary, source);
    if (local.kind !== "complete") return local;
    if ((next ?? assigned).has(local.value)) continue;
    if (next === null) {
      const copy = chargeWork(deps.account, assigned.size) ?? chargeResultEntries(deps.account, assigned.size + 1);
      if (copy !== null) return copy;
      next = new Set(assigned);
    }
    const growth = chargeResultEntries(deps.account, 1);
    if (growth !== null) return growth;
    next.add(local.value);
  }
  return { kind: "complete", value: next ?? assigned };
}

export function sourceNeedAssigned(deps: BodyRoundDeps, summary: Summary, first: number,
  bindings: readonly { readonly kind: "cell"; readonly index: number }[], locals: readonly LocalId[],
  assigned: ReadonlySet<LocalId>): DataflowResult<ReadonlySet<LocalId>> {
  const prior = accountFailure(deps.account);
  if (prior !== null) return prior;
  const state = constantPointState(deps, summary.initialization, first);
  if (state.kind !== "complete") return state;
  let next: Set<LocalId> | null = null;
  for (let formal = 0; formal < summary.initialization.cells.length; formal += 1) {
    const read = chargeWork(deps.account, 3);
    if (read !== null) return read;
    if (!(state.value.cells.get(formal) ?? state.value.otherwise)) continue;
    const source = requirePresent(summary.initialization.cells[formal], { owner: "analyses/body", query: null, origin: null,
      message: "A read point's sibling state retains its actual source cell." });
    const binding = requirePresent(bindings[source], { owner: "analyses/body", query: null, origin: null,
      message: "A read point's sibling cell retains its actual caller binding." });
    const local = requirePresent(locals[binding.index], { owner: "analyses/body", query: null, origin: null,
      message: "A bound caller cell retains its actual executing local." });
    if ((next ?? assigned).has(local)) continue;
    if (next === null) {
      const copy = chargeWork(deps.account, assigned.size) ?? chargeResultEntries(deps.account, assigned.size + 1);
      if (copy !== null) return copy;
      next = new Set(assigned);
    }
    const entry = chargeResultEntries(deps.account, 1);
    if (entry !== null) return entry;
    next.add(local);
  }
  return { kind: "complete", value: next ?? assigned };
}

export function recordInitializationPoint(deps: BodyRoundDeps, points: InitializationPoint[], rows: InitializationRow[],
  point: InitializationPoint, captures: readonly LocalId[], assigned: ReadonlySet<LocalId>): DataflowStop | null {
  const growth = chargeWork(deps.account, 1) ?? chargeResultEntries(deps.account, 2);
  if (growth !== null) return growth;
  const index = points.length;
  points.push(point);
  rows.push({ point: index, cell: null, condition: 0 });
  for (let cell = 0; cell < captures.length; cell += 1) {
    const read = chargeWork(deps.account, 1);
    if (read !== null) return read;
    const local = requirePresent(captures[cell], { owner: "analyses/body", query: null, origin: null,
      message: "A point state retains every actual dense capture cell's executing local." });
    if (!assigned.has(local)) continue;
    const row = chargeResultEntries(deps.account, 1);
    if (row !== null) return row;
    rows.push({ point: index, cell, condition: 1 });
  }
  return null;
}

export function captureMustAtExit(deps: BodyRoundDeps, captures: readonly LocalId[], assigned: ReadonlySet<LocalId>,
  previous: ReadonlySet<LocalId> | null): DataflowResult<ReadonlySet<LocalId>> {
  const prior = accountFailure(deps.account);
  if (prior !== null) return prior;
  const growth = chargeWork(deps.account, 1) ?? chargeResultEntries(deps.account, 1);
  if (growth !== null) return growth;
  const next = new Set<LocalId>();
  for (const local of captures) {
    const read = chargeWork(deps.account, 1);
    if (read !== null) return read;
    if (!assigned.has(local) || previous !== null && !previous.has(local)) continue;
    const entry = chargeResultEntries(deps.account, 1);
    if (entry !== null) return entry;
    next.add(local);
  }
  return { kind: "complete", value: next };
}
