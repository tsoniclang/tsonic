import type { KeyData, LibraryTypeId } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import type {
  LibraryAuthoredSummary, LibrarySummaryEffectPaths, LibrarySummaryProducer,
} from "../snapshot/contract.js";
import type { LibraryCatalogue, LibrarySignature } from "./contract.js";
import {
  catalogueIndex, checkLibraryCatalogue, compareExports, compareText, exportIdentityData, exportKey, moduleIdentityData,
  orderedViolations, violation,
} from "./verify-catalogue.js";
import type { CatalogueIndex, ExportEntry, LibraryViolation, LocatedSite } from "./verify-catalogue.js";

export function ordinal(value: number, length: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0) && value < length;
}

function integral(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0);
}

function producerData(producer: LibrarySummaryProducer): readonly KeyData[] {
  switch (producer.kind) {
    case "parameter": case "capture": return [producer.kind, producer.index, producer.path];
    case "receiver": return [producer.kind, producer.path];
    case "shared": return [producer.kind, exportIdentityData(producer.identity), producer.path];
    case "allocation": return [producer.kind, producer.site, producer.path];
  }
}

function callbackSignatures(entry: ExportEntry, parameter: number,
  cache: Map<string, readonly LibrarySignature[]>): readonly LibrarySignature[] {
  const formal = entry.signature?.parameters[parameter];
  if (formal === undefined) return [];
  const key = encodeKey([moduleIdentityData(entry.module.identity), formal.type]);
  const previous = cache.get(key);
  if (previous !== undefined) return previous;
  const work: LibraryTypeId[] = [formal.type];
  const visited = new Set<LibraryTypeId>();
  const signatures: LibrarySignature[] = [];
  for (const identifier of work) {
    if (visited.has(identifier)) continue;
    visited.add(identifier);
    const type = entry.module.types[identifier];
    if (type === undefined) continue;
    if (type.kind === "function") signatures.push(type.signature);
    if (type.kind === "union" || type.kind === "intersection") {
      for (const child of type.types) work.push(child);
    }
  }
  cache.set(key, signatures);
  return signatures;
}

export function validateAuthoredSummary(summary: LibraryAuthoredSummary, index: CatalogueIndex,
  output: LibraryViolation[], callbacks: Map<string, readonly LibrarySignature[]>): boolean {
  const initial = output.length;
  const site = (table: "projection" | "producer" | "origins" | "boundary" | "parameter" | "capture" |
    "write" | "retention" | "callback", position: number | null): LocatedSite =>
    ({ kind: "authored-summary", identity: summary.identity, table, index: position });
  const entry = index.exports.get(exportKey(summary.identity));
  if (entry == null || entry.signature === null) {
    output.push(violation("authored-summary-identity-resolves", site("parameter", null)));
  }
  const dense = (rows: readonly { readonly id: number }[],
    table: "projection" | "producer" | "origins" | "boundary"): ReadonlySet<number> => {
    const identifiers = new Set<number>();
    for (const [position, row] of rows.entries()) {
      if (!Object.hasOwn(rows, position) || !integral(row.id) || row.id !== position) {
        output.push(violation("authored-summary-id-dense", site(table, position)));
      } else identifiers.add(position);
    }
    return identifiers;
  };
  const projections = dense(summary.projections, "projection");
  const producerRows = dense(summary.producers, "producer");
  const originRows = dense(summary.origins, "origins");
  const boundaryRows = dense(summary.boundaries, "boundary");
  const reference = (value: number, rows: ReadonlySet<number>, owner: LocatedSite,
    table: string): void => {
    if (!integral(value) || !rows.has(value)) output.push(violation("authored-summary-reference-resolves", owner, table, encodeKey(value)));
  };
  const path = (value: number | null, owner: LocatedSite): void => {
    if (value !== null) reference(value, projections, owner, "projection");
  };
  const parameter = (value: number, owner: LocatedSite): void => {
    if (!integral(value) || entry != null && entry.signature !== null && value >= entry.signature.parameters.length) {
      output.push(violation("authored-summary-parameter-range", owner, encodeKey(value)));
    }
  };
  const capture = (value: number, owner: LocatedSite): void => {
    if (!ordinal(value, summary.captures.length)) {
      output.push(violation("authored-summary-capture-range", owner, encodeKey(value)));
    }
  };
  const logicalSite = (value: number, owner: LocatedSite): void => {
    if (!integral(value)) output.push(violation("authored-summary-site-integral", owner, encodeKey(value)));
  };
  const ordered = (values: readonly number[], owner: LocatedSite,
    rule: "authored-summary-origins-order" | "authored-summary-effects-order"): void => {
    let previous: number | null = null;
    for (const value of values) {
      if (previous !== null && previous >= value) output.push(violation(rule, owner));
      previous = value;
    }
  };
  for (const [position, projection] of summary.projections.entries()) {
    if (projection === undefined) continue;
    const owner = site("projection", position);
    path(projection.parent, owner);
    if (projection.parent !== null && (!integral(projection.parent) || projection.parent >= projection.id)) {
      output.push(violation("authored-summary-path-parent-precedes", owner));
    }
    if ((projection.projection.kind === "field" || projection.projection.kind === "method-value") &&
      index.exports.get(exportKey(projection.projection.identity)) == null) {
      output.push(violation("authored-summary-reference-resolves", owner, "export", exportKey(projection.projection.identity)));
    }
  }
  const producers = new Set<string>();
  for (const [position, producer] of summary.producers.entries()) {
    if (producer === undefined) continue;
    const owner = site("producer", position);
    path(producer.path, owner);
    const key = encodeKey(producerData(producer));
    if (producers.has(key)) output.push(violation("authored-summary-producer-unique", owner));
    producers.add(key);
    switch (producer.kind) {
      case "parameter": parameter(producer.index, owner); break;
      case "capture": capture(producer.index, owner); break;
      case "allocation": logicalSite(producer.site, owner); break;
      case "shared":
        if (index.exports.get(exportKey(producer.identity)) == null) {
          output.push(violation("authored-summary-reference-resolves", owner, "export", exportKey(producer.identity)));
        }
        break;
      case "receiver": break;
    }
  }
  for (const [position, origins] of summary.origins.entries()) {
    if (origins === undefined) continue;
    const owner = site("origins", position);
    for (const producer of origins.producers) reference(producer, producerRows, owner, "producer");
    ordered(origins.producers, owner, "authored-summary-origins-order");
    if (origins.kind === "open") {
      for (const boundary of origins.boundaries) reference(boundary, boundaryRows, owner, "boundary");
      ordered(origins.boundaries, owner, "authored-summary-origins-order");
    }
  }
  for (const [position, boundary] of summary.boundaries.entries()) {
    if (boundary === undefined) continue;
    const owner = site("boundary", position);
    reference(boundary.subject, producerRows, owner, "producer");
    if (boundary.owner !== null) reference(boundary.owner, producerRows, owner, "producer");
    logicalSite(boundary.site, owner);
  }
  const effects = (effect: LibrarySummaryEffectPaths, owner: LocatedSite): void => {
    for (const projection of effect.paths) reference(projection, projections, owner, "projection");
    ordered(effect.paths, owner, "authored-summary-effects-order");
    if (effect.kind === "open") {
      for (const boundary of effect.boundaries) reference(boundary, boundaryRows, owner, "boundary");
      ordered(effect.boundaries, owner, "authored-summary-effects-order");
    }
  };
  let previousParameter: number | null = null;
  for (const [position, effect] of summary.parameters.entries()) {
    const owner = site("parameter", position);
    const key = effect.slot.kind === "receiver" ? -1 : effect.slot.index;
    if (effect.slot.kind === "parameter") parameter(effect.slot.index, owner);
    if (previousParameter !== null && previousParameter >= key) {
      output.push(violation("authored-summary-effects-order", owner));
    }
    previousParameter = key;
    effects(effect.reads, owner);
    effects(effect.writes, owner);
  }
  let previousCapture: number | null = null;
  for (const [position, effect] of summary.captures.entries()) {
    const owner = site("capture", position);
    capture(effect.index, owner);
    if (previousCapture !== null && previousCapture >= effect.index) {
      output.push(violation("authored-summary-effects-order", owner));
    }
    previousCapture = effect.index;
    effects(effect.reads, owner);
    effects(effect.writes, owner);
  }
  reference(summary.result, originRows, site("origins", null), "result");
  reference(summary.thrown, originRows, site("origins", null), "thrown");
  let previousWrite: string | null = null;
  for (const [position, write] of summary.writes.entries()) {
    const owner = site("write", position);
    reference(write.target, producerRows, owner, "producer");
    reference(write.value, originRows, owner, "origins");
    const key = encodeKey([write.target, write.value]);
    if (previousWrite !== null && compareText(previousWrite, key) >= 0) {
      output.push(violation("authored-summary-effects-order", owner));
    }
    previousWrite = key;
  }
  let previousRetention: string | null = null;
  for (const [position, retention] of summary.retention.entries()) {
    const owner = site("retention", position);
    reference(retention.source, producerRows, owner, "producer");
    const target = retention.into;
    switch (target.kind) {
      case "shared":
        path(target.path, owner);
        if (index.exports.get(exportKey(target.identity)) == null) {
          output.push(violation("authored-summary-reference-resolves", owner, "export", exportKey(target.identity)));
        }
        break;
      case "parameter": parameter(target.index, owner); path(target.path, owner); break;
      case "capture": capture(target.index, owner); path(target.path, owner); break;
      case "receiver": path(target.path, owner); break;
      case "callback": case "suspension": logicalSite(target.site, owner); break;
      case "external": reference(target.boundary, boundaryRows, owner, "boundary"); break;
      case "return": case "throw": break;
    }
    const key = encodeKey([retention.source, target.kind === "shared"
      ? [target.kind, exportIdentityData(target.identity), target.path]
      : target.kind === "parameter" || target.kind === "capture" ? [target.kind, target.index, target.path]
      : target.kind === "receiver" ? [target.kind, target.path]
      : target.kind === "callback" || target.kind === "suspension" ? [target.kind, target.site]
      : target.kind === "external" ? [target.kind, target.boundary] : [target.kind]]);
    if (previousRetention !== null && compareText(previousRetention, key) >= 0) {
      output.push(violation("authored-summary-effects-order", owner));
    }
    previousRetention = key;
  }
  let previousCallback: number | null = null;
  for (const [position, callback] of summary.callbacks.entries()) {
    const owner = site("callback", position);
    parameter(callback.parameterIndex, owner);
    if (previousCallback !== null && previousCallback >= callback.parameterIndex) {
      output.push(violation("authored-summary-effects-order", owner));
    }
    previousCallback = callback.parameterIndex;
    if (entry != null) {
      const signatures = callbackSignatures(entry, callback.parameterIndex, callbacks);
      const targetParameter = (value: number): void => {
        if (!integral(value) || signatures.length === 0 || signatures.some(signature => value >= signature.parameters.length)) {
          output.push(violation("authored-summary-parameter-range", owner, "callback", encodeKey(value)));
        }
      };
      if (callback.rejection !== null) targetParameter(callback.rejection);
      let previousInput: number | null = null;
      for (const input of callback.inputs) {
        targetParameter(input.parameterIndex);
        if (input.kind === "argument-element") parameter(input.sourceParameterIndex, owner);
        if (previousInput !== null && previousInput >= input.parameterIndex) {
          output.push(violation("authored-summary-effects-order", owner));
        }
        previousInput = input.parameterIndex;
      }
    }
  }
  for (const parameterIndex of summary.invocationOnlyParameters) parameter(parameterIndex, site("parameter", null));
  ordered(summary.invocationOnlyParameters, site("parameter", null), "authored-summary-effects-order");
  return output.length === initial;
}

export function checkAuthoredSummaries(catalogue: LibraryCatalogue,
  declared: readonly LibraryAuthoredSummary[]): readonly LibraryViolation[] {
  const output: LibraryViolation[] = [...checkLibraryCatalogue(catalogue)];
  const index = catalogueIndex(catalogue);
  const callbacks = new Map<string, readonly LibrarySignature[]>();
  const identities = new Set<string>();
  let previous: LibraryAuthoredSummary | null = null;
  for (const summary of declared) {
    const site: LocatedSite = { kind: "authored-summary", identity: summary.identity, table: "parameter", index: null };
    if (previous !== null && compareExports(previous.identity, summary.identity) > 0) {
      output.push(violation("authored-summaries-order", site));
    }
    previous = summary;
    const key = exportKey(summary.identity);
    if (identities.has(key)) output.push(violation("authored-summary-identity-unique", site));
    identities.add(key);
    validateAuthoredSummary(summary, index, output, callbacks);
  }
  return orderedViolations(output);
}
