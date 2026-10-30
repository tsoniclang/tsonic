import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
import { sourceConstructionExpression } from "../../../source-navigation/class-initialization.js";
import type { SourceStorageCallbackEntry, SourceStorageDomainBoundary } from "../model/types.js";
import type { SourceStorageReference, SourceStorageScope, SourceStorageScopedSubject as SourceStorageBoundSubject, SourceStorageTerm } from "../graph/scoped-model.js";
import { sourceStorageReference } from "../graph/scoped-model.js";
import type { SourceStorageScopes } from "./scoped-scopes.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import { sourceStorageFormalOwner } from "../model/subjects.js";
import { sourceStorageNativeCallablePayloads } from "../graph/invocation-inputs.js";

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

export function sourceStorageExecutionDemands(transport: SourceStorageScopedTransport, scopes: SourceStorageScopes,
  budget: SourceStorageBudget, demand: Node, context: SourceStorageScope | undefined, deferred: boolean,
  execution?: SourceStorageTerm): readonly SourceStorageTerm[] | undefined {
  if (execution !== undefined) return [execution];
  const roots = context === undefined ? [] : scopes.executionRoots(context);
  if (roots === undefined) return undefined;
  if (roots.length === 0) return [Object.freeze({ kind: "execution-root", demand, deferred })];
  const selected: SourceStorageTerm[] = [];
  for (const root of roots) for (const region of transport.regions.callable(root.owner, root.invocation,
    undefined, root.callback, undefined, "active")) {
    if (!budget.step()) return undefined;
    selected.push(Object.freeze({ kind: "region", region, scope: root.scope, demand, deferred }));
  }
  return selected;
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
        if (transport.pointerInvocations.has(invocation)) {
          const pointerAccessors = transport.pointerAccessors(invocation);
          if (pointerAccessors === undefined) return undefined;
          for (const candidate of pointerAccessors) {
            if (!budget.step()) return undefined;
            for (const child of transport.regions.callable(candidate, undefined)) if (!add(child)) return undefined;
          }
        }
        if (transport.invocationEffects.get(invocation)?.resumeReceiver === true) {
          const resumed = transport.resumedImplementations(invocation);
          if (resumed === undefined) return undefined;
          for (const candidate of resumed) {
            if (!budget.step()) return undefined;
            const body = source.ast.body(candidate);
            if (body === undefined || !add(body)) return undefined;
          }
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
        if (sourceConstructionExpression(invocation, source, budget.step) !== undefined) {
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
        if (frontier.subject === frontier.owner ||
          transport.regions.callable(frontier.subject.node, undefined).some(region => selected.has(region))) relevant.push(frontier);
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

export function createSourceStorageInputExecutions(source: TargetSourceProgram, budget: SourceStorageBudget,
  transport: SourceStorageScopedTransport, scopes: SourceStorageScopes,
  reachability: ReturnType<typeof createSourceStorageExecutionReachability>,
  readRelation: (term: SourceStorageTerm) => ReadonlySet<SourceStorageTerm> | undefined) {
  const leaf = (subject: SourceStorageSubject, scope: SourceStorageScope): SourceStorageReference => Object.freeze({ kind: "leaf", subject, scope });
  const conditionalExecutions = (roots: Iterable<SourceStorageTerm>, demand: Node, exposure: Node,
    reasons: { readonly value: { readonly reason: string; readonly executionOnly: boolean };
      readonly effect: string | undefined }, retainProducers: boolean): readonly SourceStorageTerm[] | undefined => {
    const selected = transport.subjectFor(demand);
    const terms: SourceStorageTerm[] = [];
    for (const result of walkSourceStorageExecution(budget, roots, readRelation)) {
      if (!budget.step()) return undefined;
      if (result.kind === "unresolved") terms.push(result);
      else if (result.kind === "leaf" && result.subject === selected) {
        if (retainProducers) terms.push(result);
        const uncertainty: Extract<SourceStorageTerm, { readonly kind: "unresolved" }> = {
          kind: "unresolved", subject: result.subject, scope: result.scope, exposure, reason: reasons.value.reason,
          ...(reasons.value.executionOnly ? { executionOnly: true } : {}),
        };
        terms.push(Object.freeze(uncertainty));
      } else if (result.kind === "effect" && result.store.region === demand) {
        if (retainProducers) terms.push(result);
        if (reasons.effect !== undefined) terms.push(Object.freeze({ kind: "unresolved", subject: result.store.storage,
          scope: result.scope, exposure, reason: reasons.effect, effectOnly: true }));
      }
    }
    return budget.failure() === undefined ? Object.freeze(terms) : undefined;
  };
  const nativeInputExecutions = (invocation: Node, scope: SourceStorageScope, demand: Node, deferred: boolean | undefined,
    callback?: { readonly entry: SourceStorageCallbackEntry; readonly subject: SourceStorageSubject;
      readonly bindings: SourceStorageScope }): readonly SourceStorageTerm[] | undefined => {
    const frontiers = reachability.frontiers(invocation, demand);
    if (frontiers === undefined) return undefined;
    if (frontiers.length === 0 && callback === undefined) return Object.freeze([]);
    const contexts = scopes.executionRoots(scope);
    if (contexts === undefined) return undefined;
    const terms: SourceStorageTerm[] = [];
    const selected = transport.subjectFor(demand);
    let covered = false;
    let incomplete = false;
    const uncertain = (bindings: SourceStorageScope, reason: string, exposure: Node): boolean => {
      if (selected !== undefined) terms.push(Object.freeze({ kind: "unresolved", subject: selected, scope: bindings, reason, exposure }));
      else for (const store of transport.storesIn(demand) ?? []) {
        if (!budget.step()) return false;
        terms.push(Object.freeze({ kind: "unresolved", subject: store.storage, scope: bindings, reason, exposure }));
      }
      return budget.failure() === undefined;
    };
    for (const frontier of frontiers) {
      if (!budget.step()) return undefined;
      if (callback === undefined ? frontier.callback !== undefined
        : frontier.callback !== callback.entry || frontier.owner !== callback.subject) continue;
      const owner = frontier.owner === undefined ? undefined : sourceStorageFormalOwner(frontier.owner, source);
      const actual = callback === undefined || owner === undefined ? undefined
        : scopes.boundActivation(callback.bindings, owner)?.nativeEntry;
      if (callback !== undefined) {
        if (actual === undefined) { incomplete = true; continue; }
        if (actual.invocation !== frontier.exposure) continue;
      }
      let matched = false;
      for (const context of contexts) {
        if (!budget.step()) return undefined;
        if (owner === undefined || context.owner !== owner) continue;
        const activation = scopes.boundActivation(context.scope, owner);
        const native = activation?.nativeEntry;
        if (native?.invocation !== frontier.exposure) {
          if (context.scope.kind === "variable" && context.callback !== undefined &&
            transport.callbackEntriesFor(frontier.exposure).includes(context.callback))
            if (!uncertain(context.scope, "A relevant native callback input requires its completed same-activation value correspondence.",
              frontier.exposure)) return undefined;
          continue;
        }
        if (actual !== undefined && (native.callback !== actual.callback || native.caller !== actual.caller)) continue;
        matched = true;
        covered = true;
        if (native.callback.timing === "deferred" && !deferred) continue;
        const payloads = sourceStorageNativeCallablePayloads(source, budget, frontier.exposure, native.caller, {
          subjectFor: transport.subjectFor, inputsFor: transport.incomingFor, callbackEntriesFor: transport.callbackEntriesFor,
          componentsFor: transport.memberFlow.componentsFor,
          hasOnlySourceImplementations: transport.hasOnlySourceImplementations,
          componentFor: (value, component) => transport.subject(value.subject.node, value.subject.kind, [...value.subject.projection, component]),
          valuesFor: (subject, bindings) => {
            const selected = readRelation(sourceStorageReference(subject, bindings));
            if (selected === undefined) return undefined;
            const values: SourceStorageBoundSubject[] = [];
            let complete = true;
            for (const value of selected) {
              if (!budget.step()) return undefined;
              if (value.kind === "leaf") values.push({ subject: value.subject, bindings: value.scope });
              else if (value.kind === "unresolved") complete = false;
            }
            return { values, complete };
          },
        });
        if (payloads === undefined) return undefined;
        if (!payloads.complete) {
          for (const value of payloads.uncertain) if (!uncertain(value.bindings,
            "A relevant native callback input requires its actual source payload and creation correspondence.", frontier.exposure)) return undefined;
          if (payloads.uncertain.length === 0 && !uncertain(native.caller,
            "A relevant native callback input requires its actual source payload and creation correspondence.", frontier.exposure)) return undefined;
        }
        for (const value of payloads.values) {
          if (!budget.step()) return undefined;
          if (frontier.subject !== frontier.owner && value.subject !== frontier.subject) continue;
          if (frontier.callback?.timing === "deferred" && !deferred) continue;
          const possible: SourceStorageTerm = Object.freeze({ kind: "application", invocation, activation: Object.freeze({ kind: "invoke" }),
            callee: leaf(value.subject, value.bindings), scope, projection: [],
            ...(frontier.callback === undefined ? {} : { callback: frontier.callback }),
            mode: "execution", demand, deferred });
          const conditional = conditionalExecutions([possible], demand, frontier.exposure, {
            value: { reason: "A relevant source callable crosses a native input without completed value and capture correspondence.",
              executionOnly: false },
            effect: "A relevant source effect crosses a native input without completed value and capture correspondence.",
          }, false);
          if (conditional === undefined) return undefined;
          terms.push(...conditional);
        }
      }
      if (callback !== undefined && !matched) incomplete = true;
    }
    if (callback !== undefined && (!covered || incomplete)) {
      if (selected === undefined) return undefined;
      terms.push(Object.freeze({ kind: "unresolved", subject: selected, scope, exposure: invocation,
        reason: "A native callback entry requires its exact original source implementation and capture context." }));
    }
    return budget.failure() !== undefined ? undefined : Object.freeze(terms);
  };
  return Object.freeze({ conditionalExecutions, nativeInputExecutions });
}
