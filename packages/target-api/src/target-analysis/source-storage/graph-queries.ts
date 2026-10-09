import type { Node } from "@tsonic/tsts";
import type { SourceStorageBudget } from "./resource-budget.js";
import type { SourceStorageSubject } from "./subjects.js";

interface Dependency {
  readonly entries: Set<QueryEntry>;
}

interface QueryEntry {
  live: boolean;
  readonly remove: () => void;
  readonly reads: Set<Dependency>;
  readonly parents: Set<QueryEntry>;
  readonly children: Set<QueryEntry>;
}

export function createSourceStorageGraphQueries(budget: SourceStorageBudget) {
  const reads = new Map<Node, Map<SourceStorageSubject["kind"], Dependency>>();
  let active: QueryEntry | undefined;
  const depend = (parent: QueryEntry | undefined, child: QueryEntry): boolean => {
    if (parent === undefined || parent.children.has(child)) return true;
    if (!budget.row() || !budget.row()) return false;
    parent.children.add(child);
    child.parents.add(parent);
    return true;
  };
  const discard = (entry: QueryEntry): void => {
    entry.live = false;
    entry.remove();
    for (const read of entry.reads) read.entries.delete(entry);
    for (const child of entry.children) child.parents.delete(entry);
    for (const parent of entry.parents) parent.children.delete(entry);
    entry.reads.clear();
    entry.children.clear();
    entry.parents.clear();
  };
  return Object.freeze({
    read(subject: SourceStorageSubject): void {
      if (active === undefined || !budget.step()) return;
      const kinds = reads.get(subject.node) ?? new Map<SourceStorageSubject["kind"], Dependency>();
      let dependency = kinds.get(subject.kind);
      if (dependency === undefined) {
        if (!budget.row()) return;
        dependency = { entries: new Set() };
        kinds.set(subject.kind, dependency);
        reads.set(subject.node, kinds);
      }
      if (active.reads.has(dependency) || !budget.row() || !budget.row()) return;
      dependency.entries.add(active);
      active.reads.add(dependency);
    },
    invalidate(subject: SourceStorageSubject): void {
      const pending = [...reads.get(subject.node)?.get(subject.kind)?.entries ?? []];
      while (pending.length !== 0 && budget.step()) {
        const entry = pending.pop()!;
        if (!entry.live) continue;
        pending.push(...entry.parents);
        discard(entry);
      }
    },
    query<Key, Value>(collect: (key: Key) => ReadonlySet<Value> | undefined): (key: Key) => ReadonlySet<Value> | undefined {
      const selections = new Map<Key, { readonly entry: QueryEntry; readonly values?: ReadonlySet<Value> }>();
      return key => {
        if (!budget.step()) return undefined;
        const parent = active;
        const cached = selections.get(key);
        if (cached !== undefined) {
          if (cached.values === undefined) {
            budget.reject("Source storage graph queries cannot recursively select an unfinished result.");
            return undefined;
          }
          return depend(parent, cached.entry) ? cached.values : undefined;
        }
        if (!budget.row()) return undefined;
        const entry: QueryEntry = { live: true, remove: () => { selections.delete(key); },
          reads: new Set(), parents: new Set(), children: new Set() };
        selections.set(key, { entry });
        if (!depend(parent, entry)) { discard(entry); return undefined; }
        let values: ReadonlySet<Value> | undefined;
        active = entry;
        try {
          values = collect(key);
        } catch (error) {
          discard(entry);
          throw error;
        } finally {
          active = parent;
        }
        if (!entry.live) budget.reject("Source storage graph inputs changed during query selection.");
        for (let index = 0; index < (values?.size ?? 0); index += 1) {
          if (!budget.row()) break;
        }
        if (values === undefined || budget.failure() !== undefined) {
          discard(entry);
          return undefined;
        }
        selections.set(key, { entry, values });
        return values;
      };
    },
  });
}
