import type { CallerRefusal, DataflowResult } from "../../dataflow/contract.js";
import { accountFailure, chargeResultEntries, chargeWork } from "../../dataflow/index.js";
import type { UnitRef } from "../../diag/contract.js";
import { resourceLimitDiagnostic, throwInvariant } from "../../diag/index.js";
import type { AppliedOriginsValue, AppliedSummary, MirPoint, RelationalArena, Summary, SummaryApplicationInput, SummaryKey, ValueEntryBinding } from "../../ir-facts/contract.js";
import { admitSummaryIdentity, applySummary, summaryKey } from "../../ir-facts/index.js";
import type { MirBody, MirOperand, MirTerminator } from "../../ir-mir/contract.js";
import type { ValueContextId } from "../../ids/contract.js";
import type { BodyInstance } from "../../ir-types/contract.js";
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

export function callInstance(operation: Extract<MirTerminator, { readonly kind: "call" }>): BodyInstance {
  if (operation.callee.kind === "body") {
    return operation.callee.instance;
  } else if (operation.callee.kind === "direct" && operation.callee.resolution.activation !== null
    && operation.callee.resolution.decision.activation === null) return operation.callee.resolution.activation;
  return frontier(operation, "BodyAnalysis requires the actual selected argument, receiver and capture transport for this call.");
}

export function scalarArgument(deps: BodyRoundDeps, operation: Extract<MirTerminator, { readonly kind: "call" }>,
  index: number): DataflowResult<MirOperand> {
  const read = chargeWork(deps.account, 1);
  if (read !== null) return read;
  const argument = operation.arguments[index];
  if (argument?.kind !== "value" || argument.passing !== "by-value")
    return frontier(operation, "BodyAnalysis requires the actual selected argument, receiver and capture transport for this call.");
  return { kind: "complete", value: argument.operand };
}

export function callSummary(deps: BodyRoundDeps, body: MirBody,
  operation: Extract<MirTerminator, { readonly kind: "call" }>): DataflowResult<Summary | CallError> {
  const prior = accountFailure(deps.account);
  if (prior !== null) return prior;
  const admission = chargeWork(deps.account, 1) ?? chargeResultEntries(deps.account, 3);
  if (admission !== null) return admission;
  const instance = callInstance(operation);
  if (operation.callee.kind === "body") for (const capture of operation.callee.captures) {
    const work = chargeWork(deps.account, 1);
    if (work !== null) return work;
    if (capture?.capture !== "captured-location")
      return frontier(operation, "BodyAnalysis requires the actual selected argument, receiver and capture transport for this call, including a distinct copied capture slot when selected.");
  }
  if (operation.receiver !== null || operation.callee.kind === "body" && operation.arguments.length !== 0)
    return frontier(operation, "BodyAnalysis requires the actual selected argument, receiver and capture transport for this call.");
  for (let index = 0; index < operation.arguments.length; index += 1) {
    const argument = scalarArgument(deps, operation, index);
    if (argument.kind !== "complete") return argument;
  }
  const key: SummaryKey = { kind: "body", execution: { instance, provided: operation.arguments.length } };
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
  const signatureStop = accountFailure(deps.account);
  if (signatureStop !== null) return signatureStop;
  if (signature.receiver !== null || signature.parameters.length !== operation.arguments.length)
    return frontier(operation, "BodyAnalysis requires the actual selected argument mapping of this callee signature.");
  if (operation.callee.kind === "direct" && (operation.callee.resolution.decision.parameters.length !== operation.arguments.length
    || operation.callee.resolution.decision.completion.signature !== summary.signature
    || operation.callee.resolution.decision.result !== signature.result))
    return frontier(operation, "A direct call retains its actual selected completion and result association.");
  if (operation.callee.kind === "direct") for (let index = 0; index < signature.parameters.length; index += 1) {
    const read = chargeWork(deps.account, 1);
    if (read !== null) return read;
    const mapping = operation.callee.resolution.decision.parameters[index];
    if (signature.parameters[index]?.passing !== "by-value" || mapping?.kind !== "argument" || mapping.parameter !== index
      || mapping.argument !== index || mapping.component !== null || mapping.passing !== "by-value")
      return frontier(operation, "BodyAnalysis requires the actual fixed by-value mapping for each selected argument.");
  }
  if (operation.destination !== null && body.places[operation.destination]?.storage !== signature.result)
    return frontier(operation, "A placed initializer retains its actual selected destination storage and result type.");
  if (summary.unwinds || summary.suspends)
    return frontier(operation, "BodyAnalysis requires the actual unwind or suspension transport of this selected callee.");
  return { kind: "complete", value: summary };
}

function hasReferences(value: AppliedOriginsValue): boolean {
  return value.caller.length + value.callee.length + value.boundaries.length !== 0;
}

export function applyScalarCall(deps: BodyRoundDeps, input: BodyRoundInput,
  operation: Extract<MirTerminator, { readonly kind: "call" }>, point: MirPoint,
  summary: Summary, arena: RelationalArena, context: ValueContextId,
  entries: readonly ValueEntryBinding[], cells: SummaryApplicationInput["cells"]): DataflowResult<AppliedSummary> {
  const admission = chargeWork(deps.account, 2) ?? chargeResultEntries(deps.account, 24);
  if (admission !== null) return admission;
  if (summary.arena.cells.length !== cells.length)
    return frontier(operation, "BodyAnalysis requires the actual caller-cell bindings of this selected callee.");
  const refusal = (limit: "maximumOriginAlternatives" | "maximumConditionAlternatives"): CallerRefusal => ({ kind: "refused", diagnostics: [
    resourceLimitDiagnostic({ owner: "analyses/origins", limit: `analysis.${limit}`, maximum: deps.limits[limit],
      site: { kind: "source", origin: operation.origin }, unit: { request: deps.unit, position: { kind: "result" } } }),
  ] });
  const applied = applySummary({ summary, callee: summary.key, at: { execution: input.execution, point }, context,
    caller: arena, entries, cells, events: [], eventBindings: [] }, {
    account: deps.account, maximumOriginAlternatives: deps.limits.maximumOriginAlternatives,
    maximumConditionAlternatives: deps.limits.maximumConditionAlternatives,
    originRefusal: refusal("maximumOriginAlternatives"), conditionRefusal: refusal("maximumConditionAlternatives"),
  });
  if (applied.kind !== "complete") return applied;
  const value = applied.value;
  const inspection = chargeWork(deps.account, 16);
  if (inspection !== null) return inspection;
  if (hasReferences(value.result) || hasReferences(value.thrown) || value.thrown.includesAbsence)
    return frontier(operation, "BodyAnalysis requires the actual Origins result and thrown-value binding of this call.");
  const effects = value.events.length + value.writes.length + value.concurrentWrites.length
    + value.contentsOnReturn.length + value.contentsOnUnwind.length
    + value.retention.length + value.callbacks.length + value.resultCells.length + value.backing.length;
  if (effects !== 0)
    return frontier(operation, "BodyAnalysis requires the actual caller cell, event, callback or backing producer for these applied effects.");
  for (let index = 0; index < value.subjects.length; index += 1) {
    const work = chargeWork(deps.account, 1);
    if (work !== null) return work;
    const bound = summary.arena.boundProducers[index];
    if (bound === undefined || summary.arena.producers[bound.producer]?.kind !== "capture" || value.subjects[index]?.kind !== "caller")
      return frontier(operation, "BodyAnalysis requires the actual caller cell, event, callback or backing producer for these applied effects.");
  }
  for (const capture of value.captures) {
    const work = chargeWork(deps.account, 1);
    if (work !== null) return work;
    if (capture.source.reads.kind !== "complete" || capture.source.reads.paths.length !== 0
      || capture.source.writes.kind !== "complete" || capture.source.writes.paths.length !== 0)
      return frontier(operation, "BodyAnalysis requires the actual captured subobject read/write transport for these applied effects.");
  }
  for (const row of value.initialization) {
    const read = chargeWork(deps.account, 1);
    if (read !== null) return read;
    if (row.point.kind === "need" ? row.cell?.kind !== "cell" : row.point.kind !== "return" || row.cell !== null)
      return frontier(operation, "BodyAnalysis requires the actual supplied cell and completion-event bindings of these initialization obligations.");
  }
  return applied;
}
