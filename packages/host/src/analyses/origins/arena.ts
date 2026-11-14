// The canonical close of the relational arena (origins chapter 8.1; R6 G-5; R5 BA-4). The solve named producers by
// provisional number; here every producer a row or the execution's context needs is given its final id in sorted
// canonical-key order (entry roots by role and index, allocations by site node, then path), projections in sorted
// path order (a parent before its children), bound producers one per producer under the one context, and origins in
// sorted order of their producer lists. Records and references are counted and charged against the arena limits
// before any record is made.
import type { BoundProducerId, OriginsId, ProjectionPathId } from "../../ids/contract.js";
import { boundProducerId, originsId, producerId, projectionPathId, valueContextId } from "../../ids/index.js";
import type { Execution } from "../../ir-types/contract.js";
import type { DataflowAccount, DataflowStop, DataflowResult } from "../../dataflow/contract.js";
import { accountFailure, chargeWork, refuseAccount } from "../../dataflow/index.js";
import type { Origins, Producer, Projection, ProjectionPath, RelationalArena, ValueContext } from "../../ir-facts/contract.js";
import type { ProducerSpec, SegmentSpec } from "./keys.js";
import type { InvariantFailure } from "../../diag/contract.js";
import { requirePresent } from "../../diag/index.js";
import { compareRoots, compareSegments, frontier, representativeKey, requiredStop, segmentKey, segmentWork } from "./keys.js";
import type { Value } from "./state.js";
import { originRefusal } from "./state.js";

export interface ContextValues {
  readonly receiver: Value | null;
  readonly arguments: readonly Value[];
}

interface ArenaPath {
  readonly parent: number | null;
  segment: SegmentSpec;
  readonly children: number[];
}

export type Closed =
  | { readonly kind: "closed"; readonly arena: RelationalArena; readonly originsOf: (value: Value) => DataflowResult<OriginsId> }
  | DataflowStop;

const defect = (message: string): InvariantFailure => ({ owner: "analyses/origins", query: null, origin: null, message: `origins: ${message}` });
const unknownProducer = (): InvariantFailure => defect("a value names a producer that was not interned");
const unnamedPath = (): InvariantFailure => defect("a producer's path was not closed into the arena");
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

const sortValues = <Value>(values: readonly Value[], compare: (left: Value, right: Value) => number,
  account: DataflowAccount): DataflowResult<Value[]> => {
  const stop = chargeWork(account, values.length);
  if (stop !== null) return stop;
  let rows = [...values];
  let buffer: Value[] = [];
  for (let width = 1; width < rows.length; width *= 2) {
    const passStop = chargeWork(account, rows.length);
    if (passStop !== null) return passStop;
    const sorted = buffer;
    sorted.length = 0;
    for (let start = 0; start < rows.length; start += 2 * width) {
      let left = start;
      let right = Math.min(start + width, rows.length);
      const middle = right;
      const end = Math.min(start + 2 * width, rows.length);
      while (left < middle || right < end) {
        const chooseLeft = right === end || left < middle && compare(
          requirePresent(rows[left], unclosedValue()), requirePresent(rows[right], unclosedValue())) <= 0;
        const failure = accountFailure(account);
        if (failure !== null) return failure;
        sorted.push(requirePresent(rows[chooseLeft ? left++ : right++], unclosedValue()));
      }
    }
    buffer = rows;
    rows = sorted;
  }
  return { kind: "complete", value: rows };
};

export function closeArena(
  execution: Execution, specs: readonly ProducerSpec[], context: ContextValues, rows: readonly Value[],
  limits: { readonly maximumRecords: number; readonly maximumReferences: number },
  account: DataflowAccount,
): Closed {
  const priorStop = accountFailure(account);
  if (priorStop !== null) return priorStop;
  const { body, bindings: artifact } = execution.instance;
  if (artifact.kind !== "instantiated") return frontier(null, "a template has no complete bound producer vector");
  const bindings = artifact.bindings;
  let records = 0;
  let references = 0;
  const refusal = (): DataflowStop => requiredStop(account);
  const work = (units = 1): boolean => chargeWork(account, units) === null;
  const reserve = (recordCount: number, referenceCount: number): boolean => {
    if (!work(recordCount + referenceCount)) return false;
    if (records + recordCount > limits.maximumRecords) {
      refuseAccount(account, originRefusal(execution, "analysis.maximumRelationalRecordsPerBody", limits.maximumRecords, null));
      return false;
    }
    if (references + referenceCount > limits.maximumReferences) {
      refuseAccount(account, originRefusal(execution, "analysis.maximumRelationalReferencesPerBody", limits.maximumReferences, null));
      return false;
    }
    records += recordCount;
    references += referenceCount;
    return true;
  };
  const used = new Set<number>();
  const paths: ArenaPath[] = [];
  const pathNumbers = new Map<string, number>();
  const producerPaths = new Map<number, number | null>();
  const rootPaths: number[] = [];
  const distinct = new Map<string, Value>();
  const includePath = (number: number): boolean => {
    const pending: { readonly number: number; readonly spec: ProducerSpec & { readonly parent: number; readonly segment: SegmentSpec } }[] = [];
    for (let current = number; !producerPaths.has(current);) {
      if (!work()) return false;
      const spec = requirePresent(specs[current], unknownProducer());
      if (spec.parent === null) {
        producerPaths.set(current, null);
        break;
      }
      pending.push({ number: current, spec });
      current = spec.parent;
    }
    for (let current = pending.pop(); current !== undefined; current = pending.pop()) {
      if (!work()) return false;
      const spec = current.spec;
      const parent = requirePresent(producerPaths.get(spec.parent), unnamedPath());
      const segment = spec.segment;
      if (!work(1 + (segment.kind === "field" ? segment.key.length : 1))) return false;
      const key = `${parent === null ? -1 : parent}/${segmentKey(segment)}`;
      let path = pathNumbers.get(key);
      if (path === undefined) {
        if (!reserve(1, parent === null ? 0 : 1)) return false;
        path = paths.length;
        paths.push({ parent, segment, children: [] });
        pathNumbers.set(key, path);
        const siblings = parent === null ? rootPaths : requirePresent(paths[parent], unnamedPath()).children;
        siblings.push(path);
      } else {
        const previous = requirePresent(paths[path], unnamedPath());
        if (!segmentWork(account, segment) || !segmentWork(account, previous.segment)) return false;
        if (representativeKey(segment) < representativeKey(previous.segment)) previous.segment = segment;
      }
      producerPaths.set(current.number, path);
    }
    return true;
  };
  const include = (value: Value): boolean => {
    if (!work(1 + value.producers.length)) return false;
    const key = valueKey(value.producers, value.absent);
    if (distinct.has(key)) return true;
    if (!reserve(1, value.producers.length)) return false;
    distinct.set(key, value);
    for (const number of value.producers) {
      if (!work()) return false;
      if (used.has(number)) continue;
      const spec = requirePresent(specs[number], unknownProducer());
      if (!reserve(2, 2 + (spec.parent === null ? 0 : 1))) return false;
      used.add(number);
      if (!includePath(number)) return false;
    }
    return true;
  };
  if (!reserve(1, (context.receiver === null ? 0 : 1) + context.arguments.length)
    || context.receiver !== null && !include(context.receiver)) return refusal();
  for (const value of context.arguments) if (!include(value)) return refusal();
  for (const value of rows) if (!include(value)) return refusal();

  const comparePathIds = (left: number, right: number): number => {
    const first = requirePresent(paths[left], unnamedPath()).segment;
    const second = requirePresent(paths[right], unnamedPath()).segment;
    if (!work(1 + (first.kind === "field" && second.kind === "field" ? Math.min(first.key.length, second.key.length) : 1))) return 0;
    return compareSegments(first, second);
  };
  const roots = sortValues(rootPaths, comparePathIds, account);
  if (roots.kind !== "complete") return roots;
  const pathOrder = roots.value;
  for (let position = 0; position < pathOrder.length; position += 1) {
    if (!work()) return refusal();
    const path = requirePresent(paths[requirePresent(pathOrder[position], unnamedPath())], unnamedPath());
    const children = sortValues(path.children, comparePathIds, account);
    if (children.kind !== "complete") return children;
    if (!work(children.value.length)) return refusal();
    for (const child of children.value) pathOrder.push(child);
  }
  if (!work(pathOrder.length)) return refusal();
  const pathIds = new Map(pathOrder.map((path, index) => [path, index]));
  const pathRank = (number: number): number => {
    const path = requirePresent(producerPaths.get(number), unnamedPath());
    return path === null ? -1 : requirePresent(pathIds.get(path), unnamedPath());
  };
  if (!work(used.size)) return refusal();
  const orderedResult = sortValues([...used].map(number => ({ number, spec: requirePresent(specs[number], unknownProducer()) })),
    (left, right) => compareRoots(left.spec.root, right.spec.root) || pathRank(left.number) - pathRank(right.number), account);
  if (orderedResult.kind !== "complete") return orderedResult;
  const ordered = orderedResult.value;
  if (!work(ordered.length * 2)) return refusal();
  const producerSpecs = ordered.map(entry => entry.spec);
  const final = new Map(ordered.map((entry, index) => [entry.number, index]));
  const finalValues = new Map<string, { readonly list: readonly number[]; readonly absent: boolean }>();
  for (const value of distinct.values()) {
    if (!work(1 + value.producers.length * 2)) return refusal();
    const sorted = sortValues(value.producers.map(number => requirePresent(final.get(number), unknownProducer())), (left, right) => left - right, account);
    if (sorted.kind !== "complete") return sorted;
    finalValues.set(valueKey(value.producers, value.absent), { list: sorted.value, absent: value.absent });
  }
  if (!work(finalValues.size)) return refusal();
  const orderedOrigins = sortValues([...finalValues.entries()], ([, left], [, right]) => {
    if (!work(1 + Math.min(left.list.length, right.list.length))) return 0;
    return compareLists(left.list, right.list) || (Number(left.absent) - Number(right.absent));
  }, account);
  if (orderedOrigins.kind !== "complete") return orderedOrigins;
  const originsEntries = orderedOrigins.value;

  const pathIdOf = (number: number | null): ProjectionPathId | null =>
    number === null ? null : projectionPathId(requirePresent(pathIds.get(number), unnamedPath()));
  if (!work(pathOrder.length + producerSpecs.length + originsEntries.length + 1 + context.arguments.length)) return refusal();
  const projections: ProjectionPath[] = pathOrder.map((number, index) => {
    const path = requirePresent(paths[number], unnamedPath());
    return { id: projectionPathId(index), parent: pathIdOf(path.parent), projection: projectionOf(path.segment) };
  });
  const producers: Producer[] = producerSpecs.map((spec, index) => {
    const provisional = requirePresent(ordered[index], unknownProducer()).number;
    const head = { id: producerId(index), path: pathIdOf(requirePresent(producerPaths.get(provisional), unnamedPath())) };
    switch (spec.root.kind) {
      case "receiver": return { ...head, kind: "receiver" };
      case "parameter": return { ...head, kind: "parameter", index: spec.root.index };
      case "allocation": return { ...head, kind: "allocation", at: { kind: "node", node: { body, node: spec.root.node } } };
    }
  });
  const originsIndex = new Map(originsEntries.map(([key], index) => [key, index]));
  const originsOf = (value: Value): DataflowResult<OriginsId> => {
    const priorStop = accountFailure(account);
    if (priorStop !== null) return priorStop;
    const stop = chargeWork(account, 1 + value.producers.length);
    if (stop !== null) return stop;
    return { kind: "complete", value: originsId(requirePresent(originsIndex.get(valueKey(value.producers, value.absent)), unclosedValue())) };
  };
  for (const entry of originsEntries) {
    if (!work(1 + entry[1].list.length)) return refusal();
  }
  const origins: Origins[] = originsEntries.map(([, entry], index) => ({
    id: originsId(index), producers: entry.list.map((id): BoundProducerId => boundProducerId(id)),
    includesAbsence: entry.absent, kind: "complete",
  }));
  let receiver: OriginsId | null = null;
  if (context.receiver !== null) {
    const result = originsOf(context.receiver);
    if (result.kind !== "complete") return result;
    receiver = result.value;
  }
  const arguments_: OriginsId[] = [];
  for (const argument of context.arguments) {
    const result = originsOf(argument);
    if (result.kind !== "complete") return result;
    arguments_.push(result.value);
  }
  const contexts: ValueContext[] = [{ id: valueContextId(0), receiver, arguments: arguments_, captures: [] }];
  if (!work(producers.length)) return refusal();
  const boundProducers = producers.map(producer => ({ id: boundProducerId(producer.id), producer: producer.id,
    bindings, context: valueContextId(0) }));
  return { kind: "closed", arena: { projections, producers, contexts, boundProducers, origins, boundaries: [] }, originsOf };
}
