import type { Node } from "@tsonic/tsts";
import type { SourceStorageBudget, SourceStorageRows } from "./resource-budget.js";
import type { SourceStorageSubject } from "./subjects.js";

interface Dependency {
  readonly entries: Set<QueryEntry>;
}

interface QueryEntry {
  live: boolean;
  readonly rows: SourceStorageRows;
  readonly dependencyRows: SourceStorageRows;
  readonly remove: () => void;
  readonly reads: Set<Dependency>;
  readonly parents: Set<QueryEntry>;
  readonly children: Set<QueryEntry>;
  previous: QueryEntry | undefined;
  next: QueryEntry | undefined;
}

export function createSourceStorageGraphQueries(budget: SourceStorageBudget) {
  const reads = new Map<Node, Map<SourceStorageSubject["kind"], Dependency>>();
  const readRows = budget.createRows();
  let active: QueryEntry | undefined;
  let first: QueryEntry | undefined;
  let sealed = false;
  const depend = (parent: QueryEntry | undefined, child: QueryEntry): boolean => {
    if (sealed || parent === undefined || parent.children.has(child)) return true;
    if (!parent.dependencyRows.add(2)) return false;
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
    if (entry.previous !== undefined) entry.previous.next = entry.next;
    else if (first === entry) first = entry.next;
    if (entry.next !== undefined) entry.next.previous = entry.previous;
    entry.previous = undefined;
    entry.next = undefined;
    entry.dependencyRows.release();
    entry.rows.release();
  };
  return Object.freeze({
    seal(): void {
      if (sealed || budget.failure() !== undefined) return;
      if (active !== undefined) {
        budget.reject("Source storage graph queries cannot seal an unfinished selection.");
        return;
      }
      sealed = true;
      reads.clear();
      readRows.release();
      while (first !== undefined && budget.step()) {
        const entry = first;
        first = entry.next;
        entry.reads.clear();
        entry.children.clear();
        entry.parents.clear();
        entry.previous = undefined;
        entry.next = undefined;
        entry.dependencyRows.release();
      }
    },
    read(subject: SourceStorageSubject): void {
      if (sealed || active === undefined || !budget.step()) return;
      const kinds = reads.get(subject.node) ?? new Map<SourceStorageSubject["kind"], Dependency>();
      let dependency = kinds.get(subject.kind);
      if (dependency === undefined) {
        if (!readRows.add(1)) return;
        dependency = { entries: new Set() };
        kinds.set(subject.kind, dependency);
        reads.set(subject.node, kinds);
      }
      if (active.reads.has(dependency) || !active.dependencyRows.add(2)) return;
      dependency.entries.add(active);
      active.reads.add(dependency);
    },
    invalidate(subject: SourceStorageSubject): void {
      if (sealed) {
        budget.reject("Source storage graph queries cannot invalidate sealed inputs.");
        return;
      }
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
        const entry: QueryEntry = { live: true, rows, dependencyRows: budget.createRows(),
          remove: () => { selections.delete(key); }, reads: new Set(), parents: new Set(), children: new Set(),
          previous: undefined, next: sealed ? undefined : first };
        if (!sealed) {
          if (first !== undefined) first.previous = entry;
          first = entry;
        }
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
