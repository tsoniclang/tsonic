import type { SourceErrorStorageSubject, SourceErrorStorageSubjectQuery } from "./error-storage-subjects.js";

export function createSourceErrorStorageUnresolvedQuery(
  step: () => boolean,
  subject: SourceErrorStorageSubjectQuery,
  incoming: ReadonlyMap<SourceErrorStorageSubject, ReadonlySet<SourceErrorStorageSubject>>,
  unresolved: ReadonlyMap<SourceErrorStorageSubject, string>,
): (selected: SourceErrorStorageSubject) => string | undefined {
  const selections = new Map<SourceErrorStorageSubject, string | undefined>();
  return selected => {
    if (selections.has(selected)) return selections.get(selected);
    const pending = [selected];
    const visited = new Set<SourceErrorStorageSubject>();
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
      pending.push(...incoming.get(current) ?? []);
    }
    selections.set(selected, undefined);
    return undefined;
  };
}
