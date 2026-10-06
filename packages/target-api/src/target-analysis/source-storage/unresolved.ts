import type { SourceStorageSubject, SourceStorageSubjectQuery } from "./subjects.js";

export function createSourceStorageUnresolvedQuery(
  step: () => boolean,
  subject: SourceStorageSubjectQuery,
  incoming: ReadonlyMap<SourceStorageSubject, ReadonlySet<SourceStorageSubject>>,
  unresolved: ReadonlyMap<SourceStorageSubject, string>,
): (selected: SourceStorageSubject) => string | undefined {
  const selections = new Map<SourceStorageSubject, string | undefined>();
  return selected => {
    if (selections.has(selected)) return selections.get(selected);
    const pending = [selected];
    const visited = new Set<SourceStorageSubject>();
    while (pending.length !== 0 && step()) {
      const current = pending.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      for (let length = current.projection.length; length >= 0 && step(); length -= 1) {
        const prefix = subject(current.node, current.kind, current.projection.slice(0, length));
        const reason = prefix === undefined ? undefined : unresolved.get(prefix);
        if (reason !== undefined) {
          selections.set(selected, reason);
          return reason;
        }
      }
      for (const origin of incoming.get(current) ?? []) {
        if (!step()) break;
        pending.push(origin);
      }
    }
    selections.set(selected, undefined);
    return undefined;
  };
}
