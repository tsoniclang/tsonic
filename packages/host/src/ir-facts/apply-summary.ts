import type { DataflowAccount, DataflowResult, DataflowStop } from "../dataflow/contract.js";
import { accountFailure, chargeResultEntries, chargeWork } from "../dataflow/index.js";
import type { DefId, ProjectionPathId } from "../ids/contract.js";
import type { MemberSelection } from "../ir-tir/contract.js";
import type { BindingVector } from "../ir-types/contract.js";
import { projectBindingScope } from "../ir-types/index.js";
import type { BoundProducerRef, CallFieldBindings, LogicalCellRef, ProjectCallFields, RelationalOwner, SummaryWrite } from "./contract.js";
import type { ProjectionPath } from "./arena-data.js";
import type { AppliedCell, AppliedContext, AppliedSummary, AppliedSubject, AppliedWrite, SummaryApplicationInput, SummaryApplicationLimits } from "./application-data.js";
import type { BoundInitializationCell } from "./initialization-data.js";
import { applyInitialization } from "./apply-initialization.js";
import { applyValueOrigins } from "./apply-values.js";
import { checkConditionLimits } from "./conditions.js";
import { summaryKey } from "./summary-key.js";
import { admitOwnerIdentity } from "./verification.js";

function callerFieldBindings(account: DataflowAccount, definition: DefId,
  bindings: CallFieldBindings): DataflowResult<BindingVector | null> {
  const paid = chargeWork(account, 1 + definition.length);
  if (paid !== null) return paid;
  const scope = bindings.scopeOf(definition);
  const stopped = accountFailure(account);
  if (stopped !== null) return stopped;
  if (scope === null) return { kind: "complete", value: null };
  const projected = projectBindingScope(bindings.lexical, scope,
    (work, entries) => chargeWork(account, work) ?? chargeResultEntries(account, entries));
  return projected.kind === "resource-stop" ? projected.stop : projected;
}

export const projectCallFields: ProjectCallFields = (account, paths, path, view, bindings, apply) => {
  let current: ProjectionPathId | null = path;
  let admitted: MemberSelection[] | null = null;
  while (current !== null) {
    const paid = chargeWork(account, 1) ?? chargeResultEntries(account, admitted === null ? 2 : 1);
    if (paid !== null) return paid;
    const row: ProjectionPath | undefined = paths[current];
    if (row?.id !== current || row.parent !== null && row.parent >= current || row.projection.kind !== "field") return { kind: "complete", value: false };
    (admitted ??= []).push(row.projection.member);
    current = row.parent;
  }
  let parent: number | null = null;
  while (admitted !== null && admitted.length !== 0) {
    const paid = chargeWork(account, 1);
    if (paid !== null) return paid;
    let member = admitted.pop();
    if (member === undefined) return { kind: "complete", value: false };
    const decision = member.decision;
    if (decision.location.kind !== "data" || decision.location.receiver !== "by-reference" || decision.location.check.kind !== "none"
      || member.getter !== null || member.setter !== null || decision.getter !== null || decision.setter !== null) return { kind: "complete", value: false };
    if (view !== null) {
      let found = false;
      for (let position = 0; position < view.fields.length; position += 1) {
        const slot = chargeWork(account, 1);
        if (slot !== null) return slot;
        const row = view.fields[position];
        if (row === undefined || row.parent !== parent || row.formal !== decision.primary) continue;
        if (decision.read !== null && decision.read !== row.formalType || decision.write !== null && decision.write !== row.formalType)
          return { kind: "complete", value: false };
        const scope = callerFieldBindings(account, row.caller, bindings);
        if (scope.kind !== "complete") return scope;
        if (scope.value === null) return { kind: "complete", value: false };
        const newDeclaration = row.formal !== row.caller;
        if (newDeclaration || row.formalType !== row.callerType || decision.bindings !== scope.value) {
          const keep = chargeWork(account, newDeclaration ? 8 : 5) ?? chargeResultEntries(account, newDeclaration ? 5 : 2);
          if (keep !== null) return keep;
          member = { getter: null, setter: null, decision: { ...decision, primary: row.caller,
            selectedDeclarations: newDeclaration ? [row.caller] : decision.selectedDeclarations,
            origins: newDeclaration ? [{ kind: "declared", declaration: row.caller }] : decision.origins,
            bindings: scope.value,
            read: decision.read === null ? null : row.callerType, write: decision.write === null ? null : row.callerType } };
        }
        parent = position;
        found = true;
        break;
      }
      if (!found) return { kind: "complete", value: false };
    }
    const stopped = apply(member);
    if (stopped !== null) return stopped;
  }
  return { kind: "complete", value: true };
};

function validIndex(index: number, length: number): boolean {
  return Number.isSafeInteger(index) && index >= 0 && !Object.is(index, -0) && index < length;
}

function pick<Value>(values: readonly Value[], index: number): Value {
  const value = validIndex(index, values.length) ? values[index] : undefined;
  if (value === undefined) throw new TypeError("Summary application requires its actual dense ready reference");
  return value;
}

function grow(limits: SummaryApplicationLimits, entries = 1): DataflowStop | null {
  return chargeWork(limits.account, 1) ?? chargeResultEntries(limits.account, entries);
}

function located(value: AppliedCell): AppliedCell & { readonly kind: "located" } {
  if (value.kind !== "located") throw new TypeError("A located effect requires its actual nonempty supplied storage binding");
  return value;
}

export function applySummary(input: SummaryApplicationInput, limits: SummaryApplicationLimits): DataflowResult<AppliedSummary> {
  const prior = accountFailure(limits.account);
  if (prior !== null) return prior;
  checkConditionLimits({ account: limits.account, eventCount: input.events.length,
    maximumConditionAlternatives: limits.maximumConditionAlternatives, refusal: limits.conditionRefusal });
  const initial = grow(limits);
  if (initial !== null) return initial;
  const values = applyValueOrigins(input, { account: limits.account, maximumOriginAlternatives: limits.maximumOriginAlternatives,
    refusal: limits.originRefusal });
  if (values.kind !== "complete") return values;
  const source = input.summary;
  if (input.cells.length !== source.arena.cells.length)
    throw new TypeError("Summary storage binding covers the one complete actual source cell domain");
  const owner: RelationalOwner = { kind: "body", execution: input.at.execution };
  const cells: AppliedCell[] = [];
  for (const [index, binding] of input.cells.entries()) {
    const stop = grow(limits);
    if (stop !== null) return stop;
    if (!Object.is(pick(source.arena.cells, index).id, index)) throw new TypeError("The summary logical-cell domain is dense");
    if (binding.kind === "written") { cells.push({ kind: "written" }); continue; }
    const reference = (cell: number): LogicalCellRef => {
      if (!Object.is(pick(input.caller.cells, cell).id, cell)) throw new TypeError("A storage binding retains its actual caller cell");
      return { owner, cell };
    };
    if (binding.kind !== "unproven") {
      const row = reference(binding.index);
      cells.push({ kind: "located", targets: [row], same: row });
      continue;
    }
    const domain = grow(limits);
    if (domain !== null) return domain;
    const seen = new Set<number>();
    const firstStop = grow(limits);
    if (firstStop !== null) return firstStop;
    const first = pick(binding.indices, 0);
    const firstTarget = reference(first);
    seen.add(first);
    const targets: [LogicalCellRef, ...LogicalCellRef[]] = [firstTarget];
    for (let index = 1; index < binding.indices.length; index += 1) {
      const targetStop = grow(limits);
      if (targetStop !== null) return targetStop;
      const cell = pick(binding.indices, index);
      if (seen.has(cell)) throw new TypeError("A may-storage domain retains distinct actual rows");
      seen.add(cell);
      targets.push(reference(cell));
    }
    cells.push({ kind: "located", targets, same: null });
  }
  const contexts: AppliedContext[] = [];
  const contextCaptures: Map<number, AppliedContext["captures"][number]>[] = [];
  for (const [index, context] of source.arena.contexts.entries()) {
    const stop = grow(limits);
    if (stop !== null) return stop;
    if (!Object.is(context.id, index)) throw new TypeError("The summary context inventory is dense");
    const argumentsValues: AppliedContext["arguments"][number][] = [];
    for (const argument of context.arguments) {
      const argumentStop = grow(limits);
      if (argumentStop !== null) return argumentStop;
      argumentsValues.push(argument.kind === "provided" ? { kind: "provided", origins: pick(values.value.origins, argument.origins) } : { kind: "omitted" });
    }
    const captures: AppliedContext["captures"][number][] = [];
    const captured = new Map<number, AppliedContext["captures"][number]>();
    let previous = -1;
    for (const capture of context.captures) {
      const captureStop = grow(limits);
      if (captureStop !== null) return captureStop;
      if (!Number.isSafeInteger(capture.index) || capture.index <= previous || Object.is(capture.index, -0))
        throw new TypeError("A captured environment retains its ordered actual source capture association");
      previous = capture.index;
      const entry = "origins" in capture
        ? { index: capture.index, origins: pick(values.value.origins, capture.origins) }
        : { index: capture.index, location: pick(values.value.subjects, capture.location), cell: located(pick(cells, capture.cell)) };
      captures.push(entry);
      captured.set(capture.index, entry);
    }
    contexts.push({ receiver: context.receiver === null ? null : pick(values.value.origins, context.receiver), arguments: argumentsValues, captures });
    contextCaptures.push(captured);
  }
  const writes = (rows: readonly SummaryWrite[]): DataflowResult<readonly AppliedWrite[]> => {
    const allocation = grow(limits);
    if (allocation !== null) return allocation;
    const result: AppliedWrite[] = [];
    for (const row of rows) {
      const stop = grow(limits);
      if (stop !== null) return stop;
      result.push({ target: located(pick(cells, row.target)), value: pick(values.value.origins, row.value) });
    }
    return { kind: "complete", value: result };
  };
  const history = writes(source.writes);
  if (history.kind !== "complete") return history;
  const concurrent = writes(source.concurrentWrites);
  if (concurrent.kind !== "complete") return concurrent;
  const returned = writes(source.contentsOnReturn);
  if (returned.kind !== "complete") return returned;
  const unwound = writes(source.contentsOnUnwind);
  if (unwound.kind !== "complete") return unwound;
  const formalValues = new Map<string, AppliedSubject[]>();
  const captureEffects = new Map<number, { readonly kind: "value" } | { readonly kind: "location"; readonly cells: AppliedCell[] }>();
  for (const bound of source.arena.boundProducers) {
    const stop = chargeWork(limits.account, 1);
    if (stop !== null) return stop;
    const producer = pick(source.arena.producers, bound.producer);
    if (producer.path !== null || producer.kind !== "parameter" && producer.kind !== "receiver" && producer.kind !== "capture") continue;
    const key = producer.kind === "receiver" ? producer.kind : `${producer.kind}:${producer.index}`;
    const growth = grow(limits);
    if (growth !== null) return growth;
    let group = formalValues.get(key);
    if (group === undefined) { group = []; formalValues.set(key, group); }
    group.push(pick(values.value.subjects, bound.id));
    if (producer.kind === "capture") {
      const found = pick(contextCaptures, bound.context).get(producer.index);
      if (found === undefined) throw new TypeError("A bound capture has its actual context capture association");
      const previous = captureEffects.get(producer.index);
      const cellGrowth = grow(limits, previous === undefined && "cell" in found ? 2 : 1);
      if (cellGrowth !== null) return cellGrowth;
      if ("cell" in found) {
        if (previous?.kind === "value") throw new TypeError("A capture retains its selected mode across contexts");
        if (previous === undefined) captureEffects.set(producer.index, { kind: "location", cells: [found.cell] });
        else previous.cells.push(found.cell);
      } else {
        if (previous?.kind === "location") throw new TypeError("A capture retains its selected mode across contexts");
        if (previous === undefined) captureEffects.set(producer.index, { kind: "value" });
      }
    }
  }
  const parameters: AppliedSummary["parameters"][number][] = [];
  for (const parameter of source.parameters) {
    const stop = grow(limits);
    if (stop !== null) return stop;
    const key = parameter.slot.kind === "receiver" ? "receiver" : `parameter:${parameter.slot.index}`;
    const actual = formalValues.get(key);
    if (actual === undefined && (parameter.reads.kind === "open" || parameter.reads.paths.length !== 0
      || parameter.writes.kind === "open" || parameter.writes.paths.length !== 0))
      throw new TypeError("A nonempty input effect retains its actual bound entry value");
    parameters.push({ source: parameter, values: actual ?? [] });
  }
  const captures: AppliedSummary["captures"][number][] = [];
  for (const capture of source.captures) {
    const stop = grow(limits);
    if (stop !== null) return stop;
    const actual = formalValues.get(`capture:${capture.index}`);
    const binding = captureEffects.get(capture.index);
    if (actual === undefined || binding === undefined)
      throw new TypeError("A capture effect retains its actual value and storage binding");
    captures.push({ source: capture, values: actual, cells: binding.kind === "location" ? binding.cells : [] });
  }
  const sourceKey = values.value.key;
  const subject = (reference: BoundProducerRef): DataflowResult<AppliedSubject> => {
    const stop = admitOwnerIdentity(reference.owner, limits.account);
    if (stop !== null) return stop;
    if (reference.owner.kind !== "summary" || summaryKey(reference.owner.key) !== sourceKey)
      throw new TypeError("An applied value subject retains the exact source summary arena owner");
    return { kind: "complete", value: pick(values.value.subjects, reference.producer) };
  };
  const callbacks: AppliedSummary["callbacks"][number][] = [];
  for (const callback of source.callbacks) {
    const stop = grow(limits);
    if (stop !== null) return stop;
    const value = subject(callback.subject);
    if (value.kind !== "complete") return value;
    if (callback.kind === "unknown") {
      callbacks.push({ source: callback, subject: value.value, application: null });
      continue;
    }
    const shared = writes(callback.shared);
    if (shared.kind !== "complete") return shared;
    const handle = callback.handle === null ? null : subject(callback.handle);
    if (handle !== null && handle.kind !== "complete") return handle;
    callbacks.push({ source: callback, subject: value.value, application: {
      context: pick(contexts, callback.context), result: pick(values.value.origins, callback.result),
      thrown: pick(values.value.origins, callback.thrown), handle: handle === null ? null : handle.value, shared: shared.value,
    } });
  }
  const retention: AppliedSummary["retention"][number][] = [];
  for (const row of source.retention) {
    const stop = grow(limits);
    if (stop !== null) return stop;
    retention.push({ source: row, value: pick(values.value.subjects, row.source), into: row.into });
  }
  const resultCells: AppliedSummary["resultCells"][number][] = [];
  for (const row of source.resultCells) {
    const stop = grow(limits);
    if (stop !== null) return stop;
    resultCells.push({ source: row, value: pick(values.value.origins, row.value), cell: located(pick(cells, row.cell)) });
  }
  const backing: AppliedSummary["backing"][number][] = [];
  for (const row of source.backing) {
    const stop = grow(limits);
    if (stop !== null) return stop;
    backing.push({ source: row, pointer: pick(values.value.origins, row.pointer), cell: located(pick(cells, row.cell)) });
  }
  const initialized: BoundInitializationCell[] = [];
  for (const cell of source.initialization.cells) {
    const stop = grow(limits);
    if (stop !== null) return stop;
    initialized.push(pick(input.cells, cell));
  }
  const initialization = applyInitialization({ application: { owner: { kind: "summary", key: source.key }, arena: source.arena,
    table: source.initialization, binding: { cells: initialized, events: input.eventBindings } }, caller: input.caller, events: input.events }, {
    account: limits.account, eventCount: input.events.length, maximumConditionAlternatives: limits.maximumConditionAlternatives,
    refusal: limits.conditionRefusal,
  });
  if (initialization.kind !== "complete") return initialization;
  const resultStop = grow(limits);
  if (resultStop !== null) return resultStop;
  return { kind: "complete", value: { source, at: input.at, context: input.context, cells, subjects: values.value.subjects,
    events: input.events, contexts,
    result: pick(values.value.origins, source.result), thrown: pick(values.value.origins, source.thrown), writes: history.value,
    concurrentWrites: concurrent.value, contentsOnReturn: returned.value, contentsOnUnwind: unwound.value,
    parameters, captures, callbacks, retention, resultCells, backing, initialization: initialization.value } };
}
