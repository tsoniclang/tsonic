import type { BoundProducerId, DefId, KeyData, LibraryExportIdentity, OpenBoundaryId, OriginsId, ProducerId, ProjectionPathId } from "../ids/contract.js";
import {
  boundProducerId, encodeKey, openBoundaryId, originsId, producerId, projectionPathId, valueContextId,
} from "../ids/index.js";
import type { Diagnostic, Result } from "../diag/contract.js";
import { hostDiagnosticCode } from "../diag/index.js";
import type { BindingVector, MemberKey, Signature } from "../ir-types/contract.js";
import type { MemberSelection, ResolvedCallee } from "../ir-tir/contract.js";
import type {
  BoundProducer, CaptureEffect, CaptureLocation, EscapeTarget, OpenBoundary, Origins, ParameterEffect, Producer,
  Projection, ProjectionPath, RetentionFact, Summary, SummaryWrite,
} from "../ir-facts/contract.js";
import type {
  LibraryAuthoredSummary, LibrarySummaryCaptureEffect, LibrarySummaryEffectPaths, LibrarySummaryEscapeTarget,
  LibrarySummaryParameterEffect,
} from "../snapshot/contract.js";
import type { EffectPaths } from "../ir-facts/contract.js";
import type { BoundLibraries, Libraries, LibraryDeclaredSummary, LibraryExportBinding, LibrarySignature } from "./contract.js";
import { validateAuthoredSummary, ordinal } from "./verify-summaries.js";
import type { CatalogueIndex, LibraryViolation } from "./verify-catalogue.js";
import { bindingData, catalogueIndex, compareExports, compareText, exportKey, moduleIdentityData } from "./verify-catalogue.js";

function boundaryIds(values: readonly [number, ...number[]]): readonly [OpenBoundaryId, ...OpenBoundaryId[]] {
  const [first, ...rest] = values;
  return [openBoundaryId(first), ...rest.map(openBoundaryId)];
}

function effectPaths(paths: LibrarySummaryEffectPaths, remapped: ReadonlyMap<number, ProjectionPathId>): EffectPaths | null {
  const distinct = new Set<ProjectionPathId>();
  for (const path of paths.paths) {
    const projected = remapped.get(path);
    if (projected === undefined) return null;
    distinct.add(projected);
  }
  const projected = [...distinct].sort((left, right) => left - right);
  return paths.kind === "complete" ? { kind: "complete", paths: projected }
    : { kind: "open", paths: projected, boundaries: boundaryIds(paths.boundaries) };
}

function memberKeyData(key: MemberKey): KeyData {
  switch (key.kind) {
    case "text": return [key.kind, key.value];
    case "number": return [key.kind, key.value.numerator, key.value.denominator, key.value.negativeZero];
    case "symbol": return [key.kind, key.declaration];
  }
}

function calleeData(callee: ResolvedCallee | null): KeyData {
  if (callee === null) return null;
  const decision = callee.decision;
  const advertised = decision.advertised;
  const api = decision.api;
  const activation = callee.activation;
  return [decision.candidate, [advertised.declaration, advertised.role, advertised.signature, advertised.body],
    [api.declaration, api.role, api.signature, api.body], bindingData(decision.bindings), bindingData(decision.implementationBindings),
    decision.parameters.map((parameter): KeyData => {
      switch (parameter.kind) {
        case "argument": return [parameter.kind, parameter.parameter, parameter.argument, parameter.component, parameter.passing];
        case "default": return [parameter.kind, parameter.parameter, parameter.initializer];
        case "omitted": return [parameter.kind, parameter.parameter, parameter.type];
        case "rest": return [parameter.kind, parameter.parameter, parameter.arguments, parameter.passing];
      }
    }), [decision.completion.signature, decision.completion.completion, decision.completion.yielded, decision.completion.sent],
    decision.result, activation === null ? null : [activation.body, activation.bindings.kind === "parametric"
      ? [activation.bindings.kind] : [activation.bindings.kind, bindingData(activation.bindings.bindings)]],
    callee.captures.map(capture => [capture.body, capture.local])];
}

function memberData(member: MemberSelection): KeyData {
  const decision = member.decision;
  return [memberKeyData(decision.key), decision.origins.map((origin): KeyData => {
    switch (origin.kind) {
      case "declared": return [origin.kind, origin.declaration];
      case "class-prototype": return [origin.kind, origin.owner];
      case "mapped": return [origin.kind, origin.owner.kind,
        origin.owner.kind === "body" ? origin.owner.value.body : origin.owner.value.owner,
        origin.owner.value.node, memberKeyData(origin.key)];
    }
  }), decision.selectedDeclarations, decision.primary, decision.read, decision.write,
  decision.getter === null ? null : [decision.getter.declaration, decision.getter.role, decision.getter.signature, decision.getter.body],
  decision.setter === null ? null : [decision.setter.declaration, decision.setter.role, decision.setter.signature, decision.setter.body],
  bindingData(decision.bindings), calleeData(member.getter), calleeData(member.setter)];
}

function internValue(values: Map<string, number>, data: KeyData): number {
  const key = encodeKey(data);
  const previous = values.get(key);
  if (previous !== undefined) return previous;
  const token = values.size;
  values.set(key, token);
  return token;
}

function declaredSiteData(identity: LibraryExportIdentity, site: number): readonly KeyData[] {
  return ["declared", ...moduleIdentityData(identity.module), identity.exportId, identity.memberId, identity.signatureId, site];
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

interface EnvironmentValue {
  readonly value: BindingVector;
  readonly token: number;
}

interface MemberValue {
  readonly value: MemberSelection;
  readonly token: number;
}

interface ExportValue {
  readonly binding: LibraryExportBinding;
  readonly environment: EnvironmentValue;
  readonly member: MemberValue | null;
}

function translateSummary(raw: LibraryAuthoredSummary, selected: ExportValue, signature: Signature,
  index: CatalogueIndex, callbacks: Map<string, readonly LibrarySignature[]>,
  lookup: (identity: LibraryExportIdentity) => ExportValue | null): Summary | null {
  const definition = selected.binding.definition;
  const environment = selected.environment;
  const bindings = environment.value;
  const context = valueContextId(0);
  const producers: Producer[] = [];
  const boundProducers: BoundProducer[] = [];
  const formals = new Map<string, Formal>();
  const remapped = new Map<number, BoundReference>();
  const producerKeys = new Map<string, ProducerId>();
  const alternativeKeys = new Map<string, BoundProducerId>();
  const add = (producer: Producer, identity: KeyData, environment: EnvironmentValue): BoundReference => {
    const key = encodeKey([producer.kind, producer.path, identity]);
    let id = producerKeys.get(key);
    if (id === undefined) {
      id = producer.id;
      producerKeys.set(key, id);
      producers.push(producer);
    }
    const alternativeKey = encodeKey([id, environment.token, context]);
    let bound = alternativeKeys.get(alternativeKey);
    if (bound === undefined) {
      bound = boundProducerId(boundProducers.length);
      alternativeKeys.set(alternativeKey, bound);
      boundProducers.push({ id: bound, producer: id, bindings: environment.value, context });
    }
    return { id, bound };
  };
  if (signature.receiver !== null) {
    const identifier = producerId(producers.length);
    const assigned = add({ id: identifier, kind: "receiver", path: null }, null, environment);
    formals.set(slotKey("receiver", 0), { ...assigned, kind: "receiver" });
  }
  for (let position = 0; position < signature.parameters.length; position += 1) {
    const identifier = producerId(producers.length);
    const assigned = add({ id: identifier, kind: "parameter", index: position, path: null }, position, environment);
    formals.set(slotKey("parameter", position), { ...assigned, kind: "parameter", index: position });
  }
  for (let position = 0; position < raw.captures.length; position += 1) {
    const identifier = producerId(producers.length);
    const assigned = add({ id: identifier, kind: "capture", index: position, path: null }, position, environment);
    formals.set(slotKey("capture", position), { ...assigned, kind: "capture", index: position });
  }
  const projections: ProjectionPath[] = [];
  const projectionIds = new Map<number, ProjectionPathId>();
  const projectionKeys = new Map<string, ProjectionPathId>();
  for (const path of raw.projections) {
    if (path === undefined) return null;
    const parent = path.parent === null ? null : projectionIds.get(path.parent);
    if (parent === undefined) return null;
    let projection: Projection;
    let data: KeyData;
    switch (path.projection.kind) {
      case "field": case "method-value": {
        const target = lookup(path.projection.identity);
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
      id = projectionPathId(projections.length);
      projectionKeys.set(key, id);
      projections.push({ id, parent, projection });
    }
    projectionIds.set(path.id, id);
  }
  for (const producer of raw.producers) {
    if (producer === undefined) return null;
    if (producer.path === null && (producer.kind === "receiver" || producer.kind === "parameter" || producer.kind === "capture")) {
      const assigned = formals.get(slotKey(producer.kind, producer.kind === "receiver" ? 0 : producer.index));
      if (assigned === undefined) return null;
      remapped.set(producer.id, assigned);
      continue;
    }
    if (producer.kind === "receiver" && signature.receiver === null) return null;
    if (producer.kind === "parameter" && !ordinal(producer.index, signature.parameters.length)) return null;
    if (producer.kind === "capture" && !ordinal(producer.index, raw.captures.length)) return null;
    const id = producerId(producers.length);
    const path = producer.path === null ? null : projectionIds.get(producer.path);
    if (path === undefined) return null;
    let assigned: BoundReference;
    switch (producer.kind) {
      case "receiver": assigned = add({ id, kind: "receiver", path }, null, environment); break;
      case "parameter": case "capture":
        assigned = add({ id, kind: producer.kind, index: producer.index, path }, producer.index, environment); break;
      case "allocation": assigned = add({ id, kind: "allocation",
        at: { kind: "declared", identity: raw.identity, site: producer.site }, path },
      declaredSiteData(raw.identity, producer.site), environment); break;
      case "shared": {
        const target = lookup(producer.identity);
        if (target === null) return null;
        assigned = add({ id, kind: "shared", definition: target.binding.definition, path }, target.binding.definition, target.environment);
        break;
      }
    }
    remapped.set(producer.id, assigned);
  }
  const origins: Origins[] = [];
  for (const row of raw.origins) {
    if (row === undefined) return null;
    const alternatives = new Set<BoundProducerId>();
    for (const reference of row.producers) {
      const assigned = remapped.get(reference);
      if (assigned === undefined) return null;
      alternatives.add(assigned.bound);
    }
    const common = { id: originsId(row.id), producers: [...alternatives].sort((left, right) => left - right), includesAbsence: row.includesAbsence };
    origins.push(row.kind === "complete" ? { ...common, kind: "complete" }
      : { ...common, kind: "open", boundaries: boundaryIds(row.boundaries) });
  }
  const boundaries: OpenBoundary[] = [];
  for (const boundary of raw.boundaries) {
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
  const parameterEffects = new Map<string, LibrarySummaryParameterEffect>();
  for (const effect of raw.parameters) {
    if (effect.slot.kind === "receiver" ? signature.receiver === null : !ordinal(effect.slot.index, signature.parameters.length)) return null;
    parameterEffects.set(slotKey(effect.slot.kind, effect.slot.kind === "receiver" ? 0 : effect.slot.index), effect);
  }
  const captureEffects = new Map<number, LibrarySummaryCaptureEffect>();
  for (const effect of raw.captures) captureEffects.set(effect.index, effect);
  const parameters: ParameterEffect[] = [];
  const argumentsOrigins: OriginsId[] = [];
  const captures: CaptureLocation[] = [];
  const captureRows: CaptureEffect[] = [];
  let receiver: OriginsId | null = null;
  for (const [key, formal] of formals) {
    if (formal.kind === "capture") {
      const effect = captureEffects.get(formal.index);
      if (effect === undefined) return null;
      const reads = effectPaths(effect.reads, projectionIds);
      const writes = effectPaths(effect.writes, projectionIds);
      if (reads === null || writes === null) return null;
      captureRows.push({ index: formal.index, reads, writes });
      captures.push({ index: formal.index, location: formal.bound });
    } else {
      const formalOrigins = originsId(origins.length);
      origins.push({ id: formalOrigins, kind: "complete", producers: [formal.bound], includesAbsence: false });
      const effect = parameterEffects.get(key);
      const reads: EffectPaths | null = effect === undefined ? { kind: "complete", paths: [] } : effectPaths(effect.reads, projectionIds);
      const writes: EffectPaths | null = effect === undefined ? { kind: "complete", paths: [] } : effectPaths(effect.writes, projectionIds);
      if (reads === null || writes === null) return null;
      if (formal.kind === "receiver") {
        receiver = formalOrigins;
        parameters.push({ slot: { kind: "receiver" }, reads, writes });
      } else {
        argumentsOrigins.push(formalOrigins);
        parameters.push({ slot: { kind: "parameter", index: formal.index }, reads, writes });
      }
    }
  }
  const writes: SummaryWrite[] = [];
  for (const write of raw.writes) {
    const target = remapped.get(write.target);
    if (target === undefined) return null;
    writes.push({ target: target.id, value: originsId(write.value) });
  }
  const targetOf = (target: LibrarySummaryEscapeTarget): BoundEscape | null => {
    const path = target.kind === "shared" || target.kind === "parameter" || target.kind === "capture" || target.kind === "receiver"
      ? target.path === null ? null : projectionIds.get(target.path) : null;
    if (path === undefined) return null;
    switch (target.kind) {
      case "return": case "throw": return { value: { kind: target.kind }, key: encodeKey([target.kind]) };
      case "shared": {
        const selected = lookup(target.identity);
        return selected === null ? null : {
          value: { kind: "shared", definition: selected.binding.definition, path },
          key: encodeKey([target.kind, selected.binding.definition, path]),
        };
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
      case "callback": case "suspension": return {
        value: { kind: target.kind, at: { kind: "declared", identity: raw.identity, site: target.site } },
        key: encodeKey([target.kind, declaredSiteData(raw.identity, target.site)]),
      };
      case "external": return { value: { kind: "external", boundary: openBoundaryId(target.boundary) },
        key: encodeKey([target.kind, target.boundary]) };
    }
  };
  const retainedRows: { readonly value: RetentionFact; readonly key: string }[] = [];
  const retainedKeys = new Set<string>();
  for (const retained of raw.retention) {
    const source = remapped.get(retained.source);
    const into = targetOf(retained.into);
    if (source === undefined || into === null) return null;
    const key = encodeKey([source.id, into.key]);
    if (!retainedKeys.has(key)) {
      retainedKeys.add(key);
      retainedRows.push({ value: { source: source.id, into: into.value }, key: into.key });
    }
  }
  const retention = retainedRows.sort((left, right) => left.value.source - right.value.source || compareText(left.key, right.key))
    .map(row => row.value);
  for (const callback of raw.callbacks) {
    if (!ordinal(callback.parameterIndex, signature.parameters.length)) return null;
    for (const input of callback.inputs) {
      if (input.kind === "argument-element" ? !ordinal(input.sourceParameterIndex, signature.parameters.length)
        : signature.receiver === null) return null;
    }
  }
  for (const parameter of raw.invocationOnlyParameters) if (!ordinal(parameter, signature.parameters.length)) return null;
  const findings: LibraryViolation[] = [];
  if (!validateAuthoredSummary(raw, index, findings, callbacks)) return null;
  writes.sort((left, right) => left.target - right.target || left.value - right.value);
  const distinctWrites = writes.filter((write, position) => {
    const previous = writes[position - 1];
    return previous === undefined || previous.target !== write.target || previous.value !== write.value;
  });
  return { key: { definition, bindings: { kind: "instantiated", bindings } }, signature: signature.id,
    arena: { producers, projections, boundProducers, origins, boundaries,
      contexts: [{ id: context, receiver, arguments: argumentsOrigins, captures }] },
    parameters, captures: captureRows, result: originsId(raw.result), thrown: originsId(raw.thrown), writes: distinctWrites, retention,
    callbacks: raw.callbacks, invocationOnlyParameters: raw.invocationOnlyParameters,
    suspends: raw.suspends, bindingDependent: raw.bindingDependent };
}

function summaryDiagnostic(identity: LibraryExportIdentity): Diagnostic {
  const rendered = "TSONIC_LIBRARY_SUMMARY_BINDING_INVALID";
  return { code: { kind: "host", name: hostDiagnosticCode(rendered), rendered }, severity: "error",
    site: { kind: "none" }, source: "libraries", evidence: [exportKey(identity)],
    message: "Library summary binding does not match its declared signature and member.", arguments: [], related: [], fix: null };
}

export function bindDeclaredSummaries(bound: BoundLibraries, declared: readonly LibraryAuthoredSummary[],
  signatureOfExport: (identity: LibraryExportIdentity) => LibraryExportBinding | null): Result<Libraries> {
  const index = catalogueIndex({ sources: bound.sources });
  const cache = new Map<string, ExportValue | null>();
  const memberValues = new Map<string, number>();
  const environmentValues = new Map<string, number>();
  const lookup = (identity: LibraryExportIdentity): ExportValue | null => {
    const key = exportKey(identity);
    const previous = cache.get(key);
    if (previous !== undefined) return previous;
    const entry = index.exports.get(key);
    if (entry === undefined || entry === null) {
      cache.set(key, null);
      return null;
    }
    const binding = signatureOfExport(identity);
    const result = binding === null || (identity.memberId !== null) !== (binding.member !== null) ? null : {
      binding,
      environment: { value: binding.bindings, token: internValue(environmentValues, bindingData(binding.bindings)) },
      member: binding.member === null ? null : { value: binding.member, token: internValue(memberValues, memberData(binding.member)) },
    };
    cache.set(key, result);
    return result;
  };
  const roles = new Map<string, DefId | null>();
  for (const role of bound.sourceRoles) {
    const key = exportKey(role.identity);
    roles.set(key, roles.has(key) ? null : role.definition);
  }
  const groups = new Map<string, { readonly summary: LibraryAuthoredSummary; count: number }>();
  for (const summary of declared) {
    const key = exportKey(summary.identity);
    const previous = groups.get(key);
    if (previous === undefined) groups.set(key, { summary, count: 1 });
    else previous.count += 1;
  }
  const diagnostics: Diagnostic[] = [];
  const summaries: LibraryDeclaredSummary[] = [];
  const callbacks = new Map<string, readonly LibrarySignature[]>();
  const ordered = [...groups.values()].sort((left, right) => compareExports(left.summary.identity, right.summary.identity));
  for (const group of ordered) {
    const raw = group.summary;
    if (group.count !== 1) {
      diagnostics.push(summaryDiagnostic(raw.identity));
      continue;
    }
    const selected = lookup(raw.identity);
    const role = roles.get(exportKey(raw.identity));
    if (selected === null || selected.binding.signature === null || role === null || role !== undefined && role !== selected.binding.definition) {
      diagnostics.push(summaryDiagnostic(raw.identity));
      continue;
    }
    const summary = translateSummary(raw, selected, selected.binding.signature, index, callbacks, lookup);
    if (summary === null) diagnostics.push(summaryDiagnostic(raw.identity));
    else summaries.push({ identity: raw.identity, summary });
  }
  const [first, ...rest] = diagnostics;
  return first === undefined ? { kind: "ok", value: { sources: bound.sources, sourceRoles: bound.sourceRoles,
    declaredSummaries: summaries }, diagnostics: [] } : { kind: "refused", diagnostics: [first, ...rest] };
}
