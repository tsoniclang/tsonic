import type { DataflowAccount, DataflowResult, DataflowStop } from "../dataflow/contract.js";
import { chargeResultEntries, chargeWork } from "../dataflow/index.js";
import { admitArtifactIdentity, admitOwnerIdentity, recordFinding } from "./verification.js";
import { summaryDefinition } from "./summary-key.js";
import type { Violation } from "../diag/contract.js";
import type { ComponentId, DefId } from "../ids/contract.js";
import { encodeComponentId } from "../ids/index.js";
import { artifactBindingsKey } from "../ir-types/index.js";
import type {
  CallComponent, CallEdge, CallGraphRule, FactsSite, VerifyCallGraph,
} from "./contract.js";
import { compareNumbers, ownerKey, validIndex } from "./verify-relations.js";

const definitionSite = (definition: DefId): FactsSite => ({
  kind: "definition", definition,
});

const componentSite = (component: CallComponent): FactsSite => ({ kind: "component", component: component.id });

interface ComponentWork {
  readonly occurrence: number;
  readonly component: CallComponent;
  readonly expected: Set<ComponentId>;
  readonly dependents: ComponentWork[];
  remaining: number;
}

const compareEdges = (left: CallEdge, right: CallEdge): number => {
  if (left.caller !== right.caller) return left.caller < right.caller ? -1 : 1;
  if (left.at.body !== right.at.body) return left.at.body < right.at.body ? -1 : 1;
  const nodeOrder = compareNumbers(left.at.node, right.at.node);
  if (nodeOrder !== 0) return nodeOrder;
  if (left.kind !== right.kind) return left.kind < right.kind ? -1 : 1;
  switch (left.callee.kind) {
    case "definition":
      switch (right.callee.kind) {
        case "open": return -1;
        case "definition":
          if (left.callee.definition !== right.callee.definition) return left.callee.definition < right.callee.definition ? -1 : 1;
          break;
      }
      break;
    case "open":
      switch (right.callee.kind) {
        case "definition": return 1;
        case "open": {
          const leftOwner = ownerKey(left.callee.boundary.owner);
          const rightOwner = ownerKey(right.callee.boundary.owner);
          if (leftOwner !== rightOwner) return leftOwner < rightOwner ? -1 : 1;
          const boundaryOrder = compareNumbers(left.callee.boundary.boundary, right.callee.boundary.boundary);
          if (boundaryOrder !== 0) return boundaryOrder;
          break;
        }
      }
      break;
  }
  const leftBindings = artifactBindingsKey(left.bindings);
  const rightBindings = artifactBindingsKey(right.bindings);
  return leftBindings === rightBindings ? 0 : leftBindings < rightBindings ? -1 : 1;
};

const reachedMembers = (
  first: DefId,
  component: ComponentWork,
  membership: ReadonlyMap<DefId, ComponentWork>,
  edges: ReadonlyMap<DefId, readonly DefId[]>,
  account: DataflowAccount,
): DataflowResult<number> => {
  const pending: DefId[] = [first];
  const visited = new Set<DefId>();
  for (const definition of pending) {
    const step = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
    if (step !== null) return step;
    if (visited.has(definition)) continue;
    visited.add(definition);
    const targets = edges.get(definition);
    if (targets === undefined) continue;
    for (const target of targets) {
    const step = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
    if (step !== null) return step;
      if (membership.get(target)?.occurrence === component.occurrence && !visited.has(target)) pending.push(target);
    }
  }
  return { kind: "complete", value: visited.size };
};

export const verifyCallGraph: VerifyCallGraph = (graph, context, account) => {
  const initial = chargeWork(account, 1) ?? chargeResultEntries(account, 10);
  if (initial !== null) return initial;
  const violations: Violation<CallGraphRule, FactsSite>[] = [];
  const report = (rule: CallGraphRule, site: FactsSite, text: string): DataflowStop | null =>
    recordFinding(account, violations, "last", rule, site, text);
  const definitions = new Set<DefId>();
  let previousDefinition: DefId | undefined;
  for (const definition of graph.definitions) {
    const step = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
    if (step !== null) return step;
    if (previousDefinition !== undefined && previousDefinition >= definition) {
      { const stop = report("definitions-order", definitionSite(definition), "Definitions must be distinct and ordered by identity."); if (stop !== null) return stop; }
    }
    if (!context.definitionExists(definition)) {
      { const stop = report("definition-resolves", definitionSite(definition), "The graph definition must exist in the supplied definition inventory."); if (stop !== null) return stop; }
    }
    previousDefinition = definition;
    definitions.add(definition);
  }

  const components = new Map<ComponentId, ComponentWork>();
  const membership = new Map<DefId, ComponentWork>();
  const work: ComponentWork[] = [];
  let previousComponent: ComponentId | undefined;
  for (const component of graph.components) {
    const step = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
    if (step !== null) return step;
    const site = componentSite(component);
    if (previousComponent !== undefined && previousComponent >= component.id) {
      { const stop = report("components-order", site, "Components must be distinct and ordered by identity."); if (stop !== null) return stop; }
    }
    previousComponent = component.id;
    const state: ComponentWork = { occurrence: work.length, component, expected: new Set(), dependents: [], remaining: 0 };
    work.push(state);
    components.set(component.id, state);
    let units = component.definitions.length;
    for (const definition of component.definitions) {
    const step = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
    if (step !== null) return step;
      const stop = chargeWork(account, 1 + definition.length);
      if (stop !== null) return stop;
      units += definition.length;
    }
    const identity = chargeWork(account, units) ?? chargeResultEntries(account, component.definitions.length + 5);
    if (identity !== null) return identity;
    const [first, ...rest] = component.definitions;
    if (first === undefined || encodeComponentId([first, ...rest]) !== component.id) {
      { const stop = report("component-identity", site, "The component identity must encode exactly its canonical member vector."); if (stop !== null) return stop; }
    }
    if (component.definitions.length === 0) {
      { const stop = report("component-membership-exact", site, "Every component must contain at least one graph definition."); if (stop !== null) return stop; }
    }
    let previousMember: DefId | undefined;
    for (const definition of component.definitions) {
    const step = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
    if (step !== null) return step;
      if (previousMember !== undefined && previousMember >= definition) {
        { const stop = report("component-members-order", site, "Component members must be distinct and ordered by definition identity."); if (stop !== null) return stop; }
      }
      previousMember = definition;
      if (!definitions.has(definition) || membership.has(definition)) {
        { const stop = report("component-membership-exact", site, "Each graph definition must belong to exactly one component."); if (stop !== null) return stop; }
      }
      if (!membership.has(definition)) membership.set(definition, state);
    }
    let previousDependency: ComponentId | undefined;
    for (const dependency of component.dependencies) {
    const step = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
    if (step !== null) return step;
      if (previousDependency !== undefined && previousDependency >= dependency) {
        { const stop = report("component-dependencies-order", site, "Component dependencies must be distinct and ordered by identity."); if (stop !== null) return stop; }
      }
      previousDependency = dependency;
    }
  }
  for (const definition of definitions) {
    const step = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
    if (step !== null) return step;
    if (!membership.has(definition)) {
      { const stop = report("component-membership-exact", definitionSite(definition), "Each graph definition must belong to exactly one component."); if (stop !== null) return stop; }
    }
  }

  const forward = new Map<DefId, DefId[]>();
  const reverse = new Map<DefId, DefId[]>();
  for (const definition of definitions) {
    const step = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
    if (step !== null) return step;
    forward.set(definition, []);
    reverse.set(definition, []);
  }
  let previousEdge: CallEdge | undefined;
  for (const edge of graph.edges) {
    const step = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
    if (step !== null) return step;
    const site: FactsSite = { kind: "node", at: { kind: "body", value: edge.at } };
    const identity = admitArtifactIdentity(edge.bindings, account)
      ?? chargeWork(account, edge.caller.length + edge.at.body.length
        + (edge.callee.kind === "definition" ? edge.callee.definition.length : 0))
      ?? (edge.callee.kind === "open" ? admitOwnerIdentity(edge.callee.boundary.owner, account) : null);
    if (identity !== null) return identity;
    if (previousEdge !== undefined) {
      const previousIdentity = admitArtifactIdentity(previousEdge.bindings, account)
        ?? (previousEdge.callee.kind === "open" ? admitOwnerIdentity(previousEdge.callee.boundary.owner, account) : null);
      if (previousIdentity !== null) return previousIdentity;
    }
    if (previousEdge !== undefined && compareEdges(previousEdge, edge) >= 0) {
      { const stop = report("edges-order", site, "Call edges must be distinct and ordered by caller, occurrence and callee."); if (stop !== null) return stop; }
    }
    previousEdge = edge;
    if (!definitions.has(edge.caller)) {
      { const stop = report("definition-resolves", site, "A call edge caller must be a graph definition."); if (stop !== null) return stop; }
    }
    if (!context.nodeExists({ kind: "body", value: edge.at })) {
      { const stop = report("call-site-resolves", site, "A call edge must retain an existing source occurrence."); if (stop !== null) return stop; }
    }
    if (context.bodyOwner(edge.at.body) !== edge.caller) {
      { const stop = report("cross-owner-qualified", site, "The call occurrence must belong to its actual caller definition."); if (stop !== null) return stop; }
    }
    if (edge.callee.kind === "definition") {
      const callee = edge.callee.definition;
      if (!definitions.has(callee)) {
        { const stop = report("definition-resolves", site, "A closed call edge callee must be a graph definition."); if (stop !== null) return stop; }
      }
      const outgoing = forward.get(edge.caller);
      const incoming = reverse.get(callee);
      if (outgoing !== undefined && incoming !== undefined) {
        outgoing.push(callee);
        incoming.push(edge.caller);
      }
      const callerComponent = membership.get(edge.caller);
      const calleeComponent = membership.get(callee);
      if (callerComponent !== undefined && calleeComponent !== undefined && callerComponent.component.id !== calleeComponent.component.id) {
        callerComponent.expected.add(calleeComponent.component.id);
      }
    } else {
      const owner = edge.callee.boundary.owner;
      const arena = context.arenaOf(owner);
      const actualOwner = owner.kind === "summary" ? summaryDefinition(owner.key, context) : context.bodyOwner(owner.execution.instance.body);
      if (arena === null || !validIndex(edge.callee.boundary.boundary, arena.boundaries.length) ||
        !Object.is(arena.boundaries[edge.callee.boundary.boundary]?.id, edge.callee.boundary.boundary) || actualOwner !== edge.caller) {
        { const stop = report("cross-owner-qualified", site, "An open call retains its actual caller-owned relational boundary and complete environment."); if (stop !== null) return stop; }
      }
    }
  }

  for (const state of work) {
    const step = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
    if (step !== null) return step;
    const component = state.component;
    const site = componentSite(component);
    const growth = chargeWork(account, component.dependencies.length)
      ?? chargeResultEntries(account, component.dependencies.length + 1);
    if (growth !== null) return growth;
    const actual = new Set(component.dependencies);
    let exact = state.expected.size === actual.size;
    for (const dependency of component.dependencies) {
    const step = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
    if (step !== null) return step;
      const stop = chargeWork(account, 1);
      if (stop !== null) return stop;
      if (!components.has(dependency) || !state.expected.has(dependency)) exact = false;
    }
    if (!exact) {
      { const stop = report("component-dependencies-exact", site, "Dependencies must be exactly the other components named by closed call edges."); if (stop !== null) return stop; }
    }
    const first = component.definitions[0];
    if (first !== undefined && membership.get(first)?.occurrence === state.occurrence) {
      const forwardReached = reachedMembers(first, state, membership, forward, account);
      if (forwardReached.kind !== "complete") return forwardReached;
      const reverseReached = reachedMembers(first, state, membership, reverse, account);
      if (reverseReached.kind !== "complete") return reverseReached;
      if (forwardReached.value !== component.definitions.length || reverseReached.value !== component.definitions.length)
        { const stop = report("component-membership-exact", site, "The members of a component must be mutually reachable through actual call edges."); if (stop !== null) return stop; }
    }
  }

  const pending: ComponentWork[] = [];
  for (const state of work) {
    const step = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
    if (step !== null) return step;
    const selected = new Map<number, ComponentWork>();
    for (const identity of state.component.dependencies) {
    const step = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
    if (step !== null) return step;
      const dependency = components.get(identity);
      if (dependency !== undefined) selected.set(dependency.occurrence, dependency);
    }
    state.remaining = selected.size;
    if (selected.size === 0) pending.push(state);
    for (const dependency of selected.values()) {
    const step = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
    if (step !== null) return step;
      dependency.dependents.push(state);
    }
  }
  const completed = new Set<number>();
  for (const state of pending) {
    const step = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
    if (step !== null) return step;
    completed.add(state.occurrence);
    for (const dependent of state.dependents) {
    const step = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
    if (step !== null) return step;
      dependent.remaining -= 1;
      if (dependent.remaining === 0) pending.push(dependent);
    }
  }
  for (const state of work) {
    const step = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
    if (step !== null) return step;
    if (!completed.has(state.occurrence)) {
      const stop = report("component-acyclic", componentSite(state.component), "The condensation graph must be acyclic; recursion belongs inside one component.");
      if (stop !== null) return stop;
    }
  }
  return { kind: "complete", violations };
};
