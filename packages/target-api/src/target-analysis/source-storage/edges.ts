import type { Node, Type } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/index.js";
import { sourceStorageComponentType, sourceStorageComponents, sourceStorageSubjectType } from "./components.js";
import type { SourceStorageBudget } from "./resource-budget.js";
import type { SourceStorageProjection, SourceStorageSubject, SourceStorageSubjectQuery } from "./subjects.js";

export type SourceStorageIncomingQuery = (subject: SourceStorageSubject) => ReadonlySet<SourceStorageSubject>;

interface SourceStorageDestinationEdges {
  readonly components: Map<SourceStorageSubject, Set<SourceStorageSubject>>;
  revision: number;
}

export function createSourceStorageEdges(
  source: TargetSourceProgram,
  budget: SourceStorageBudget,
  subject: SourceStorageSubjectQuery,
) {
  const destinations = new Map<Node, Map<SourceStorageSubject["kind"], SourceStorageDestinationEdges>>();
  const selections = new Map<SourceStorageSubject, { readonly revision: number; readonly origins: ReadonlySet<SourceStorageSubject> }>();
  const empty: ReadonlySet<SourceStorageSubject> = new Set();
  const add = (origin: SourceStorageSubject, destination: SourceStorageSubject): boolean => {
    const kinds = destinations.get(destination.node) ?? new Map<SourceStorageSubject["kind"], SourceStorageDestinationEdges>();
    const selected = kinds.get(destination.kind) ?? { components: new Map<SourceStorageSubject, Set<SourceStorageSubject>>(), revision: 0 };
    const origins = selected.components.get(destination) ?? new Set<SourceStorageSubject>();
    if (origins.has(origin) || !budget.edge()) return false;
    origins.add(origin);
    selected.components.set(destination, origins);
    selected.revision += 1;
    kinds.set(destination.kind, selected);
    destinations.set(destination.node, kinds);
    return true;
  };
  const incomingFor: SourceStorageIncomingQuery = selected => {
    const destinationEdges = destinations.get(selected.node)?.get(selected.kind);
    if (selected.projection.length === 0) return destinationEdges?.components.get(selected) ?? empty;
    const revision = destinationEdges?.revision ?? 0;
    const cached = selections.get(selected);
    if (cached?.revision === revision) return cached.origins;
    const result = new Set<SourceStorageSubject>();
    for (const [destination, origins] of destinationEdges?.components ?? []) {
      if (!budget.step()) break;
      if (destination.projection.length > selected.projection.length || !destination.projection.every((component, index) =>
        equalProjection(component, selected.projection[index]!))) continue;
      const remaining = selected.projection.slice(destination.projection.length);
      for (const origin of origins) {
        if (!budget.step()) break;
        if (remaining.length === 0) { result.add(origin); continue; }
        const from = sourceStorageSubjectType(source, origin);
        const to = sourceStorageSubjectType(source, destination);
        if (from === undefined || to === undefined) continue;
        const semantics = source.semantics.forNode(origin.node);
        let candidates: { readonly projection: readonly SourceStorageProjection[]; readonly from: Type; readonly to: Type }[] =
          [{ projection: origin.projection, from, to }];
        for (const component of remaining) {
          const next: typeof candidates = [];
          for (const candidate of candidates) {
            if (!budget.step()) break;
            const target = sourceStorageComponentType(candidate.to, component, semantics);
            if (target === undefined) continue;
            const components: Iterable<SourceStorageProjection> = component.kind === "array-element"
              ? sourceStorageComponents(candidate.from, semantics)
              : [semantics.types.isTuple(candidate.from) ? component : { kind: "array-element" }];
            for (const original of components) {
              if (!budget.step()) break;
              const sourceType = sourceStorageComponentType(candidate.from, original, semantics);
              if (sourceType === undefined || !budget.row()) continue;
              next.push({ projection: [...candidate.projection, original], from: sourceType, to: target });
            }
          }
          candidates = next;
          if (candidates.length === 0 || budget.failure() !== undefined) break;
        }
        for (const candidate of candidates) {
          if (!budget.step()) break;
          const projected = subject(origin.node, origin.kind, candidate.projection);
          if (projected !== undefined && projected !== selected && !result.has(projected) && budget.edge()) result.add(projected);
        }
      }
    }
    selections.set(selected, { revision, origins: result });
    return result;
  };
  return Object.freeze({ add, incomingFor });
}

function equalProjection(left: SourceStorageProjection, right: SourceStorageProjection): boolean {
  return left.kind === right.kind && (left.kind === "array-element" || right.kind === "tuple-element" && left.index === right.index);
}
