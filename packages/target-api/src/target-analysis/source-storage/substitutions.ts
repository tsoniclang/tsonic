import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/index.js";
import type { SourceStorageSubject, SourceStorageSubjectQuery } from "./subjects.js";
import type { SourceStorageIncomingQuery } from "./edges.js";

export interface SourceStorageBoundSelection {
  readonly actuals: ReadonlySet<SourceStorageSubject>;
  readonly inputs: ReadonlySet<SourceStorageSubject>;
  readonly context: SourceStorageSubstitutions;
}

export type SourceStorageSubstitutions = ReadonlyMap<SourceStorageSubject, SourceStorageBoundSelection>;

export function createSourceStorageSubstitutions(
  source: TargetSourceProgram,
  step: () => boolean,
  subject: SourceStorageSubjectQuery,
  incoming: SourceStorageIncomingQuery,
  invocationOrigins: (origin: SourceStorageSubject, candidate: Node, invocation: Node) => ReadonlySet<SourceStorageSubject>,
  reserveRow: () => boolean,
) {
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
      if (parents.size === 0) origins.add(selected);
      else for (const parent of parents) { if (!step()) break; remaining.push(parent); }
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
    const selected = Object.freeze({ actuals: project(binding.actuals), inputs: project(binding.inputs), context: binding.context });
    const selections = projectedSelections.get(bindings) ?? new Map<SourceStorageSubject, SourceStorageBoundSelection>();
    selections.set(origin, selected);
    projectedSelections.set(bindings, selections);
    return selected;
  };
  const forInvocation = (candidate: Node, invocation: Node, parent: SourceStorageSubstitutions): SourceStorageSubstitutions | undefined => {
    const selected = new Map<SourceStorageSubject, SourceStorageBoundSelection>();
    for (const [formal, binding] of parent) {
      if (!step()) return undefined;
      selected.set(formal, binding);
    }
    const parameters = source.ast.is.IsClassDeclaration(candidate) || source.ast.is.IsClassExpression(candidate)
      ? [] : source.ast.parameters(candidate);
    for (const parameter of [...parameters, candidate]) {
      if (parameter === undefined || !step()) continue;
      const formal = subject(parameter, parameter === candidate ? "receiver" : "value");
      if (formal === undefined) return undefined;
      const actual = new Set<SourceStorageSubject>();
      const inputs = invocationOrigins(formal, candidate, invocation);
      for (const origin of inputs) {
        for (const value of origins(origin, parent)) {
          if (!step()) return undefined;
          actual.add(value);
        }
      }
      selected.set(formal, Object.freeze({ actuals: actual, inputs, context: parent }));
    }
    const entries: { readonly formal: number; readonly actuals: readonly number[]; readonly inputs: readonly number[]; readonly context: number }[] = [];
    for (const [formal, binding] of selected) {
      if (!step()) return undefined;
      const indexes: number[] = [];
      const inputIndexes: number[] = [];
      for (const actual of binding.actuals) {
        if (!step()) return undefined;
        indexes.push(identity(actual));
      }
      for (const input of binding.inputs) {
        if (!step()) return undefined;
        inputIndexes.push(identity(input));
      }
      const context = contexts.get(binding.context);
      if (context === undefined) return undefined;
      entries.push({ formal: identity(formal), actuals: indexes.sort((left, right) => left - right),
        inputs: inputIndexes.sort((left, right) => left - right), context });
    }
    entries.sort((left, right) => left.formal - right.formal);
    const key = entries.map(entry => `${entry.formal}:${entry.actuals.join(",")}:${entry.inputs.join(",")}:${entry.context}`).join(";");
    const cached = bindingSets.get(key);
    if (cached !== undefined) return cached;
    for (const entry of entries) {
      if (!reserveRow()) return undefined;
      for (let index = 0; index < entry.actuals.length; index += 1) if (!reserveRow()) return undefined;
      for (let index = 0; index < entry.inputs.length; index += 1) if (!reserveRow()) return undefined;
    }
    contexts.set(selected, bindingSets.size + 1);
    bindingSets.set(key, selected);
    return selected;
  };
  return Object.freeze({ empty, origins, forInvocation, selection });
}
