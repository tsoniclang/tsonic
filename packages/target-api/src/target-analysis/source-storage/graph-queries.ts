import type { Node } from "@tsonic/tsts";
import type { SourceStorageBudget, SourceStorageRows } from "./resource-budget.js";
import type { SourceStorageSubject } from "./subjects.js";

interface Dependency {
  readonly entries: Set<QueryEntry>;
}

interface QueryEntry {
  live: boolean;
  readonly rows: SourceStorageRows;
  readonly remove: () => void;
  readonly reads: Set<Dependency>;
  readonly parents: Set<QueryEntry>;
  readonly children: Set<QueryEntry>;
}

export function createSourceStorageGraphQueries(budget: SourceStorageBudget) {
  const reads = new Map<Node, Map<SourceStorageSubject["kind"], Dependency>>();
  let active: QueryEntry | undefined;
  const inheritsRead = (entry: QueryEntry, dependency: Dependency): boolean => {
    if (entry.children.size === 0) return false;
    const only = entry.children.size === 1 ? entry.children.values().next().value : undefined;
    if (only !== undefined) {
      if (only.reads.has(dependency)) return true;
      if (only.children.size === 0) return false;
    }
    const pending = [...entry.children];
    const visited = new Set<QueryEntry>();
    while (pending.length !== 0 && budget.step()) {
      const child = pending.pop()!;
      if (visited.has(child)) continue;
      visited.add(child);
      if (child.reads.has(dependency)) return true;
      for (const descendant of child.children) {
        if (!budget.step()) return false;
        pending.push(descendant);
      }
    }
    return false;
  };
  const depend = (parent: QueryEntry | undefined, child: QueryEntry): boolean => {
    if (parent === undefined || parent.children.has(child)) return true;
    if (!parent.rows.add(2)) return false;
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
    entry.rows.release();
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
      if (active.reads.has(dependency) || inheritsRead(active, dependency) || !active.rows.add(2)) return;
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
        const rows = budget.createRows();
        if (!rows.add(1)) return undefined;
        const entry: QueryEntry = { live: true, rows, remove: () => { selections.delete(key); },
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
        if (values !== undefined && values.size !== 0) rows.add(values.size);
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
