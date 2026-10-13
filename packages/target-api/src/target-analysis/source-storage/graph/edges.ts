import type { Node, SourceFile, Type } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import { sourceStorageSubjectType } from "../model/components.js";
import { sourceStorageProjectComponents } from "./component-projections.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageProjection, SourceStorageSubject, SourceStorageSubjectQuery } from "../model/subjects.js";
import { sourceStorageIsMemberProjection } from "../model/subjects.js";

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
  const projectOrigin = (origin: SourceStorageSubject, destination: SourceStorageSubject, selected: SourceStorageSubject,
    collect: (origin: SourceStorageSubject) => void): void => {
    if (destination.node !== selected.node || destination.kind !== selected.kind ||
      destination.projection.length > selected.projection.length || !destination.projection.every((component, index) =>
        equalProjection(component, selected.projection[index]!))) return;
    const remaining = selected.projection.slice(destination.projection.length);
    if (remaining.length === 0) { collect(origin); return; }
    const fromFile = sourceFileFor(origin);
    const toFile = sourceFileFor(destination);
    const variants = destinations.get(destination.node)?.get(destination.kind)?.components.get(destination)?.get(origin);
    for (const types of variants ?? [undefined]) {
      if (!budget.step()) return;
      const from = types?.from ?? sourceStorageSubjectType(source, origin, fromFile);
      const to = types?.to ?? sourceStorageSubjectType(source, destination, toFile);
      if (from === undefined || to === undefined || fromFile === undefined) continue;
      sourceStorageProjectComponents(origin.projection, from, to, remaining, source.semantics.forFile(fromFile), budget, projection => {
        const projected = subject(origin.node, origin.kind, projection);
        if (projected !== undefined) collect(projected);
      });
    }
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
        for (const origin of origins.keys()) {
          if (!budget.step()) break;
          projectOrigin(origin, destination, selected, projected => {
            if (projected !== selected && !result.has(projected) &&
              (projected === origin || budget.edge()) && retained.add(1)) result.add(projected);
          });
        }
      }
      selections.set(selected, { revision, origins: result, release: retained.release });
      completed = true;
      return result;
    } finally {
      if (!completed) retained.release();
    }
  };
  return Object.freeze({ add, incomingFor, projectOrigin });
}

function equalProjection(left: SourceStorageProjection, right: SourceStorageProjection): boolean {
  return left.kind === right.kind && (left.kind === "array-element" ||
    left.kind === "tuple-element" && right.kind === "tuple-element" && left.index === right.index ||
    sourceStorageIsMemberProjection(left) && sourceStorageIsMemberProjection(right) && left.declaration === right.declaration);
}
