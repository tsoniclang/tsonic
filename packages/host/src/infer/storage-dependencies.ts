import type { DataflowAccount, DataflowLimits, DataflowResult, GraphComponents } from "../dataflow/contract.js";
import { chargeResultEntries, chargeWork, createAccount, remainingWork, stronglyConnectedComponents } from "../dataflow/index.js";
import { requirePresent } from "../diag/index.js";
import type { Enumerated, StorageDependencies } from "./member-pause.js";

export function planStorageDependencies(items: readonly Enumerated[], variables: number, work: number,
  limits: DataflowLimits): DataflowResult<{ readonly work: number; readonly storage: StorageDependencies | null }> {
  const account = createAccount(limits);
  const vertices = variables + items.length;
  const setup = chargeWork(account, work) ?? chargeWork(account, vertices) ?? chargeResultEntries(account, vertices + 1);
  if (setup !== null) return setup;
  const successors: number[][] = Array.from({ length: vertices }, () => []);
  const edges = (vertex: number) => requirePresent(successors[vertex], {
    owner: "infer", query: null, origin: null, message: "A storage dependency retains its actual variable or contribution vertex.",
  });
  for (let position = 0; position < items.length; position += 1) {
    const read = chargeWork(account, 1);
    if (read !== null) return read;
    const { contribution } = requirePresent(items[position], {
      owner: "infer", query: null, origin: null, message: "An inference dependency retains its actual atomic contribution.",
    });
    const vertex = variables + position;
    for (let index = 0; index < contribution.reads.length; index += 1) {
      const stop = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
      if (stop !== null) return stop;
      const read = requirePresent(contribution.reads[index], {
        owner: "infer", query: null, origin: null, message: "A storage dependency retains each actual read variable.",
      });
      edges(read).push(vertex);
    }
    for (let index = 0; index < contribution.bounds.length; index += 1) {
      const stop = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
      if (stop !== null) return stop;
      const bound = requirePresent(contribution.bounds[index], {
        owner: "infer", query: null, origin: null, message: "A storage dependency retains each actual bounded variable.",
      });
      edges(vertex).push(bound);
    }
  }
  const components = stronglyConnectedComponents({ successors }, account);
  if (components.kind !== "complete") return components;
  let conditional: Map<number, number> | null = null;
  let targets: Set<number> | null = null;
  for (let position = 0; position < items.length; position += 1) {
    const paid = chargeWork(account, 1);
    if (paid !== null) return paid;
    const item = requirePresent(items[position], {
      owner: "infer", query: null, origin: null, message: "A storage equality retains its actual atomic contribution.",
    });
    if (item.reached.kind !== "eq") continue;
    const [target] = item.contribution.bounds;
    if (target === undefined || components.value.componentOf[target] !== components.value.componentOf[variables + position]) continue;
    const keep = chargeResultEntries(account, (conditional === null ? 2 : 0) + (targets?.has(target) === true ? 1 : 2));
    if (keep !== null) return keep;
    conditional ??= new Map();
    targets ??= new Set();
    conditional.set(position, target);
    targets.add(target);
  }
  const storage = conditional === null || targets === null ? null : componentSchedule(components.value, successors, conditional, targets, account);
  if (storage !== null && storage.kind !== "complete") return storage;
  return { kind: "complete", value: { work: limits.maximumWork - remainingWork(account), storage: storage?.value ?? null } };
}

function componentSchedule(components: GraphComponents, graph: readonly (readonly number[])[], conditional: Map<number, number>,
  targets: Set<number>, account: DataflowAccount): DataflowResult<StorageDependencies> {
  const count = components.components.length;
  const setup = chargeWork(account, count) ?? chargeResultEntries(account, 6 + count * 4);
  if (setup !== null) return setup;
  const remaining = components.components.map(rows => rows.length);
  const unresolved = components.components.map(() => 0);
  const successors: number[][] = components.components.map(() => []);
  const waiting = new Map<number, Set<number>>();
  const defaultable = new Set<number>();
  for (let index = 0; index < graph.length; index += 1) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    const from = row(components.componentOf, index);
    const edges = row(graph, index);
    for (let position = 0; position < edges.length; position += 1) {
      const read = chargeWork(account, 1);
      if (read !== null) return read;
      const to = row(components.componentOf, row(edges, position));
      if (to === from) continue;
      const keep = chargeResultEntries(account, 1);
      if (keep !== null) return keep;
      row(successors, from).push(to);
      unresolved[to] = row(unresolved, to) + 1;
    }
  }
  for (const target of targets) {
    const admitted = chargeWork(account, 1) ?? chargeResultEntries(account, 3);
    if (admitted !== null) return admitted;
    const component = row(components.componentOf, target);
    if (!waiting.has(component)) waiting.set(component, new Set());
  }
  return { kind: "complete", value: { conditional, targets, componentOf: components.componentOf, successors, unresolved, remaining,
    waiting, defaultable, reserve: entries => chargeResultEntries(account, entries) === null } };
}

function row<Value>(values: readonly Value[], index: number): Value {
  return requirePresent(values[index], { owner: "infer", query: null, origin: null, message: "A storage dependency keeps its actual component row." });
}

export function updateStorageWait(storage: StorageDependencies, variable: number, pending: boolean): boolean {
  const component = row(storage.componentOf, variable);
  const waiting = requirePresent(storage.waiting.get(component), {
    owner: "infer", query: null, origin: null, message: "A literal with a conditional carrier belongs to its actual component.",
  });
  if (pending) {
    waiting.add(variable);
    if (storage.unresolved[component] === 0) storage.defaultable.add(component);
    return true;
  }
  const removed = waiting.delete(variable);
  if (waiting.size === 0) storage.defaultable.delete(component);
  return removed;
}

export function retireStorageVertex(storage: StorageDependencies, vertex: number, take: (work: number) => boolean): boolean {
  if (!take(1)) return false;
  const component = row(storage.componentOf, vertex);
  const remaining = row(storage.remaining, component) - 1;
  storage.remaining[component] = remaining;
  if (remaining !== 0) return true;
  const successors = row(storage.successors, component);
  for (let index = 0; index < successors.length; index += 1) {
    if (!take(1)) return false;
    const successor = row(successors, index);
    const unresolved = row(storage.unresolved, successor) - 1;
    storage.unresolved[successor] = unresolved;
    if (unresolved === 0 && (storage.waiting.get(successor)?.size ?? 0) !== 0) storage.defaultable.add(successor);
  }
  return true;
}
