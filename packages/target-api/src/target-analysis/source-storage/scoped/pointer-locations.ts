import { sourceStorageValue, type SourceStorageProgram } from "../model/program.js";
import type { Node } from "@tsonic/tsts";
import type { SourceTypedLocationOperation } from "../../../source-model/pointers.js";

import type { SourceStorageBudget } from "../model/resource-budget.js";
import { sourceIndexedStorageProjection } from "../model/components.js";
import { sourceStorageProjectComponents } from "../graph/component-projections.js";
import type { SourceStorageReference, SourceStorageScope, SourceStorageTerm } from "../graph/scoped-model.js";
import { sourceStorageReference } from "../graph/scoped-model.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
import { sourceStorageProjectionType } from "./projection-views.js";

interface SourceStoragePointerLocationQueries {
  read(term: SourceStorageTerm): ReadonlySet<SourceStorageTerm> | undefined;
  creatorScope(node: Node, scope: SourceStorageScope): SourceStorageScope;
}

type SourceStoragePointerLocation = SourceStorageReference | Extract<SourceStorageTerm, { readonly kind: "input-frontier" | "empty" | "unresolved" }>;

export function createSourceStoragePointerLocations(source: SourceStorageProgram, budget: SourceStorageBudget,
  transport: SourceStorageScopedTransport, queries: SourceStoragePointerLocationQueries) {
  const typedOperation = (occurrence: Node): SourceTypedLocationOperation | undefined => {
    const selected = sourceStorageValue(source.facts.protocols.pointerOperation(occurrence));
    return selected.kind === "present" && selected.value.family === "typed-location" ? selected.value : undefined;
  };
  const address = (operation: Extract<SourceTypedLocationOperation, { readonly operation: "address-of" }>,
    scope: SourceStorageScope): readonly SourceStoragePointerLocation[] | undefined => budget.withRows(rows => {
    const selectedPlace = sourceStorageValue(source.facts.protocols.storage(operation.storage.occurrence));
    if (selectedPlace.kind === "none" || !selectedPlace.value.writable) return undefined;
    const place = selectedPlace.value;
    if (place.kind === "binding") {
      const subject = transport.locationFor(place.storage);
      return subject === undefined ? undefined : [Object.freeze({ kind: "leaf", subject,
        scope: queries.creatorScope(subject.node, scope) })];
    }
    if (place.kind === "pointer") return undefined;
    const receiver = transport.subjectFor(place.receiver.occurrence);
    const components = place.kind === "member"
      ? place.declarations.map(declaration => Object.freeze({ kind: "member" as const, declaration }))
      : sourceIndexedStorageProjection(source, place.storage);
    if (receiver === undefined || components.length === 0) return undefined;
    const originals = queries.read(sourceStorageReference(receiver, scope));
    if (originals === undefined) return undefined;
    const result: SourceStoragePointerLocation[] = [];
    for (const original of originals) {
      if (!budget.step()) return undefined;
      if (original.kind === "empty" || original.kind === "unresolved") {
        if (!rows.add(1)) return undefined;
        result.push(original);
        continue;
      }
      if (original.kind !== "leaf" && original.kind !== "input-frontier") return undefined;
      const type = sourceStorageProjectionType(source, original.subject, original.views, transport.sourceFileFor(original.subject));
      if (type === undefined) return undefined;
      for (const component of components) {
        if (!budget.step()) return undefined;
        sourceStorageProjectComponents(original.subject.projection, type, place.receiver.value,
          [component], source, budget, projection => {
            const subject = transport.subject(original.subject.node, original.subject.kind, projection);
            if (subject !== undefined && rows.add(1)) result.push(original.kind === "input-frontier"
              ? Object.freeze({ ...original, subject, preservesInput: false })
              : Object.freeze({ ...original, subject }));
          });
      }
    }
    return budget.failure() === undefined ? result : undefined;
  });
  const identities = (pointer: SourceStorageReference): readonly SourceStoragePointerLocation[] | undefined => budget.withRows(rows => {
    const pending: SourceStoragePointerLocation[] = [pointer];
    const seen = new Map<SourceStorageScope, Set<SourceStorageReference["subject"]>>();
    const result: SourceStoragePointerLocation[] = [];
    while (pending.length !== 0) {
      if (!budget.step()) return undefined;
      const original = pending.pop()!;
      if (original.kind === "empty" || original.kind === "unresolved" || original.kind === "input-frontier") {
        result.push(original); continue;
      }
      const visited = seen.get(original.scope);
      if (visited?.has(original.subject)) continue;
      if (!rows.add(visited === undefined ? 3 : 2)) return undefined;
      const entries = visited ?? new Set();
      entries.add(original.subject); seen.set(original.scope, entries);
      const operation = original.subject.kind === "value" && original.subject.projection.length === 0
        ? typedOperation(original.subject.node) : undefined;
      if (operation?.operation === "allocate") { result.push(original); continue; }
      if (operation?.operation === "address-of") {
        const selected = address(operation, original.scope);
        if (selected === undefined) return undefined;
        result.push(...selected); continue;
      }
      const expression = operation?.operation === "bind-pointer" ? operation.identity.occurrence
        : operation?.operation === "project-pointer" ? operation.pointer.occurrence : undefined;
      const subject = transport.subjectFor(expression);
      if (subject === undefined) return undefined;
      const selected = queries.read(sourceStorageReference(subject, original.scope));
      if (selected === undefined) return undefined;
      for (const value of selected) {
        if (!budget.step() || !rows.add(1)) return undefined;
        if (value.kind === "empty" || value.kind === "unresolved") { result.push(value); continue; }
        if (value.kind !== "leaf" && value.kind !== "input-frontier") return undefined;
        if (operation?.operation === "bind-pointer") result.push(value);
        else pending.push(value);
      }
    }
    return result;
  });
  return Object.freeze({ address, identities });
}
