import type { BoundProducerId, KeyData, LibraryExportIdentity, OpenBoundaryId, OriginsId, ProducerId, ProjectionPathId, SourceNodeRef } from "../ids/contract.js";
import type { DataflowAccount, DataflowResult, DataflowStop } from "../dataflow/contract.js";
import { chargeResultEntries, chargeWork, orderRows } from "../dataflow/index.js";
import { boundProducerId, encodeKey, openBoundaryId, originsId, producerId, projectionPathId, valueContextId } from "../ids/index.js";
import type { BindingVector, DeclaredExecution, Signature } from "../ir-types/contract.js";
import type { MemberSelection } from "../ir-tir/contract.js";
import type { BoundProducer, CaptureEffect, CaptureLocation, EffectPaths, EscapeTarget, OpenBoundary, Origins, ParameterEffect,
  DeclaredCellInventory, Producer, Projection, ProjectionPath, SummaryRetention, Summary, SummaryRelations, SummaryWrite,
  ValueArgument } from "../ir-facts/contract.js";
import type { AdmittedNativeGuarantee, NativeExportAssociation } from "../libraries/contract.js";
import { admitNativeIdentity } from "./declared-work.js";

type NativeStatement = AdmittedNativeGuarantee["statement"];
type ParameterStatement = NativeStatement["parameters"][number];
type CaptureStatement = NativeStatement["captures"][number];
type NativeEffectPaths = ParameterStatement["reads"];
type NativeEscapeTarget = NativeStatement["retention"][number]["into"];

const compareText = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const ordinal = (value: number, length: number): boolean => Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0) && value < length;

function boundaryIds(account: DataflowAccount, values: readonly [number, ...number[]]): DataflowResult<readonly [OpenBoundaryId, ...OpenBoundaryId[]]> {
  const setup = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
  if (setup !== null) return setup;
  const mapped: [OpenBoundaryId, ...OpenBoundaryId[]] = [openBoundaryId(values[0])];
  for (let index = 1; index < values.length; index += 1) {
    const read = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
    if (read !== null) return read;
    const boundary = values[index];
    if (boundary === undefined) throw new TypeError("The admitted native boundary inventory is dense");
    mapped.push(openBoundaryId(boundary));
  }
  return { kind: "complete", value: mapped };
}

function sortSet<Value extends number>(account: DataflowAccount, values: ReadonlySet<Value>): DataflowResult<readonly Value[]> {
  const scan = chargeWork(account, values.size) ?? chargeResultEntries(account, 1 + values.size);
  return scan ?? orderRows([...values], (left, right) => left - right, account);
}

function effectPaths(account: DataflowAccount, paths: NativeEffectPaths,
  remapped: ReadonlyMap<number, ProjectionPathId>): DataflowResult<EffectPaths | null> {
  const setup = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
  if (setup !== null) return setup;
  const distinct = new Set<ProjectionPathId>();
  for (let index = 0; index < paths.paths.length; index += 1) {
    const read = chargeWork(account, 1);
    if (read !== null) return read;
    const path = paths.paths[index];
    if (path === undefined) return { kind: "complete", value: null };
    const projected = remapped.get(path);
    if (projected === undefined) return { kind: "complete", value: null };
    if (distinct.has(projected)) continue;
    const retain = chargeResultEntries(account, 1);
    if (retain !== null) return retain;
    distinct.add(projected);
  }
  const projected = sortSet(account, distinct);
  if (projected.kind !== "complete") return projected;
  const keep = chargeResultEntries(account, 1);
  if (keep !== null) return keep;
  if (paths.kind === "complete") return { kind: "complete", value: { kind: "complete", paths: projected.value } };
  const boundaries = boundaryIds(account, paths.boundaries);
  return boundaries.kind === "complete" ? { kind: "complete", value: { kind: "open", paths: projected.value, boundaries: boundaries.value } }
    : boundaries;
}

function declaredSiteData(identity: LibraryExportIdentity, site: number): readonly KeyData[] {
  return ["declared", identity.module.providerId, identity.module.providerVersion, identity.module.packageName, identity.module.moduleSpecifier, identity.module.providerModuleId, identity.exportId, identity.memberId, identity.signatureId, site];
}

function slotKey(kind: "receiver" | "parameter" | "capture", index: number): string {
  return `${kind}:${index}`;
}

interface BoundReference {
  readonly id: ProducerId;
  readonly bound: BoundProducerId;
}

type Formal = BoundReference & (
  | { readonly kind: "receiver" }
  | { readonly kind: "parameter" | "capture"; readonly index: number }
);

interface BoundEscape {
  readonly value: EscapeTarget;
  readonly key: string;
}

export interface EnvironmentValue {
  readonly value: BindingVector;
  readonly token: number;
}

export interface MemberValue {
  readonly value: MemberSelection;
  readonly token: number;
}

export interface ExportValue {
  readonly association: NativeExportAssociation;
  readonly environment: EnvironmentValue;
  readonly member: MemberValue | null;
}

export function translateNativeSummary(account: DataflowAccount, raw: NativeStatement, selected: ExportValue, signature: Signature,
  execution: DeclaredExecution, declarationSource: SourceNodeRef, cells: DeclaredCellInventory, relations: SummaryRelations,
  lookup: (identity: LibraryExportIdentity) => ExportValue | null | DataflowStop): Summary | null | DataflowStop {
  const setup = chargeWork(account, 4) ?? chargeResultEntries(account, 6);
  if (setup !== null) return setup;
  const environment = selected.environment;
  const bindings = environment.value;
  const context = valueContextId(0);
  const producers: Producer[] = [];
  const boundProducers: BoundProducer[] = [];
  const formals = new Map<string, Formal>();
  const remapped = new Map<number, BoundReference>();
  const producerKeys = new Map<string, ProducerId>();
  const alternativeKeys = new Map<string, BoundProducerId>();
  const add = (producer: Producer, identity: KeyData, environment: EnvironmentValue): BoundReference | DataflowStop => {
    const work = chargeWork(account, 2) ?? chargeResultEntries(account, 3);
    if (work !== null) return work;
    const key = encodeKey([producer.kind, producer.path, identity]);
    let id = producerKeys.get(key);
    if (id === undefined) {
      const keep = chargeResultEntries(account, 2);
      if (keep !== null) return keep;
      id = producer.id;
      producerKeys.set(key, id);
      producers.push(producer);
    }
    const alternativeKey = encodeKey([id, environment.token, context]);
    let bound = alternativeKeys.get(alternativeKey);
    if (bound === undefined) {
      const keep = chargeResultEntries(account, 3);
      if (keep !== null) return keep;
      bound = boundProducerId(boundProducers.length);
      alternativeKeys.set(alternativeKey, bound);
      boundProducers.push({ id: bound, producer: id, bindings: environment.value, context });
    }
    return { id, bound };
  };
  if (signature.receiver !== null) {
    const keep = chargeWork(account, 1) ?? chargeResultEntries(account, 3);
    if (keep !== null) return keep;
    const identifier = producerId(producers.length);
    const assigned = add({ id: identifier, kind: "receiver", path: null }, null, environment);
    if ("kind" in assigned) return assigned;
    formals.set(slotKey("receiver", 0), { ...assigned, kind: "receiver" });
  }
  for (let position = 0; position < signature.parameters.length; position += 1) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    const parameter = signature.parameters[position];
    if (parameter === undefined) return null;
    const identifier = producerId(producers.length);
    const keep = chargeResultEntries(account, 3);
    if (keep !== null) return keep;
    if (position >= execution.provided && parameter.kind !== "rest") {
      producers.push({ id: identifier, kind: "parameter", index: position, path: null });
      continue;
    }
    const assigned = add({ id: identifier, kind: "parameter", index: position, path: null }, position, environment);
    if ("kind" in assigned) return assigned;
    formals.set(slotKey("parameter", position), { ...assigned, kind: "parameter", index: position });
  }
  for (let position = 0; position < raw.captures.length; position += 1) {
    const keep = chargeWork(account, 1) ?? chargeResultEntries(account, 3);
    if (keep !== null) return keep;
    const identifier = producerId(producers.length);
    const assigned = add({ id: identifier, kind: "capture", index: position, path: null }, position, environment);
    if ("kind" in assigned) return assigned;
    formals.set(slotKey("capture", position), { ...assigned, kind: "capture", index: position });
  }
  const pathSetup = chargeResultEntries(account, 3);
  if (pathSetup !== null) return pathSetup;
  const projections: ProjectionPath[] = [];
  const projectionIds = new Map<number, ProjectionPathId>();
  const projectionKeys = new Map<string, ProjectionPathId>();
  for (let position = 0; position < raw.projections.length; position += 1) {
    const read = chargeWork(account, 1);
    if (read !== null) return read;
    const path = raw.projections[position];
    if (path === undefined) return null;
    const parent = path.parent === null ? null : projectionIds.get(path.parent);
    if (parent === undefined) return null;
    let projection: Projection;
    let data: KeyData;
    const scratch = chargeResultEntries(account, 4);
    if (scratch !== null) return scratch;
    switch (path.projection.kind) {
      case "field": case "method-value": {
        const target = lookup(path.projection.identity);
        if (target !== null && "kind" in target) return target;
        if (target === null || target.member === null) return null;
        projection = { kind: path.projection.kind, member: target.member.value };
        data = [path.projection.kind, target.member.token];
        break;
      }
      case "element": case "deref": projection = { kind: path.projection.kind }; data = [path.projection.kind]; break;
      case "index": projection = { kind: "index", constant: path.projection.constant };
        data = [path.projection.kind, path.projection.constant]; break;
    }
    const key = encodeKey([parent, data]);
    let id = projectionKeys.get(key);
    if (id === undefined) {
      const keep = chargeResultEntries(account, 3);
      if (keep !== null) return keep;
      id = projectionPathId(projections.length);
      projectionKeys.set(key, id);
      projections.push({ id, parent, projection });
    }
    const keep = chargeResultEntries(account, 1);
    if (keep !== null) return keep;
    projectionIds.set(path.id, id);
  }
  for (let position = 0; position < raw.producers.length; position += 1) {
    const read = chargeWork(account, 1);
    if (read !== null) return read;
    const producer = raw.producers[position];
    if (producer === undefined) return null;
    const keep = chargeResultEntries(account, 1);
    if (keep !== null) return keep;
    if (producer.path === null && (producer.kind === "receiver" || producer.kind === "parameter" || producer.kind === "capture")) {
      const assigned = formals.get(slotKey(producer.kind, producer.kind === "receiver" ? 0 : producer.index));
      if (assigned === undefined) return null;
      remapped.set(producer.id, assigned);
      continue;
    }
    if (producer.kind === "receiver" && signature.receiver === null) return null;
    if (producer.kind === "parameter" && (!ordinal(producer.index, signature.parameters.length)
      || !formals.has(slotKey("parameter", producer.index)))) return null;
    if (producer.kind === "capture" && !ordinal(producer.index, raw.captures.length)) return null;
    const id = producerId(producers.length);
    const path = producer.path === null ? null : projectionIds.get(producer.path);
    if (path === undefined) return null;
    let assigned: BoundReference | DataflowStop;
    const construct = chargeResultEntries(account, 1);
    if (construct !== null) return construct;
    switch (producer.kind) {
      case "receiver": assigned = add({ id, kind: "receiver", path }, null, environment); break;
      case "parameter": case "capture":
        assigned = add({ id, kind: producer.kind, index: producer.index, path }, producer.index, environment); break;
      case "allocation": {
        const identity = admitNativeIdentity(account, raw.identity) ?? chargeResultEntries(account, 2);
        if (identity !== null) return identity;
        assigned = add({ id, kind: "allocation", at: { kind: "declared", identity: raw.identity, site: producer.site }, path },
          declaredSiteData(raw.identity, producer.site), environment);
        break;
      }
      case "shared": {
        const target = lookup(producer.identity);
        if (target !== null && "kind" in target) return target;
        if (target === null) return null;
        const definition = target.association.kind === "callable" ? target.association.request.definition : target.association.declaration;
        const read = chargeWork(account, definition.length);
        if (read !== null) return read;
        assigned = add({ id, kind: "shared", definition, path }, definition, target.environment);
        break;
      }
    }
    if ("kind" in assigned) return assigned;
    remapped.set(producer.id, assigned);
  }
  const originSetup = chargeResultEntries(account, 1);
  if (originSetup !== null) return originSetup;
  const origins: Origins[] = [];
  for (let position = 0; position < raw.origins.length; position += 1) {
    const read = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
    if (read !== null) return read;
    const row = raw.origins[position];
    if (row === undefined) return null;
    const alternatives = new Set<BoundProducerId>();
    for (let index = 0; index < row.producers.length; index += 1) {
      const step = chargeWork(account, 1);
      if (step !== null) return step;
      const reference = row.producers[index];
      if (reference === undefined) return null;
      const assigned = remapped.get(reference);
      if (assigned === undefined) return null;
      if (alternatives.has(assigned.bound)) continue;
      const keep = chargeResultEntries(account, 1);
      if (keep !== null) return keep;
      alternatives.add(assigned.bound);
    }
    const ordered = sortSet(account, alternatives);
    if (ordered.kind !== "complete") return ordered;
    const keep = chargeResultEntries(account, 2);
    if (keep !== null) return keep;
    if (row.kind === "complete") origins.push({ id: originsId(row.id), producers: ordered.value, includesAbsence: row.includesAbsence, kind: "complete" });
    else {
      const boundaries = boundaryIds(account, row.boundaries);
      if (boundaries.kind !== "complete") return boundaries;
      origins.push({ id: originsId(row.id), producers: ordered.value, includesAbsence: row.includesAbsence, kind: "open", boundaries: boundaries.value });
    }
  }
  const boundarySetup = chargeResultEntries(account, 1);
  if (boundarySetup !== null) return boundarySetup;
  const boundaries: OpenBoundary[] = [];
  for (let position = 0; position < raw.boundaries.length; position += 1) {
    const read = chargeWork(account, 1) ?? chargeResultEntries(account, 3);
    if (read !== null) return read;
    const boundary = raw.boundaries[position];
    if (boundary === undefined) return null;
    const subject = remapped.get(boundary.subject);
    if (subject === undefined) return null;
    let owner: ProducerId | null = null;
    if (boundary.owner !== null) {
      const assigned = remapped.get(boundary.owner);
      if (assigned === undefined) return null;
      owner = assigned.id;
    }
    boundaries.push({ id: openBoundaryId(boundary.id), kind: boundary.kind,
      at: { kind: "declared", identity: raw.identity, site: boundary.site }, subject: subject.id, owner, bindings, context,
      detail: boundary.detail });
  }
  const parameterSetup = chargeResultEntries(account, 2);
  if (parameterSetup !== null) return parameterSetup;
  const parameterEffects = new Map<string, ParameterStatement>();
  for (let position = 0; position < raw.parameters.length; position += 1) {
    const read = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
    if (read !== null) return read;
    const effect = raw.parameters[position];
    if (effect === undefined) return null;
    if (effect.slot.kind === "receiver" ? signature.receiver === null : !ordinal(effect.slot.index, signature.parameters.length)) return null;
    parameterEffects.set(slotKey(effect.slot.kind, effect.slot.kind === "receiver" ? 0 : effect.slot.index), effect);
  }
  const captureEffects = new Map<number, CaptureStatement>();
  for (let position = 0; position < raw.captures.length; position += 1) {
    const read = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
    if (read !== null) return read;
    const effect = raw.captures[position];
    if (effect === undefined) return null;
    captureEffects.set(effect.index, effect);
  }
  const formalSetup = chargeWork(account, signature.parameters.length) ?? chargeResultEntries(account, 5 + 2 * signature.parameters.length);
  if (formalSetup !== null) return formalSetup;
  const parameters: ParameterEffect[] = [];
  const argumentsOrigins: ValueArgument[] = Array.from({ length: signature.parameters.length }, () => ({ kind: "omitted" }));
  const captures: CaptureLocation[] = [];
  const capturedCells = new Map<number, number>();
  for (let position = 0; position < cells.captures.length; position += 1) {
    const read = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
    if (read !== null) return read;
    const capture = cells.captures[position];
    if (capture === undefined) return null;
    if (!ordinal(capture.index, raw.captures.length) || !ordinal(capture.cell, cells.cells.length)
      || capturedCells.has(capture.index)) return null;
    capturedCells.set(capture.index, capture.cell);
  }
  if (capturedCells.size !== raw.captures.length) return null;
  const captureRows: CaptureEffect[] = [];
  let receiver: OriginsId | null = null;
  const formalScan = chargeWork(account, formals.size);
  if (formalScan !== null) return formalScan;
  for (const [key, formal] of formals) {
    if (formal.kind === "capture") {
      const effect = captureEffects.get(formal.index);
      if (effect === undefined) return null;
      const reads = effectPaths(account, effect.reads, projectionIds);
      if (reads.kind !== "complete") return reads;
      if (reads.value === null) return null;
      const writes = effectPaths(account, effect.writes, projectionIds);
      if (writes.kind !== "complete") return writes;
      if (writes.value === null) return null;
      const keep = chargeResultEntries(account, 4);
      if (keep !== null) return keep;
      captureRows.push({ index: formal.index, reads: reads.value, writes: writes.value });
      const cell = capturedCells.get(formal.index);
      if (cell === undefined) return null;
      captures.push({ index: formal.index, location: formal.bound, cell });
    } else {
      const keep = chargeResultEntries(account, 8);
      if (keep !== null) return keep;
      const formalOrigins = originsId(origins.length);
      origins.push({ id: formalOrigins, kind: "complete", producers: [formal.bound], includesAbsence: false });
      const effect = parameterEffects.get(key);
      let reads: EffectPaths;
      let writes: EffectPaths;
      if (effect === undefined) {
        const empty = chargeResultEntries(account, 2);
        if (empty !== null) return empty;
        reads = { kind: "complete", paths: [] };
        writes = reads;
      } else {
        const readEffects = effectPaths(account, effect.reads, projectionIds);
        if (readEffects.kind !== "complete") return readEffects;
        if (readEffects.value === null) return null;
        const writeEffects = effectPaths(account, effect.writes, projectionIds);
        if (writeEffects.kind !== "complete") return writeEffects;
        if (writeEffects.value === null) return null;
        reads = readEffects.value;
        writes = writeEffects.value;
      }
      if (formal.kind === "receiver") {
        receiver = formalOrigins;
        parameters.push({ slot: { kind: "receiver" }, reads, writes });
      } else {
        argumentsOrigins[formal.index] = { kind: "provided", origins: formalOrigins };
        parameters[formal.index + (signature.receiver === null ? 0 : 1)] = { slot: { kind: "parameter", index: formal.index }, reads, writes };
      }
    }
  }
  const omittedScan = chargeWork(account, argumentsOrigins.length);
  if (omittedScan !== null) return omittedScan;
  for (let position = 0; position < argumentsOrigins.length; position += 1) if (argumentsOrigins[position]?.kind === "omitted") {
    if (parameterEffects.has(slotKey("parameter", position))) return null;
    const keep = chargeResultEntries(account, 5);
    if (keep !== null) return keep;
    const effects: EffectPaths = { kind: "complete", paths: [] };
    parameters[position + (signature.receiver === null ? 0 : 1)] = { slot: { kind: "parameter", index: position }, reads: effects, writes: effects };
  }
  const writeSetup = chargeResultEntries(account, 2);
  if (writeSetup !== null) return writeSetup;
  const writes: SummaryWrite[] = [];
  const locations = new Map<number, number>();
  for (let index = 0; index < cells.cells.length; index += 1) {
    const read = chargeWork(account, 1);
    if (read !== null) return read;
    const cell = cells.cells[index];
    if (cell === undefined || !Object.is(cell.id, index)) return null;
  }
  for (let position = 0; position < cells.producers.length; position += 1) {
    const read = chargeWork(account, 2) ?? chargeResultEntries(account, 1);
    if (read !== null) return read;
    const association = cells.producers[position];
    if (association === undefined) return null;
    if (!ordinal(association.producer, raw.producers.length) || raw.producers[association.producer]?.id !== association.producer
      || !ordinal(association.cell, cells.cells.length) || locations.has(association.producer)) return null;
    locations.set(association.producer, association.cell);
  }
  for (let position = 0; position < raw.writes.length; position += 1) {
    const read = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
    if (read !== null) return read;
    const write = raw.writes[position];
    if (write === undefined) return null;
    const target = locations.get(write.target);
    if (target === undefined) return null;
    writes.push({ target, value: originsId(write.value) });
  }
  const targetOf = (target: NativeEscapeTarget): BoundEscape | null | DataflowStop => {
    const read = chargeWork(account, 1) ?? chargeResultEntries(account, 3);
    if (read !== null) return read;
    const path = target.kind === "shared" || target.kind === "parameter" || target.kind === "capture" || target.kind === "receiver"
      ? target.path === null ? null : projectionIds.get(target.path) : null;
    if (path === undefined) return null;
    switch (target.kind) {
      case "return": case "throw": return { value: { kind: target.kind }, key: encodeKey([target.kind]) };
      case "shared": {
        const selected = lookup(target.identity);
        if (selected === null || "kind" in selected) return selected;
        const definition = selected.association.kind === "callable" ? selected.association.request.definition : selected.association.declaration;
        const read = chargeWork(account, definition.length);
        return read ?? { value: { kind: "shared", definition, path }, key: encodeKey([target.kind, definition, path]) };
      }
      case "parameter":
        return ordinal(target.index, signature.parameters.length)
          ? { value: { kind: "parameter", index: target.index, path },
            key: encodeKey([target.kind, target.index, path]) } : null;
      case "capture": return {
        value: { kind: "capture", index: target.index, path },
        key: encodeKey([target.kind, target.index, path]),
      };
      case "receiver": return signature.receiver === null ? null
        : { value: { kind: "receiver", path }, key: encodeKey([target.kind, path]) };
      case "callback": case "suspension": {
        const identity = admitNativeIdentity(account, raw.identity) ?? chargeResultEntries(account, 2);
        return identity ?? { value: { kind: target.kind, at: { kind: "declared", identity: raw.identity, site: target.site } },
          key: encodeKey([target.kind, declaredSiteData(raw.identity, target.site)]) };
      }
      case "external": return { value: { kind: "external", boundary: openBoundaryId(target.boundary) },
        key: encodeKey([target.kind, target.boundary]) };
    }
  };
  const retentionSetup = chargeResultEntries(account, 2);
  if (retentionSetup !== null) return retentionSetup;
  const retainedRows: { readonly value: SummaryRetention; readonly key: string }[] = [];
  const retainedKeys = new Set<string>();
  for (let position = 0; position < raw.retention.length; position += 1) {
    const read = chargeWork(account, 1);
    if (read !== null) return read;
    const retained = raw.retention[position];
    if (retained === undefined) return null;
    const source = remapped.get(retained.source);
    const into = targetOf(retained.into);
    if (into !== null && "kind" in into) return into;
    if (source === undefined || into === null) return null;
    const encoding = chargeWork(account, into.key.length) ?? chargeResultEntries(account, 1);
    if (encoding !== null) return encoding;
    const key = encodeKey([source.bound, into.key]);
    if (!retainedKeys.has(key)) {
      const keep = chargeResultEntries(account, 5);
      if (keep !== null) return keep;
      retainedKeys.add(key);
      retainedRows.push({ value: { source: source.bound, at: { kind: "declared", execution, source: declarationSource }, into: into.value }, key: into.key });
    }
  }
  const orderedRetention = orderRows(retainedRows, (left, right) => {
    const subjects = left.value.source - right.value.source;
    return subjects !== 0 ? subjects : chargeWork(account, left.key.length + right.key.length) ?? compareText(left.key, right.key);
  }, account);
  if (orderedRetention.kind !== "complete") return orderedRetention;
  const reserveRetention = chargeWork(account, orderedRetention.value.length) ?? chargeResultEntries(account, 1 + orderedRetention.value.length);
  if (reserveRetention !== null) return reserveRetention;
  const retention = orderedRetention.value.map(row => row.value);
  for (let position = 0; position < raw.callbacks.length; position += 1) {
    const read = chargeWork(account, 1);
    if (read !== null) return read;
    const callback = raw.callbacks[position];
    if (callback === undefined) return null;
    if (!ordinal(callback.parameterIndex, signature.parameters.length)) return null;
    for (let index = 0; index < callback.inputs.length; index += 1) {
      const read = chargeWork(account, 1);
      if (read !== null) return read;
      const input = callback.inputs[index];
      if (input === undefined) return null;
      if (input.kind === "argument-element" ? !ordinal(input.sourceParameterIndex, signature.parameters.length)
        : signature.receiver === null) return null;
    }
  }
  for (let position = 0; position < raw.invocationOnlyParameters.length; position += 1) {
    const read = chargeWork(account, 1);
    if (read !== null) return read;
    const parameter = raw.invocationOnlyParameters[position];
    if (parameter === undefined || !ordinal(parameter, signature.parameters.length)) return null;
  }
  const ordered = orderRows(writes, (left, right) => left.target - right.target || left.value - right.value, account);
  if (ordered.kind !== "complete") return ordered;
  const output = chargeWork(account, 1) ?? chargeResultEntries(account, 8);
  if (output !== null) return output;
  const distinctWrites: SummaryWrite[] = [];
  let previous: SummaryWrite | undefined;
  for (let position = 0; position < ordered.value.length; position += 1) {
    const read = chargeWork(account, 1);
    if (read !== null) return read;
    const write = ordered.value[position];
    if (write === undefined) throw new TypeError("The ordered native write inventory is dense");
    if (previous !== undefined && previous.target === write.target && previous.value === write.value) continue;
    const keep = chargeResultEntries(account, 1);
    if (keep !== null) return keep;
    distinctWrites.push(write);
    previous = write;
  }
  return { key: { kind: "declared", execution }, signature: signature.id,
    arena: { cells: cells.cells, producers, projections, boundProducers, origins, boundaries,
      contexts: [{ id: context, receiver, arguments: argumentsOrigins, captures }] },
    parameters, captures: captureRows, result: originsId(raw.result), thrown: originsId(raw.thrown), writes: distinctWrites, retention,
    callbacks: relations.callbacks, resultCells: relations.resultCells, backing: relations.backing,
    suspends: raw.suspends, bindingDependent: raw.bindingDependent,
    concurrentWrites: relations.concurrentWrites, contentsOnReturn: relations.contentsOnReturn,
    contentsOnUnwind: relations.contentsOnUnwind, returns: relations.returns, unwinds: relations.unwinds,
    initialization: relations.initialization };
}
