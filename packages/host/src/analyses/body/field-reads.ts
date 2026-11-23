import type { DataflowResult, DataflowStop } from "../../dataflow/contract.js";
import { accountFailure, chargeResultEntries, chargeWork } from "../../dataflow/index.js";
import type { LocalId, LocalRef, NodeId, PlaceId, ProjectionPathId } from "../../ids/contract.js";
import { encodeKey, projectionPathId } from "../../ids/index.js";
import type { AppliedSummary, BoundProducer, Origins, Producer, ProjectionPath, RelationalArena } from "../../ir-facts/contract.js";
import { admitSelectionIdentity } from "../../ir-facts/index.js";
import type { MirPlace } from "../../ir-mir/contract.js";
import type { MemberSelection, TirSyntaxOccurrence } from "../../ir-tir/contract.js";
import { memberSelectionKey } from "../../ir-tir/index.js";
import type { BodyRoundDeps, BodyRoundInput } from "./contract.js";
import { bodyFrontier } from "./places.js";
import { valueKind } from "./values.js";

interface HeldFieldRead {
  readonly holder: LocalId;
  readonly member: MemberSelection;
}

export interface HeldFieldReads {
  readonly references: ReadonlySet<LocalId>;
  readonly places: ReadonlyMap<PlaceId, HeldFieldRead>;
}

export function heldFieldReads(deps: BodyRoundDeps, input: BodyRoundInput, source: ReadonlyMap<NodeId, TirSyntaxOccurrence>,
  projections: readonly MirPlace[]): DataflowResult<HeldFieldReads> {
  const { account } = deps;
  const { mir, tir } = input;
  const start = chargeWork(account, 1) ?? chargeResultEntries(account, 4);
  if (start !== null) return start;
  const reads = new Map<PlaceId, HeldFieldRead>();
  const holders = new Map<LocalId, LocalRef>();
  const references = new Set<LocalId>();
  for (const place of projections) {
    const admission = chargeWork(account, 4);
    if (admission !== null) return admission;
    const base = place.base;
    if (base.kind !== "place" || base.projection.kind !== "field" || base.tir.body !== tir.body)
      return bodyFrontier("BodyAnalysis requires the actual selected projection or static-cell producer for this place.");
    const node = source.get(base.tir.node);
    const selection = node?.kind === "PropertyAccessExpression" && node.tsonic.role === "value" ? node.tsonic.selection : null;
    if (selection?.kind !== "decided" || selection.decision.decision.location.kind !== "data"
      || selection.decision.decision.location.receiver !== "by-reference" || selection.decision.decision.location.check.kind !== "none"
      || selection.decision.decision.read !== place.storage || selection.decision.decision.primary !== base.projection.member.decision.primary)
      return bodyFrontier("A scalar field read requires its actual selected reference-held data field.");
    const kind = valueKind(deps, place.storage);
    if (kind !== "primitive") {
      const cut = accountFailure(account);
      return cut ?? bodyFrontier("A reference-held non-scalar field requires its actual projected value Origins and cells.");
    }
    if (node?.kind !== "PropertyAccessExpression") return bodyFrontier("The field read retains its actual receiver syntax.");
    let receiver = node.expression;
    while (receiver.kind === "ParenthesizedExpression") {
      const cut = chargeWork(account, 1);
      if (cut !== null) return cut;
      receiver = receiver.expression;
    }
    const resolution = receiver.kind === "Identifier" && receiver.tsonic.role === "value" ? receiver.tsonic.resolution : null;
    const receiverSource = resolution?.kind === "local" && resolution.local.body === tir.body ? resolution.local : null;
    const holderBase = mir.places[base.place]?.base;
    const holder = holderBase?.kind === "local" ? mir.locals[holderBase.local] : undefined;
    const previous = holder === undefined ? undefined : holders.get(holder.id);
    if (receiverSource === null || holder?.role.kind !== "temporary" || holder.mode !== "local"
      || (previous !== undefined && (previous.body !== receiverSource.body || previous.local !== receiverSource.local)))
      return bodyFrontier("The field read must borrow the actual checked reference through its stable held local.");
    const retained = chargeResultEntries(account, 4);
    if (retained !== null) return retained;
    reads.set(place.id, { holder: holder.id, member: selection.decision });
    holders.set(holder.id, receiverSource);
    references.add(holder.id);
  }
  const assigned = new Set<LocalId>();
  for (const block of mir.blocks) {
    const blockWork = chargeWork(account, 1);
    if (blockWork !== null) return blockWork;
    for (const statement of block.statements) {
      const read = chargeWork(account, 1);
      if (read !== null) return read;
      if (statement.kind !== "assign") continue;
      const targetPlace = mir.places[statement.place];
      if (targetPlace?.base.kind !== "local") continue;
      const target = targetPlace.base;
      const expected = holders.get(target.local);
      if (expected === undefined) continue;
      const admission = chargeWork(account, 2);
      if (admission !== null) return admission;
      const operand = statement.value.kind === "use" ? statement.value.operand : null;
      const sourcePlace = operand?.kind === "place" ? mir.places[operand.place]?.base : undefined;
      const source = sourcePlace?.kind === "local" ? mir.locals[sourcePlace.local] : undefined;
      if (assigned.has(target.local) || source?.source?.body !== expected.body || source.source.local !== expected.local
        || source.storage !== targetPlace.storage
        || !(source.role.kind === "parameter" && source.mode === "by-value" || source.role.kind === "user" && source.mode === "local"))
        return bodyFrontier("A held reference retains one actual copy of its selected local binding.");
      const retained = chargeResultEntries(account, 1);
      if (retained !== null) return retained;
      assigned.add(target.local);
    }
    const terminal = chargeWork(account, 1);
    if (terminal !== null) return terminal;
    const terminator = block.terminator;
    const destination = "destination" in terminator && terminator.destination !== null ? mir.places[terminator.destination]?.base : undefined;
    if (destination?.kind === "local" && holders.has(destination.local))
      return bodyFrontier("A call or invocation cannot replace the selected held reference.");
  }
  if (assigned.size !== holders.size) return bodyFrontier("Every held reference has its actual producer occurrence.");
  return { kind: "complete", value: { references, places: reads } };
}

export function fieldReadEffects(deps: BodyRoundDeps, objectFormals: ReadonlySet<number>,
  grow: (records: number, references: number) => DataflowStop | null) {
  const paths = new Map<string, ProjectionPathId>();
  const projections: ProjectionPath[] = [];
  const byParameter = new Map<number, Set<ProjectionPathId>>();
  function read(member: MemberSelection, origins: Origins, bound: readonly BoundProducer[], producers: readonly Producer[]): DataflowStop | null {
    const { account } = deps;
    const admission = admitSelectionIdentity(member, account);
    if (admission !== null) return admission;
    const key = encodeKey(memberSelectionKey(member));
    let id = paths.get(key);
    if (id === undefined) {
      const retained = grow(1, 0) ?? chargeResultEntries(account, 3);
      if (retained !== null) return retained;
      id = projectionPathId(projections.length);
      projections.push({ id, parent: null, projection: { kind: "field", member } });
      paths.set(key, id);
    }
    if (origins.kind !== "complete" || origins.includesAbsence || origins.producers.length === 0)
      return bodyFrontier("A held field read requires the complete actual receiver bindings at the read.");
    for (let index = 0; index < origins.producers.length; index += 1) {
      const paid = chargeWork(account, 3);
      if (paid !== null) return paid;
      const identity = origins.producers[index];
      const subject = identity === undefined ? undefined : bound[identity];
      const producer = subject === undefined ? undefined : producers[subject.producer];
      if (producer?.kind !== "parameter" || producer.path !== null || !objectFormals.has(producer.index))
        return bodyFrontier("A held scalar field read requires its actual incoming object producer.");
      let effect = byParameter.get(producer.index);
      if (effect === undefined) {
        const retained = chargeResultEntries(account, 2);
        if (retained !== null) return retained;
        effect = new Set();
        byParameter.set(producer.index, effect);
      }
      if (!effect.has(id)) {
        const retained = grow(0, 1) ?? chargeResultEntries(account, 1);
        if (retained !== null) return retained;
        effect.add(id);
      }
    }
    return null;
  }
  function call(parameter: AppliedSummary["parameters"][number], callee: RelationalArena, caller: RelationalArena): DataflowStop | null {
    const paths = parameter.source.reads.paths;
    for (let index = 0; index < paths.length; index += 1) {
      const admitted = chargeWork(deps.account, 2);
      if (admitted !== null) return admitted;
      const id = paths[index];
      const path = id === undefined ? undefined : callee.projections[id];
      if (path === undefined || path.id !== id || path.parent !== null || path.projection.kind !== "field")
        return bodyFrontier("An applied field read requires its actual direct callee field projection.");
      const member = path.projection.member;
      const { location, read: storage } = member.decision;
      if (location.kind !== "data" || location.receiver !== "by-reference" || location.check.kind !== "none" || storage === null)
        return bodyFrontier("An applied scalar field read requires the selected unchecked reference access.");
      const kind = valueKind(deps, storage);
      const stopped = accountFailure(deps.account);
      if (stopped !== null) return stopped;
      if (kind !== "primitive" || parameter.values.length === 0)
        return bodyFrontier("An applied scalar field read requires its actual incoming reference subjects.");
      for (let subject = 0; subject < parameter.values.length; subject += 1) {
        const prepay = chargeWork(deps.account, 2);
        if (prepay !== null) return prepay;
        const value = parameter.values[subject];
        const origins = value?.kind === "caller" ? caller.origins[value.value.origins] : undefined;
        if (origins === undefined || value?.kind !== "caller" || origins.id !== value.value.origins)
          return bodyFrontier("An applied field read requires its actual caller Origins.");
        const transported = read(member, origins, caller.boundProducers, caller.producers);
        if (transported !== null) return transported;
      }
    }
    return null;
  }
  return { paths: (index: number) => byParameter.get(index), projections, read, call };
}
