import type { Type } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/index.js";
import type { SourceStorageBudget } from "./model/resource-budget.js";
import type { SourceStorageSubject } from "./model/subjects.js";
import type { SourceStorageScope, SourceStorageProjectionView } from "./graph/scoped-model.js";
import type { SourceStorageBindings, SourceStorageOriginsSelection, SourceStorageTypedSubject,
  SourceStorageUnresolved, SourceStorageDomainBoundary } from "./model/types.js";
import type { createSourceStorageTransport } from "./transport/transport.js";
import type { createSourceStorageDomains } from "./transport/domains.js";
import { sourceStorageProjectionType } from "./scoped/projection-views.js";

export type SourceStorageOriginViews = ReadonlyMap<SourceStorageSubject, ReadonlySet<readonly SourceStorageProjectionView[]>>;

export function createSourceStorageDomainSelection(source: TargetSourceProgram, budget: SourceStorageBudget,
  transport: ReturnType<typeof createSourceStorageTransport>, domains: ReturnType<typeof createSourceStorageDomains>,
  bindingStates: WeakMap<SourceStorageBindings, readonly SourceStorageScope[]>,
  bindingView: (states: Iterable<SourceStorageScope>) => SourceStorageBindings | undefined,
  subjectReason: (subject: SourceStorageSubject) => string | undefined,
  unresolved: (reason: string) => SourceStorageUnresolved) {
  const typedOrigins = (subjects: readonly SourceStorageSubject[], qualified: SourceStorageOriginViews): SourceStorageOriginsSelection => {
    const origins: SourceStorageTypedSubject[] = [];
    for (const origin of subjects) {
      if (!budget.step()) return unresolved(budget.failure()!);
      const sourceFile = transport.sourceFileFor(origin);
      const views = qualified.get(origin);
      const types = new Set<Type>();
      for (const view of views === undefined ? [undefined] : views) {
        if (!budget.step()) return unresolved(budget.failure()!);
        const type = sourceStorageProjectionType(source, origin, view);
        if (type === undefined || sourceFile === undefined) return unresolved("A source storage origin has no exact checked component type.");
        if (!types.has(type)) {
          origins.push(Object.freeze({ subject: origin, type, sourceFile }));
          types.add(type);
        }
      }
    }
    return Object.freeze({ kind: "resolved", origins: Object.freeze(origins) });
  };
  const selectDomain = (subject: SourceStorageSubject, bindings: SourceStorageBindings,
    purpose: "values" | "storage-producers") => transport.substitutions.withQuery(() => {
    const reason = subjectReason(subject) ?? transport.directlyUnresolvedFor(subject);
    if (reason !== undefined) return unresolved(reason);
    const states = bindingStates.get(bindings);
    if (states === undefined) return unresolved("Invocation substitutions belong to a different source storage query.");
    const subjects = new Set<SourceStorageSubject>();
    const boundaries: SourceStorageDomainBoundary[] = [];
    const producerStates = new Map<SourceStorageSubject, Set<SourceStorageScope>>();
    const qualified = new Map<SourceStorageSubject, Set<readonly SourceStorageProjectionView[]>>();
    let absence = false;
    for (const state of states) {
      if (!budget.step()) return unresolved(budget.failure()!);
      const selected = domains.select(subject, state, purpose);
      if (selected.reason !== undefined) return unresolved(selected.reason);
      absence ||= selected.absence;
      for (const origin of selected.boundSubjects) {
        if (origin.views === undefined) continue;
        const views = qualified.get(origin.subject) ?? new Set<readonly SourceStorageProjectionView[]>();
        views.add(origin.views);
        qualified.set(origin.subject, views);
      }
      for (const origin of selected.subjects) { if (!budget.step()) return unresolved(budget.failure()!); subjects.add(origin); }
      if (purpose === "storage-producers") for (const origin of selected.boundSubjects) {
        if (!budget.step()) return unresolved(budget.failure()!);
        const states = producerStates.get(origin.subject) ?? new Set<SourceStorageScope>();
        states.add(origin.bindings);
        producerStates.set(origin.subject, states);
      }
      for (const boundary of selected.boundaries) {
        if (!budget.step()) return unresolved(budget.failure()!);
        const bindings = bindingView([boundary.bindings]);
        if (bindings === undefined) return unresolved(budget.failure() ?? "A source boundary requires its original owned activation bindings.");
        if (!boundaries.some(selected => selected.kind === boundary.kind && selected.subject === boundary.subject &&
          selected.owner === boundary.owner && selected.exposure === boundary.exposure && selected.bindings === bindings))
          boundaries.push(Object.freeze({ ...boundary, bindings }));
      }
    }
    if (budget.failure() !== undefined) return unresolved(budget.failure()!);
    if (subjects.size === 0 && boundaries.length === 0 && !absence)
      return unresolved("A source storage cycle has no proven original owner.");
    const origins = typedOrigins([...subjects], qualified);
    if (origins.kind === "unresolved") return origins;
    return boundaries.length === 0 ? Object.freeze({ kind: "complete" as const, origins: origins.origins, producerStates })
      : Object.freeze({ kind: "open" as const, origins: origins.origins, producerStates, boundaries: Object.freeze(boundaries) });
  });
  return { typedOrigins, selectDomain };
}
