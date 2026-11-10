import type { MessageArgument, Violation } from "../diag/contract.js";
import type { ComponentId, DefId } from "../ids/contract.js";
import { encodeComponentId, encodeKey } from "../ids/index.js";
import type {
  CallComponent, CallEdge, CallGraphRule, FactsSite, VerifyCallGraph,
} from "./contract.js";
import { artifactData, ownerKey, validIndex } from "./verify-relations.js";

const definitionSite = (definition: DefId): FactsSite => ({
  kind: "summary", summary: { definition, bindings: { kind: "parametric" } },
});

const componentSite = (component: CallComponent): FactsSite => ({ kind: "component", component: component.id });

interface ComponentWork {
  readonly component: CallComponent;
  readonly expected: Set<ComponentId>;
  readonly dependents: ComponentWork[];
  remaining: number;
}

const compareEdges = (left: CallEdge, right: CallEdge): number => {
  if (left.caller !== right.caller) return left.caller < right.caller ? -1 : 1;
  if (left.at.body !== right.at.body) return left.at.body < right.at.body ? -1 : 1;
  if (left.at.node !== right.at.node) return left.at.node < right.at.node ? -1 : 1;
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
          if (left.callee.boundary.boundary !== right.callee.boundary.boundary) return left.callee.boundary.boundary - right.callee.boundary.boundary;
          break;
        }
      }
      break;
  }
  const leftBindings = encodeKey(artifactData(left.bindings));
  const rightBindings = encodeKey(artifactData(right.bindings));
  return leftBindings === rightBindings ? 0 : leftBindings < rightBindings ? -1 : 1;
};

const reachedMembers = (
  first: DefId,
  component: ComponentWork,
  membership: ReadonlyMap<DefId, ComponentWork>,
  edges: ReadonlyMap<DefId, readonly DefId[]>,
): number => {
  const pending: DefId[] = [first];
  const visited = new Set<DefId>();
  for (const definition of pending) {
    if (visited.has(definition)) continue;
    visited.add(definition);
    const targets = edges.get(definition);
    if (targets === undefined) continue;
    for (const target of targets) {
      if (membership.get(target) === component && !visited.has(target)) pending.push(target);
    }
  }
  return visited.size;
};

export const verifyCallGraph: VerifyCallGraph = (graph, context) => {
  const violations: Violation<CallGraphRule, FactsSite>[] = [];
  const report = (rule: CallGraphRule, site: FactsSite, text: string): void => {
    const detail: MessageArgument = Object.freeze({ kind: "text", value: text });
    violations.push(Object.freeze({ rule, site, detail: Object.freeze([detail]) }));
  };
  const definitions = new Set<DefId>();
  let previousDefinition: DefId | undefined;
  for (const definition of graph.definitions) {
    if (previousDefinition !== undefined && previousDefinition >= definition) {
      report("definitions-order", definitionSite(definition), "Definitions must be distinct and ordered by identity.");
    }
    if (!context.definitionExists(definition)) {
      report("definition-resolves", definitionSite(definition), "The graph definition must exist in the supplied definition inventory.");
    }
    previousDefinition = definition;
    definitions.add(definition);
  }

  const components = new Map<ComponentId, ComponentWork>();
  const membership = new Map<DefId, ComponentWork>();
  const work: ComponentWork[] = [];
  let previousComponent: ComponentId | undefined;
  for (const component of graph.components) {
    const site = componentSite(component);
    if (previousComponent !== undefined && previousComponent >= component.id) {
      report("components-order", site, "Components must be distinct and ordered by identity.");
    }
    previousComponent = component.id;
    const state: ComponentWork = { component, expected: new Set(), dependents: [], remaining: 0 };
    work.push(state);
    components.set(component.id, state);
    const [first, ...rest] = component.definitions;
    if (first === undefined || encodeComponentId([first, ...rest]) !== component.id) {
      report("component-identity", site, "The component identity must encode exactly its canonical member vector.");
    }
    if (component.definitions.length === 0) {
      report("component-membership-exact", site, "Every component must contain at least one graph definition.");
    }
    let previousMember: DefId | undefined;
    for (const definition of component.definitions) {
      if (previousMember !== undefined && previousMember >= definition) {
        report("component-members-order", site, "Component members must be distinct and ordered by definition identity.");
      }
      previousMember = definition;
      if (!definitions.has(definition) || membership.has(definition)) {
        report("component-membership-exact", site, "Each graph definition must belong to exactly one component.");
      }
      if (!membership.has(definition)) membership.set(definition, state);
    }
    let previousDependency: ComponentId | undefined;
    for (const dependency of component.dependencies) {
      if (previousDependency !== undefined && previousDependency >= dependency) {
        report("component-dependencies-order", site, "Component dependencies must be distinct and ordered by identity.");
      }
      previousDependency = dependency;
    }
  }
  for (const definition of definitions) {
    if (!membership.has(definition)) {
      report("component-membership-exact", definitionSite(definition), "Each graph definition must belong to exactly one component.");
    }
  }

  const forward = new Map<DefId, DefId[]>();
  const reverse = new Map<DefId, DefId[]>();
  for (const definition of definitions) {
    forward.set(definition, []);
    reverse.set(definition, []);
  }
  let previousEdge: CallEdge | undefined;
  for (const edge of graph.edges) {
    const site: FactsSite = { kind: "node", at: edge.at };
    if (previousEdge !== undefined && compareEdges(previousEdge, edge) >= 0) {
      report("edges-order", site, "Call edges must be distinct and ordered by caller, occurrence and callee.");
    }
    previousEdge = edge;
    if (!definitions.has(edge.caller)) {
      report("definition-resolves", site, "A call edge caller must be a graph definition.");
    }
    if (!context.nodeExists({ kind: "body", value: edge.at })) {
      report("call-site-resolves", site, "A call edge must retain an existing source occurrence.");
    }
    if (context.bodyOwner(edge.at.body) !== edge.caller) {
      report("cross-owner-qualified", site, "The call occurrence must belong to its actual caller definition.");
    }
    if (edge.callee.kind === "definition") {
      const callee = edge.callee.definition;
      if (!definitions.has(callee)) {
        report("definition-resolves", site, "A closed call edge callee must be a graph definition.");
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
      const actualOwner = owner.kind === "summary" ? owner.definition : context.tirBody(owner.instance).owner;
      if (arena === null || !validIndex(edge.callee.boundary.boundary, arena.boundaries.length) || actualOwner !== edge.caller) {
        report("cross-owner-qualified", site, "An open call retains its actual caller-owned relational boundary and complete environment.");
      }
    }
  }

  for (const state of work) {
    const component = state.component;
    const site = componentSite(component);
    const actual = new Set(component.dependencies);
    if (state.expected.size !== actual.size ||
      component.dependencies.some(dependency => !components.has(dependency) || !state.expected.has(dependency))) {
      report("component-dependencies-exact", site, "Dependencies must be exactly the other components named by closed call edges.");
    }
    const first = component.definitions[0];
    if (first !== undefined && membership.get(first) === state &&
      (reachedMembers(first, state, membership, forward) !== component.definitions.length ||
        reachedMembers(first, state, membership, reverse) !== component.definitions.length)) {
      report("component-membership-exact", site, "The members of a component must be mutually reachable through actual call edges.");
    }
  }

  const pending: ComponentWork[] = [];
  for (const state of work) {
    const selected = new Set<ComponentWork>();
    for (const identity of state.component.dependencies) {
      const dependency = components.get(identity);
      if (dependency !== undefined) selected.add(dependency);
    }
    state.remaining = selected.size;
    if (selected.size === 0) pending.push(state);
    for (const dependency of selected) {
      dependency.dependents.push(state);
    }
  }
  const completed = new Set<ComponentWork>();
  for (const state of pending) {
    completed.add(state);
    for (const dependent of state.dependents) {
      dependent.remaining -= 1;
      if (dependent.remaining === 0) pending.push(dependent);
    }
  }
  for (const state of work) {
    if (!completed.has(state)) {
      report("component-acyclic", componentSite(state.component), "The condensation graph must be acyclic; recursion belongs inside one component.");
    }
  }
  return Object.freeze(violations);
};
