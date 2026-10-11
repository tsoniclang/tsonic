import type { Node } from "@tsonic/tsts";
import type { SourceStorageBudget, SourceStorageRows } from "./resource-budget.js";

interface GraphInput {
  readonly node: Node;
  readonly kind: unknown;
}

export type SourceStorageReconciliation = (once: (key: object) => boolean) => void;

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
  inheritedReads: ReadonlySet<Dependency> | undefined;
}

interface Reaction {
  readonly operation: SourceStorageReconciliation;
  readonly applied: Set<object>;
  entry: QueryEntry | undefined;
}

interface FixedPointCell<Key, Value> {
  readonly key: Key;
  readonly values: Set<Value>;
  readonly view: ReadonlySet<Value>;
  readonly rows: SourceStorageRows;
  readonly dependencyRows: SourceStorageRows;
  readonly parents: Set<FixedPointCell<Key, Value>>;
  complete: boolean;
}

function readonlyValues<Value>(values: ReadonlySet<Value>, validate?: () => void): ReadonlySet<Value> {
  const checked = <Entry>(entries: SetIterator<Entry>): SetIterator<Entry> => {
    const iterator: SetIterator<Entry> = Object.freeze({
      next() { validate!(); return entries.next(); },
      [Symbol.iterator]() { validate!(); return iterator; },
      [Symbol.dispose]() { validate!(); },
    });
    return iterator;
  };
  const view: ReadonlySet<Value> = Object.freeze({
    get size(): number { validate?.(); return values.size; },
    has: (value: Value): boolean => { validate?.(); return values.has(value); },
    entries: () => { validate?.(); return validate === undefined ? values.entries() : checked(values.entries()); },
    keys: () => { validate?.(); return validate === undefined ? values.keys() : checked(values.keys()); },
    values: () => { validate?.(); return validate === undefined ? values.values() : checked(values.values()); },
    [Symbol.iterator]: () => { validate?.(); return validate === undefined ? values[Symbol.iterator]() : checked(values[Symbol.iterator]()); },
    forEach(callback: (value: Value, key: Value, set: ReadonlySet<Value>) => void, receiver?: unknown): void {
      validate?.();
      for (const value of values) { validate?.(); callback.call(receiver, value, value, view); }
    },
  });
  return view;
}

export function createSourceStorageGraphQueries(budget: SourceStorageBudget) {
  const reads = new Map<Node, Map<unknown, Dependency>>();
  const readRows = budget.createRows();
  let sealed = false;
  let active: QueryEntry | undefined;
  const inheritsRead = (entry: QueryEntry, dependency: Dependency): boolean => {
    const only = entry.children.size === 1 ? entry.children.values().next().value : undefined;
    return only !== undefined && (only.reads.has(dependency) || only.inheritedReads?.has(dependency) === true);
  };
  const depend = (parent: QueryEntry | undefined, child: QueryEntry): boolean => {
    if (sealed || parent === undefined || !parent.live || parent.children.has(child) || child.reads.size === 0 && child.children.size === 0) return true;
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
    entry.inheritedReads = undefined;
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
                selected.inheritedReads = undefined;
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
    read(subject: GraphInput): void {
      if (active === undefined || !budget.step()) return;
      if (sealed || !active.live) return;
      const kinds = reads.get(subject.node) ?? new Map<unknown, Dependency>();
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
    invalidate(subject: GraphInput): void {
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
    reconcile(operations: Iterable<SourceStorageReconciliation>): void {
      if (sealed || active !== undefined) {
        budget.reject("Source storage graph reconciliation requires an idle mutable graph.");
        return;
      }
      budget.withRows(rows => {
        const reactions = new Set<Reaction>();
        const pending = new Set<Reaction>();
        let closed = false;
        try {
          for (const operation of operations) {
            if (!budget.step() || !rows.add(3)) return;
            const reaction: Reaction = { operation, applied: new Set(), entry: undefined };
            reactions.add(reaction);
            pending.add(reaction);
          }
          while (pending.size !== 0 && budget.step()) {
            const reaction = pending.values().next().value!;
            pending.delete(reaction);
            const retained = budget.createRows();
            if (!retained.add(1)) return;
            const entry: QueryEntry = { live: true, rows: retained, dependencyRows: budget.createRows(),
              remove: () => { if (!closed && budget.step()) pending.add(reaction); },
              reads: new Set(), parents: new Set(), children: new Set(), inheritedReads: undefined };
            reaction.entry = entry;
            active = entry;
            try {
              reaction.operation(key => {
                if (!budget.step() || reaction.applied.has(key) || !rows.add(1)) return false;
                reaction.applied.add(key);
                return true;
              });
            } finally {
              active = undefined;
            }
          }
        } finally {
          closed = true;
          for (const reaction of reactions) {
            budget.step();
            if (reaction.entry?.live) discard(reaction.entry);
            reaction.applied.clear();
          }
          pending.clear();
          reactions.clear();
        }
      });
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
          reads: new Set(), parents: new Set(), children: new Set(), inheritedReads: undefined };
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
        if (!sealed && entry.children.size === 1) {
          const child = entry.children.values().next().value!;
          entry.inheritedReads = child.children.size === 0 ? child.reads : child.inheritedReads;
        }
        selections.set(key, { entry, values });
        return values;
      };
    },
    fixedPoint<Key, Value>(collect: (key: Key, read: (key: Key) => ReadonlySet<Value> | undefined,
      add: (value: Value) => boolean) => boolean): (key: Key) => ReadonlySet<Value> | undefined {
      const selections = new Map<Key, FixedPointCell<Key, Value>>();
      let running = false;
      return key => {
        if (!budget.step()) return undefined;
        if (!sealed || running) {
          budget.reject("Source storage fixed-point queries require a sealed graph and cannot expose an unfinished family.");
          return undefined;
        }
        const cached = selections.get(key);
        if (cached?.complete) return cached.view;
        return budget.withRows(workRows => {
          const wave = new Set<FixedPointCell<Key, Value>>();
          const pending = new Set<FixedPointCell<Key, Value>>();
          const frontierRows = budget.createRows();
          let maximumFrontier = 0;
          let current: FixedPointCell<Key, Value> | undefined;
          let complete = false;
          const schedule = (cell: FixedPointCell<Key, Value>): boolean => {
            if (pending.has(cell)) return true;
            if (pending.size === maximumFrontier) {
              if (!frontierRows.add(1)) return false;
              maximumFrontier += 1;
            }
            pending.add(cell);
            return true;
          };
          const admit = (input: Key): FixedPointCell<Key, Value> | undefined => {
            if (!budget.step()) return undefined;
            const selected = selections.get(input);
            if (selected !== undefined) return selected;
            const rows = budget.createRows();
            if (!rows.add(2) || !workRows.add(1)) { rows.release(); return undefined; }
            const values = new Set<Value>();
            const cell: FixedPointCell<Key, Value> = { key: input, values, view: readonlyValues(values), rows,
              dependencyRows: budget.createRows(), parents: new Set(), complete: false };
            if (!schedule(cell)) { rows.release(); return undefined; }
            selections.set(input, cell);
            wave.add(cell);
            return cell;
          };
          const evaluate = (cell: FixedPointCell<Key, Value>): boolean => budget.withRows(resultRows => {
            current = cell;
            let reading = true;
            const values = new Set<Value>();
            const borrowed = new Map<FixedPointCell<Key, Value>, ReadonlySet<Value>>();
            const borrowRows = budget.createRows();
            const validate = (): void => {
              if (reading && current === cell && budget.failure() === undefined) return;
              const reason = "Source storage fixed-point values require their active collector.";
              budget.reject(reason);
              throw new Error(reason);
            };
            let collected: boolean;
            try {
              collected = collect(cell.key, input => {
                if (!budget.step()) return undefined;
                if (!reading || current !== cell) {
                  budget.reject("Source storage fixed-point reads require their active collector.");
                  return undefined;
                }
                const selected = admit(input);
                if (selected === undefined) return undefined;
                if (selected.complete) return selected.view;
                if (!selected.parents.has(cell)) {
                  if (!selected.dependencyRows.add(1)) return undefined;
                  selected.parents.add(cell);
                }
                const existing = borrowed.get(selected);
                if (existing !== undefined) return existing;
                if (!borrowRows.add(2)) return undefined;
                const view = readonlyValues(selected.values, validate);
                borrowed.set(selected, view);
                return view;
              }, value => {
                if (!budget.step()) return false;
                if (!reading || current !== cell) {
                  budget.reject("Source storage fixed-point writes require their active collector.");
                  return false;
                }
                if (values.has(value)) return true;
                if (!resultRows.add(1)) return false;
                values.add(value);
                return true;
              });
            } finally {
              reading = false;
              current = undefined;
              borrowed.clear();
              borrowRows.release();
            }
            if (!collected || budget.failure() !== undefined) {
              budget.reject("Source storage fixed-point collectors require an exact positive result.");
              return false;
            }
            for (const previous of cell.values) {
              if (!budget.step()) return false;
              if (!values.has(previous)) {
                budget.reject("Source storage fixed-point collectors cannot retract a proved result.");
                return false;
              }
            }
            let changed = false;
            for (const value of values) {
              if (!budget.step()) return false;
              if (cell.values.has(value)) continue;
              if (!cell.rows.add(1)) return false;
              cell.values.add(value);
              changed = true;
            }
            if (changed) for (const parent of cell.parents) {
              if (!budget.step()) return false;
              if (!schedule(parent)) return false;
            }
            return budget.failure() === undefined;
          });
          running = true;
          try {
            const root = admit(key);
            if (root === undefined) return undefined;
            while (pending.size !== 0) {
              if (!budget.step()) return undefined;
              const cell = pending.values().next().value!;
              pending.delete(cell);
              if (!evaluate(cell)) return undefined;
            }
            if (budget.failure() !== undefined) return undefined;
            for (const cell of wave) {
              if (!budget.step()) return undefined;
              cell.complete = true;
            }
            complete = true;
            return root.view;
          } finally {
            running = false;
            current = undefined;
            pending.clear();
            for (const cell of wave) {
              cell.parents.clear();
              cell.dependencyRows.release();
              if (!complete) {
                selections.delete(cell.key);
                cell.values.clear();
                cell.rows.release();
              }
            }
            wave.clear();
            frontierRows.release();
          }
        });
      };
    },
  });
}
