import type { DataflowResult, DataflowStop } from "../../dataflow/contract.js";
import { accountFailure, chargeResultEntries, chargeWork } from "../../dataflow/index.js";
import type { BoundProducerId, LocalId, LocalRef, NodeId, OriginsId, PlaceId, ProjectionPathId } from "../../ids/contract.js";
import { admitIntegerKey, boundProducerId, encodeKey, producerId, projectionPathId } from "../../ids/index.js";
import type { AppliedSummary, BoundProducer, CallFieldBindings, Origins, Producer, Projection, ProjectionPath, RelationalArena, Summary } from "../../ir-facts/contract.js";
import { admitSelectionIdentity, fieldProjectionIdentityData, projectCallFields } from "../../ir-facts/index.js";
import type { MirOperand, MirPlace, MirStatement, MirTerminator } from "../../ir-mir/contract.js";
import type { PropertyAccessExpression } from "../../ir-hir/contract.js";
import type { MemberSelection, TirSyntaxOccurrence, TypedPhase } from "../../ir-tir/contract.js";
import type { ReferenceArgumentView, SourceObjectField } from "../../ir-types/contract.js";
import type { BodyRoundDeps, BodyRoundInput } from "./contract.js";
import { bodyFrontier } from "./places.js";
import type { AdmitOrigins, ValueOrigins } from "./values.js";
import { projectOrigins, valueKind } from "./values.js";

type ScalarProjection = Extract<Projection, { readonly kind: "field" | "element" | "index" }>;
type Call = Extract<MirTerminator, { readonly kind: "call" }>;
type Access = "read" | "write";
type IncomingFamily = "field" | "array";
type IncomingRole = "parameter" | "capture";

type FieldValue = "scalar" | "scalar-optional" | "reference" | "reference-optional" | "write-only";
type HeldProjection = { readonly holder: LocalId; readonly value: FieldValue } & ScalarProjection;
type ReceiverProducer = LocalRef | NodeId | PropertyAccessExpression<TypedPhase>;

function sameReceiver(previous: ReceiverProducer, current: ReceiverProducer): boolean {
  if (previous === current) return true;
  if (typeof previous === "number" || typeof current === "number") return false;
  if ("kind" in previous) return false;
  return !("kind" in current) && previous.body === current.body && previous.local === current.local;
}

interface AbsenceValue {
  readonly statement: MirStatement;
  readonly operand: MirOperand;
}

export interface HeldProjections {
  readonly references: ReadonlySet<LocalId>;
  readonly places: ReadonlyMap<PlaceId, HeldProjection>;
  readonly includesAbsence: boolean;
  readonly absenceValues: ReadonlyMap<LocalId, AbsenceValue> | null;
  readonly refined: ReadonlyMap<PlaceId, LocalId> | null;
  readonly saved: ReadonlyMap<LocalId, PlaceId> | null;
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
  projections: readonly MirPlace[], views: readonly MirPlace[] | null): DataflowResult<HeldProjections> {
  const { account } = deps;
  const { mir, tir } = input;
  const start = chargeWork(account, 1) ?? chargeResultEntries(account, 4);
  if (start !== null) return start;
  const places = new Map<PlaceId, HeldProjection>();
  const holders = new Map<LocalId, ReceiverProducer>();
  const references = new Set<LocalId>();
  let includesAbsence = false;
  let hasWriteOnly = false;
  let fields: ((node: NodeId) => DataflowResult<SourceObjectField | null>) | null = null;
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
    let value: FieldValue = optional ? "scalar-optional" : writeOnly ? "write-only" : "scalar";
    if (kind !== "primitive" && !optional && !writeOnly) {
      const fieldRead = node.kind === "PropertyAccessExpression" && node.tsonic.role === "value"
        || node.kind === "BindingElement" && node.tsonic.role === "field-binding";
      if (member !== null && fieldRead && (kind === "reference" || kind === "reference-optional")) {
        value = kind;
      } else {
        if (member === null || node.kind !== "PropertyAccessExpression" || node.tsonic.role !== "value")
          return bodyFrontier("A reference-held non-scalar projection requires its actual projected value Origins and cells.");
        if (fields === null) {
          const prepared = deps.sourceObjectFields(account, tir.body);
          if (prepared.kind !== "complete") return prepared;
          fields = prepared.value;
        }
        const proof = fields(node.id);
        if (proof.kind !== "complete") return proof;
        const field = proof.value;
        if (field === null || field.field !== member.decision.primary || field.occurrence.body !== tir.body || field.occurrence.node !== node.id
          || (field.presence?.storage ?? field.requiredReference) !== place.storage)
          return bodyFrontier("A reference field read needs its actual admitted reference-valued declaration.");
        value = field.presence === null ? "reference" : "reference-optional";
      }
    }
    hasWriteOnly ||= writeOnly;
    includesAbsence ||= optional || value === "reference-optional";
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
    const receiverSource: ReceiverProducer | null = resolution?.kind === "local" ? resolution.local
      : receiver.kind === "CallExpression" && "application" in receiver.tsonic && receiver.tsonic.application.kind === "decided" ? receiver.id
      : receiver.kind === "PropertyAccessExpression" && receiver.tsonic.role === "value" && receiver.tsonic.selection?.kind === "decided"
        ? receiver : null;
    const holderBase = mir.places[base.place]?.base;
    const holder = holderBase?.kind === "local" ? mir.locals[holderBase.local] : undefined;
    const previous = holder === undefined ? undefined : holders.get(holder.id);
    if (receiverSource === null || holder?.role.kind !== "temporary" || holder.mode !== "local"
      || previous !== undefined && !sameReceiver(previous, receiverSource))
      return bodyFrontier("A projected receiver must borrow the actual checked reference through its stable held local.");
    const retained = chargeResultEntries(account, 4);
    if (retained !== null) return retained;
    places.set(place.id, member !== null ? { holder: holder.id, kind: "field", member, value }
      : constant !== null ? { holder: holder.id, kind: "index", constant, value: "scalar" }
        : { holder: holder.id, kind: "element", value: "scalar" });
    holders.set(holder.id, receiverSource);
    references.add(holder.id);
  }
  let refined: Map<PlaceId, LocalId> | null = null;
  let saved: Map<LocalId, PlaceId> | null = null;
  if (views !== null) {
    const setup = chargeResultEntries(account, 2);
    if (setup !== null) return setup;
    refined = new Map();
    saved = new Map();
    for (const view of views) {
      const paid = chargeWork(account, 4);
      if (paid !== null) return paid;
      const base = view.base;
      const temporary = base.kind === "checked" ? mir.places[base.place] : undefined;
      const local = temporary?.base.kind === "local" ? mir.locals[temporary.base.local] : undefined;
      const node = base.kind === "checked" && base.tir.body === tir.body ? source.get(base.tir.node) : undefined;
      const info = node?.kind === "PropertyAccessExpression" && node.tsonic.role === "value" ? node.tsonic.narrowing : null;
      let binding = null;
      if (node?.kind === "BindingElement" && node.tsonic.role === "field-binding") {
        const selectedWork = chargeWork(account, 3);
        if (selectedWork !== null) return selectedWork;
        if (node.tsonic.initializer !== null) binding = node.tsonic;
      }
      const selected = info?.kind === "narrowed" ? info.source : binding?.field.decision.read ?? null;
      const present = info?.kind === "narrowed" ? info.result : binding?.present ?? null;
      if (local?.role.kind !== "temporary" || local.mode !== "local"
        || selected !== local.storage || present !== view.storage || saved.has(local.id))
        return bodyFrontier("A narrowed reference retains its actual checked field and saved optional value.");
      const storage = deps.typeOf(local.storage);
      const cut = accountFailure(account);
      if (cut !== null) return cut;
      if (storage.kind !== "optional" || storage.value !== view.storage)
        return bodyFrontier("A narrowed reference retains the present carrier of its saved optional value.");
      const keep = chargeResultEntries(account, 2);
      if (keep !== null) return keep;
      refined.set(view.id, local.id);
      saved.set(local.id, view.id);
    }
  }
  const assigned = new Set<LocalId>();
  let savedCount = 0;
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
      const savedView = saved?.get(target.local);
      if (savedView !== undefined) {
        const paid = chargeWork(account, 4) ?? chargeResultEntries(account, 1);
        if (paid !== null) return paid;
        const operand = statement.value.kind === "use" ? statement.value.operand : null;
        const original = operand?.kind === "place" ? mir.places[operand.place] : undefined;
        const view = mir.places[savedView];
        if (expected !== undefined || assigned.has(target.local) || original?.base.kind !== "place" || view?.base.kind !== "checked"
          || view.base.place !== targetPlace.id || original.base.tir.node !== view.base.tir.node || statement.tir.node !== view.base.tir.node
          || original.base.tir.body !== tir.body || statement.tir.body !== tir.body || original.storage !== targetPlace.storage
          || places.get(original.id)?.value !== "reference-optional")
          return bodyFrontier("A saved optional reference requires one actual copy of its selected field value.");
        assigned.add(target.local);
        savedCount += 1;
        continue;
      }
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
      if (assigned.has(target.local) || typeof expected === "number")
        return bodyFrontier("A held reference retains only one actual selected producer.");
      if ("kind" in expected) {
        const paid = chargeWork(account, 3);
        if (paid !== null) return paid;
        const original = operand?.kind === "place" ? mir.places[operand.place] : undefined;
        if (original === undefined || sourcePlace?.kind !== "place" && sourcePlace?.kind !== "checked"
          || sourcePlace.tir.body !== tir.body || source.get(sourcePlace.tir.node) !== expected
          || statement.tir.body !== tir.body || statement.tir.node !== expected.id || original.storage !== targetPlace.storage
          || (sourcePlace.kind === "place" ? places.get(original.id)?.value !== "reference" : refined?.has(original.id) !== true))
          return bodyFrontier("A held reference retains one actual projected or checked field operand.");
      } else {
        if (sourceLocal?.source?.body !== expected.body || sourceLocal.source.local !== expected.local || sourceLocal.storage !== targetPlace.storage)
          return bodyFrontier("A held reference retains one actual copy of its selected local binding.");
        if (sourceLocal.role.kind === "capture") {
          const paid = chargeWork(account, 1);
          if (paid !== null) return paid;
          const capture = tir.captures[sourceLocal.role.index];
          if (capture?.local.body !== expected.body || capture.local.local !== expected.local || expected.body === tir.body
            || capture.capture === null || sourceLocal.mode !== capture.capture)
            return bodyFrontier("A held reference retains the actual qualified capture of its checked binding.");
        } else if (expected.body !== tir.body || !(sourceLocal.role.kind === "parameter" && sourceLocal.mode === "by-value"
          || sourceLocal.role.kind === "user" && sourceLocal.mode === "local"))
          return bodyFrontier("A held reference retains one actual copy of its selected local binding.");
      }
      const retained = chargeResultEntries(account, 1);
      if (retained !== null) return retained;
      assigned.add(target.local);
    }
    const terminal = chargeWork(account, 1);
    if (terminal !== null) return terminal;
    const terminator = block.terminator;
    const destination = "destination" in terminator && terminator.destination !== null ? mir.places[terminator.destination]?.base : undefined;
    if (destination?.kind !== "local") continue;
    if (saved?.has(destination.local) === true)
      return bodyFrontier("A saved optional field value cannot be replaced by a call result.");
    const expected = holders.get(destination.local);
    if (expected === undefined) continue;
    if (typeof expected !== "number" || terminator.kind !== "call" || terminator.tir.body !== tir.body
      || terminator.tir.node !== expected || assigned.has(destination.local))
      return bodyFrontier("A selected held reference retains only its actual evaluated call destination.");
    const retained = chargeResultEntries(account, 1);
    if (retained !== null) return retained;
    assigned.add(destination.local);
  }
  if (assigned.size - savedCount !== holders.size || savedCount !== (saved?.size ?? 0))
    return bodyFrontier("Every held reference has its actual producer occurrence.");
  return { kind: "complete", value: { references, places, includesAbsence, absenceValues, refined, saved } };
}

export function projectionEffects(deps: BodyRoundDeps, referenceFormals: ReadonlyMap<number, IncomingFamily> | null,
  referenceCaptures: ReadonlySet<number> | null,
  projections: ProjectionPath[], grow: (records: number, references: number) => DataflowStop | null,
  admitDepth: (depth: number) => DataflowStop | null, bindings: CallFieldBindings) {
  const paths = new Map<string | bigint, ProjectionPathId>();
  let descendants: Map<ProjectionPathId, Map<string | bigint, ProjectionPathId>> | null = null;
  let depths: Map<ProjectionPathId, number> | null = null;
  let boundPaths: Map<ProjectionPathId, Map<BoundProducerId, BoundProducerId>> | null = null;
  let roots: Map<BoundProducerId, BoundProducerId> | null = null;
  const reads = new Map<number, Set<ProjectionPathId>>();
  let writes: Map<number, Set<ProjectionPathId>> | null = null;
  let captureReads: Map<number, Set<ProjectionPathId>> | null = null;
  let captureWrites: Map<number, Set<ProjectionPathId>> | null = null;
  const related = (kind: IncomingRole, index: number) => kind === "parameter" ? referenceFormals?.get(index)
    : referenceCaptures?.has(index) === true ? "field" : undefined;
  const effectsAt = (kind: IncomingRole, access: Access) => kind === "parameter" ? access === "read" ? reads : writes
    : access === "read" ? captureReads : captureWrites;
  function remember(projection: ScalarProjection, parent: ProjectionPathId | null): ProjectionPathId | DataflowStop {
    const { account } = deps;
    const admission = projection.kind === "field" ? admitSelectionIdentity(projection.member, account) : chargeWork(account, 1)
      ?? (projection.kind === "index" ? admitIntegerKey(projection.constant, count => chargeWork(account, count)) : null);
    if (admission !== null) return admission;
    const key = projection.kind === "field" ? encodeKey(fieldProjectionIdentityData(projection.member))
      : projection.kind === "index" ? projection.constant : "element";
    let members = parent === null ? paths : descendants?.get(parent);
    let id = members?.get(key);
    if (id === undefined) {
      if (parent !== null) {
        const admission = chargeWork(account, 1);
        if (admission !== null) return admission;
        if (projections[parent]?.id !== parent) return bodyFrontier("A projection extends its actual earlier path.");
        const depth = (depths?.get(parent) ?? 1) + 1;
        const stop = admitDepth(depth) ?? chargeResultEntries(account, (descendants === null ? 2 : 0) + (members === undefined ? 2 : 0) + 1);
        if (stop !== null) return stop;
        descendants ??= new Map();
        depths ??= new Map();
        if (members === undefined) {
          members = new Map();
          descendants.set(parent, members);
        }
        depths.set(projectionPathId(projections.length), depth);
      }
      const retained = (parent === null ? admitDepth(1) : null) ?? grow(1, parent === null ? 0 : 1) ?? chargeResultEntries(account, 3);
      if (retained !== null) return retained;
      id = projectionPathId(projections.length);
      projections.push({ id, parent, projection: projection.kind === "field" ? { kind: "field", member: projection.member }
        : projection.kind === "index" ? { kind: "index", constant: projection.constant } : { kind: "element" } });
      if (members === undefined) return bodyFrontier("A projection retains the actual index for its parent.");
      members.set(key, id);
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
          projections[id] = { id, parent, projection: { kind: "field", member: selected } };
        }
      }
    }
    return id;
  }
  function observeAt(access: Access, family: "field" | "array", origins: Origins, bound: readonly BoundProducer[],
    producers: readonly Producer[], locate: (parent: ProjectionPathId | null) => ProjectionPathId | DataflowStop): DataflowStop | null {
    const { account } = deps;
    if (origins.kind !== "complete" || origins.includesAbsence || origins.producers.length === 0)
      return bodyFrontier("A held field access requires the complete actual receiver bindings at the occurrence.");
    if (access === "write" && writes === null && (referenceCaptures === null || referenceFormals !== null)) {
      const retained = chargeResultEntries(account, 1);
      if (retained !== null) return retained;
      writes = new Map();
    }
    for (let index = 0; index < origins.producers.length; index += 1) {
      const paid = chargeWork(account, 3);
      if (paid !== null) return paid;
      const identity = origins.producers[index];
      const subject = identity === undefined ? undefined : bound[identity];
      const producer = subject === undefined ? undefined : producers[subject.producer];
      if (producer?.kind === "allocation" && producer.path === null && family === "array") {
        const path = locate(null);
        if (typeof path !== "number") return path;
        continue;
      }
      if (producer?.kind !== "parameter" && producer?.kind !== "capture"
        || related(producer.kind, producer.index) !== family
        || producer.path !== null && family !== "field")
        return bodyFrontier("A held projection requires its actual incoming reference producer and storage family.");
      const id = locate(producer.path);
      if (typeof id !== "number") return id;
      let inventory = effectsAt(producer.kind, access);
      if (inventory === null) {
        const retained = chargeResultEntries(account, 1);
        if (retained !== null) return retained;
        inventory = new Map();
        if (producer.kind === "parameter") writes = inventory;
        else if (access === "read") captureReads = inventory;
        else captureWrites = inventory;
      }
      let effect = inventory.get(producer.index);
      if (effect === undefined) {
        const retained = chargeResultEntries(account, 2);
        if (retained !== null) return retained;
        effect = new Set();
        inventory.set(producer.index, effect);
      }
      if (!effect.has(id)) {
        const retained = grow(0, 1) ?? chargeResultEntries(account, 1);
        if (retained !== null) return retained;
        effect.add(id);
      }
    }
    return null;
  }
  function observe(access: Access, projection: ScalarProjection, origins: Origins, bound: readonly BoundProducer[],
    producers: readonly Producer[]): DataflowStop | null {
    return observeAt(access, projection.kind === "field" ? "field" : "array", origins, bound,
      producers, parent => remember(projection, parent));
  }
  function projectValue(receiver: OriginsId, absence: boolean, values: ValueOrigins, bound: BoundProducer[],
    producers: Producer[], admit: AdmitOrigins,
    locate: (parent: ProjectionPathId | null) => ProjectionPathId | DataflowStop): OriginsId | DataflowStop {
    const paid = chargeWork(deps.account, 1);
    if (paid !== null) return paid;
    const held = values.rows[receiver];
    if (held?.kind !== "complete" || held.includesAbsence || held.producers.length === 0)
      return bodyFrontier("A reference projection needs its actual complete present receiver Origins.");
    return projectOrigins(deps, values, held, absence, admit, identity => {
      const read = chargeWork(deps.account, 3);
      if (read !== null) return read;
      const subject = bound[identity];
      const producer = subject === undefined ? undefined : producers[subject.producer];
      if (subject === undefined || producer?.kind !== "parameter" && producer?.kind !== "capture" || related(producer.kind, producer.index) !== "field")
        return bodyFrontier("A projected field value needs its actual reference formal producer.");
      const path = locate(producer.path);
      if (typeof path !== "number") return path;
      const root = producer.path === null ? identity : roots?.get(identity);
      if (root === undefined) return bodyFrontier("A projected reference retains its actual root binding.");
      let scoped = boundPaths?.get(path);
      const known = scoped?.get(root);
      if (known !== undefined) return known;
      const growth = grow(2, 3) ?? chargeResultEntries(deps.account, 4 + (roots === null ? 2 : 0) + (scoped === undefined ? 2 : 0));
      if (growth !== null) return growth;
      boundPaths ??= new Map();
      roots ??= new Map();
      if (scoped === undefined) {
        scoped = new Map();
        boundPaths.set(path, scoped);
      }
      const producerIdentity = producerId(producers.length);
      const boundIdentity = boundProducerId(bound.length);
      producers.push({ id: producerIdentity, path, kind: producer.kind, index: producer.index });
      bound.push({ id: boundIdentity, producer: producerIdentity, bindings: subject.bindings, context: subject.context });
      scoped.set(root, boundIdentity);
      roots.set(boundIdentity, root);
      return boundIdentity;
    });
  }
  function value(projection: HeldProjection, receiver: OriginsId, values: ValueOrigins, bound: BoundProducer[],
    producers: Producer[], admit: AdmitOrigins): OriginsId | DataflowStop {
    if (projection.kind !== "field") return bodyFrontier("A reference projection needs its actual field.");
    return projectValue(receiver, projection.value === "reference-optional", values, bound, producers, admit,
      parent => remember(projection, parent));
  }
  function callerPath(rows: readonly ProjectionPath[], id: ProjectionPathId, view: ReferenceArgumentView | null,
    parent: ProjectionPathId | null): ProjectionPathId | DataflowStop {
    let image = parent;
    const transported = projectCallFields(deps.account, rows, id, view, bindings, member => {
      const selected = remember({ kind: "field", member }, image);
      if (typeof selected !== "number") return selected;
      image = selected;
      return null;
    });
    if (transported.kind !== "complete") return transported;
    return transported.value && image !== null ? image : bodyFrontier("An applied data field has no actual selected caller correspondence.");
  }
  function call(operation: Call, access: Access, incoming: AppliedSummary["parameters"][number] | AppliedSummary["captures"][number], callee: Summary,
    caller: RelationalArena): DataflowStop | null {
    const { source } = incoming;
    const { paths } = access === "read" ? source.reads : source.writes;
    for (let index = 0; index < paths.length; index += 1) {
      const admitted = chargeWork(deps.account, 2);
      if (admitted !== null) return admitted;
      const id = paths[index];
      const path = id === undefined ? undefined : callee.arena.projections[id];
      if (path === undefined || path.id !== id
        || path.projection.kind !== "field" && path.projection.kind !== "element" && path.projection.kind !== "index")
        return bodyFrontier("An applied access requires its actual direct callee projection.");
      const projection = path.projection;
      let view: ReferenceArgumentView | null = null;
      if (projection.kind === "field") {
        const { decision } = projection.member;
        const { location } = decision;
        const storage = access === "read" ? decision.read : decision.write;
        if (location.kind !== "data" || location.receiver !== "by-reference" || location.check.kind !== "none" || storage === null)
          return bodyFrontier("An applied field access requires the selected unchecked reference access.");
        const paid = chargeWork(deps.account, 1);
        if (paid !== null) return paid;
        if ("slot" in source) {
          const { slot } = source;
          const mapping = slot.kind === "parameter" && operation.callee.kind === "direct"
            ? operation.callee.resolution.decision.parameters[slot.index] : undefined;
          if (mapping?.kind !== "reference-argument" && mapping?.kind !== "argument")
            return bodyFrontier("An applied field access requires its actual selected by-value argument.");
          if (mapping.kind === "reference-argument") view = mapping.view;
        } else {
          const capture = operation.callee.kind === "body" ? operation.callee.captures[source.index] : undefined;
          if (capture === undefined || capture.capture === null)
            return bodyFrontier("An applied field access requires its actual selected capture.");
        }
      } else {
        const admission = chargeWork(deps.account, 3);
        if (admission !== null) return admission;
        if (!("slot" in source) || source.slot.kind !== "parameter") return bodyFrontier("An applied element access requires its actual selected array formal.");
        const { slot } = source;
        const signature = deps.signatureOf(callee.signature);
        const prior = accountFailure(deps.account);
        if (prior !== null) return prior;
        const formal = signature.parameters[slot.index];
        const carrier = formal === undefined ? null : deps.typeOf(formal.type);
        const stopped = accountFailure(deps.account);
        if (stopped !== null) return stopped;
        if (path.parent !== null || carrier?.kind !== "array" || formal?.passing !== "by-value" || access === "write" && carrier.readonly)
          return bodyFrontier("An applied element access requires its actual selected array formal.");
        const kind = valueKind(deps, carrier.element);
        const cut = accountFailure(deps.account);
        if (cut !== null) return cut;
        if (kind !== "primitive") return bodyFrontier("An applied element access requires its actual incoming scalar storage.");
      }
      if (incoming.values.length === 0) return bodyFrontier("An applied access requires its actual incoming reference subjects.");
      for (let subject = 0; subject < incoming.values.length; subject += 1) {
        const prepay = chargeWork(deps.account, 2);
        if (prepay !== null) return prepay;
        const value = incoming.values[subject];
        const origins = value?.kind === "caller" ? caller.origins[value.value.origins] : undefined;
        if (origins === undefined || value?.kind !== "caller" || origins.id !== value.value.origins)
          return bodyFrontier("An applied field access requires its actual caller Origins.");
        const transported = projection.kind === "field"
          ? observeAt(access, "field", origins, caller.boundProducers, caller.producers,
            parent => callerPath(callee.arena.projections, path.id, view, parent))
          : observe(access, projection, origins, caller.boundProducers, caller.producers);
        if (transported !== null) return transported;
      }
    }
    return null;
  }
  function appliedValue(operation: Call, callee: Summary, index: number, path: ProjectionPathId, receiver: OriginsId,
    values: ValueOrigins, bound: BoundProducer[], producers: Producer[], admit: AdmitOrigins): OriginsId | DataflowStop {
    const paid = chargeWork(deps.account, 1);
    if (paid !== null) return paid;
    const mapping = operation.callee.kind === "direct" ? operation.callee.resolution.decision.parameters[index] : undefined;
    if (mapping?.kind !== "reference-argument" && mapping?.kind !== "argument" || mapping.passing !== "by-value")
      return bodyFrontier("A projected callee producer retains its actual selected incoming argument.");
    return projectValue(receiver, false, values, bound, producers, admit,
      parent => callerPath(callee.arena.projections, path, mapping.kind === "reference-argument" ? mapping.view : null, parent));
  }
  return { paths: (access: Access, kind: IncomingRole, index: number) => effectsAt(kind, access)?.get(index),
    projections, remember, observe, value, call, appliedValue };
}
