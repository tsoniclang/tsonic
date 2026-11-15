import type { DataflowResult, DataflowStop } from "../../dataflow/contract.js";
import { accountFailure, chargeResultEntries, chargeWork } from "../../dataflow/index.js";
import { requirePresent } from "../../diag/index.js";
import type { BlockId, BoundProducerId, LocalId, NodeId, SourceNodeRef } from "../../ids/contract.js";
import { boundProducerId, producerId, valueContextId } from "../../ids/index.js";
import type { BoundProducer, CaptureLocation, LogicalCellLifetime, LogicalCellRow, Producer, RelationalArena } from "../../ir-facts/contract.js";
import type { TirNode } from "../../ir-tir/contract.js";
import type { BodyRoundDeps, BodyRoundInput } from "./contract.js";
import type { Assigned, StorageLive } from "./storage.js";
import { localSlotLifetimes, solveStorageLive } from "./storage.js";
import { bodyFrontier, readLocal } from "./places.js";

type CaptureArena = Pick<RelationalArena, "contexts" | "origins"> & {
  readonly cells: LogicalCellRow[];
  readonly producers: Producer[];
  readonly boundProducers: BoundProducer[];
};
type AdmitCaptures = (limit: "maximumRelationalRecordsPerBody" | "maximumRelationalReferencesPerBody",
  size: number, retained?: number) => DataflowStop | null;

export function prepareCallCaptures(deps: BodyRoundDeps, input: BodyRoundInput, arena: CaptureArena,
  source: ReadonlyMap<NodeId, TirNode>, entry: readonly Assigned[], reachable: readonly boolean[],
  capturedLocals: ReadonlyMap<number, number>, captureLocations: readonly CaptureLocation[],
  cellLocals: LocalId[], bounded: AdmitCaptures, contextReferences: number):
  DataflowResult<{ readonly calls: ReadonlyMap<BlockId, readonly CaptureLocation[]>;
    readonly references: number; readonly lifetimes: number }> {
  const { account } = deps;
  const prior = accountFailure(account) ?? chargeWork(account, 1);
  if (prior !== null) return prior;
  const setup = chargeWork(account, input.mir.blocks.length) ?? chargeResultEntries(account, 2);
  if (setup !== null) return setup;
  const { execution, mir, tir } = input;
  const { cells, producers, boundProducers } = arena;
  const calls = new Map<BlockId, readonly CaptureLocation[]>();
  const callerCaptures = new Map<LocalId, CaptureLocation>();
  let callerLocalSubjects: Map<LocalId, BoundProducerId> | null = null;
  let localSlots: { readonly lifetimes: ReadonlyMap<LocalId, readonly LogicalCellLifetime[]>;
    readonly live: readonly StorageLive[] } | null = null;
  let lifetimeRecords = 0;
  for (const block of mir.blocks) {
    if (reachable[block.id] !== true || entry[block.id] === null) continue;
    const terminator = block.terminator;
    if (terminator.kind !== "call" || terminator.callee.kind !== "body") continue;
    const growth = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
    if (growth !== null) return growth;
    const callCaptures: CaptureLocation[] = [];
    for (let index = 0; index < terminator.callee.captures.length; index += 1) {
      const captureWork = chargeWork(account, 1) ?? chargeResultEntries(account, 5);
      if (captureWork !== null) return captureWork;
      const capture = requirePresent(terminator.callee.captures[index], { owner: "analyses/body", query: null, origin: terminator.origin,
        message: "A selected body call retains every actual capture transport." });
      const local = readLocal(mir, { kind: "place", place: capture.place });
      const incoming = capturedLocals.get(local);
      const sourceWork = chargeWork(account, 2);
      if (sourceWork !== null) return sourceWork;
      const actual = requirePresent(mir.locals[local], { owner: "analyses/body", query: null, origin: terminator.origin,
        message: "A verified capture retains its actual executing local." });
      let lifetimes: readonly LogicalCellLifetime[] | undefined;
      if (incoming === undefined && actual.role.kind === "user") {
        if (localSlots === null) {
          const evidence = localSlotLifetimes(input, entry, account);
          if (evidence.kind !== "complete") return evidence;
          const live = solveStorageLive(input, entry, account);
          if (live.kind !== "complete") return live;
          const retained = chargeResultEntries(account, 1);
          if (retained !== null) return retained;
          localSlots = { lifetimes: evidence.value, live: live.value };
        }
        const lookup = chargeWork(account, 2);
        if (lookup !== null) return lookup;
        const live = localSlots.live[block.id]?.has(local) === true;
        lifetimes = localSlots.lifetimes.get(local);
        if (!live || lifetimes === undefined)
          return bodyFrontier("BodyAnalysis requires the actual must-live-at-call relation for this captured local slot.");
      }
      let binding = incoming !== undefined ? captureLocations[incoming] : callerCaptures.get(local);
      if (binding === undefined) {
        const growth = chargeWork(account, 2) ?? chargeResultEntries(account, 12);
        if (growth !== null) return growth;
        const callerLocal = actual;
        if (callerLocal.role.kind !== "parameter" && callerLocal.role.kind !== "receiver" && callerLocal.role.kind !== "user")
          return bodyFrontier("BodyAnalysis requires the actual local lifetime and value-subject binding for this captured slot.");
        const declaration = callerLocal.source === null ? undefined : tir.locals[callerLocal.source.local];
        if (callerLocal.source === null || callerLocal.source.body !== tir.body || declaration?.id !== callerLocal.source.local)
          return bodyFrontier("A captured caller slot retains its actual qualified source local, not its formal value identity.");
        let at: SourceNodeRef | null = null;
        if (callerLocal.role.kind === "user") {
          const projection = chargeWork(account, 3) ?? chargeResultEntries(account, 2);
          if (projection !== null) return projection;
          const reference = declaration.declaration;
          const node = source.get(reference.value.node);
          const annotation = node?.tsonic;
          const target = annotation !== undefined && annotation !== null && "declaration" in annotation ? annotation.declaration : null;
          if (node === undefined || reference.kind === "body" && reference.value.body !== tir.body
            || typeof target !== "object" || target === null || !("kind" in target) || target.kind !== "local"
            || target.local.body !== tir.body || !Object.is(target.local.local, declaration.id))
            return bodyFrontier("A captured local declaration retains its actual executing occurrence and qualified local association.");
          at = { kind: "body", value: { body: tir.body, node: node.id } };
        }
        const subject = callerLocalSubjects?.get(callerLocal.source.local);
        const subjectRows = subject === undefined ? 2 : 0;
        const subjectReferences = subject === undefined ? 5 : 3;
        const bound = bounded("maximumRelationalRecordsPerBody", arena.cells.length + arena.boundProducers.length
          + arena.producers.length + arena.contexts.length + arena.origins.length + lifetimeRecords + 2 + subjectRows)
          ?? bounded("maximumRelationalReferencesPerBody", subjectReferences, contextReferences);
        if (bound !== null) return bound;
        const cell = cells.length;
        const location = subject ?? boundProducerId(boundProducers.length);
        const producer = producerId(producers.length);
        if (lifetimes !== undefined) {
          const markers = lifetimes.length;
          const retained = arena.cells.length + arena.boundProducers.length + arena.producers.length
            + arena.contexts.length + arena.origins.length + lifetimeRecords + 2 + subjectRows;
          const markerBound = bounded("maximumRelationalRecordsPerBody", markers, retained)
            ?? bounded("maximumRelationalReferencesPerBody", markers * 2, contextReferences + subjectReferences);
          if (markerBound !== null) return markerBound;
          lifetimeRecords += markers;
          contextReferences += markers * 2;
        }
        cells.push({ id: cell, role: { kind: "local", local }, occurrence: at !== null
          ? { kind: "declared", at: { kind: "node", node: at } }
          : { kind: "entry", execution, local }, lifetimes: lifetimes ?? [] });
        cellLocals.push(local);
        if (subject === undefined) {
          if (callerLocalSubjects === null) {
            const retained = chargeResultEntries(account, 1);
            if (retained !== null) return retained;
            callerLocalSubjects = new Map();
          }
          producers.push({ id: producer, path: null, kind: "local", local: callerLocal.source });
          boundProducers.push({ id: location, producer, bindings: tir.lexicalBindings, context: valueContextId(0) });
          callerLocalSubjects.set(callerLocal.source.local, location);
        }
        binding = { index, location, cell };
        callerCaptures.set(local, binding);
        contextReferences += subjectReferences;
      }
      const references = bounded("maximumRelationalReferencesPerBody", 2, contextReferences);
      if (references !== null) return references;
      contextReferences += 2;
      callCaptures.push({ index, location: binding.location, cell: binding.cell });
    }
    calls.set(block.id, callCaptures);
  }
  return { kind: "complete", value: { calls, references: contextReferences, lifetimes: lifetimeRecords } };
}
