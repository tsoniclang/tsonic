import type { DataflowResult, DataflowStop } from "../../dataflow/contract.js";
import { accountFailure, chargeResultEntries, chargeWork } from "../../dataflow/index.js";
import type { Cause, Diagnostic, DiagnosticCode, ErrorValue, UnitAnswerPosition, UnitDiagnostic, UnitPosition, UnitRef } from "../../diag/contract.js";
import { hostDiagnosticCode, requirePresent } from "../../diag/index.js";
import type { NodeId, NodeRef, Origin } from "../../ids/contract.js";
import type { InitializationPoint, InitializationRow, InitializationTable, MirPoint, Summary } from "../../ir-facts/contract.js";
import { admitSummaryIdentity } from "../../ir-facts/index.js";
import type { MirBody, MirTerminator } from "../../ir-mir/contract.js";
import type { Execution } from "../../ir-types/contract.js";
import { executionKey } from "../../ir-types/index.js";
import type { BodyRoundDeps, BodyRoundResult } from "./contract.js";
import { bodyFrontier, readLocal } from "./places.js";
import type { StaticCalleeCells } from "./static-calls.js";

export interface UninitializedRead {
  readonly local: number;
  readonly origin: Origin;
  readonly declaration: Origin | null;
}

export function recordUninitializedRead(deps: BodyRoundDeps, mir: MirBody, reads: Map<NodeId, UninitializedRead> | null,
  node: NodeId, local: number, origin: Origin): DataflowResult<Map<NodeId, UninitializedRead>> {
  const admission = chargeWork(deps.account, 2) ?? chargeResultEntries(deps.account, 1);
  if (admission !== null) return admission;
  if (reads !== null) {
    const previous = reads.get(node);
    if (previous !== undefined) {
      if (previous.local !== local) return bodyFrontier("One actual read occurrence retains the same lowered storage local.");
      return { kind: "complete", value: reads };
    }
  }
  const growth = chargeResultEntries(deps.account, reads === null ? 3 : 2);
  if (growth !== null) return growth;
  const storage = requirePresent(mir.locals[local], { owner: "analyses/body", query: null, origin,
    message: "An unmet own-storage read retains its actual lowered local." });
  const retained = reads ?? new Map();
  retained.set(node, { local, origin, declaration: storage.origin });
  return { kind: "complete", value: retained };
}

function uninitializedDiagnostic(unit: UnitRef, origin: Origin, declaration: Origin | null): UnitDiagnostic {
  const name = hostDiagnosticCode("TSONIC_READ_BEFORE_INITIALIZATION");
  const code: DiagnosticCode = { kind: "host", name, rendered: name };
  return { identity: { kind: "host", unit, code: name }, diagnostic: { code, severity: "error", site: { kind: "source", origin },
    source: "analyses/body", evidence: [], message: "The execution reads its own storage before initialization.", arguments: [],
    related: declaration === null ? [] : [{ code, site: { kind: "source", origin: declaration }, message: "The storage is introduced here." }], fix: null } };
}

export interface PlacedInitializationRead {
  readonly node: NodeRef;
  readonly point: MirPoint;
  readonly origin: Origin;
}

export function initializationError(deps: BodyRoundDeps, execution: Execution, reads: ReadonlyMap<NodeId, UninitializedRead> | null,
  placed: PlacedInitializationRead | null, dependency: readonly UnitRef[]): BodyRoundResult {
  const count = reads?.size ?? 0;
  const allocation = chargeWork(deps.account, 2 + count * 3 + (placed === null ? 0 : 5))
    ?? chargeResultEntries(deps.account, 8 + count * 15 + (placed === null ? 0 : 11))
    ?? admitSummaryIdentity({ kind: "body", execution }, deps.account);
  if (allocation !== null) return allocation;
  const key = executionKey(execution);
  const positions: UnitAnswerPosition[] = [];
  const diagnostics: Diagnostic[] = [];
  const emissions: UnitDiagnostic[] = [];
  const causes: Cause[] = [];
  if (reads !== null) for (const [node, read] of reads) {
    const position: UnitPosition = { kind: "execution-source-node", execution: key, node: { body: execution.instance.body, node } };
    const unit = { request: deps.unit, position };
    const emission = uninitializedDiagnostic(unit, read.origin, read.declaration);
    const error: ErrorValue = { kind: "error", causes: [{ kind: "diagnostic", diagnostic: emission.identity }] };
    positions.push({ position, error });
    diagnostics.push(emission.diagnostic);
    emissions.push(emission);
    causes.push({ kind: "unit", unit });
  }
  const result: UnitPosition = { kind: "execution-result", execution: key };
  if (placed !== null) {
    if (placed.node.body !== execution.instance.body || placed.point.statement !== null || reads?.has(placed.node.node) === true)
      return bodyFrontier("A placed initialization detector requires a distinct actual call occurrence of the executing body.");
    const position: UnitPosition = { kind: "execution-source-node", execution: key, node: placed.node };
    const unit = { request: deps.unit, position };
    const emission = uninitializedDiagnostic(unit, placed.origin, null);
    diagnostics.push(emission.diagnostic);
    emissions.push(emission);
    positions.push({ position, error: { kind: "error", causes: [{ kind: "diagnostic", diagnostic: emission.identity }] } });
    causes.push({ kind: "unit", unit });
  }
  for (let index = 0; index < dependency.length; index += 1) {
    const admitted = chargeWork(deps.account, 1) ?? chargeResultEntries(deps.account, 1);
    if (admitted !== null) return admitted;
    const unit = dependency[index];
    if (unit === undefined) return bodyFrontier("An absorbed initialization cause must name its actual ground.");
    causes.push({ kind: "unit", unit });
  }
  const [first, ...rest] = causes;
  const error: ErrorValue = { kind: "error", causes: [requirePresent(first, { owner: "analyses/body", query: null,
    origin: null, message: "An unsuccessful execution retains its actual initialization cause." }), ...rest] };
  positions.push({ position: result, error });
  return { kind: "complete", value: { kind: "ok", value: error, diagnostics, emissions, positions } };
}

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

export function callSlotAt(deps: BodyRoundDeps, mir: MirBody,
  operation: Extract<MirTerminator, { readonly kind: "call" }>, summary: Summary, cell: number,
  staticSlot: StaticCalleeCells | null): DataflowResult<number> {
  const read = chargeWork(deps.account, 3);
  if (read !== null) return read;
  const selected = summary.arena.cells[cell];
  if (selected?.role.kind === "static") {
    const slot = staticSlot?.(summary, cell);
    if (slot === undefined) return bodyFrontier("Initialization requires the actual static-slot binding for this callee declaration.");
    return { kind: "complete", value: slot };
  }
  const capture = selected?.role.kind === "capture" && operation.callee.kind === "body"
    ? operation.callee.captures[selected.role.index] : undefined;
  if (capture === undefined)
    return bodyFrontier("Initialization requires the actual immediate captured-slot binding for this callee cell.");
  return { kind: "complete", value: readLocal(mir, { kind: "place", place: capture.place }) };
}

export function callExitAssigned(deps: BodyRoundDeps, mir: MirBody,
  operation: Extract<MirTerminator, { readonly kind: "call" }>, summary: Summary,
  assigned: ReadonlySet<number>, kind: "return" | "unwind", staticSlot: StaticCalleeCells | null = null): DataflowResult<ReadonlySet<number>> {
  const read = chargeWork(deps.account, 1);
  if (read !== null) return read;
  const table = summary.initialization;
  if (table.cells.length === 0) return { kind: "complete", value: assigned };
  let first: number | null = null;
  for (let index = 0; index < table.rows.length; index += 1) {
    const read = chargeWork(deps.account, 2);
    if (read !== null) return read;
    const row = requirePresent(table.rows[index], { owner: "analyses/body", query: null, origin: null,
      message: "A finite callee exit retains its actual initialization table rows." });
    if (row.cell === null && table.points[row.point]?.kind === kind) { first = index; break; }
  }
  if (first === null) return bodyFrontier(`Initialization requires the actual finite-${kind} point state for this callee.`);
  const state = constantPointState(deps, table, first);
  if (state.kind !== "complete") return state;
  let next: Set<number> | null = null;
  for (let formal = 0; formal < table.cells.length; formal += 1) {
    const read = chargeWork(deps.account, 1);
    if (read !== null) return read;
    if (!(state.value.cells.get(formal) ?? state.value.otherwise)) continue;
    const source = requirePresent(table.cells[formal], { owner: "analyses/body", query: null, origin: null,
      message: "A guaranteed finite exit state retains its actual source cell." });
    const local = callSlotAt(deps, mir, operation, summary, source, staticSlot);
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
  bindings: readonly { readonly kind: "cell"; readonly index: number }[], locals: readonly number[],
  assigned: ReadonlySet<number>): DataflowResult<ReadonlySet<number>> {
  const prior = accountFailure(deps.account);
  if (prior !== null) return prior;
  const state = constantPointState(deps, summary.initialization, first);
  if (state.kind !== "complete") return state;
  let next: Set<number> | null = null;
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
  point: InitializationPoint, captures: readonly number[], assigned: ReadonlySet<number>): DataflowStop | null {
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

export function cellMustAtExit(deps: BodyRoundDeps, captures: readonly number[], assigned: ReadonlySet<number>,
  previous: ReadonlySet<number> | null): DataflowResult<ReadonlySet<number>> {
  const prior = accountFailure(deps.account);
  if (prior !== null) return prior;
  const growth = chargeWork(deps.account, 1) ?? chargeResultEntries(deps.account, 1);
  if (growth !== null) return growth;
  const next = new Set<number>();
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
