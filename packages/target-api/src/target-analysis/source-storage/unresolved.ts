import type { SourceStorageSubject, SourceStorageSubjectQuery } from "./subjects.js";
import type { SourceStorageIncomingQuery } from "./edges.js";
import type { SourceStorageBudget } from "./resource-budget.js";

export function createSourceStorageUnresolvedQuery(
  budget: SourceStorageBudget,
  subject: SourceStorageSubjectQuery,
  incoming: SourceStorageIncomingQuery,
  unresolved: ReadonlyMap<SourceStorageSubject, string>,
): (selected: SourceStorageSubject) => string | undefined {
  const selections = new Map<SourceStorageSubject, string | undefined>();
  const store = (selected: SourceStorageSubject, reason: string | undefined): void => {
    if (!selections.has(selected) && !budget.row()) return;
    selections.set(selected, reason);
  };
  return selected => {
    if (!budget.step()) return budget.failure();
    if (selections.has(selected)) return selections.get(selected);
    const pending = [selected];
    const visited = new Set<SourceStorageSubject>();
    while (pending.length !== 0 && budget.step()) {
      const current = pending.pop()!;
      if (visited.has(current)) continue;
      if (selections.has(current)) {
        const reason = selections.get(current);
        if (reason !== undefined) {
          store(selected, reason);
          return budget.failure() ?? reason;
        }
        continue;
      }
      visited.add(current);
      for (let length = current.projection.length; length >= 0 && budget.step(); length -= 1) {
        const prefix = subject(current.node, current.kind, current.projection.slice(0, length));
        const reason = prefix === undefined ? undefined : unresolved.get(prefix);
        if (reason !== undefined) {
          store(selected, reason);
          return budget.failure() ?? reason;
        }
      }
      for (const origin of incoming(current)) {
        if (!budget.step()) break;
        pending.push(origin);
      }
    }
    if (budget.failure() !== undefined) return budget.failure();
    for (const subject of visited) store(subject, undefined);
    return budget.failure();
  };
}
