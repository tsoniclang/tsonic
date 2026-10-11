import type { SourceStorageSubject } from "./subjects.js";
import type { SourceStorageBudget } from "./resource-budget.js";
import type { SourceStorageIncomingQuery } from "./edges.js";

export function createSourceStorageAncestorQuery(budget: SourceStorageBudget, incoming: SourceStorageIncomingQuery) {
  return function* (selected: SourceStorageSubject,
    accepts?: (subject: SourceStorageSubject, origins: ReadonlySet<SourceStorageSubject>) => boolean): IterableIterator<SourceStorageSubject> {
    const rows = budget.createRows();
    const visited = new Set<SourceStorageSubject>();
    const pending: SourceStorageSubject[] = [];
    const admit = (subject: SourceStorageSubject): boolean => {
      if (visited.has(subject)) return true;
      if (!rows.add(2)) return false;
      visited.add(subject);
      pending.push(subject);
      return true;
    };
    try {
      if (!admit(selected)) return;
      for (let index = 0; index < pending.length; index += 1) {
        if (!budget.step()) return;
        const current = pending[index]!;
        const origins = incoming(current);
        if (accepts === undefined || accepts(current, origins)) yield current;
        for (const origin of origins) {
          if (!budget.step() || !admit(origin)) return;
        }
      }
    } finally {
      visited.clear();
      pending.length = 0;
      rows.release();
    }
  };
}
