import type { MessageArgument, Violation } from "../diag/contract.js";
import type { ComponentId, DefId } from "../ids/contract.js";
import { decodeBodyId, decodeComponentId } from "../ids/index.js";
import type {
  CallComponent, CallEdge, CallGraphRule, FactsSite, VerifyCallGraph,
} from "./contract.js";

const definitionSite = (definition: DefId): FactsSite => ({
  kind: "summary", summary: { definition, bindings: { kind: "parametric" } },
});

const componentSite = (component: CallComponent): FactsSite => ({ kind: "component", component: component.id });

const compareEdges = (left: CallEdge, right: CallEdge): number => {
  const leftDefinition = left.callee.kind === "definition" ? left.callee.definition : "";
  const rightDefinition = right.callee.kind === "definition" ? right.callee.definition : "";
  const leftFields = [left.caller, left.at.body, left.kind, left.callee.kind, leftDefinition];
  const rightFields = [right.caller, right.at.body, right.kind, right.callee.kind, rightDefinition];
  for (let field = 0; field < leftFields.length; field += 1) {
    const leftValue = leftFields[field];
    const rightValue = rightFields[field];
    if (leftValue !== undefined && rightValue !== undefined && leftValue !== rightValue) {
      return leftValue < rightValue ? -1 : 1;
    }
    if (field === 1 && left.at.node !== right.at.node) return left.at.node < right.at.node ? -1 : 1;
  }
  if (left.callee.kind === "open" && right.callee.kind === "open") {
    const leftOwner = left.callee.boundary.owner;
    const rightOwner = right.callee.boundary.owner;
    if (leftOwner.kind !== rightOwner.kind) return leftOwner.kind < rightOwner.kind ? -1 : 1;
    const leftName = leftOwner.kind === "body" ? leftOwner.instance.body : leftOwner.definition;
    const rightName = rightOwner.kind === "body" ? rightOwner.instance.body : rightOwner.definition;
    if (leftName !== rightName) return leftName < rightName ? -1 : 1;
    return left.callee.boundary.boundary - right.callee.boundary.boundary;
  }
  return 0;
};

const reachedMembers = (
  first: DefId,
  component: ComponentId,
  membership: ReadonlyMap<DefId, ComponentId>,
  edges: ReadonlyMap<DefId, readonly DefId[]>,
): number => {
  const pending: DefId[] = [first];
  const visited = new Set<DefId>();
  for (let cursor = 0; cursor < pending.length; cursor += 1) {
    const definition = pending[cursor];
    if (definition === undefined || visited.has(definition)) continue;
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

  const components = new Map<ComponentId, CallComponent>();
  const membership = new Map<DefId, ComponentId>();
  let previousComponent: ComponentId | undefined;
  for (const component of graph.components) {
    const site = componentSite(component);
    if (previousComponent !== undefined && previousComponent >= component.id) {
      report("components-order", site, "Components must be distinct and ordered by identity.");
    }
    previousComponent = component.id;
    components.set(component.id, component);
    const decoded = decodeComponentId(component.id);
    if (decoded.kind !== "decoded" || decoded.value.length !== component.definitions.length ||
      decoded.value.some((definition, index) => definition !== component.definitions[index])) {
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
      if (!membership.has(definition)) membership.set(definition, component.id);
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
  const dependencies = new Map<ComponentId, Set<ComponentId>>();
  for (const definition of definitions) {
    forward.set(definition, []);
    reverse.set(definition, []);
  }
  for (const component of components.values()) dependencies.set(component.id, new Set());
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
    const body = decodeBodyId(edge.at.body);
    if (body.kind !== "decoded" || body.value.owner !== edge.caller) {
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
      if (callerComponent !== undefined && calleeComponent !== undefined && callerComponent !== calleeComponent) {
        dependencies.get(callerComponent)?.add(calleeComponent);
      }
    }
  }

  for (const component of graph.components) {
    const site = componentSite(component);
    const expected = dependencies.get(component.id);
    const actual = new Set(component.dependencies);
    if (expected === undefined || expected.size !== actual.size ||
      component.dependencies.some(dependency => !components.has(dependency) || !expected.has(dependency))) {
      report("component-dependencies-exact", site, "Dependencies must be exactly the other components named by closed call edges.");
    }
    const first = component.definitions[0];
    if (first !== undefined && membership.get(first) === component.id &&
      (reachedMembers(first, component.id, membership, forward) !== component.definitions.length ||
        reachedMembers(first, component.id, membership, reverse) !== component.definitions.length)) {
      report("component-membership-exact", site, "The members of a component must be mutually reachable through actual call edges.");
    }
  }

  const remaining = new Map<ComponentId, number>();
  const dependents = new Map<ComponentId, ComponentId[]>();
  const pending: ComponentId[] = [];
  for (const component of graph.components) {
    const selected = new Set(component.dependencies.filter(dependency => components.has(dependency)));
    remaining.set(component.id, selected.size);
    if (selected.size === 0) pending.push(component.id);
    for (const dependency of selected) {
      const current = dependents.get(dependency);
      if (current === undefined) dependents.set(dependency, [component.id]);
      else current.push(component.id);
    }
  }
  const completed = new Set<ComponentId>();
  for (let cursor = 0; cursor < pending.length; cursor += 1) {
    const component = pending[cursor];
    if (component === undefined || completed.has(component)) continue;
    completed.add(component);
    const incoming = dependents.get(component);
    if (incoming === undefined) continue;
    for (const dependent of incoming) {
      const count = remaining.get(dependent);
      if (count !== undefined) {
        remaining.set(dependent, count - 1);
        if (count === 1) pending.push(dependent);
      }
    }
  }
  for (const component of graph.components) {
    if (!completed.has(component.id)) {
      report("component-acyclic", componentSite(component), "The condensation graph must be acyclic; recursion belongs inside one component.");
    }
  }
  return Object.freeze(violations);
};
