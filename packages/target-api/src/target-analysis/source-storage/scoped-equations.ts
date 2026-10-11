import type { Node } from "@tsonic/tsts";
import type { SourceStorageBudget } from "./resource-budget.js";
import { sourceStorageReference } from "./scoped-model.js";
import type { SourceStorageEquation, SourceStorageScope, SourceStorageTerm, SourceStorageVariable } from "./scoped-model.js";
import type { SourceStorageScopes } from "./scoped-scopes.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
import type { SourceStorageScopedRecursion } from "./scoped-recursion.js";

export function createSourceStorageEquations(budget: SourceStorageBudget,
  transport: SourceStorageScopedTransport, scopes: SourceStorageScopes, recursion: SourceStorageScopedRecursion,
  keyFor: (term: Extract<SourceStorageTerm, { readonly kind: "application" }>) => string | undefined) {
  const rows = budget.createRows();
  const equations = new Map<string, SourceStorageEquation>();
  const scopeFor = (candidate: Node, invocation: Node, caller: SourceStorageScope,
    captured: SourceStorageScope, term: Extract<SourceStorageTerm, { readonly kind: "application" }>): SourceStorageScope | undefined => {
    if (!budget.step()) return undefined;
    const component = recursion.componentFor(candidate);
    if (budget.failure() !== undefined) return undefined;
    if (component === undefined) return scopes.frameFor(candidate, invocation, caller, captured);
    const previous = scopes.family(caller);
    const owner = recursion.ownerFor(invocation);
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
    if (variable.capture !== undefined) {
      budget.reject("Source storage captures require their exact selected callee before continuation.");
      return undefined;
    }
    const { equation, owner } = variable;
    const alternatives: SourceStorageTerm[] = [];
    const replace = (scope: SourceStorageScope): SourceStorageTerm | undefined => scopes.applyTerm(term, new Map([[variable, scope]]));
    if (owner === equation.entry) {
      const entry = equation.initial;
      if (entry.kind !== "frame" || entry.owner !== owner || entry.invocation === undefined || entry.caller === undefined) {
        budget.reject("Source storage equations require their exact initial invocation frame."); return undefined;
      }
      const scope = scopes.frameFor(owner, entry.invocation, entry.caller, entry.parents[0] ?? entry.caller, equation);
      const initial = scope === undefined ? undefined : replace(scope);
      if (initial === undefined) return undefined;
      alternatives.push(initial);
    }
    for (const caller of equation.component) for (const edge of recursion.edgesFor(caller)) {
      if (!budget.step()) return undefined;
      if (edge.candidate !== owner) continue;
      const previous = scopes.variable(equation, caller);
      const target = transport.invocationTargets.get(edge.invocation);
      if (previous === undefined || target === undefined) return undefined;
      const capture = scopes.variable(equation, owner, edge.invocation);
      const frame = capture === undefined ? undefined : scopes.frameFor(owner, edge.invocation, previous, capture, equation);
      const value = frame === undefined ? undefined : replace(frame);
      if (capture === undefined || value === undefined) return undefined;
      alternatives.push(Object.freeze({ kind: "transition", capture,
        condition: sourceStorageReference(target, previous), value }));
    }
    return Object.freeze(alternatives);
  };
  return Object.freeze({ scopeFor, expand });
}
