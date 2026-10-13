import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject, SourceStorageSubjectQuery } from "../model/subjects.js";
import type { SourceStorageStore } from "./stored-values.js";
import type { createSourceStorageEdges } from "./edges.js";

export interface SourceStorageStoredProjection {
  readonly store: SourceStorageStore;
  readonly value: SourceStorageSubject | undefined;
}

export function createSourceStorageStoreProjections(budget: SourceStorageBudget, subject: SourceStorageSubjectQuery,
  storesFor: (subject: SourceStorageSubject) => Iterable<SourceStorageStore> | undefined,
  projectOrigin: ReturnType<typeof createSourceStorageEdges>["projectOrigin"]) {
  const selections = new Map<SourceStorageSubject, readonly SourceStorageStoredProjection[] | null>();
  return (selected: SourceStorageSubject): readonly SourceStorageStoredProjection[] | undefined => {
    if (!budget.step()) return undefined;
    const cached = selections.get(selected);
    if (cached !== undefined) return cached ?? undefined;
    const rows = budget.createRows();
    const temporary = budget.createRows();
    let published = false;
    try {
      const result: SourceStorageStoredProjection[] = [];
      const seen = new Map<SourceStorageStore, Set<SourceStorageSubject | undefined>>();
      let hasStores = false;
      const collect = (store: SourceStorageStore, value: SourceStorageSubject | undefined): void => {
        let values = seen.get(store);
        if (values?.has(value)) return;
        if (value !== undefined && value !== store.value && !budget.edge()) return;
        if (!temporary.add(values === undefined ? 2 : 1) || !rows.add(2)) return;
        values ??= new Set();
        values.add(value);
        seen.set(store, values);
        result.push(Object.freeze({ store, value }));
      };
      for (let length = selected.projection.length; length >= 0; length -= 1) {
        if (!budget.step()) return undefined;
        const prefix = subject(selected.node, selected.kind, selected.projection.slice(0, length));
        if (prefix === undefined) return undefined;
        for (const store of storesFor(prefix) ?? []) {
          if (!budget.step()) return undefined;
          hasStores = true;
          if (store.value === undefined) collect(store, undefined);
          else projectOrigin(store.value, prefix, selected, value => collect(store, value));
        }
      }
      if (budget.failure() !== undefined || !rows.add(1)) return undefined;
      if (!hasStores) {
        selections.set(selected, null);
        published = true;
        return undefined;
      }
      const selection = Object.freeze(result);
      selections.set(selected, selection);
      published = true;
      return selection;
    } finally {
      temporary.release();
      if (!published) rows.release();
    }
  };
}
