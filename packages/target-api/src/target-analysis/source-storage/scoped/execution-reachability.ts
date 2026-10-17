import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
import { sourceStorageConstructionExpression } from "../model/construction.js";
import type { SourceStorageCallbackEntry, SourceStorageDomainBoundary } from "../model/types.js";
import type { SourceStorageTerm } from "../graph/scoped-model.js";

export function* walkSourceStorageExecution(budget: SourceStorageBudget, roots: Iterable<SourceStorageTerm>,
  read: (term: SourceStorageTerm) => Iterable<SourceStorageTerm> | undefined): Generator<SourceStorageTerm> {
  const rows = budget.createRows();
  const frontier = budget.createRows();
  let maximumFrontier = 0;
  const pending: SourceStorageTerm[] = [];
  const visited = new Set<SourceStorageTerm>();
  const schedule = (term: SourceStorageTerm): boolean => {
    if (!budget.step()) return false;
    if (visited.has(term)) return true;
    if (!rows.add(1)) return false;
    if (pending.length === maximumFrontier) {
      if (!frontier.add(1)) return false;
      maximumFrontier += 1;
    }
    visited.add(term); pending.push(term);
    return true;
  };
  try {
    for (const root of roots) if (!schedule(root)) return;
    while (pending.length !== 0) {
      if (!budget.step()) return;
      const term = pending.pop()!;
      if (term.kind === "leaf" || term.kind === "effect" || term.kind === "unresolved") { yield term; continue; }
      if (term.kind === "empty") continue;
      const successors = read(term);
      if (successors === undefined) {
        budget.reject("Source storage execution requires its active scoped relation."); return;
      }
      for (const successor of successors) if (!schedule(successor)) return;
    }
  } finally { pending.length = 0; visited.clear(); frontier.release(); rows.release(); }
}

export function createSourceStorageExecutionReachability(source: TargetSourceProgram, budget: SourceStorageBudget,
  transport: SourceStorageScopedTransport) {
  let index: { readonly callers: ReadonlyMap<Node, ReadonlySet<Node>>;
    readonly callees: ReadonlyMap<Node, ReadonlySet<Node>>;
    readonly entries: ReadonlyMap<Node, ReadonlySet<Node>> } | undefined;
  const selections = { callers: new Map<Node, ReadonlySet<Node>>(), callees: new Map<Node, ReadonlySet<Node>>() };
  let initializing = false;
  const initialize = () => {
    if (index !== undefined) return index;
    if (initializing) { budget.reject("Source storage execution cannot expose an unfinished call graph."); return undefined; }
    const owned = budget.createRows();
    let complete = false;
    initializing = true;
    try {
      const callers = new Map<Node, Set<Node>>();
      const callees = new Map<Node, Set<Node>>();
      const entries = new Map<Node, Set<Node>>();
      const connect = (adjacency: Map<Node, Set<Node>>, origin: Node, destination: Node): boolean => {
        const previous = adjacency.get(origin);
        if (previous?.has(destination)) return true;
        if (!owned.add(previous === undefined ? 2 : 1)) return false;
        const retained = previous ?? new Set<Node>();
        retained.add(destination); adjacency.set(origin, retained);
        return true;
      };
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
          return connect(callers, child, region) && connect(callees, region, child);
        };
        for (const candidate of transport.invocationImplementations(invocation)) {
          if (!budget.step()) return undefined;
          for (const child of transport.regions.callable(candidate, transport.accessorTargets.has(invocation) ? undefined : invocation))
            if (!add(child)) return undefined;
        }
        for (const entry of transport.callbackEntriesFor(invocation)) {
          if (!budget.step()) return undefined;
          for (const candidate of transport.callbackImplementationsFor(entry)) {
            if (!budget.step()) return undefined;
            for (const child of transport.regions.callable(candidate, invocation, undefined, entry)) if (!add(child)) return undefined;
          }
        }
        const frontiers = transport.callbackInputFrontiersFor(invocation);
        if (frontiers === undefined) return undefined;
        for (const frontier of frontiers) {
          if (!budget.step()) return undefined;
          for (const child of transport.regions.callable(frontier.subject.node, undefined)) if (!add(child)) return undefined;
        }
        if (sourceStorageConstructionExpression(invocation, source, budget.step) !== undefined) {
          const instance = transport.regions.instance(invocation);
          if (instance === undefined) return undefined;
          for (const child of instance.regions) if (!add(child.node)) return undefined;
        }
      }
      if (budget.failure() !== undefined) return undefined;
      index = Object.freeze({ callers, callees, entries }); complete = true;
      return index;
    } finally { initializing = false; if (!complete) owned.release(); }
  };
  const reaching = (target: Node, direction: "callers" | "callees"): ReadonlySet<Node> | undefined => {
    if (!budget.step()) return undefined;
    target = transport.regions.enclosing(target) ?? target;
    const cached = selections[direction].get(target);
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
        for (const adjacent of graph[direction].get(pending.pop()!) ?? []) if (!schedule(adjacent)) return undefined;
      }
      if (!owned.add(1)) return undefined;
      selections[direction].set(target, selected);
      complete = true;
      return selected;
    }); } finally { if (!complete) owned.release(); }
  };
  return Object.freeze({
    frontiers(invocation: Node, target: Node): readonly (Omit<SourceStorageDomainBoundary, "bindings"> & {
      readonly callback?: SourceStorageCallbackEntry;
    })[] | undefined {
      const selected = reaching(target, "callers");
      if (selected === undefined) return undefined;
      const frontiers = transport.callbackInputFrontiersFor(invocation);
      if (frontiers === undefined) return undefined;
      const relevant: (Omit<SourceStorageDomainBoundary, "bindings"> & { readonly callback?: SourceStorageCallbackEntry })[] = [];
      for (const frontier of frontiers) {
        if (!budget.step()) return undefined;
        if (transport.regions.callable(frontier.subject.node, undefined).some(region => selected.has(region))) relevant.push(frontier);
      }
      return Object.freeze(relevant);
    },
    reachableFrom: (region: Node): ReadonlySet<Node> | undefined => reaching(region, "callees"),
    region: (region: Node, target: Node): boolean | undefined => reaching(target, "callers")?.has(region),
    invocation: (invocation: Node, target: Node): boolean | undefined => {
      const selected = reaching(target, "callers");
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
