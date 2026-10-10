import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/index.js";
import type { SourceStorageSubject, SourceStorageSubjectQuery } from "./subjects.js";
import { sourceStorageHasOriginalCallableValue } from "./subjects.js";
import type { SourceStorageIncomingQuery } from "./edges.js";
import type { SourceStorageBudget } from "./resource-budget.js";

export interface SourceStorageBoundSelection {
  readonly actuals: ReadonlySet<SourceStorageSubject>;
  readonly inputs: ReadonlySet<SourceStorageSubject>;
  readonly forwarded: ReadonlySet<SourceStorageSubject>;
  readonly context: SourceStorageSubstitutions;
}

export type SourceStorageSubstitutions = ReadonlyMap<SourceStorageSubject, SourceStorageBoundSelection>;

export function createSourceStorageSubstitutions(
  source: TargetSourceProgram,
  budget: SourceStorageBudget,
  subject: SourceStorageSubjectQuery,
  incoming: SourceStorageIncomingQuery,
  invocationOrigins: (origin: SourceStorageSubject, candidate: Node, invocation: Node) => ReadonlySet<SourceStorageSubject>,
  contextualInputs: (origin: SourceStorageSubject) => ReadonlySet<SourceStorageSubject>,
) {
  const step = budget.step;
  const reserveRow = budget.row;
  const empty: SourceStorageSubstitutions = new Map();
  const bindingSets = new Map<string, SourceStorageSubstitutions>();
  const contexts = new WeakMap<SourceStorageSubstitutions, number>();
  contexts.set(empty, 0);
  const identities = new Map<SourceStorageSubject, number>();
  const identity = (subject: SourceStorageSubject): number => {
    let selected = identities.get(subject);
    if (selected === undefined) { selected = identities.size; identities.set(subject, selected); }
    return selected;
  };
  const origins = (origin: SourceStorageSubject, bindings: SourceStorageSubstitutions): ReadonlySet<SourceStorageSubject> => {
    const remaining = [origin];
    const checked = new Set<SourceStorageSubject>();
    const origins = new Set<SourceStorageSubject>();
    while (remaining.length !== 0 && step()) {
      const selected = remaining.pop()!;
      if (checked.has(selected)) continue;
      checked.add(selected);
      const bound = selection(selected, bindings);
      if (bound !== undefined) {
        for (const actual of bound.actuals) {
          if (!step()) break;
          if (bindings.has(selected)) origins.add(actual);
          else if (!checked.has(actual)) remaining.push(actual);
        }
        continue;
      }
      const parents = incoming(selected);
      if (parents.size === 0 || sourceStorageHasOriginalCallableValue(selected, source.ast)) origins.add(selected);
      for (const parent of parents) { if (!step()) break; remaining.push(parent); }
    }
    return origins;
  };
  const projectedSelections = new WeakMap<SourceStorageSubstitutions, Map<SourceStorageSubject, SourceStorageBoundSelection>>();
  const selection = (origin: SourceStorageSubject, bindings: SourceStorageSubstitutions): SourceStorageBoundSelection | undefined => {
    const exact = bindings.get(origin);
    if (exact !== undefined || origin.projection.length === 0) return exact;
    const cached = projectedSelections.get(bindings)?.get(origin);
    if (cached !== undefined) return cached;
    const root = subject(origin.node, origin.kind);
    const binding = root === undefined ? undefined : bindings.get(root);
    if (binding === undefined || !reserveRow()) return undefined;
    const project = (values: ReadonlySet<SourceStorageSubject>): ReadonlySet<SourceStorageSubject> => {
      const result = new Set<SourceStorageSubject>();
      for (const value of values) {
        if (!step()) break;
        const selected = subject(value.node, value.kind, [...value.projection, ...origin.projection]);
        if (selected !== undefined) result.add(selected);
      }
      return result;
    };
    const selected = Object.freeze({ actuals: project(binding.actuals), inputs: project(binding.inputs), forwarded: project(binding.forwarded), context: binding.context });
    const selections = projectedSelections.get(bindings) ?? new Map<SourceStorageSubject, SourceStorageBoundSelection>();
    selections.set(origin, selected);
    projectedSelections.set(bindings, selections);
    return selected;
  };
  const intern = (selected: SourceStorageSubstitutions): SourceStorageSubstitutions | undefined => {
    if (selected.size === 0) return empty;
    const entries: { readonly formal: number; readonly actuals: readonly number[]; readonly inputs: readonly number[];
      readonly forwarded: readonly number[]; readonly context: number }[] = [];
    for (const [formal, binding] of selected) {
      if (!step()) return undefined;
      const indexes: number[] = [];
      const inputIndexes: number[] = [];
      const forwardedIndexes: number[] = [];
      for (const actual of binding.actuals) {
        if (!step()) return undefined;
        indexes.push(identity(actual));
      }
      for (const input of binding.inputs) {
        if (!step()) return undefined;
        inputIndexes.push(identity(input));
      }
      for (const input of binding.forwarded) {
        if (!step()) return undefined;
        forwardedIndexes.push(identity(input));
      }
      const context = contexts.get(binding.context);
      if (context === undefined) return undefined;
      entries.push({ formal: identity(formal), actuals: indexes.sort((left, right) => left - right),
        inputs: inputIndexes.sort((left, right) => left - right), forwarded: forwardedIndexes.sort((left, right) => left - right), context });
    }
    entries.sort((left, right) => left.formal - right.formal);
    const key = entries.map(entry => `${entry.formal}:${entry.actuals.join(",")}:${entry.inputs.join(",")}:${entry.forwarded.join(",")}:${entry.context}`).join(";");
    const cached = bindingSets.get(key);
    if (cached !== undefined) return cached;
    for (const entry of entries) {
      if (!reserveRow()) return undefined;
      for (let index = 0; index < entry.actuals.length; index += 1) if (!reserveRow()) return undefined;
      for (let index = 0; index < entry.inputs.length; index += 1) if (!reserveRow()) return undefined;
      for (let index = 0; index < entry.forwarded.length; index += 1) if (!reserveRow()) return undefined;
    }
    contexts.set(selected, bindingSets.size + 1);
    bindingSets.set(key, selected);
    return selected;
  };
  const contextFor = (inputs: ReadonlySet<SourceStorageSubject>, parent: SourceStorageSubstitutions): SourceStorageSubstitutions | undefined => {
    if (parent.size === 0) return empty;
    const selected = new Map<SourceStorageSubject, SourceStorageBoundSelection>();
    return budget.withRows(rows => {
      if (inputs.size !== 0 && !rows.add(inputs.size)) return undefined;
      const scheduled = new Set(inputs);
      const pending = [...scheduled];
      while (pending.length !== 0) {
        if (!step()) return undefined;
        const current = pending.pop()!;
        const bound = selection(current, parent);
        if (bound !== undefined) selected.set(current, bound);
        else for (const input of contextualInputs(current)) {
          if (!step()) return undefined;
          if (!scheduled.has(input)) {
            if (!rows.add(1)) return undefined;
            scheduled.add(input);
            pending.push(input);
          }
        }
      }
      return intern(selected);
    });
  };
  const forInvocation = (candidate: Node, invocation: Node, parent: SourceStorageSubstitutions): SourceStorageSubstitutions | undefined => {
    if (!step()) return undefined;
    const selected = new Map<SourceStorageSubject, SourceStorageBoundSelection>();
    for (const [formal, binding] of parent) {
      if (!step()) return undefined;
      selected.set(formal, binding);
    }
    const parameters = source.ast.is.IsClassDeclaration(candidate) || source.ast.is.IsClassExpression(candidate)
      ? [] : source.ast.parameters(candidate);
    for (const parameter of [...parameters, candidate]) {
      if (parameter === undefined) continue;
      if (!step()) return undefined;
      const formal = subject(parameter, parameter === candidate ? "receiver" : "value");
      if (formal === undefined) return undefined;
      const actuals = new Set<SourceStorageSubject>();
      const inputs = invocationOrigins(formal, candidate, invocation);
      for (const origin of inputs) {
        for (const value of origins(origin, parent)) {
          if (!step()) return undefined;
          actuals.add(value);
        }
      }
      const input = inputs.size === 1 ? inputs.values().next().value : undefined;
      const forwarded = input === undefined ? undefined : selection(input, parent);
      if (forwarded !== undefined) selected.set(formal, Object.freeze({ actuals, inputs: forwarded.inputs,
        forwarded: new Set([...forwarded.forwarded, input!]), context: forwarded.context }));
      else {
        const context = contextFor(inputs, parent);
        if (context === undefined) return undefined;
        selected.set(formal, Object.freeze({ actuals, inputs, forwarded: new Set<SourceStorageSubject>(), context }));
      }
    }
    return intern(selected);
  };
  return Object.freeze({ empty, origins, forInvocation, selection });
}
