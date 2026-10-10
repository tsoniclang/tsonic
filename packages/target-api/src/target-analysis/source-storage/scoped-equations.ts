import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/index.js";
import { targetStronglyConnectedComponents } from "../graph-components.js";
import type { SourceStorageBudget } from "./resource-budget.js";
import { sourceStorageHasOriginalCallableValue } from "./subjects.js";
import { sourceStorageReference } from "./scoped-model.js";
import type { SourceStorageEquation, SourceStorageScope, SourceStorageTerm, SourceStorageVariable } from "./scoped-model.js";
import type { SourceStorageScopes } from "./scoped-scopes.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
import { sourceStorageRegionOwner } from "./lexical-regions.js";

export function createSourceStorageEquations(source: TargetSourceProgram, budget: SourceStorageBudget,
  transport: SourceStorageScopedTransport, scopes: SourceStorageScopes, keyFor: (term: SourceStorageTerm) => string | undefined) {
  const rows = budget.createRows();
  const edges = new Map<Node, { readonly invocation: Node; readonly candidate: Node }[]>();
  const vertices = new Set<Node>();
  const recursive = new Map<Node, ReadonlySet<Node>>();
  const equations = new Map<string, SourceStorageEquation>();
  let initialized = false;
  const ownerFor = (invocation: Node): Node | undefined => {
    const region = transport.regions.enclosing(invocation);
    return region === undefined ? undefined : sourceStorageRegionOwner(source.ast, region);
  };
  const initialize = (): void => {
    if (initialized) return;
    initialized = true;
    for (const invocation of [...transport.invocations, ...transport.accessorTargets.keys()]) {
      if (!budget.step()) return;
      const owner = ownerFor(invocation);
      if (owner === undefined) continue;
      if (!vertices.has(owner)) { if (!rows.add(1)) return; vertices.add(owner); }
      const targets = edges.get(owner) ?? [];
      if (!edges.has(owner) && !rows.add(1)) return;
      for (const candidate of transport.invocationImplementations(invocation)) {
        if (!budget.step()) return;
        if (!vertices.has(candidate)) { if (!rows.add(1)) return; vertices.add(candidate); }
        if (!rows.add(1)) return;
        targets.push(Object.freeze({ invocation, candidate }));
      }
      edges.set(owner, targets);
    }
    budget.withRows(temporary => {
      if (vertices.size !== 0 && !temporary.add(7 * vertices.size)) return;
      const components = targetStronglyConnectedComponents(vertices, owner => (edges.get(owner) ?? []).map(edge => edge.candidate), budget.step);
      if (components.kind !== "resolved") { budget.reject(components.reason); return; }
      for (const members of components.components) {
        if (!budget.step()) return;
        if (members.length === 1 && !(edges.get(members[0]!) ?? []).some(edge => edge.candidate === members[0])) continue;
        if (!rows.add(1 + members.length)) return;
        const component = new Set(members);
        for (const member of members) { if (!budget.step()) return; recursive.set(member, component); }
      }
    });
  };
  const scopeFor = (candidate: Node, invocation: Node, caller: SourceStorageScope,
    captured: SourceStorageScope, term: SourceStorageTerm): SourceStorageScope | undefined => {
    initialize();
    if (!budget.step()) return undefined;
    const component = recursive.get(candidate);
    if (component === undefined) return scopes.frameFor(candidate, invocation, caller, captured);
    const previous = scopes.family(caller);
    const owner = ownerFor(invocation);
    let equation: SourceStorageEquation | undefined;
    if (previous?.component === component && owner !== undefined && component.has(owner)) equation = previous;
    else {
      const key = keyFor(term);
      if (key === undefined) return undefined;
      equation = equations.get(key);
      if (equation === undefined) {
        const initial = scopes.frameFor(candidate, invocation, caller, captured);
        if (initial === undefined || !rows.add(1)) return undefined;
        equation = Object.freeze({ identity: equations.size, component, entry: candidate, initial });
        equations.set(key, equation);
      }
    }
    return scopes.variable(equation, candidate);
  };
  const expand = (variable: SourceStorageVariable, term: SourceStorageTerm): readonly SourceStorageTerm[] | undefined => {
    initialize();
    const { equation, owner } = variable;
    const alternatives: SourceStorageTerm[] = [];
    const replace = (scope: SourceStorageScope): SourceStorageTerm | undefined => scopes.applyTerm(term, new Map([[variable, scope]]));
    if (owner === equation.entry) {
      const initial = replace(equation.initial);
      if (initial === undefined) return undefined;
      alternatives.push(initial);
    }
    for (const caller of equation.component) for (const edge of edges.get(caller) ?? []) {
      if (!budget.step()) return undefined;
      if (edge.candidate !== owner) continue;
      const previous = scopes.variable(equation, caller);
      const target = transport.invocationTargets.get(edge.invocation);
      if (previous === undefined || target === undefined) return undefined;
      const frame = scopes.frameFor(owner, edge.invocation, previous, previous);
      const value = frame === undefined ? undefined : replace(frame);
      if (value === undefined) return undefined;
      const selected = sourceStorageHasOriginalCallableValue(target, source.ast) ? source.navigation.callableImplementation(target.node) : undefined;
      if (selected?.kind === "resolved") {
        if (selected.implementation.declaration === owner) alternatives.push(value);
      } else alternatives.push(Object.freeze({ kind: "guard", candidate: owner,
        condition: sourceStorageReference(target, previous), value }));
    }
    return Object.freeze(alternatives);
  };
  return Object.freeze({ scopeFor, expand });
}
