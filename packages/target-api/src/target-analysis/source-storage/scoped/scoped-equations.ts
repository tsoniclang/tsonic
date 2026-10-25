import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import { sourceStorageSuperConstructor } from "../model/construction.js";
import { sourceStorageHasOriginalCallableValue, type SourceStorageSubject } from "../model/subjects.js";
import { sourceStorageReference } from "../graph/scoped-model.js";
import type { SourceStorageEquation, SourceStorageScope, SourceStorageTerm, SourceStorageVariable } from "../graph/scoped-model.js";
import type { SourceStorageScopes } from "./scoped-scopes.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
import type { SourceStorageScopedRecursion } from "./scoped-recursion.js";

export function createSourceStorageEquations(source: TargetSourceProgram, budget: SourceStorageBudget,
  transport: SourceStorageScopedTransport, scopes: SourceStorageScopes, recursion: SourceStorageScopedRecursion,
  keyFor: (term: Extract<SourceStorageTerm, { readonly kind: "application" }>) => string | undefined) {
  const rows = budget.createRows();
  const equations = new Map<Node, Map<string, SourceStorageEquation>>();
  let nextIdentity = 0;
  const scopeFor = (candidate: Node, invocation: Node, caller: SourceStorageScope,
    captured: SourceStorageScope, term: Extract<SourceStorageTerm, { readonly kind: "application" }>): SourceStorageScope | undefined => {
    if (!budget.step()) return undefined;
    if (term.activation.kind === "entered") {
      const entered = scopes.boundActivation(term.activation.scope, candidate);
      return entered?.invocation === invocation ? entered.scope : undefined;
    }
    const component = recursion.componentFor(candidate);
    if (budget.failure() !== undefined) return undefined;
    if (component === undefined) return scopes.frameFor(candidate, invocation, caller, captured, undefined, term.callback);
    const previous = scopes.family(caller);
    const owner = recursion.ownerFor(invocation);
    if (previous?.component === component && owner !== undefined && component.has(owner)) {
      const parent = sourceStorageSuperConstructor(invocation, source, budget.step) === undefined
        ? scopes.variable(previous, owner) : caller;
      return parent === undefined ? undefined : scopes.frameFor(candidate, invocation, parent, captured, previous, term.callback);
    }
    const key = keyFor(term);
    if (key === undefined) return undefined;
    const entries = equations.get(candidate);
    let equation = entries?.get(key);
    if (equation === undefined) {
      const initial = scopes.frameFor(candidate, invocation, caller, captured, undefined, term.callback);
      if (initial === undefined || !rows.add(entries === undefined ? 2 : 1)) return undefined;
      equation = Object.freeze({ identity: nextIdentity++, component, entry: candidate, initial });
      const selected = entries ?? new Map<string, SourceStorageEquation>();
      selected.set(key, equation);
      equations.set(candidate, selected);
    }
    return scopes.frameFor(candidate, invocation, caller, captured, equation, term.callback);
  };
  const expand = (variable: SourceStorageVariable, term: SourceStorageTerm,
    read: (term: SourceStorageTerm) => ReadonlySet<SourceStorageTerm> | undefined): readonly SourceStorageTerm[] | undefined => {
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
      const scope = scopes.frameFor(owner, entry.invocation, entry.caller, entry.parents[0] ?? entry.caller, equation, entry.callback);
      const initial = scope === undefined ? undefined : replace(scope);
      if (initial === undefined) return undefined;
      alternatives.push(initial);
    }
    const callers = recursion.incomingFor(owner);
    if (callers === undefined) return undefined;
    let supplierTarget: SourceStorageSubject | undefined;
    let supplierScope: SourceStorageScope | undefined;
    let supplierValues: ReadonlySet<SourceStorageTerm> | undefined;
    for (const site of callers) {
      if (!budget.step()) return undefined;
      const caller = site.caller;
      if (!equation.component.has(caller)) continue;
      const previous = scopes.variable(equation, caller);
      const target = site.callback?.argument.actual ?? transport.invocationTargets.get(site.invocation);
      if (previous === undefined || target === undefined) return undefined;
      const host = site.callback === undefined ? target : transport.invocationTargets.get(site.invocation);
      if (host === undefined) return undefined;
      if (host !== supplierTarget || previous !== supplierScope) {
        supplierTarget = host;
        supplierScope = previous;
        supplierValues = read(sourceStorageReference(host, previous));
      }
      if (supplierValues === undefined) return undefined;
      if (supplierValues.size === 0) continue;
      let excluded = true;
      for (const supplier of supplierValues) {
        if (!budget.step()) return undefined;
        const selected = supplier.kind === "leaf" && sourceStorageHasOriginalCallableValue(supplier.subject, source.ast)
          ? source.navigation.callableImplementation(supplier.subject.node) : undefined;
        if (selected?.kind !== "resolved" || (site.callback === undefined
          ? selected.implementation.declaration === owner : source.ast.body(selected.implementation.declaration) === undefined)) {
          excluded = false;
          break;
        }
      }
      if (excluded) continue;
      const capture = scopes.variable(equation, owner, site.invocation, site.callback);
      const frame = capture === undefined ? undefined : scopes.frameFor(owner, site.invocation, previous, capture, equation, site.callback);
      const value = frame === undefined ? undefined : replace(frame);
      if (capture === undefined || value === undefined) return undefined;
      alternatives.push(Object.freeze({ kind: "transition", capture,
        condition: sourceStorageReference(target, previous), value }));
    }
    return Object.freeze(alternatives);
  };
  return Object.freeze({ scopeFor, expand });
}
