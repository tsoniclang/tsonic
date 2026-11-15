import type { CallerRefusal, DataflowResult } from "../../dataflow/contract.js";
import { accountFailure, chargeResultEntries, chargeWork } from "../../dataflow/index.js";
import type { UnitRef } from "../../diag/contract.js";
import { resourceLimitDiagnostic, throwInvariant } from "../../diag/index.js";
import type { AppliedOriginsValue, MirPoint, RelationalArena, Summary, SummaryKey } from "../../ir-facts/contract.js";
import { admitSummaryIdentity, applySummary, summaryKey } from "../../ir-facts/index.js";
import type { MirBody, MirCallee, MirTerminator } from "../../ir-mir/contract.js";
import type { ValueContextId } from "../../ids/contract.js";
import type { BodyRoundDeps, BodyRoundInput } from "./contract.js";

export interface CallError {
  readonly kind: "error";
  readonly key: string;
  readonly unit: UnitRef;
}

function frontier(operation: MirTerminator, message: string): never {
  return throwInvariant({ owner: "analyses/body", query: null, origin: operation.origin, message });
}

export function isCallError(value: ReadonlySet<unknown> | Summary | CallError | null): value is CallError {
  return value !== null && "kind" in value;
}

export function initializerCallee(operation: Extract<MirTerminator, { readonly kind: "call" }>): Extract<MirCallee, { readonly kind: "body" }> {
  if (operation.callee.kind !== "body")
    return frontier(operation, "BodyAnalysis requires the actual selected argument, receiver and capture transport for this call.");
  return operation.callee;
}

export function callSummary(deps: BodyRoundDeps, body: MirBody,
  operation: Extract<MirTerminator, { readonly kind: "call" }>): DataflowResult<Summary | CallError> {
  const prior = accountFailure(deps.account);
  if (prior !== null) return prior;
  const admission = chargeWork(deps.account, 1) ?? chargeResultEntries(deps.account, 3);
  if (admission !== null) return admission;
  const callee = initializerCallee(operation);
  if (operation.receiver !== null || operation.arguments.length !== 0 || callee.captures.length !== 0)
    return frontier(operation, "BodyAnalysis requires the actual selected argument, receiver and capture transport for this call.");
  const key: SummaryKey = { kind: "body", execution: { instance: callee.instance, provided: operation.arguments.length } };
  const identity = admitSummaryIdentity(key, deps.account);
  if (identity !== null) return identity;
  const requested = summaryKey(key);
  const read = chargeWork(deps.account, 1);
  if (read !== null) return read;
  const answer = deps.summaryOf(key);
  const stopped = accountFailure(deps.account);
  if (stopped !== null) return stopped;
  const summary = answer.value;
  if ("kind" in summary) return { kind: "complete", value: { kind: "error", key: requested, unit: answer.unit } };
  const returned = admitSummaryIdentity(summary.key, deps.account);
  if (returned !== null) return returned;
  if (summaryKey(summary.key) !== requested)
    return frontier(operation, "A call reads the Summary of its exact complete selected execution and provided count.");
  const signatureRead = chargeWork(deps.account, 1);
  if (signatureRead !== null) return signatureRead;
  const signature = deps.signatureOf(summary.signature);
  if (signature.receiver !== null || signature.parameters.length !== 0)
    return frontier(operation, "BodyAnalysis requires the actual selected argument mapping of this callee signature.");
  if (operation.destination !== null && body.places[operation.destination]?.storage !== signature.result)
    return frontier(operation, "A placed initializer retains its actual selected destination storage and result type.");
  if (summary.unwinds || summary.suspends)
    return frontier(operation, "BodyAnalysis requires the actual unwind or suspension transport of this selected callee.");
  return { kind: "complete", value: summary };
}

function hasReferences(value: AppliedOriginsValue): boolean {
  return value.caller.length + value.callee.length + value.boundaries.length !== 0 || value.includesAbsence;
}

export function applyScalarCall(deps: BodyRoundDeps, input: BodyRoundInput,
  operation: Extract<MirTerminator, { readonly kind: "call" }>, point: MirPoint,
  summary: Summary, arena: RelationalArena, context: ValueContextId): DataflowResult<Summary> {
  const admission = chargeWork(deps.account, 2) ?? chargeResultEntries(deps.account, 24);
  if (admission !== null) return admission;
  if (summary.arena.cells.length !== 0)
    return frontier(operation, "BodyAnalysis requires the actual caller-cell bindings of this selected callee.");
  const refusal = (limit: "maximumOriginAlternatives" | "maximumConditionAlternatives"): CallerRefusal => ({ kind: "refused", diagnostics: [
    resourceLimitDiagnostic({ owner: "analyses/origins", limit: `analysis.${limit}`, maximum: deps.limits[limit],
      site: { kind: "source", origin: operation.origin }, unit: { request: deps.unit, position: { kind: "result" } } }),
  ] });
  const applied = applySummary({ summary, callee: summary.key, at: { execution: input.execution, point }, context,
    caller: arena, entries: [], cells: [], events: [], eventBindings: [] }, {
    account: deps.account, maximumOriginAlternatives: deps.limits.maximumOriginAlternatives,
    maximumConditionAlternatives: deps.limits.maximumConditionAlternatives,
    originRefusal: refusal("maximumOriginAlternatives"), conditionRefusal: refusal("maximumConditionAlternatives"),
  });
  if (applied.kind !== "complete") return applied;
  const value = applied.value;
  const inspection = chargeWork(deps.account, 16);
  if (inspection !== null) return inspection;
  if (hasReferences(value.result) || hasReferences(value.thrown))
    return frontier(operation, "BodyAnalysis requires the actual Origins result and thrown-value binding of this call.");
  const effects = value.cells.length + value.subjects.length + value.events.length + value.writes.length + value.concurrentWrites.length
    + value.contentsOnReturn.length + value.contentsOnUnwind.length + value.parameters.length + value.captures.length
    + value.retention.length + value.callbacks.length + value.resultCells.length + value.backing.length;
  if (effects !== 0)
    return frontier(operation, "BodyAnalysis requires the actual caller cell, event, callback or backing producer for these applied effects.");
  for (const row of value.initialization) {
    const read = chargeWork(deps.account, 1);
    if (read !== null) return read;
    if (row.cell !== null || row.point.kind !== "return")
      return frontier(operation, "BodyAnalysis requires the actual supplied cell and completion-event bindings of these initialization obligations.");
  }
  return { kind: "complete", value: summary };
}
