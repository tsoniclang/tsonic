import type { Node, SourceFile, Type } from "@tsonic/tsts";
import type { SourceFileSemantics, TargetSourceProgram } from "../../source-semantics/index.js";
import { sourceStorageComponentType, sourceStorageComponents, sourceStorageSubjectType } from "./components.js";
import type { SourceStorageBudget } from "./resource-budget.js";
import type { SourceStorageProjection, SourceStorageSubject, SourceStorageSubjectQuery } from "./subjects.js";

export type SourceStorageIncomingQuery = (subject: SourceStorageSubject) => ReadonlySet<SourceStorageSubject>;

export interface SourceStorageEdgeTypes {
  readonly from: Type;
  readonly to: Type;
}

interface SourceStorageDestinationEdges {
  readonly components: Map<SourceStorageSubject, Map<SourceStorageSubject, ReadonlySet<SourceStorageEdgeTypes | undefined>>>;
  revision: number;
}

export function createSourceStorageEdges(
  source: TargetSourceProgram,
  budget: SourceStorageBudget,
  subject: SourceStorageSubjectQuery,
  sourceFileFor: (subject: SourceStorageSubject) => SourceFile | undefined,
) {
  const destinations = new Map<Node, Map<SourceStorageSubject["kind"], SourceStorageDestinationEdges>>();
  const selections = new Map<SourceStorageSubject, { readonly revision: number; readonly origins: ReadonlySet<SourceStorageSubject>;
    readonly release: () => void }>();
  const empty: ReadonlySet<SourceStorageSubject> = new Set();
  const add = (origin: SourceStorageSubject, destination: SourceStorageSubject, types?: SourceStorageEdgeTypes): boolean => {
    const kinds = destinations.get(destination.node) ?? new Map<SourceStorageSubject["kind"], SourceStorageDestinationEdges>();
    const selected: SourceStorageDestinationEdges = kinds.get(destination.kind) ?? { components: new Map(), revision: 0 };
    const origins = selected.components.get(destination) ?? new Map<SourceStorageSubject, ReadonlySet<SourceStorageEdgeTypes | undefined>>();
    const previous = origins.get(origin);
    for (const existing of previous ?? []) {
      if (!budget.step()) return false;
      if (existing?.from === types?.from && existing?.to === types?.to) return false;
    }
    if (!budget.edge()) return false;
    origins.set(origin, new Set([...previous ?? [], types === undefined ? undefined : Object.freeze({ ...types })]));
    selected.components.set(destination, origins);
    selected.revision += 1;
    kinds.set(destination.kind, selected);
    destinations.set(destination.node, kinds);
    return true;
  };
  const incomingFor: SourceStorageIncomingQuery = selected => {
    const destinationEdges = destinations.get(selected.node)?.get(selected.kind);
    const revision = destinationEdges?.revision ?? 0;
    const cached = selections.get(selected);
    if (cached?.revision === revision) return cached.origins;
    cached?.release();
    const retained = budget.createRows();
    if (!retained.add(1)) return empty;
    const result = new Set<SourceStorageSubject>();
    let completed = false;
    try {
      for (const [destination, origins] of destinationEdges?.components ?? []) {
        if (!budget.step()) break;
        if (destination.projection.length > selected.projection.length || !destination.projection.every((component, index) =>
          equalProjection(component, selected.projection[index]!))) continue;
        const remaining = selected.projection.slice(destination.projection.length);
        for (const [origin, variants] of origins) {
          if (!budget.step()) break;
          if (remaining.length === 0) {
            if (!result.has(origin) && retained.add(1)) result.add(origin);
            continue;
          }
          const fromFile = sourceFileFor(origin);
          const toFile = sourceFileFor(destination);
          for (const types of variants) {
            if (!budget.step()) break;
            const from = types?.from ?? sourceStorageSubjectType(source, origin, fromFile);
            const to = types?.to ?? sourceStorageSubjectType(source, destination, toFile);
            if (from === undefined || to === undefined || fromFile === undefined) continue;
            const semantics = source.semantics.forFile(fromFile);
            projectEdge(origin, from, to, remaining, semantics, budget, projection => {
              const projected = subject(origin.node, origin.kind, projection);
              if (projected !== undefined && projected !== selected && !result.has(projected) && budget.edge() && retained.add(1)) result.add(projected);
            });
          }
        }
      }
      selections.set(selected, { revision, origins: result, release: retained.release });
      completed = true;
      return result;
    } finally {
      if (!completed) retained.release();
    }
  };
  return Object.freeze({ add, incomingFor });
}

function projectEdge(
  origin: SourceStorageSubject,
  from: Type,
  to: Type,
  remaining: readonly SourceStorageProjection[],
  semantics: SourceFileSemantics,
  budget: SourceStorageBudget,
  collect: (projection: readonly SourceStorageProjection[]) => void,
): void {
  if (semantics.types.couldContainTypeVariables(to) && semantics.types.isIdentical(from, to)) {
    collect([...origin.projection, ...remaining]);
    return;
  }
  let candidates: { readonly projection: readonly SourceStorageProjection[]; readonly from: Type; readonly to: Type }[] = [];
  let frontierRows = budget.createRows();
  let nextRows: ReturnType<SourceStorageBudget["createRows"]> | undefined;
  try {
    if (!frontierRows.add(1)) return;
    candidates.push({ projection: origin.projection, from, to });
    for (const component of remaining) {
      const next: typeof candidates = [];
      nextRows = budget.createRows();
      for (const candidate of candidates) {
        if (!budget.step()) return;
        const target = sourceStorageComponentType(candidate.to, component, semantics);
        if (target === undefined) continue;
        const components: Iterable<SourceStorageProjection> = component.kind === "array-element"
          ? sourceStorageComponents(candidate.from, semantics)
          : [semantics.types.isTuple(candidate.from) ? component : { kind: "array-element" }];
        for (const original of components) {
          if (!budget.step()) return;
          const sourceType = sourceStorageComponentType(candidate.from, original, semantics);
          if (sourceType === undefined) continue;
          if (!nextRows.add(1)) return;
          next.push({ projection: [...candidate.projection, original], from: sourceType, to: target });
        }
      }
      frontierRows.release();
      frontierRows = nextRows;
      nextRows = undefined;
      candidates = next;
      if (candidates.length === 0) return;
    }
    for (const candidate of candidates) {
      if (!budget.step()) return;
      collect(candidate.projection);
    }
  } finally {
    frontierRows.release();
    nextRows?.release();
  }
}

function equalProjection(left: SourceStorageProjection, right: SourceStorageProjection): boolean {
  return left.kind === right.kind && (left.kind === "array-element" || right.kind === "tuple-element" && left.index === right.index);
}
