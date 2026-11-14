// The canonical close of the relational arena (origins chapter 8.1; R6 G-5; R5 BA-4). The solve named producers by
// provisional number; here every producer a row or the execution's context needs is given its final id in sorted
// canonical-key order (entry roots by role and index, allocations by site node, then path), projections in sorted
// path order (a parent before its children), bound producers one per producer under the one context, and origins in
// sorted order of their producer lists. Records and references are counted and charged against the arena limits
// before any record is made.
import type { BodyId, BoundProducerId, OriginsId, ProjectionPathId } from "../../ids/contract.js";
import { boundProducerId, originsId, producerId, projectionPathId, valueContextId } from "../../ids/index.js";
import type { BindingVector } from "../../ir-types/contract.js";
import type { Origins, Producer, Projection, ProjectionPath, RelationalArena, ValueContext } from "../../ir-facts/contract.js";
import type { ProducerSpec, SegmentSpec } from "./keys.js";
import type { InvariantFailure } from "../../diag/contract.js";
import { requirePresent } from "../../diag/index.js";
import { compareProducers, comparePaths, pathKey } from "./keys.js";
import type { Value } from "./state.js";

export interface ContextValues {
  readonly receiver: Value | null;
  readonly arguments: readonly Value[];
}

export type Closed =
  | { readonly kind: "closed"; readonly arena: RelationalArena; readonly originsOf: (value: Value) => OriginsId }
  | { readonly kind: "over"; readonly limit: "analysis.maximumRelationalRecordsPerBody" | "analysis.maximumRelationalReferencesPerBody";
      readonly maximum: number };

const defect = (message: string): InvariantFailure => ({ owner: "analyses/origins", query: null, origin: null, message: `origins: ${message}` });
const unknownProducer = (): InvariantFailure => defect("a value names a producer that was not interned");
const unnamedPath = (): InvariantFailure => defect("a producer's path was not closed into the arena");
const emptyPath = (): InvariantFailure => defect("a projection path has no segment");
const unclosedValue = (): InvariantFailure => defect("a row value was not closed into the arena");

const valueKey = (producers: readonly number[], absent: boolean): string => `${producers.join(",")}|${absent ? 1 : 0}`;

const compareLists = (left: readonly number[], right: readonly number[]): number => {
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    const order = Number(left[index]) - Number(right[index]);
    if (order !== 0) return order;
  }
  return left.length - right.length;
};

const projectionOf = (segment: SegmentSpec): Projection => {
  switch (segment.kind) {
    case "field": return { kind: "field", member: segment.member };
    case "index": return { kind: "index", constant: BigInt(segment.index) };
    case "element": return { kind: "element" };
  }
};

export function closeArena(
  body: BodyId, specs: readonly ProducerSpec[], bindings: BindingVector, context: ContextValues, rows: readonly Value[],
  limits: { readonly maximumRecords: number; readonly maximumReferences: number },
): Closed {
  const values = [...(context.receiver === null ? [] : [context.receiver]), ...context.arguments, ...rows];
  const used = [...new Set(values.flatMap(value => value.producers))];
  const ordered = used.map(number => ({ number, spec: requirePresent(specs[number], unknownProducer()) }))
    .sort((left, right) => compareProducers(left.spec, right.spec));
  const producerSpecs = ordered.map(entry => entry.spec);
  const final = new Map(ordered.map((entry, index) => [entry.number, index]));
  const paths = new Map<string, readonly SegmentSpec[]>();
  for (const spec of producerSpecs) for (let length = 1; length <= spec.segments.length; length += 1) {
    const prefix = spec.segments.slice(0, length);
    paths.set(pathKey(prefix), prefix);
  }
  const pathList = [...paths.values()].sort(comparePaths);
  const pathIds = new Map(pathList.map((path, index) => [pathKey(path), index]));
  const finalList = (value: Value): readonly number[] =>
    value.producers.map(number => requirePresent(final.get(number), unknownProducer())).sort((a, b) => a - b);
  const finalValues = new Map<string, { readonly list: readonly number[]; readonly absent: boolean }>();
  for (const value of values) {
    const list = finalList(value);
    finalValues.set(valueKey(list, value.absent), { list, absent: value.absent });
  }
  const originsEntries = [...finalValues.entries()].sort(([, left], [, right]) =>
    compareLists(left.list, right.list) || (Number(left.absent) - Number(right.absent)));
  const records = pathList.length + producerSpecs.length * 2 + 1 + originsEntries.length;
  const references = pathList.filter(path => path.length > 1).length + producerSpecs.filter(spec => spec.segments.length > 0).length
    + (context.receiver === null ? 0 : 1) + context.arguments.length
    + originsEntries.reduce((sum, [, entry]) => sum + entry.list.length, 0) + producerSpecs.length * 2;
  if (records > limits.maximumRecords) return { kind: "over", limit: "analysis.maximumRelationalRecordsPerBody", maximum: limits.maximumRecords };
  if (references > limits.maximumReferences) return { kind: "over", limit: "analysis.maximumRelationalReferencesPerBody", maximum: limits.maximumReferences };

  const pathIdOf = (segments: readonly SegmentSpec[]): ProjectionPathId | null =>
    segments.length === 0 ? null : projectionPathId(requirePresent(pathIds.get(pathKey(segments)), unnamedPath()));
  const projections: ProjectionPath[] = pathList.map((path, index) => {
    const last = requirePresent(path[path.length - 1], emptyPath());
    return { id: projectionPathId(index), parent: pathIdOf(path.slice(0, -1)), projection: projectionOf(last) };
  });
  const producers: Producer[] = producerSpecs.map((spec, index) => {
    const head = { id: producerId(index), path: pathIdOf(spec.segments) };
    switch (spec.root.kind) {
      case "receiver": return { ...head, kind: "receiver" };
      case "parameter": return { ...head, kind: "parameter", index: spec.root.index };
      case "allocation": return { ...head, kind: "allocation", at: { kind: "node", node: { body, node: spec.root.node } } };
    }
  });
  const originsIndex = new Map(originsEntries.map(([key], index) => [key, index]));
  const originsOf = (value: Value): OriginsId =>
    originsId(requirePresent(originsIndex.get(valueKey(finalList(value), value.absent)), unclosedValue()));
  const origins: Origins[] = originsEntries.map(([, entry], index) => ({
    id: originsId(index), producers: entry.list.map((id): BoundProducerId => boundProducerId(id)),
    includesAbsence: entry.absent, kind: "complete",
  }));
  const contexts: ValueContext[] = [{ id: valueContextId(0), receiver: context.receiver === null ? null : originsOf(context.receiver),
    arguments: context.arguments.map(originsOf), captures: [] }];
  const boundProducers = producers.map(producer => ({ id: boundProducerId(producer.id), producer: producer.id,
    bindings, context: valueContextId(0) }));
  return { kind: "closed", arena: { projections, producers, contexts, boundProducers, origins, boundaries: [] }, originsOf };
}
