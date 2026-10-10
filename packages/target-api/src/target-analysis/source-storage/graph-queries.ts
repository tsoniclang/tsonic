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
}

export function createSourceStorageGraphQueries(budget: SourceStorageBudget) {
  const reads = new Map<Node, Map<SourceStorageSubject["kind"], Dependency>>();
  const readRows = budget.createRows();
  let sealed = false;
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
    if (sealed || parent === undefined || parent.children.has(child) || child.reads.size === 0 && child.children.size === 0) return true;
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
      budget.withRows(rows => {
        const pending: { readonly owner: QueryEntry; readonly parents: Iterator<QueryEntry> }[] = [];
        for (const kinds of reads.values()) for (const dependency of kinds.values()) {
          for (const entry of dependency.entries) {
            let selected: QueryEntry | undefined = entry;
            while (selected !== undefined || pending.length !== 0) {
              if (!budget.step()) return;
              if (selected !== undefined && (selected.reads.size !== 0 || selected.children.size !== 0)) {
                for (const read of selected.reads) { if (!budget.step()) return; read.entries.delete(selected); }
                for (const child of selected.children) { if (!budget.step()) return; child.parents.delete(selected); }
                selected.reads.clear();
                selected.children.clear();
                selected.dependencyRows.release();
                if (selected.parents.size !== 0) {
                  if (!rows.add(1)) return;
                  pending.push({ owner: selected, parents: selected.parents.values() });
                }
              }
              const frame = pending[pending.length - 1];
              const next = frame?.parents.next();
              if (frame !== undefined && next?.done === true) {
                frame.owner.parents.clear();
                pending.pop();
              }
              selected = next?.done === false ? next.value : undefined;
            }
          }
        }
      });
      reads.clear();
      readRows.release();
    },
    read(subject: SourceStorageSubject): void {
      if (active === undefined || !budget.step()) return;
      if (sealed) return;
      const kinds = reads.get(subject.node) ?? new Map<SourceStorageSubject["kind"], Dependency>();
      let dependency = kinds.get(subject.kind);
      if (dependency === undefined) {
        if (!readRows.add(1)) return;
        dependency = { entries: new Set() };
        kinds.set(subject.kind, dependency);
        reads.set(subject.node, kinds);
      }
      if (active.reads.has(dependency) || inheritsRead(active, dependency) || !active.dependencyRows.add(2)) return;
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
        const entry: QueryEntry = { live: true, rows, dependencyRows: budget.createRows(), remove: () => { selections.delete(key); },
          reads: new Set(), parents: new Set(), children: new Set() };
        selections.set(key, { entry });
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
        if (values === undefined || budget.failure() !== undefined || !depend(parent, entry)) {
          discard(entry);
          return undefined;
        }
        selections.set(key, { entry, values });
        return values;
      };
    },
  });
}
