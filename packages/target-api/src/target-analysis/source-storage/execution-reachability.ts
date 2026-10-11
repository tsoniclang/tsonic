import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/index.js";
import type { SourceStorageBudget } from "./resource-budget.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";

export function createSourceStorageExecutionReachability(source: TargetSourceProgram, budget: SourceStorageBudget,
  transport: SourceStorageScopedTransport) {
  let index: { readonly callers: ReadonlyMap<Node, ReadonlySet<Node>>;
    readonly entries: ReadonlyMap<Node, ReadonlySet<Node>> } | undefined;
  const selections = new Map<Node, ReadonlySet<Node>>();
  let initializing = false;
  const initialize = () => {
    if (index !== undefined) return index;
    if (initializing) { budget.reject("Source storage execution cannot expose an unfinished call graph."); return undefined; }
    const owned = budget.createRows();
    let complete = false;
    initializing = true;
    try {
      const callers = new Map<Node, Set<Node>>();
      const entries = new Map<Node, Set<Node>>();
      for (const invocations of [transport.invocations, transport.accessorTargets.keys()]) for (const invocation of invocations) {
        if (!budget.step()) return undefined;
        if (entries.has(invocation)) continue;
        const region = transport.regions.enclosing(invocation);
        if (region === undefined) {
          budget.reject("Source storage execution reachability requires the original invocation region."); return undefined;
        }
        if (!owned.add(1)) return undefined;
        const selected = new Set<Node>();
        entries.set(invocation, selected);
        const add = (child: Node): boolean => {
          if (!budget.step()) return false;
          if (!selected.has(child)) {
            if (!owned.add(1)) return false;
            selected.add(child);
          }
          const parents = callers.get(child);
          if (parents?.has(region)) return true;
          if (!owned.add(parents === undefined ? 2 : 1)) return false;
          const retained = parents ?? new Set<Node>();
          retained.add(region); callers.set(child, retained);
          return true;
        };
        for (const candidate of transport.invocationImplementations(invocation)) {
          if (!budget.step()) return undefined;
          for (const child of transport.regions.callable(candidate, transport.accessorTargets.has(invocation) ? undefined : invocation))
            if (!add(child)) return undefined;
        }
        if (source.ast.is.IsNewExpression(invocation)) for (const child of transport.regions.instance(invocation))
          if (!add(child.node)) return undefined;
      }
      if (budget.failure() !== undefined) return undefined;
      index = Object.freeze({ callers, entries }); complete = true;
      return index;
    } finally { initializing = false; if (!complete) owned.release(); }
  };
  const reaching = (target: Node): ReadonlySet<Node> | undefined => {
    if (!budget.step()) return undefined;
    const cached = selections.get(target);
    if (cached !== undefined) return cached;
    const graph = initialize();
    if (graph === undefined) return undefined;
    const owned = budget.createRows();
    let complete = false;
    try { return budget.withRows(frontier => {
      const selected = new Set<Node>();
      const pending: Node[] = [];
      let maximumFrontier = 0;
      const schedule = (region: Node): boolean => {
        if (!budget.step()) return false;
        if (selected.has(region)) return true;
        if (!owned.add(1)) return false;
        if (pending.length === maximumFrontier) {
          if (!frontier.add(1)) return false;
          maximumFrontier += 1;
        }
        selected.add(region); pending.push(region);
        return true;
      };
      if (!schedule(target)) return undefined;
      while (pending.length !== 0) {
        if (!budget.step()) return undefined;
        for (const parent of graph.callers.get(pending.pop()!) ?? []) if (!schedule(parent)) return undefined;
      }
      if (!owned.add(1)) return undefined;
      selections.set(target, selected);
      complete = true;
      return selected;
    }); } finally { if (!complete) owned.release(); }
  };
  return Object.freeze({
    region: (region: Node, target: Node): boolean | undefined => reaching(target)?.has(region),
    invocation: (invocation: Node, target: Node): boolean | undefined => {
      const selected = reaching(target);
      if (selected === undefined || index === undefined) return undefined;
      const entries = index.entries.get(invocation);
      if (entries === undefined) {
        budget.reject("Source storage execution reachability requires the indexed original invocation.");
        return undefined;
      }
      for (const region of entries) {
        if (!budget.step()) return undefined;
        if (selected.has(region)) return true;
      }
      return false;
    },
  });
}
