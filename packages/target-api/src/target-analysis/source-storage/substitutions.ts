import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/index.js";
import type { SourceStorageSubject, SourceStorageSubjectQuery } from "./subjects.js";
import { sourceStorageHasOriginalCallableValue } from "./subjects.js";
import type { SourceStorageIncomingQuery } from "./edges.js";
import type { SourceStorageBudget } from "./resource-budget.js";
import type { SourceStorageInvocationResultQueriesContract } from "./invocation-results.js";
import type { SourceStorageInvocationInputQuery } from "./invocation-inputs.js";
import { createSourceStorageContextPorts } from "./context-ports.js";
import type { createSourceStorageGraphQueries } from "./graph-queries.js";

export interface SourceStorageBoundSelection {
  readonly inputs: ReadonlySet<SourceStorageSubject>;
  readonly forwarded: ReadonlySet<SourceStorageSubject>;
  readonly context: SourceStorageSubstitutions;
}

export type SourceStorageSubstitutions = ReadonlyMap<SourceStorageSubject, SourceStorageBoundSelection>;

export interface SourceStorageBoundSubject {
  readonly subject: SourceStorageSubject;
  readonly bindings: SourceStorageSubstitutions;
}

export function createSourceStorageSubstitutions(
  source: TargetSourceProgram,
  budget: SourceStorageBudget,
  subject: SourceStorageSubjectQuery,
  incoming: SourceStorageIncomingQuery,
  invocationInputs: SourceStorageInvocationInputQuery,
  contextualInputs: (origin: SourceStorageSubject) => ReadonlySet<SourceStorageSubject> | undefined,
  invocationResults: SourceStorageInvocationResultQueriesContract,
  graphQueries: ReturnType<typeof createSourceStorageGraphQueries>,
  memberInputs: (subject: SourceStorageSubject, bindings: SourceStorageSubstitutions) => readonly SourceStorageBoundSubject[] | undefined,
) {
  const step = budget.step;
  const reserveRow = budget.row;
  const contextPorts = createSourceStorageContextPorts(budget, contextualInputs);
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
  const boundSubjects = new WeakMap<SourceStorageSubstitutions, Map<SourceStorageSubject, SourceStorageBoundSubject>>();
  const boundSubject = (subject: SourceStorageSubject, bindings: SourceStorageSubstitutions): SourceStorageBoundSubject | undefined => {
    if (!step()) return undefined;
    const subjects = boundSubjects.get(bindings);
    const cached = subjects?.get(subject);
    if (cached !== undefined) return cached;
    if (!reserveRow() || subjects === undefined && !reserveRow()) return undefined;
    const selected = Object.freeze({ subject, bindings });
    const retained = subjects ?? new Map<SourceStorageSubject, SourceStorageBoundSubject>();
    retained.set(subject, selected);
    boundSubjects.set(bindings, retained);
    return selected;
  };
  let currentRead: ((subject: SourceStorageBoundSubject) => ReadonlySet<SourceStorageBoundSubject> | undefined) | undefined;
  const selectedValues = graphQueries.fixedPoint<SourceStorageBoundSubject, SourceStorageBoundSubject>((current, read, emit) => {
    const add = (subject: SourceStorageSubject, bindings: SourceStorageSubstitutions): boolean => {
      const selected = boundSubject(subject, bindings);
      const inputs = selected === undefined ? undefined : read(selected);
      if (inputs === undefined) return false;
      for (const input of inputs) {
        if (!step()) return false;
        if (!emit(input)) return false;
      }
      return true;
    };
    currentRead = read;
    try {
      const bound = selection(current.subject, current.bindings);
      if (bound !== undefined) {
        for (const input of bound.inputs) if (!step() || !add(input, bound.context)) return false;
        return true;
      }
      const parents = incoming(current.subject);
      const allocation = invocationResults.hasAllocation(current.subject);
      if (allocation && !emit(current)) return false;
      const results = invocationResults.select(current.subject, current.bindings) ?? memberInputs(current.subject, current.bindings);
      if (results !== undefined) {
        for (const result of results) if (!step() || !add(result.subject, result.bindings)) return false;
        return true;
      }
      if (!allocation && (parents.size === 0 || sourceStorageHasOriginalCallableValue(current.subject, source.ast)) && !emit(current)) return false;
      for (const parent of parents) if (!step() || !add(parent, current.bindings)) return false;
      return true;
    } finally {
      currentRead = undefined;
    }
  });
  const values = (origin: SourceStorageSubject, bindings: SourceStorageSubstitutions): ReadonlySet<SourceStorageBoundSubject> | undefined => {
    const selected = boundSubject(origin, bindings);
    if (selected === undefined) return undefined;
    return currentRead === undefined ? selectedValues(selected) : currentRead(selected);
  };
  const origins = (origin: SourceStorageSubject, bindings: SourceStorageSubstitutions): ReadonlySet<SourceStorageSubject> | undefined => {
    const selected = values(origin, bindings);
    if (selected === undefined) return undefined;
    const origins = new Set<SourceStorageSubject>();
    for (const value of selected) { if (!step()) return undefined; origins.add(value.subject); }
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
    const selected = Object.freeze({ inputs: project(binding.inputs), forwarded: project(binding.forwarded), context: binding.context });
    const selections = projectedSelections.get(bindings) ?? new Map<SourceStorageSubject, SourceStorageBoundSelection>();
    selections.set(origin, selected);
    projectedSelections.set(bindings, selections);
    return selected;
  };
  const forwardingSelection = (origin: SourceStorageSubject, bindings: SourceStorageSubstitutions) => budget.withRows(rows => {
    const forwarded = new Set<SourceStorageSubject>();
    let current = origin;
    while (step()) {
      if (forwarded.has(current)) return undefined;
      const binding = selection(current, bindings);
      if (binding !== undefined) return { binding, forwarded };
      if (current.kind !== "value" || sourceStorageHasOriginalCallableValue(current, source.ast) ||
        source.ast.is.IsCallExpression(current.node) || source.ast.is.IsNewExpression(current.node) ||
        source.ast.is.IsPropertyAccessExpression(current.node) || source.ast.is.IsElementAccessExpression(current.node)) return undefined;
      const parents = incoming(current);
      if (parents.size !== 1 || !rows.add(1)) return undefined;
      forwarded.add(current);
      current = parents.values().next().value!;
    }
    return undefined;
  });
  const intern = (selected: SourceStorageSubstitutions): SourceStorageSubstitutions | undefined => {
    if (selected.size === 0) return empty;
    const entries: { readonly formal: number; readonly inputs: readonly number[];
      readonly forwarded: readonly number[]; readonly context: number }[] = [];
    for (const [formal, binding] of selected) {
      if (!step()) return undefined;
      const inputIndexes: number[] = [];
      const forwardedIndexes: number[] = [];
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
      entries.push({ formal: identity(formal),
        inputs: inputIndexes.sort((left, right) => left - right), forwarded: forwardedIndexes.sort((left, right) => left - right), context });
    }
    entries.sort((left, right) => left.formal - right.formal);
    const key = entries.map(entry => `${entry.formal}:${entry.inputs.join(",")}:${entry.forwarded.join(",")}:${entry.context}`).join(";");
    const cached = bindingSets.get(key);
    if (cached !== undefined) return cached;
    for (const entry of entries) {
      if (!reserveRow()) return undefined;
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
        else {
          const inputs = contextPorts.isPort(current) ? contextualInputs(current) : [current];
          if (inputs === undefined) return undefined;
          for (const input of inputs) {
            if (!step()) return undefined;
            const ports = contextPorts.firstPorts(input);
            if (ports === undefined) return undefined;
            for (const port of ports) {
              if (!step()) return undefined;
              if (!scheduled.has(port)) {
                if (!rows.add(1)) return undefined;
                scheduled.add(port);
                pending.push(port);
              }
            }
          }
        }
      }
      return intern(selected);
    });
  };
  const forInvocation = (candidate: Node, invocation: Node, parent: SourceStorageSubstitutions,
    captured: SourceStorageSubstitutions): SourceStorageSubstitutions | undefined => {
    if (!step()) return undefined;
    const selected = new Map<SourceStorageSubject, SourceStorageBoundSelection>();
    for (const [formal, binding] of parent) {
      if (!step()) return undefined;
      selected.set(formal, binding);
    }
    if (captured !== parent) for (const [formal, binding] of captured) {
      if (!step()) return undefined;
      selected.set(formal, binding);
    }
    const parameters = source.ast.is.IsClassDeclaration(candidate) || source.ast.is.IsClassExpression(candidate)
      ? [] : source.ast.parameters(candidate);
    for (const parameter of [...parameters, candidate]) {
      if (parameter === undefined) continue;
      if (!step()) return undefined;
      const formal = subject(parameter, parameter === candidate ? "receiver" : "input");
      if (formal === undefined) return undefined;
      const selectedInputs = invocationInputs(formal, candidate, invocation);
      const inputs = selectedInputs.subjects;
      const input = inputs.size === 1 ? inputs.values().next().value : undefined;
      const caller = selectedInputs.context === "callee" ? intern(new Map(selected)) : parent;
      if (caller === undefined) return undefined;
      const forwarded = input === undefined ? undefined : forwardingSelection(input, caller);
      if (forwarded !== undefined) selected.set(formal, Object.freeze({ inputs: forwarded.binding.inputs,
        forwarded: new Set([...forwarded.binding.forwarded, ...forwarded.forwarded, input!]), context: forwarded.binding.context }));
      else {
        const context = contextFor(inputs, caller);
        if (context === undefined) return undefined;
        selected.set(formal, Object.freeze({ inputs, forwarded: new Set<SourceStorageSubject>(), context }));
      }
    }
    return intern(selected);
  };
  return Object.freeze({ empty, values, origins, forInvocation, selection, identityFor: (state: SourceStorageSubstitutions) => contexts.get(state) });
}
