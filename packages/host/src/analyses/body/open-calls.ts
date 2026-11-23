import type { DataflowStop } from "../../dataflow/contract.js";
import { chargeResultEntries, chargeWork } from "../../dataflow/index.js";
import type { OpenBoundaryId, ProducerId } from "../../ids/contract.js";
import { openBoundaryId, producerId, valueContextId } from "../../ids/index.js";
import type { AppliedSubject, AppliedSummary, EffectPaths, OpenBoundary, OpenBoundaryRef, Producer, RelationalArena, RelationalOwner, Summary } from "../../ir-facts/contract.js";
import type { MirTerminator } from "../../ir-mir/contract.js";
import type { BodyRoundDeps, BodyRoundInput } from "./contract.js";
import { bodyFrontier } from "./places.js";

type Call = Extract<MirTerminator, { readonly kind: "call" }>;
export type ReadCallBoundary = (reference: OpenBoundaryRef) => OpenBoundaryId | DataflowStop;

export const noCallBoundary: ReadCallBoundary = () => bodyFrontier("BodyAnalysis requires the actual created or open call-result Origins producer.");
export const noCallBoundaries: readonly OpenBoundaryId[] = [];

interface CallBoundaryRows {
  readonly subject: ProducerId;
  readonly ids: OpenBoundaryId[];
  readonly mapped: Map<OpenBoundaryId, OpenBoundaryId>;
}

type Access = "read" | "write";
type Formal = "receiver" | "parameter" | "capture";

function effectKey(access: Access, kind: Formal, index: number): string {
  return `${access}:${kind}:${index}`;
}

export function openCallTransport(deps: BodyRoundDeps, input: BodyRoundInput, producers: Producer[], boundaries: OpenBoundary[],
  admit: (records: number, references: number) => DataflowStop | null) {
  const { account } = deps;
  let calls: Map<Call, CallBoundaryRows> | null = null;
  let effects: Map<string, Set<OpenBoundaryId>> | null = null;
  function read(operation: Call, summary: Summary, reference: OpenBoundaryRef): OpenBoundaryId | DataflowStop {
    const inspect = chargeWork(account, 1);
    if (inspect !== null) return inspect;
    if (reference.owner.kind === "body") {
      if (reference.owner.execution !== input.execution || boundaries[reference.boundary]?.id !== reference.boundary)
        return bodyFrontier("An applied local boundary belongs to the actual caller arena.");
      return reference.boundary;
    }
    if (reference.owner.key !== summary.key)
      return bodyFrontier("An applied foreign boundary belongs to the actual selected Summary.");
    const previous = calls?.get(operation);
    const retained = previous?.mapped.get(reference.boundary);
    if (retained !== undefined) return retained;
    const source = summary.arena.boundaries[reference.boundary];
    const subject = source === undefined ? undefined : summary.arena.producers[source.subject];
    if (source?.id !== reference.boundary || source.kind !== "opaque-invocation" || source.owner !== null
      || subject?.kind !== "shared" && subject?.kind !== "call-result")
      return bodyFrontier("A call requires the actual subject transport for this open boundary.");
    if (input.mir.bindings.kind !== "instantiated") return bodyFrontier("An executed call retains the caller's actual concrete binding environment.");
    const room = admit(previous === undefined ? 2 : 1, 1)
      ?? chargeResultEntries(account, 4 + (previous === undefined ? 7 : 0) + (calls === null ? 1 : 0));
    if (room !== null) return room;
    let rows = previous;
    if (rows === undefined) {
      const id = producerId(producers.length);
      const callee: Extract<Producer, { readonly kind: "call-result" }>["callee"] = operation.callee.kind === "direct"
        ? { kind: "direct", definition: operation.callee.resolution.decision.api.declaration } : { kind: "indirect" };
      producers.push({ id, kind: "call-result", path: null, at: operation.tir, callee });
      rows = { subject: id, ids: [], mapped: new Map() };
      calls ??= new Map();
      calls.set(operation, rows);
    }
    const id = openBoundaryId(boundaries.length);
    boundaries.push({ id, kind: source.kind, at: { kind: "node", node: { kind: "body", value: operation.tir } },
      subject: rows.subject, owner: null, bindings: input.mir.bindings.bindings, context: valueContextId(0), detail: source.detail });
    rows.mapped.set(reference.boundary, id);
    rows.ids.push(id);
    return id;
  }
  function retainEffect(access: Access, paths: EffectPaths, values: readonly AppliedSubject[], applied: AppliedSummary,
    arena: RelationalArena, readBoundary: ReadCallBoundary): DataflowStop | null {
    if (paths.kind !== "open") return null;
    const keep = chargeResultEntries(account, 1);
    if (keep !== null) return keep;
    const owner: RelationalOwner = { kind: "summary", key: applied.source.key };
    for (let index = 0; index < paths.boundaries.length; index += 1) {
      const read = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
      if (read !== null) return read;
      const source = paths.boundaries[index];
      if (source === undefined) return bodyFrontier("An open parameter effect retains every actual boundary.");
      const boundary = readBoundary({ owner, boundary: source });
      if (typeof boundary !== "number") return boundary;
      for (let position = 0; position < values.length; position += 1) {
        const step = chargeWork(account, 1);
        if (step !== null) return step;
        const value = values[position];
        const origin = value?.kind === "caller" && value.value.owner.kind === "body" && value.value.owner.execution === input.execution
          ? arena.origins[value.value.origins] : undefined;
        if (origin?.kind !== "complete") return bodyFrontier("An open effect requires the actual qualified caller subjects it could affect.");
        for (let alternative = 0; alternative < origin.producers.length; alternative += 1) {
          const read = chargeWork(account, 3);
          if (read !== null) return read;
          const reference = origin.producers[alternative];
          const bound = reference === undefined ? undefined : arena.boundProducers[reference];
          const subject = bound === undefined ? undefined : arena.producers[bound.producer];
          if (subject?.kind !== "receiver" && subject?.kind !== "parameter" && subject?.kind !== "capture")
            return bodyFrontier("An open call effect requires the actual caller-owned formal or captured object.");
          const key = effectKey(access, subject.kind, subject.kind === "receiver" ? 0 : subject.index);
          const current = effects?.get(key);
          if (current?.has(boundary) === true) continue;
          const room = admit(0, 1) ?? chargeResultEntries(account, 1 + (current === undefined ? 2 : 0) + (effects === null ? 1 : 0));
          if (room !== null) return room;
          effects ??= new Map();
          const selected = current ?? new Set<OpenBoundaryId>();
          if (current === undefined) effects.set(key, selected);
          selected.add(boundary);
        }
      }
    }
    return null;
  }
  return {
    forCall: (operation: Call, summary: Summary): ReadCallBoundary | DataflowStop => {
      if (summary.arena.boundaries.length === 0 && boundaries.length === 0) return noCallBoundary;
      const keep = chargeResultEntries(account, 1);
      return keep ?? (reference => read(operation, summary, reference));
    },
    at: (operation: Call): readonly OpenBoundaryId[] => calls?.get(operation)?.ids ?? noCallBoundaries,
    retainEffects: (applied: AppliedSummary, arena: RelationalArena, readBoundary: ReadCallBoundary): DataflowStop | null => {
      for (let position = 0; position < applied.parameters.length; position += 1) {
        const read = chargeWork(account, 1);
        if (read !== null) return read;
        const parameter = applied.parameters[position];
        if (parameter === undefined) return bodyFrontier("A call retains its actual applied parameter effects.");
        const stopped = retainEffect("read", parameter.source.reads, parameter.values, applied, arena, readBoundary)
          ?? retainEffect("write", parameter.source.writes, parameter.values, applied, arena, readBoundary);
        if (stopped !== null) return stopped;
      }
      for (let position = 0; position < applied.captures.length; position += 1) {
        const read = chargeWork(account, 1);
        if (read !== null) return read;
        const capture = applied.captures[position];
        if (capture === undefined) return bodyFrontier("A call retains its actual applied capture effects.");
        const stopped = retainEffect("read", capture.source.reads, capture.values, applied, arena, readBoundary)
          ?? retainEffect("write", capture.source.writes, capture.values, applied, arena, readBoundary);
        if (stopped !== null) return stopped;
      }
      return null;
    },
    effectsOf: (access: Access, kind: Formal, index: number): ReadonlySet<OpenBoundaryId> | null =>
      effects === null ? null : effects.get(effectKey(access, kind, index)) ?? null,
  };
}

export type OpenCallTransport = ReturnType<typeof openCallTransport>;
