import type { CallerRefusal, DataflowResult, DataflowStop } from "../../dataflow/contract.js";
import { accountFailure, chargeResultEntries, chargeWork } from "../../dataflow/index.js";
import type { UnitRef } from "../../diag/contract.js";
import { requirePresent, resourceLimitDiagnostic, throwInvariant } from "../../diag/index.js";
import type { AppliedSummary, BoundInitializationRow, CaptureBinding, CaptureLocation, MirPoint, RelationalArena, Summary, SummaryApplicationInput, SummaryKey, ValueArgument, ValueEntryBinding } from "../../ir-facts/contract.js";
import { admitSummaryIdentity, applySummary, bindInitialization, summaryKey } from "../../ir-facts/index.js";
import type { MirBody, MirOperand, MirTerminator } from "../../ir-mir/contract.js";
import type { LocalId, OriginsId, PlaceId, ValueContextId } from "../../ids/contract.js";
import { valueContextId } from "../../ids/index.js";
import type { BodyInstance, Signature } from "../../ir-types/contract.js";
import type { BodyRoundDeps, BodyRoundInput, RoundCallRead, RoundLeast } from "./contract.js";
import { valueKind } from "./values.js";
import { readLocal } from "./places.js";
import { callWrites, primitiveExitLocals } from "./writes.js";
import type { StaticCalleeCells } from "./static-calls.js";

export type CallCaptureTransport = { readonly place: PlaceId } & (
  | { readonly kind: "value" }
  | { readonly kind: "location"; readonly binding: CaptureLocation });

export interface CallError {
  readonly kind: "error";
  readonly key: string;
  readonly grounds: readonly [UnitRef, ...UnitRef[]];
  readonly provided: number;
}

type SelectedBodySummary = Summary & { readonly key: Extract<SummaryKey, { readonly kind: "body" }> };
export type SelectedCall = SelectedBodySummary | CallError | RoundLeast;

function isAdmittedBodySummary(_summary: Summary, offered: SummaryKey): _summary is SelectedBodySummary {
  return offered.kind === "body";
}

function isAdmittedLeast(selected: Summary | RoundLeast, least: RoundLeast | null): selected is RoundLeast {
  return selected === least;
}

function frontier(operation: MirTerminator, message: string): never {
  return throwInvariant({ owner: "analyses/body", query: null, origin: operation.origin, message });
}

export function isCallError(value: SelectedCall): value is CallError {
  return "kind" in value && value.kind === "error";
}

export function isLeastCall(value: SelectedCall): value is RoundLeast {
  return "kind" in value && value.kind === "least";
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
  operation: Extract<MirTerminator, { readonly kind: "call" }>, answers?: Map<string, RoundCallRead>): DataflowResult<SelectedCall> {
  const prior = accountFailure(deps.account);
  if (prior !== null) return prior;
  const admission = chargeWork(deps.account, 1) ?? chargeResultEntries(deps.account, 3);
  if (admission !== null) return admission;
  const instance = callInstance(operation);
  if (operation.callee.kind === "body") for (let index = 0; index < operation.callee.captures.length; index += 1) {
    const work = chargeWork(deps.account, 1);
    if (work !== null) return work;
    const capture = operation.callee.captures[index];
    if (capture?.capture !== "captured-location" && capture?.capture !== "captured-value")
      return frontier(operation, "BodyAnalysis requires the actual selected argument, receiver and capture transport for this call.");
  }
  if (operation.receiver !== null || operation.callee.kind === "body" && operation.arguments.length !== 0)
    return frontier(operation, "BodyAnalysis requires the actual selected argument, receiver and capture transport for this call.");
  let provided = 0;
  let signature: Signature | null = null;
  if (operation.callee.kind !== "body") for (let index = 0; index < operation.arguments.length; index += 1) {
    const work = chargeWork(deps.account, 1);
    if (work !== null) return work;
    const argument = operation.arguments[index];
    if (argument?.kind === "omitted") {
      const decision = operation.callee.resolution.decision;
      const mapping = decision.parameters[index];
      if (mapping?.parameter !== index || mapping.kind !== "default" && mapping.kind !== "omitted")
        return frontier(operation, "BodyAnalysis requires the actual selected argument omission and default mapping.");
      if (signature === null) {
        const signatureRead = chargeWork(deps.account, 1);
        if (signatureRead !== null) return signatureRead;
        signature = deps.signatureOf(decision.completion.signature);
        const stopped = accountFailure(deps.account);
        if (stopped !== null) return stopped;
      }
      const formalRead = chargeWork(deps.account, 1);
      if (formalRead !== null) return formalRead;
      const formal = signature.parameters[index];
      if (mapping.kind === "omitted") {
        if (formal?.kind !== "optional" || !formal.acceptsOmission || formal.passing !== "by-value"
          || formal.initializer !== null || mapping.type !== formal.type)
          return frontier(operation, "BodyAnalysis requires the actual absence omission of a selected formal without an initializer.");
      } else if (formal?.kind !== "default" || !formal.acceptsOmission || formal.passing !== "by-value"
          || formal.initializer !== mapping.initializer)
        return frontier(operation, "BodyAnalysis requires the actual default of each omitted fixed formal.");
      continue;
    }
    if (index !== provided || argument?.kind !== "value" || argument.passing !== "by-value")
      return frontier(operation, "BodyAnalysis requires the actual selected argument, receiver and capture transport for this call.");
    provided += 1;
  }
  const key: SummaryKey = { kind: "body", execution: { instance, provided } };
  const identity = admitSummaryIdentity(key, deps.account);
  if (identity !== null) return identity;
  const requested = summaryKey(key);
  const read = chargeWork(deps.account, 1);
  if (read !== null) return read;
  let answer = answers?.get(requested);
  if (answer === undefined) {
    const retain = chargeResultEntries(deps.account, answers === undefined ? 0 : 1);
    if (retain !== null) return retain;
    answer = deps.summaryOf(key, requested);
    const stopped = accountFailure(deps.account);
    if (stopped !== null) return stopped;
    answers?.set(requested, answer);
  }
  let admittedRead: Summary | RoundLeast;
  let leastRead: RoundLeast | null = null;
  if ("kind" in answer) {
    switch (answer.kind) {
      case "prior-error":
        return { kind: "complete", value: { kind: "error", key: requested, grounds: answer.grounds, provided } };
      case "prior-summary":
        admittedRead = answer.summary;
        break;
      case "least":
        admittedRead = answer;
        leastRead = answer;
        break;
    }
  } else {
    if ("kind" in answer.value) {
      const growth = chargeResultEntries(deps.account, 1);
      return growth ?? { kind: "complete", value: { kind: "error", key: requested, grounds: [answer.unit], provided } };
    }
    admittedRead = answer.value;
  }
  const selected = admittedRead;
  const least = isAdmittedLeast(selected, leastRead);
  const offered: SummaryKey = least ? { kind: "body", execution: selected.execution } : selected.key;
  const returned = admitSummaryIdentity(offered, deps.account);
  if (returned !== null) return returned;
  if ((!least && !isAdmittedBodySummary(selected, offered)) || summaryKey(offered) !== requested)
    return frontier(operation, "A call reads the Summary of its exact complete selected execution and provided count.");
  if (least && (selected.entry.provided !== provided || operation.step !== null))
    return frontier(operation, "A private least relation requires the actual selected ordinary entry and provided count.");
  const signatureId = selected.signature;
  if (signature === null) {
    const signatureRead = chargeWork(deps.account, 1);
    if (signatureRead !== null) return signatureRead;
    signature = deps.signatureOf(signatureId);
    const signatureStop = accountFailure(deps.account);
    if (signatureStop !== null) return signatureStop;
  }
  if (signature.receiver !== null || signature.parameters.length !== operation.arguments.length)
    return frontier(operation, "BodyAnalysis requires the actual selected argument mapping of this callee signature.");
  if (operation.callee.kind === "direct" && (operation.callee.resolution.decision.parameters.length !== operation.arguments.length
    || operation.callee.resolution.decision.completion.signature !== signatureId
    || operation.callee.resolution.decision.result !== signature.result))
    return frontier(operation, "A direct call retains its actual selected completion and result association.");
  if (operation.callee.kind === "direct") for (let index = 0; index < provided; index += 1) {
    const read = chargeWork(deps.account, 1);
    if (read !== null) return read;
    const mapping = operation.callee.resolution.decision.parameters[index];
    const formal = signature.parameters[index];
    if (formal?.passing !== "by-value" || mapping?.kind !== "argument" || mapping.parameter !== index
      || mapping.argument !== index || mapping.component !== null || mapping.passing !== "by-value")
      return frontier(operation, "BodyAnalysis requires the actual fixed by-value mapping for each selected argument.");
  }
  if (least) return { kind: "complete", value: selected };
  if (operation.destination !== null && body.places[operation.destination]?.storage !== signature.result)
    return frontier(operation, "A placed initializer retains its actual selected destination storage and result type.");
  if (selected.suspends)
    return frontier(operation, "BodyAnalysis requires the actual suspension transport of this selected callee.");
  if (selected.unwinds && operation.unwind.kind !== "escape")
    return frontier(operation, "BodyAnalysis requires the actual selected callee failure continuation and its handled state transport.");
  return { kind: "complete", value: selected };
}

function callRelationRefusal(deps: BodyRoundDeps, operation: MirTerminator,
  limit: "maximumOriginAlternatives" | "maximumConditionAlternatives"): CallerRefusal {
  return { kind: "refused", diagnostics: [
    resourceLimitDiagnostic({ owner: "analyses/body", limit: `analysis.${limit}`, maximum: deps.limits[limit],
      site: { kind: "source", origin: operation.origin }, unit: { request: deps.unit, position: { kind: "result" } } }),
  ] };
}

export function bindCallInitialization(deps: BodyRoundDeps, operation: Extract<MirTerminator, { readonly kind: "call" }>,
  summary: Summary, caller: RelationalArena, bindings: readonly { readonly kind: "cell"; readonly index: number }[]):
  DataflowResult<readonly BoundInitializationRow[]> {
  const setup = chargeWork(deps.account, 1) ?? chargeResultEntries(deps.account, 12);
  if (setup !== null) return setup;
  const cells = [];
  for (const cell of summary.initialization.cells) {
    const read = chargeWork(deps.account, 1) ?? chargeResultEntries(deps.account, 1);
    if (read !== null) return read;
    cells.push(requirePresent(bindings[cell], { owner: "analyses/body", query: null, origin: operation.origin,
      message: "A callee initialization formal retains its actual caller cell binding." }));
  }
  return bindInitialization({ application: { owner: { kind: "summary", key: summary.key }, arena: summary.arena,
    table: summary.initialization, binding: { cells, events: [] } }, caller, events: [] },
  { account: deps.account, maximumConditionAlternatives: deps.limits.maximumConditionAlternatives,
    refusal: callRelationRefusal(deps, operation, "maximumConditionAlternatives"), eventCount: 0 });
}

export function applyScalarCall(deps: BodyRoundDeps, input: BodyRoundInput,
  operation: Extract<MirTerminator, { readonly kind: "call" }>, point: MirPoint,
  summary: Summary, arena: RelationalArena, context: ValueContextId,
  entries: readonly ValueEntryBinding[], cells: SummaryApplicationInput["cells"],
  onParameterEffect: (access: "read" | "write", parameter: AppliedSummary["parameters"][number]) => DataflowStop | null): DataflowResult<AppliedSummary> {
  const admission = chargeWork(deps.account, 2) ?? chargeResultEntries(deps.account, 24);
  if (admission !== null) return admission;
  if (summary.arena.cells.length !== cells.length)
    return frontier(operation, "BodyAnalysis requires the actual caller-cell bindings of this selected callee.");
  const applied = applySummary({ summary, callee: summary.key, at: { execution: input.execution, point }, context,
    caller: arena, entries, cells, events: [], eventBindings: [] }, {
    account: deps.account, maximumOriginAlternatives: deps.limits.maximumOriginAlternatives,
    maximumConditionAlternatives: deps.limits.maximumConditionAlternatives,
    originRefusal: callRelationRefusal(deps, operation, "maximumOriginAlternatives"),
    conditionRefusal: callRelationRefusal(deps, operation, "maximumConditionAlternatives"),
  });
  if (applied.kind !== "complete") return applied;
  const value = applied.value;
  const inspection = chargeWork(deps.account, 16);
  if (inspection !== null) return inspection;
  if (value.result.callee.length !== 0 || value.result.boundaries.length !== 0
    || value.thrown.callee.length !== 0 || value.thrown.boundaries.length !== 0)
    return frontier(operation, "BodyAnalysis requires the actual Origins result and thrown-value binding of this call.");
  const effects = value.events.length + value.concurrentWrites.length
    + value.callbacks.length + value.resultCells.length + value.backing.length;
  if (effects !== 0)
    return frontier(operation, "BodyAnalysis requires the actual caller cell, event, callback or backing producer for these applied effects.");
  const written = callWrites(deps, operation, cells, summary.writes, value.writes)
    ?? callWrites(deps, operation, cells, summary.contentsOnReturn, value.contentsOnReturn)
    ?? callWrites(deps, operation, cells, summary.contentsOnUnwind, value.contentsOnUnwind);
  if (written !== null) return written;
  for (let index = 0; index < value.subjects.length; index += 1) {
    const work = chargeWork(deps.account, 1);
    if (work !== null) return work;
    const bound = requirePresent(summary.arena.boundProducers[index], { owner: "analyses/body", query: null, origin: operation.origin,
      message: "Canonical application retains every actual source bound subject." });
    const producer = summary.arena.producers[bound.producer];
    if (producer === undefined || producer.path !== null || producer.kind !== "capture" && producer.kind !== "parameter"
      || value.subjects[index]?.kind !== "caller")
      return frontier(operation, "BodyAnalysis requires the actual caller cell, event, callback or backing producer for these applied effects.");
  }
  for (const parameter of value.parameters) {
    const work = chargeWork(deps.account, 1);
    if (work !== null) return work;
    if (parameter.source.reads.kind !== "complete" || parameter.source.writes.kind !== "complete"
      || (parameter.source.reads.paths.length !== 0 || parameter.source.writes.paths.length !== 0) && parameter.source.slot.kind !== "parameter")
      return frontier(operation, "BodyAnalysis requires the actual parameter subobject read/write transport for these applied effects.");
    if (parameter.source.reads.paths.length !== 0) {
      const stopped = onParameterEffect("read", parameter);
      if (stopped !== null) return stopped;
    }
    if (parameter.source.writes.paths.length !== 0) {
      const stopped = onParameterEffect("write", parameter);
      if (stopped !== null) return stopped;
    }
  }
  for (const retained of value.retention) {
    const work = chargeWork(deps.account, 1);
    if (work !== null) return work;
    if (retained.into.kind !== "return" && retained.into.kind !== "throw"
      && (retained.into.kind !== "capture" || retained.into.path !== null || operation.callee.kind !== "body")
      || retained.value.kind !== "caller")
      return frontier(operation, "BodyAnalysis requires the actual external retention transport for these applied effects.");
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
    if (row.point.kind === "need" ? row.cell?.kind !== "cell"
      : row.point.kind !== "return" && row.point.kind !== "unwind" || row.cell !== null && row.cell.kind !== "cell")
      return frontier(operation, "BodyAnalysis requires the actual supplied cell and completion-event bindings of these initialization obligations.");
  }
  return applied;
}

export type CallValueEffects =
  | { readonly kind: "primitive"; readonly contents: readonly number[] }
  | { readonly kind: "applied"; readonly value: AppliedSummary };

export function callCellIndex(summary: Summary, source: number, captures: readonly CallCaptureTransport[],
  statics: StaticCalleeCells | null): number | undefined {
  const role = summary.arena.cells[source]?.role;
  if (role?.kind === "capture") {
    const transport = captures[role.index];
    return transport?.kind === "location" ? transport.binding.cell : undefined;
  }
  return role?.kind === "static" && statics !== null ? statics(summary, source) : undefined;
}

export function callCaptureBindings(deps: BodyRoundDeps, operation: Extract<MirTerminator, { readonly kind: "call" }>,
  selected: readonly CallCaptureTransport[],
  copy: (place: Extract<MirOperand, { readonly kind: "place" }>) => OriginsId,
): DataflowResult<readonly CaptureBinding[]> {
  if (selected.length === 0) return { kind: "complete", value: [] };
  const setup = chargeResultEntries(deps.account, 1);
  if (setup !== null) return setup;
  const captures: CaptureBinding[] = [];
  for (let position = 0; position < selected.length; position += 1) {
    const read = chargeWork(deps.account, 1) ?? chargeResultEntries(deps.account, 1);
    if (read !== null) return read;
    const capture = requirePresent(selected[position], { owner: "analyses/body", query: null, origin: operation.origin,
      message: "A body call retains every actual prepared capture transport." });
    if (capture.kind === "location") captures.push(capture.binding);
    else {
      const growth = chargeWork(deps.account, 1) ?? chargeResultEntries(deps.account, 2);
      if (growth !== null) return growth;
      captures.push({ index: position, origins: copy({ kind: "place", place: capture.place }) });
    }
  }
  return { kind: "complete", value: captures };
}

export function callValueEffects(deps: BodyRoundDeps, input: BodyRoundInput,
  operation: Extract<MirTerminator, { readonly kind: "call" }>, point: MirPoint, summary: SelectedBodySummary,
  arena: RelationalArena, state: readonly OriginsId[], constants: readonly OriginsId[],
  captures: readonly CallCaptureTransport[], statics: StaticCalleeCells | null, objectValues: ReadonlySet<LocalId> | null): DataflowResult<CallValueEffects> {
  let usePrimitiveContents = true;
  if (operation.destination !== null) {
    const read = chargeWork(deps.account, 1);
    if (read !== null) return read;
    const signature = deps.signatureOf(summary.signature);
    const stopped = accountFailure(deps.account);
    if (stopped !== null) return stopped;
    const holdingRead = objectValues === null ? null : chargeWork(deps.account, 2);
    if (holdingRead !== null) return holdingRead;
    const place = objectValues === null ? undefined : input.mir.places[operation.destination];
    const kind = place?.base.kind === "local" && place.storage === signature.result && objectValues?.has(place.base.local) === true
      ? "reference" : valueKind(deps, signature.result);
    const classified = accountFailure(deps.account);
    if (classified !== null) return classified;
    if (kind === null) return frontier(operation, "BodyAnalysis requires the actual selected call-result representation and Origins producer.");
    usePrimitiveContents = kind !== "reference" && kind !== "primitive-optional" && kind !== "reference-optional";
  }
  if (usePrimitiveContents) {
    const contents = primitiveExitLocals(deps, input, operation, summary, "return");
    if (contents.kind !== "complete") return contents;
    if (contents.value !== null) {
      const output = chargeResultEntries(deps.account, 1);
      if (output !== null) return output;
      return { kind: "complete", value: { kind: "primitive", contents: contents.value } };
    }
  }
  const provided = summary.key.execution.provided;
  const setup = chargeWork(deps.account, operation.arguments.length + arena.contexts.length)
    ?? chargeResultEntries(deps.account, operation.arguments.length + arena.contexts.length + 3);
  if (setup !== null) return setup;
  const arguments_: ValueArgument[] = [];
  for (let index = 0; index < operation.arguments.length; index += 1) {
    const argument = operation.arguments[index];
    if (index >= provided) {
      arguments_.push({ kind: "omitted" });
      continue;
    }
    if (argument?.kind !== "value") return frontier(operation, "A selected by-value call retains its actual operand.");
    const operand = argument.operand;
    arguments_.push({ kind: "provided", origins: requirePresent(
      operand.kind === "constant" ? constants[operand.constant] : state[Number(readLocal(input.mir, operand))],
      { owner: "analyses/body", query: null, origin: operation.origin, message: "A selected argument retains its actual value-flow Origins." }) });
  }
  const entries: ValueEntryBinding[] = [];
  for (const bound of summary.arena.boundProducers) {
    const work = chargeWork(deps.account, 1) ?? chargeResultEntries(deps.account, 1);
    if (work !== null) return work;
    const producer = summary.arena.producers[bound.producer];
    const captured = producer?.kind === "capture" && producer.path === null && operation.callee.kind === "body"
      ? captures[producer.index] : undefined;
    if (captured !== undefined) {
      const local = readLocal(input.mir, { kind: "place", place: captured.place });
      entries.push({ formal: bound.id, actual: requirePresent(state[local], { owner: "analyses/body", query: null,
        origin: operation.origin, message: "A selected capture retains its actual caller slot content at this call." }) });
    } else if (producer?.kind === "parameter" && producer.path === null && operation.callee.kind === "direct") {
      const slot = arguments_[producer.index];
      if (slot?.kind !== "provided") return frontier(operation, "An incoming formal value requires an actual provided argument.");
      entries.push({ formal: bound.id, actual: slot.origins });
    } else return frontier(operation, "BodyAnalysis requires the actual selected non-formal reference binding for this call.");
  }
  const cellWork = chargeWork(deps.account, summary.arena.cells.length) ?? chargeResultEntries(deps.account, summary.arena.cells.length);
  if (cellWork !== null) return cellWork;
  const cells: SummaryApplicationInput["cells"][number][] = [];
  for (const cell of summary.arena.cells) {
    const location = callCellIndex(summary, cell.id, captures, statics);
    if (location === undefined) return frontier(operation, "A selected callee cell requires its actual static, capture or created-cell binding.");
    cells.push({ kind: "cell", index: location });
  }
  const context = valueContextId(arena.contexts.length);
  const environment = callCaptureBindings(deps, operation, captures, place => requirePresent(state[readLocal(input.mir, place)], {
    owner: "analyses/body", query: null, origin: operation.origin, message: "A copied capture retains its value at invocation." }));
  if (environment.kind !== "complete") return environment;
  const caller = { ...arena, contexts: [...arena.contexts, { id: context, receiver: null, arguments: arguments_, captures: environment.value }] };
  const applied = applyScalarCall(deps, input, operation, point, summary, caller, context, entries, cells, () => null);
  if (applied.kind !== "complete") return applied;
  const output = chargeResultEntries(deps.account, 1);
  if (output !== null) return output;
  return { kind: "complete", value: { kind: "applied", value: applied.value } };
}
