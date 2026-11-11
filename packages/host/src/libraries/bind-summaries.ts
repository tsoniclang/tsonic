import type { BoundProducerId, DefId, LibraryExportIdentity, OpenBoundaryId, OriginsId, ProducerId } from "../ids/contract.js";
import {
  boundProducerId, encodeKey, openBoundaryId, originsId, producerId, projectionPathId, valueContextId,
} from "../ids/index.js";
import type { Diagnostic, Result } from "../diag/contract.js";
import { hostDiagnosticCode } from "../diag/index.js";
import type { BindingVector, Signature } from "../ir-types/contract.js";
import type {
  BoundProducer, CaptureEffect, CaptureLocation, EscapeTarget, OpenBoundary, Origins, ParameterEffect, Producer,
  ProjectionPath, RetentionFact, Summary, SummaryWrite,
} from "../ir-facts/contract.js";
import type {
  LibraryAuthoredSummary, LibrarySummaryCaptureEffect, LibrarySummaryEffectPaths, LibrarySummaryEscapeTarget,
  LibrarySummaryParameterEffect,
} from "../snapshot/contract.js";
import type { EffectPaths } from "../ir-facts/contract.js";
import type { BoundLibraries, Libraries, LibraryDeclaredSummary, LibraryExportBinding, LibrarySignature } from "./contract.js";
import { validateAuthoredSummary, ordinal } from "./verify-summaries.js";
import type { CatalogueIndex, LibraryViolation } from "./verify-catalogue.js";
import { catalogueIndex, compareExports, compareText, exportIdentityData, exportKey } from "./verify-catalogue.js";

function boundaryIds(values: readonly [number, ...number[]]): readonly [OpenBoundaryId, ...OpenBoundaryId[]] {
  const [first, ...rest] = values;
  return [openBoundaryId(first), ...rest.map(openBoundaryId)];
}

function effectPaths(paths: LibrarySummaryEffectPaths): EffectPaths {
  const projected = paths.paths.map(projectionPathId);
  return paths.kind === "complete" ? { kind: "complete", paths: projected }
    : { kind: "open", paths: projected, boundaries: boundaryIds(paths.boundaries) };
}

function slotKey(kind: "receiver" | "parameter" | "capture", index: number): string {
  return `${kind}:${index}`;
}

type Formal = { readonly id: ProducerId } & (
  | { readonly kind: "receiver" }
  | { readonly kind: "parameter" | "capture"; readonly index: number }
);

interface BoundEscape {
  readonly value: EscapeTarget;
  readonly key: string;
}

function translateSummary(raw: LibraryAuthoredSummary, definition: DefId, signature: Signature, bindings: BindingVector,
  index: CatalogueIndex, callbacks: Map<string, readonly LibrarySignature[]>,
  lookup: (identity: LibraryExportIdentity) => LibraryExportBinding | null): Summary | null {
  const context = valueContextId(0);
  const producers: Producer[] = [];
  const boundProducers: BoundProducer[] = [];
  const formals = new Map<string, Formal>();
  const remapped = new Map<number, ProducerId>();
  const add = (producer: Producer, environment: BindingVector): void => {
    producers.push(producer);
    boundProducers.push({ id: boundProducerId(producer.id), producer: producer.id, bindings: environment, context });
  };
  if (signature.receiver !== null) {
    const identifier = producerId(producers.length);
    formals.set(slotKey("receiver", 0), { id: identifier, kind: "receiver" });
    add({ id: identifier, kind: "receiver", path: null }, bindings);
  }
  for (let position = 0; position < signature.parameters.length; position += 1) {
    const identifier = producerId(producers.length);
    formals.set(slotKey("parameter", position), { id: identifier, kind: "parameter", index: position });
    add({ id: identifier, kind: "parameter", index: position, path: null }, bindings);
  }
  for (let position = 0; position < raw.captures.length; position += 1) {
    const identifier = producerId(producers.length);
    formals.set(slotKey("capture", position), { id: identifier, kind: "capture", index: position });
    add({ id: identifier, kind: "capture", index: position, path: null }, bindings);
  }
  const projections: ProjectionPath[] = [];
  for (const path of raw.projections) {
    if (path === undefined) return null;
    const id = projectionPathId(path.id);
    const parent = path.parent === null ? null : projectionPathId(path.parent);
    const projection = path.projection;
    switch (projection.kind) {
      case "field": case "method-value": {
        const target = lookup(projection.identity);
        if (target === null || target.member === null) return null;
        projections.push({ id, parent, projection: { kind: projection.kind, member: target.member } });
        break;
      }
      case "element": case "deref": projections.push({ id, parent, projection: { kind: projection.kind } }); break;
      case "index": projections.push({ id, parent, projection: { kind: "index", constant: projection.constant } }); break;
    }
  }
  for (const producer of raw.producers) {
    if (producer === undefined) return null;
    if (producer.path === null && (producer.kind === "receiver" || producer.kind === "parameter" || producer.kind === "capture")) {
      const assigned = formals.get(slotKey(producer.kind, producer.kind === "receiver" ? 0 : producer.index));
      if (assigned === undefined) return null;
      remapped.set(producer.id, assigned.id);
      continue;
    }
    if (producer.kind === "receiver" && signature.receiver === null) return null;
    if (producer.kind === "parameter" && !ordinal(producer.index, signature.parameters.length)) return null;
    if (producer.kind === "capture" && !ordinal(producer.index, raw.captures.length)) return null;
    const id = producerId(producers.length);
    const path = producer.path === null ? null : projectionPathId(producer.path);
    switch (producer.kind) {
      case "receiver": add({ id, kind: "receiver", path }, bindings); break;
      case "parameter": case "capture": add({ id, kind: producer.kind, index: producer.index, path }, bindings); break;
      case "allocation": add({ id, kind: "allocation", at: { kind: "declared", identity: raw.identity, site: producer.site }, path }, bindings); break;
      case "shared": {
        const target = lookup(producer.identity);
        if (target === null) return null;
        add({ id, kind: "shared", definition: target.definition, path }, target.bindings);
        break;
      }
    }
    remapped.set(producer.id, id);
  }
  const origins: Origins[] = [];
  for (const row of raw.origins) {
    if (row === undefined) return null;
    const alternatives: BoundProducerId[] = [];
    for (const reference of row.producers) {
      const assigned = remapped.get(reference);
      if (assigned === undefined) return null;
      alternatives.push(boundProducerId(assigned));
    }
    alternatives.sort((left, right) => left - right);
    const common = { id: originsId(row.id), producers: alternatives, includesAbsence: row.includesAbsence };
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
      owner = assigned;
    }
    boundaries.push({ id: openBoundaryId(boundary.id), kind: boundary.kind,
      at: { kind: "declared", identity: raw.identity, site: boundary.site }, subject, owner, bindings, context,
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
      captureRows.push({ index: formal.index, reads: effectPaths(effect.reads), writes: effectPaths(effect.writes) });
      captures.push({ index: formal.index, location: boundProducerId(formal.id) });
    } else {
      const formalOrigins = originsId(origins.length);
      origins.push({ id: formalOrigins, kind: "complete", producers: [boundProducerId(formal.id)], includesAbsence: false });
      const effect = parameterEffects.get(key);
      const reads: EffectPaths = effect === undefined ? { kind: "complete", paths: [] } : effectPaths(effect.reads);
      const writes: EffectPaths = effect === undefined ? { kind: "complete", paths: [] } : effectPaths(effect.writes);
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
    writes.push({ target, value: originsId(write.value) });
  }
  writes.sort((left, right) => left.target - right.target || left.value - right.value);
  const targetOf = (target: LibrarySummaryEscapeTarget): BoundEscape | null => {
    switch (target.kind) {
      case "return": case "throw": return { value: { kind: target.kind }, key: encodeKey([target.kind]) };
      case "shared": {
        const selected = lookup(target.identity);
        return selected === null ? null : {
          value: { kind: "shared", definition: selected.definition, path: target.path === null ? null : projectionPathId(target.path) },
          key: encodeKey([target.kind, selected.definition, target.path]),
        };
      }
      case "parameter":
        return ordinal(target.index, signature.parameters.length)
          ? { value: { kind: "parameter", index: target.index, path: target.path === null ? null : projectionPathId(target.path) },
            key: encodeKey([target.kind, target.index, target.path]) } : null;
      case "capture": return {
        value: { kind: "capture", index: target.index, path: target.path === null ? null : projectionPathId(target.path) },
        key: encodeKey([target.kind, target.index, target.path]),
      };
      case "receiver": return signature.receiver === null ? null
        : { value: { kind: "receiver", path: target.path === null ? null : projectionPathId(target.path) },
          key: encodeKey([target.kind, target.path]) };
      case "callback": case "suspension": return {
        value: { kind: target.kind, at: { kind: "declared", identity: raw.identity, site: target.site } },
        key: encodeKey([target.kind, exportIdentityData(raw.identity), target.site]),
      };
      case "external": return { value: { kind: "external", boundary: openBoundaryId(target.boundary) },
        key: encodeKey([target.kind, target.boundary]) };
    }
  };
  const retainedRows: { readonly value: RetentionFact; readonly key: string }[] = [];
  for (const retained of raw.retention) {
    const source = remapped.get(retained.source);
    const into = targetOf(retained.into);
    if (source === undefined || into === null) return null;
    retainedRows.push({ value: { source, into: into.value }, key: into.key });
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
  return { key: { definition, bindings: { kind: "instantiated", bindings } }, signature: signature.id,
    arena: { producers, projections, boundProducers, origins, boundaries,
      contexts: [{ id: context, receiver, arguments: argumentsOrigins, captures }] },
    parameters, captures: captureRows, result: originsId(raw.result), thrown: originsId(raw.thrown), writes, retention,
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
  const cache = new Map<string, LibraryExportBinding | null>();
  const lookup = (identity: LibraryExportIdentity): LibraryExportBinding | null => {
    const key = exportKey(identity);
    const previous = cache.get(key);
    if (previous !== undefined) return previous;
    if (index.exports.get(key) == null) {
      cache.set(key, null);
      return null;
    }
    const binding = signatureOfExport(identity);
    const result = binding === null || (identity.memberId !== null) !== (binding.member !== null) ? null : binding;
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
    const binding = lookup(raw.identity);
    const role = roles.get(exportKey(raw.identity));
    if (binding === null || binding.signature === null || role === null || role !== undefined && role !== binding.definition) {
      diagnostics.push(summaryDiagnostic(raw.identity));
      continue;
    }
    const summary = translateSummary(raw, binding.definition, binding.signature, binding.bindings, index, callbacks, lookup);
    if (summary === null) diagnostics.push(summaryDiagnostic(raw.identity));
    else summaries.push({ identity: raw.identity, summary });
  }
  const [first, ...rest] = diagnostics;
  return first === undefined ? { kind: "ok", value: { sources: bound.sources, sourceRoles: bound.sourceRoles,
    declaredSummaries: summaries }, diagnostics: [] } : { kind: "refused", diagnostics: [first, ...rest] };
}
