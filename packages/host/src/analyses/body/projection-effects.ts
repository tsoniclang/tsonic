import type { DataflowResult, DataflowStop } from "../../dataflow/contract.js";
import { accountFailure, chargeResultEntries, chargeWork } from "../../dataflow/index.js";
import type { LocalId, LocalRef, NodeId, PlaceId, ProjectionPathId } from "../../ids/contract.js";
import { admitIntegerKey, encodeKey, projectionPathId } from "../../ids/index.js";
import type { AppliedSummary, BoundProducer, Origins, Producer, Projection, ProjectionPath, RelationalArena, Summary } from "../../ir-facts/contract.js";
import { admitSelectionIdentity, fieldProjectionIdentityData } from "../../ir-facts/index.js";
import type { MirOperand, MirPlace, MirStatement } from "../../ir-mir/contract.js";
import type { MemberSelection, TirSyntaxOccurrence } from "../../ir-tir/contract.js";
import type { BodyRoundDeps, BodyRoundInput } from "./contract.js";
import { bodyFrontier } from "./places.js";
import { valueKind } from "./values.js";

type ScalarProjection = Extract<Projection, { readonly kind: "field" | "element" | "index" }>;

type HeldProjection = { readonly holder: LocalId; readonly value: "scalar" | "scalar-optional" | "write-only" } & ScalarProjection;
type ReceiverProducer = LocalRef | NodeId;

interface AbsenceValue {
  readonly statement: MirStatement;
  readonly operand: MirOperand;
}

export interface HeldProjections {
  readonly references: ReadonlySet<LocalId>;
  readonly places: ReadonlyMap<PlaceId, HeldProjection>;
  readonly includesAbsence: boolean;
  readonly absenceValues: ReadonlyMap<LocalId, AbsenceValue> | null;
}

function fieldSelection(place: MirPlace, node: TirSyntaxOccurrence | undefined): MemberSelection {
  const base = place.base;
  if (base.kind === "place" && base.projection.kind === "field" && node?.kind === "BindingElement" && node.tsonic.role === "field-binding") {
    const field = node.tsonic.field;
    if (field.decision.location.kind !== "data" || field.decision.location.receiver !== "by-reference"
      || field.decision.location.check.kind !== "none" || field.decision.read !== place.storage
      || field.decision.primary !== base.projection.member.decision.primary)
      return bodyFrontier("A binding retains its actual selected reference-held field read.");
    return field;
  }
  if (base.kind !== "place" || base.projection.kind !== "field" || node?.kind !== "PropertyAccessExpression"
    || node.tsonic.role !== "value" && node.tsonic.role !== "assignment-target")
    return bodyFrontier("A field retains its actual selected receiver syntax.");
  const payload = node.tsonic;
  const selection = payload.selection;
  const writing = payload.role === "assignment-target";
  if (selection?.kind !== "decided" || selection.decision.decision.location.kind !== "data"
    || selection.decision.decision.location.receiver !== "by-reference" || selection.decision.decision.location.check.kind !== "none"
    || (writing ? selection.decision.decision.write : selection.decision.decision.read) !== place.storage
    || writing && (payload.access.storage !== place.storage || payload.access.kind === "read-write" && selection.decision.decision.read !== payload.access.read)
    || selection.decision.decision.primary !== base.projection.member.decision.primary)
    return bodyFrontier("A scalar field access requires its actual selected reference-held data field.");
  return selection.decision;
}

export function heldProjections(deps: BodyRoundDeps, input: BodyRoundInput, source: ReadonlyMap<NodeId, TirSyntaxOccurrence>,
  projections: readonly MirPlace[]): DataflowResult<HeldProjections> {
  const { account } = deps;
  const { mir, tir } = input;
  const start = chargeWork(account, 1) ?? chargeResultEntries(account, 4);
  if (start !== null) return start;
  const places = new Map<PlaceId, HeldProjection>();
  const holders = new Map<LocalId, ReceiverProducer>();
  const references = new Set<LocalId>();
  let includesAbsence = false;
  let hasWriteOnly = false;
  for (let position = 0; position < projections.length; position += 1) {
    const admission = chargeWork(account, 4);
    if (admission !== null) return admission;
    const place = projections[position];
    if (place === undefined) return bodyFrontier("An admitted projection inventory is dense.");
    const base = place.base;
    if (base.kind !== "place" && base.kind !== "checked" || base.tir.body !== tir.body)
      return bodyFrontier("BodyAnalysis requires the actual selected projection or static-cell producer for this place.");
    const node = source.get(base.tir.node);
    const index = base.kind === "checked" && base.projection.kind === "index" ? base.projection.operand : null;
    let member: MemberSelection | null = null;
    let constant: bigint | null = null;
    if (index === null) member = fieldSelection(place, node);
    else {
      const prepared = chargeWork(account, 3);
      if (prepared !== null) return prepared;
      const payload = node?.kind === "ElementAccessExpression" ? node.tsonic : null;
      const selected = payload !== null && "index" in payload ? payload.index : null;
      if (selected?.holding !== "by-reference" || (payload?.role === "value" ? selected.read : selected.write) !== place.storage
        || mir.places[base.place]?.storage !== selected.receiver)
        return bodyFrontier("A scalar element access requires its actual selected checked reference-held array.");
      const value = index.kind === "constant" ? mir.constants[index.constant]?.value : undefined;
      const literal = value?.kind === "literal" ? value.value : undefined;
      if (literal?.kind === "bigint") constant = literal.value;
      else if (literal?.kind === "number" && literal.value.denominator === 1n) constant = literal.value.numerator;
    }
    if (node?.kind !== "PropertyAccessExpression" && node?.kind !== "ElementAccessExpression" && node?.kind !== "BindingElement")
      return bodyFrontier("A held projection retains its actual selected receiver syntax.");
    const kind = valueKind(deps, place.storage);
    const stopped = accountFailure(account);
    if (stopped !== null) return stopped;
    const optional = member !== null && kind === "primitive-optional";
    const writeOnly = kind !== "primitive" && !optional && member !== null && member.decision.read === null
      && node.kind === "PropertyAccessExpression" && node.tsonic.role === "assignment-target" && node.tsonic.access.kind === "write";
    if (kind !== "primitive" && !optional && !writeOnly)
      return bodyFrontier("A reference-held non-scalar projection requires its actual projected value Origins and cells.");
    hasWriteOnly ||= writeOnly;
    includesAbsence ||= optional;
    let receiver;
    if (node.kind === "BindingElement") {
      const admission = chargeWork(account, 2);
      if (admission !== null) return admission;
      const pattern = node.parent === null ? undefined : source.get(node.parent);
      const declaration = pattern?.kind === "ObjectBindingPattern" && pattern.parent !== null ? source.get(pattern.parent) : undefined;
      if (declaration?.kind !== "VariableDeclaration" || declaration.name !== pattern || declaration.initializer === null)
        return bodyFrontier("A held binding projection retains its original evaluated source.");
      receiver = declaration.initializer;
    } else receiver = node.expression;
    while (receiver.kind === "ParenthesizedExpression") {
      const cut = chargeWork(account, 1);
      if (cut !== null) return cut;
      receiver = receiver.expression;
    }
    const resolution = receiver.kind === "Identifier" && receiver.tsonic.role === "value" ? receiver.tsonic.resolution : null;
    const receiverSource: ReceiverProducer | null = resolution?.kind === "local" && resolution.local.body === tir.body ? resolution.local
      : receiver.kind === "CallExpression" && "application" in receiver.tsonic && receiver.tsonic.application.kind === "decided" ? receiver.id : null;
    const holderBase = mir.places[base.place]?.base;
    const holder = holderBase?.kind === "local" ? mir.locals[holderBase.local] : undefined;
    const previous = holder === undefined ? undefined : holders.get(holder.id);
    if (receiverSource === null || holder?.role.kind !== "temporary" || holder.mode !== "local"
      || previous !== undefined && previous !== receiverSource && (typeof previous === "number" || typeof receiverSource === "number"
        || previous.body !== receiverSource.body || previous.local !== receiverSource.local))
      return bodyFrontier("A projected receiver must borrow the actual checked reference through its stable held local.");
    const retained = chargeResultEntries(account, 4);
    if (retained !== null) return retained;
    places.set(place.id, member !== null ? { holder: holder.id, kind: "field", member,
      value: optional ? "scalar-optional" : writeOnly ? "write-only" : "scalar" }
      : constant !== null ? { holder: holder.id, kind: "index", constant, value: "scalar" }
        : { holder: holder.id, kind: "element", value: "scalar" });
    holders.set(holder.id, receiverSource);
    references.add(holder.id);
  }
  const assigned = new Set<LocalId>();
  let absenceValues: Map<LocalId, AbsenceValue> | null = null;
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
      if (expected === undefined) {
        if (!hasWriteOnly || statement.value.kind !== "convert") continue;
        const admission = chargeWork(account, 1);
        if (admission !== null) return admission;
        const local = mir.locals[target.local];
        const selected = statement.value.operation.decision;
        const operation = selected.kind === "selected" && selected.execution.kind === "pure" ? selected.operation : null;
        if (local?.role.kind !== "temporary" || operation?.kind !== "conversion" || operation.embedding.kind !== "conversion"
          || operation.embedding.conversion !== "absence" || operation.embedding.check.kind !== "none") continue;
        const paid = chargeWork(account, 2);
        if (paid !== null) return paid;
        const site = source.get(statement.tir.node);
        const phase = site?.tsonic;
        const conversion = phase !== undefined && phase !== null && "conversion" in phase ? phase.conversion : null;
        const checked = conversion?.kind === "convert" ? conversion.operation.decision.operation : null;
        const from = deps.typeOf(operation.from);
        const stop = accountFailure(account);
        if (stop !== null) return stop;
        if (checked?.kind !== "conversion" || checked.embedding.kind !== "conversion" || checked.embedding.conversion !== "absence"
          || checked.from !== operation.from || checked.to !== operation.to || checked.to !== local.storage
          || from.kind !== "intrinsic" || from.intrinsic !== "absence"
          || absenceValues?.has(local.id) === true)
          return bodyFrontier("An absence materialization requires its actual selected source and one temporary destination.");
        const retention = chargeResultEntries(account, absenceValues === null ? 3 : 2);
        if (retention !== null) return retention;
        absenceValues ??= new Map();
        absenceValues.set(local.id, { statement, operand: statement.value.operand });
        continue;
      }
      const admission = chargeWork(account, 2);
      if (admission !== null) return admission;
      const operand = statement.value.kind === "use" ? statement.value.operand : null;
      const sourcePlace = operand?.kind === "place" ? mir.places[operand.place]?.base : undefined;
      const sourceLocal = sourcePlace?.kind === "local" ? mir.locals[sourcePlace.local] : undefined;
      if (typeof expected === "number" || assigned.has(target.local) || sourceLocal?.source?.body !== expected.body || sourceLocal.source.local !== expected.local
        || sourceLocal.storage !== targetPlace.storage
        || !(sourceLocal.role.kind === "parameter" && sourceLocal.mode === "by-value" || sourceLocal.role.kind === "user" && sourceLocal.mode === "local"))
        return bodyFrontier("A held reference retains one actual copy of its selected local binding.");
      const retained = chargeResultEntries(account, 1);
      if (retained !== null) return retained;
      assigned.add(target.local);
    }
    const terminal = chargeWork(account, 1);
    if (terminal !== null) return terminal;
    const terminator = block.terminator;
    const destination = "destination" in terminator && terminator.destination !== null ? mir.places[terminator.destination]?.base : undefined;
    if (destination?.kind !== "local") continue;
    const expected = holders.get(destination.local);
    if (expected === undefined) continue;
    if (typeof expected !== "number" || terminator.kind !== "call" || terminator.tir.body !== tir.body
      || terminator.tir.node !== expected || assigned.has(destination.local))
      return bodyFrontier("A selected held reference retains only its actual evaluated call destination.");
    const retained = chargeResultEntries(account, 1);
    if (retained !== null) return retained;
    assigned.add(destination.local);
  }
  if (assigned.size !== holders.size) return bodyFrontier("Every held reference has its actual producer occurrence.");
  return { kind: "complete", value: { references, places, includesAbsence, absenceValues } };
}

export function projectionEffects(deps: BodyRoundDeps, referenceFormals: ReadonlyMap<number, "field" | "array"> | null,
  projections: ProjectionPath[], grow: (records: number, references: number) => DataflowStop | null) {
  const paths = new Map<string | bigint, ProjectionPathId>();
  const reads = new Map<number, Set<ProjectionPathId>>();
  let writes: Map<number, Set<ProjectionPathId>> | null = null;
  function remember(projection: ScalarProjection): ProjectionPathId | DataflowStop {
    const { account } = deps;
    const admission = projection.kind === "field" ? admitSelectionIdentity(projection.member, account) : chargeWork(account, 1)
      ?? (projection.kind === "index" ? admitIntegerKey(projection.constant, count => chargeWork(account, count)) : null);
    if (admission !== null) return admission;
    const key = projection.kind === "field" ? encodeKey(fieldProjectionIdentityData(projection.member))
      : projection.kind === "index" ? projection.constant : "element";
    let id = paths.get(key);
    if (id === undefined) {
      const retained = grow(1, 0) ?? chargeResultEntries(account, 3);
      if (retained !== null) return retained;
      id = projectionPathId(projections.length);
      projections.push({ id, parent: null, projection: projection.kind === "field" ? { kind: "field", member: projection.member }
        : projection.kind === "index" ? { kind: "index", constant: projection.constant } : { kind: "element" } });
      paths.set(key, id);
    } else if (projection.kind === "field") {
      const { member } = projection;
      const paid = chargeWork(account, 1);
      if (paid !== null) return paid;
      const path = projections[id];
      if (path?.projection.kind !== "field") return bodyFrontier("A field path requires its actual retained field.");
      const previous = path.projection.member;
      if (previous !== member) {
        const offered = chargeWork(account, 4);
        if (offered !== null) return offered;
        const first = previous.decision;
        const { read: firstRead, write: firstWrite } = first;
        const { read: laterRead, write: laterWrite } = member.decision;
        if (firstRead !== null && laterRead !== null && firstRead !== laterRead
          || firstWrite !== null && laterWrite !== null && firstWrite !== laterWrite)
          return bodyFrontier("The same field path requires agreeing selected types for each reached access.");
        const read = firstRead ?? laterRead;
        const write = firstWrite ?? laterWrite;
        if (read !== firstRead || write !== firstWrite) {
          const retained = chargeWork(account, 10) ?? chargeResultEntries(account, 4);
          if (retained !== null) return retained;
          const { key, origins, selectedDeclarations, primary, bindings, getter, setter, location } = first;
          const selected = { getter: previous.getter, setter: previous.setter,
            decision: { key, origins, selectedDeclarations, primary, bindings, read, write, getter, setter, location } };
          projections[id] = { id, parent: null, projection: { kind: "field", member: selected } };
        }
      }
    }
    return id;
  }
  function observe(access: "read" | "write", projection: ScalarProjection, origins: Origins, bound: readonly BoundProducer[],
    producers: readonly Producer[]): DataflowStop | null {
    const id = remember(projection);
    if (typeof id !== "number") return id;
    const { account } = deps;
    if (origins.kind !== "complete" || origins.includesAbsence || origins.producers.length === 0)
      return bodyFrontier("A held field access requires the complete actual receiver bindings at the occurrence.");
    if (access === "write" && writes === null) {
      const retained = chargeResultEntries(account, 1);
      if (retained !== null) return retained;
      writes = new Map();
    }
    const byParameter = access === "read" ? reads : writes;
    if (byParameter === null) return bodyFrontier("A selected field effect retains its actual access inventory.");
    for (let index = 0; index < origins.producers.length; index += 1) {
      const paid = chargeWork(account, 3);
      if (paid !== null) return paid;
      const identity = origins.producers[index];
      const subject = identity === undefined ? undefined : bound[identity];
      const producer = subject === undefined ? undefined : producers[subject.producer];
      if (producer?.kind === "allocation" && producer.path === null && projection.kind !== "field") continue;
      if (producer?.kind !== "parameter" || producer.path !== null
        || referenceFormals?.get(producer.index) !== (projection.kind === "field" ? "field" : "array"))
        return bodyFrontier("A held projection requires its actual incoming reference producer and storage family.");
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
  function call(access: "read" | "write", parameter: AppliedSummary["parameters"][number], callee: Summary, caller: RelationalArena): DataflowStop | null {
    const { paths } = access === "read" ? parameter.source.reads : parameter.source.writes;
    for (let index = 0; index < paths.length; index += 1) {
      const admitted = chargeWork(deps.account, 2);
      if (admitted !== null) return admitted;
      const id = paths[index];
      const path = id === undefined ? undefined : callee.arena.projections[id];
      if (path === undefined || path.id !== id || path.parent !== null
        || path.projection.kind !== "field" && path.projection.kind !== "element" && path.projection.kind !== "index")
        return bodyFrontier("An applied access requires its actual direct callee projection.");
      const projection = path.projection;
      let storage;
      if (projection.kind === "field") {
        const { decision } = projection.member;
        const { location } = decision;
        storage = access === "read" ? decision.read : decision.write;
        if (location.kind !== "data" || location.receiver !== "by-reference" || location.check.kind !== "none" || storage === null)
          return bodyFrontier("An applied scalar field access requires the selected unchecked reference access.");
      } else {
        const admission = chargeWork(deps.account, 3);
        if (admission !== null) return admission;
        const { slot } = parameter.source;
        if (slot.kind !== "parameter") return bodyFrontier("An applied element access requires its actual selected array formal.");
        const signature = deps.signatureOf(callee.signature);
        const prior = accountFailure(deps.account);
        if (prior !== null) return prior;
        const formal = signature.parameters[slot.index];
        const carrier = formal === undefined ? null : deps.typeOf(formal.type);
        const stopped = accountFailure(deps.account);
        if (stopped !== null) return stopped;
        if (carrier?.kind !== "array" || formal?.passing !== "by-value" || access === "write" && carrier.readonly)
          return bodyFrontier("An applied element access requires its actual selected array formal.");
        storage = carrier.element;
      }
      const kind = valueKind(deps, storage);
      const stopped = accountFailure(deps.account);
      if (stopped !== null) return stopped;
      if ((kind !== "primitive" && !(projection.kind === "field" && kind === "primitive-optional")) || parameter.values.length === 0)
        return bodyFrontier("An applied scalar field access requires its actual incoming reference subjects.");
      for (let subject = 0; subject < parameter.values.length; subject += 1) {
        const prepay = chargeWork(deps.account, 2);
        if (prepay !== null) return prepay;
        const value = parameter.values[subject];
        const origins = value?.kind === "caller" ? caller.origins[value.value.origins] : undefined;
        if (origins === undefined || value?.kind !== "caller" || origins.id !== value.value.origins)
          return bodyFrontier("An applied field access requires its actual caller Origins.");
        const transported = observe(access, projection, origins, caller.boundProducers, caller.producers);
        if (transported !== null) return transported;
      }
    }
    return null;
  }
  return { paths: (access: "read" | "write", index: number) => (access === "read" ? reads : writes)?.get(index), projections, remember, observe, call };
}
