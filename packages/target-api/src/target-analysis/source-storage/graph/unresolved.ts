import type { SourceStorageSubject, SourceStorageSubjectQuery } from "../model/subjects.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";

export interface SourceStorageUnresolvedAncestry {
  readonly subjects: readonly { readonly subject: SourceStorageSubject }[];
  readonly reason?: string;
}

export function createSourceStorageUnresolvedQueries(
  budget: SourceStorageBudget,
  subject: SourceStorageSubjectQuery,
  ancestry: (selected: SourceStorageSubject) => SourceStorageUnresolvedAncestry | undefined,
  unresolved: ReadonlyMap<SourceStorageSubject, string>,
) {
  const selections = new Map<SourceStorageSubject, string | undefined>();
  const store = (selected: SourceStorageSubject, reason: string | undefined): void => {
    if (!selections.has(selected) && !budget.row()) return;
    selections.set(selected, reason);
  };
  const directFor = (selected: SourceStorageSubject): string | undefined => {
    if (!budget.step()) return budget.failure();
    for (let length = selected.projection.length; length >= 0 && budget.step(); length -= 1) {
      const prefix = subject(selected.node, selected.kind, selected.projection.slice(0, length));
      const reason = prefix === undefined ? undefined : unresolved.get(prefix);
      if (reason !== undefined) return reason;
    }
    return budget.failure();
  };
  const ancestryFor = (selected: SourceStorageSubject): string | undefined => {
    if (!budget.step()) return budget.failure();
    if (selections.has(selected)) return selections.get(selected);
    if (unresolved.size === 0) {
      store(selected, undefined);
      return budget.failure();
    }
    const direct = directFor(selected);
    if (direct !== undefined) { store(selected, direct); return budget.failure() ?? direct; }
    const relation = ancestry(selected);
    if (relation === undefined) return budget.failure() ?? "Source storage unresolved evidence requires completed scoped ancestry.";
    if (relation.reason !== undefined) {
      store(selected, relation.reason);
      return budget.failure() ?? relation.reason;
    }
    for (let index = -1; index < relation.subjects.length; index += 1) {
      if (!budget.step()) break;
      const current = index < 0 ? selected : relation.subjects[index]!.subject;
      const reason = directFor(current);
      if (reason !== undefined) {
        store(selected, reason);
        return budget.failure() ?? reason;
      }
    }
    if (budget.failure() !== undefined) return budget.failure();
    store(selected, undefined);
    return budget.failure();
  };
  return Object.freeze({ directFor, ancestryFor });
}
