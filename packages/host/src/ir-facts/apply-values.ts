import type { CallerRefusal, DataflowAccount, DataflowResult, DataflowStop } from "../dataflow/contract.js";
import { accountFailure, chargeResultEntries, chargeWork, refuseAccount } from "../dataflow/index.js";
import type { BoundProducerId, OriginsId, ValueContextId } from "../ids/contract.js";
import type { Execution } from "../ir-types/contract.js";
import type { MirPoint, OpenBoundaryRef, Origins, RelationalArena, RelationalOwner, Summary, SummaryKey } from "./contract.js";
import type { AppliedOriginsValue, AppliedProducerValue, AppliedSubject, AppliedValues, ValueEntryBinding } from "./application-data.js";
import { summaryKey } from "./summary-key.js";
import { admitOwnerIdentity } from "./verification.js";


export interface ValueApplicationInput {
  readonly summary: Summary;
  readonly callee: SummaryKey;
  readonly at: { readonly execution: Execution; readonly point: MirPoint };
  readonly context: ValueContextId;
  readonly caller: RelationalArena;
  readonly entries: readonly ValueEntryBinding[];
}

export interface ValueApplicationLimits {
  readonly maximumOriginAlternatives: number;
  readonly account: DataflowAccount;
  readonly refusal: CallerRefusal;
}


function validIndex(index: number, length: number): boolean {
  return Number.isSafeInteger(index) && index >= 0 && index < length && !Object.is(index, -0);
}

export function applyValueOrigins(input: ValueApplicationInput, limits: ValueApplicationLimits): DataflowResult<AppliedValues> {
  const prior = accountFailure(limits.account);
  if (prior !== null) return prior;
  if (!Number.isSafeInteger(limits.maximumOriginAlternatives) || limits.maximumOriginAlternatives < 0 || Object.is(limits.maximumOriginAlternatives, -0))
    throw new TypeError("Invalid maximumOriginAlternatives");
  const keyStop = admitOwnerIdentity({ kind: "summary", key: input.summary.key }, limits.account)
    ?? admitOwnerIdentity({ kind: "summary", key: input.callee }, limits.account);
  if (keyStop !== null) return keyStop;
  const key = summaryKey(input.summary.key);
  if (key !== summaryKey(input.callee)) throw new TypeError("Summary application requires the exact selected execution");
  const setupStop = chargeWork(limits.account, 1) ?? chargeResultEntries(limits.account, 1);
  if (setupStop !== null) return setupStop;
  const context = input.caller.contexts[input.context];
  if (!validIndex(input.context, input.caller.contexts.length) || context === undefined || context.id !== input.context)
    throw new TypeError("Summary application requires the actual caller value context");
  const bindings = new Map<BoundProducerId, Origins>();
  for (const entry of input.entries) {
    const stop = chargeWork(limits.account, 1) ?? chargeResultEntries(limits.account, 1);
    if (stop !== null) return stop;
    if (!validIndex(entry.formal, input.summary.arena.boundProducers.length) || bindings.has(entry.formal))
      throw new TypeError("Summary entry bindings are distinct references to actual bound producers");
    const value = input.caller.origins[entry.actual];
    if (!validIndex(entry.actual, input.caller.origins.length) || value === undefined || value.id !== entry.actual)
      throw new TypeError("Summary entry values resolve in the actual caller arena");
    bindings.set(entry.formal, value);
  }
  const summaryOwner: RelationalOwner = { kind: "summary", key: input.summary.key };
  const callerOwner: RelationalOwner = { kind: "body", execution: input.at.execution };
  const subjects: AppliedSubject[] = [];
  for (let index = 0; index < input.summary.arena.boundProducers.length; index += 1) {
    const stop = chargeWork(limits.account, 1) ?? chargeResultEntries(limits.account, 1);
    if (stop !== null) return stop;
    const bound = input.summary.arena.boundProducers[index];
    if (bound === undefined || bound.id !== index) throw new TypeError("The summary's bound producer inventory is dense");
    const producer = input.summary.arena.producers[bound.producer];
    if (!validIndex(bound.producer, input.summary.arena.producers.length) || producer === undefined || producer.id !== bound.producer)
      throw new TypeError("The summary's bound producer retains its actual producer");
    if (producer.kind === "parameter" && (context.arguments[producer.index]?.kind === "omitted"
      || input.summary.arena.contexts[bound.context]?.arguments[producer.index]?.kind === "omitted"))
      throw new TypeError("An omitted formal has no incoming caller value to bind");
    const entry = producer.kind === "receiver" || producer.kind === "parameter" || producer.kind === "capture"
      || producer.kind === "shared" || producer.kind === "cell-content";
    if (entry !== bindings.has(bound.id)) throw new TypeError("Summary application binds every actual entry producer and no created producer");
    const actual = bindings.get(bound.id);
    subjects.push(actual === undefined ? { kind: "callee", value: { at: input.at, context: input.context,
      producer: { owner: summaryOwner, producer: bound.id } } } : { kind: "caller", value: { owner: callerOwner, origins: actual.id } });
  }
  const rowsStop = chargeWork(limits.account, 1) ?? chargeResultEntries(limits.account, 1);
  if (rowsStop !== null) return rowsStop;
  const rows: AppliedOriginsValue[] = [];
  for (let index = 0; index < input.summary.arena.origins.length; index += 1) {
    const rowStop = chargeWork(limits.account, 1) ?? chargeResultEntries(limits.account, 1);
    if (rowStop !== null) return rowStop;
    const source = input.summary.arena.origins[index];
    if (source === undefined || source.id !== index) throw new TypeError("The summary's origins inventory is dense");
    const caller: { readonly owner: RelationalOwner; readonly producer: BoundProducerId }[] = [];
    const callee: AppliedProducerValue[] = [];
    const boundaries: OpenBoundaryRef[] = [];
    const callerIds = new Set<BoundProducerId>();
    const importedValues = new Set<OriginsId>();
    const importedBoundaries = new Set<number>();
    let includesAbsence = source.includesAbsence;
    const addBoundary = (owner: RelationalOwner, boundary: OpenBoundaryRef["boundary"], imported: boolean): DataflowStop | null => {
      const stop = chargeWork(limits.account, 1);
      if (stop !== null) return stop;
      if (imported && importedBoundaries.has(boundary)) return null;
      const arena = imported ? input.caller : input.summary.arena;
      const source = arena.boundaries[boundary];
      if (!validIndex(boundary, arena.boundaries.length) || source === undefined || source.id !== boundary)
        throw new TypeError("Applied open values preserve actual arena-qualified boundaries");
      const growth = chargeResultEntries(limits.account, 1);
      if (growth !== null) return growth;
      if (imported) importedBoundaries.add(boundary);
      boundaries.push({ owner, boundary });
      return null;
    };
    let previousBound = -1;
    for (const bound of source.producers) {
      const producerStop = chargeWork(limits.account, 1);
      if (producerStop !== null) return producerStop;
      if (!validIndex(bound, input.summary.arena.boundProducers.length) || bound <= previousBound)
        throw new TypeError("Summary origins retain actual distinct ordered bound producers");
      previousBound = bound;
      const actual = bindings.get(bound);
      if (actual === undefined) {
        if (caller.length + callee.length >= limits.maximumOriginAlternatives) return refuseAccount(limits.account, limits.refusal);
        const growth = chargeResultEntries(limits.account, 1);
        if (growth !== null) return growth;
        callee.push({ at: input.at, context: input.context, producer: { owner: summaryOwner, producer: bound } });
      } else {
        if (importedValues.has(actual.id)) continue;
        const importStop = chargeResultEntries(limits.account, 1);
        if (importStop !== null) return importStop;
        importedValues.add(actual.id);
        includesAbsence ||= actual.includesAbsence;
        for (const producer of actual.producers) {
          const memberStop = chargeWork(limits.account, 1);
          if (memberStop !== null) return memberStop;
          const bound = input.caller.boundProducers[producer];
          if (!validIndex(producer, input.caller.boundProducers.length) || bound === undefined || bound.id !== producer)
            throw new TypeError("Actual caller alternatives preserve their complete bound producer");
          if (callerIds.has(producer)) continue;
          if (caller.length + callee.length >= limits.maximumOriginAlternatives) return refuseAccount(limits.account, limits.refusal);
          const growth = chargeResultEntries(limits.account, 1);
          if (growth !== null) return growth;
          callerIds.add(producer);
          caller.push({ owner: callerOwner, producer });
        }
        if (actual.kind === "open") for (const boundary of actual.boundaries) {
          const boundaryStop = addBoundary(callerOwner, boundary, true);
          if (boundaryStop !== null) return boundaryStop;
        }
      }
    }
    if (source.kind === "open") for (const boundary of source.boundaries) {
      const boundaryStop = addBoundary(summaryOwner, boundary, false);
      if (boundaryStop !== null) return boundaryStop;
    }
    rows.push({ caller, callee, includesAbsence, boundaries });
  }
  return { kind: "complete", value: { key, origins: rows, subjects } };
}
