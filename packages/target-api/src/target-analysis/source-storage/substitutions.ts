import type { TargetSourceProgram } from "../../source-semantics/index.js";
import type { SourceStorageSubject } from "./subjects.js";
import type { SourceStorageBudget, SourceStorageRows } from "./resource-budget.js";
import type { SourceStorageInvocationInputQuery } from "./invocation-inputs.js";
import type { createSourceStorageGraphQueries } from "./graph-queries.js";
import { createSourceStorageScopes } from "./scoped-scopes.js";
import { createSourceStorageScopedKeys } from "./scoped-keys.js";
import { createSourceStorageEquations } from "./scoped-equations.js";
import { createSourceStorageScopedRecursion } from "./scoped-recursion.js";
import { createSourceStorageScopedSuccessors } from "./scoped-successors.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
import { sourceStorageTransparentInput } from "./scoped-transport.js";
import type { SourceStorageScope, SourceStorageTerm, SourceStorageScopedSubject, SourceStorageRelationWitness } from "./scoped-model.js";
import { sourceStorageReference } from "./scoped-model.js";
import { sourceStorageRegionOwner } from "./lexical-regions.js";

export type SourceStorageSubstitutions = SourceStorageScope;
export type SourceStorageBoundSubject = SourceStorageScopedSubject;

export function createSourceStorageSubstitutions(source: TargetSourceProgram, budget: SourceStorageBudget,
  transport: SourceStorageScopedTransport, invocationInputs: SourceStorageInvocationInputQuery,
  graphQueries: ReturnType<typeof createSourceStorageGraphQueries>) {
  const recursion = createSourceStorageScopedRecursion(source, budget, transport, invocationInputs);
  const scopes = createSourceStorageScopes(source, budget, transport.subject, invocationInputs, graphQueries, recursion.entryInputFor);
  const keys = createSourceStorageScopedKeys(source, budget, transport, scopes);
  const equations = createSourceStorageEquations(budget, transport, scopes, recursion, keys.invocation);
  const terms = new Map<string, SourceStorageTerm>();
  const dependencies = new Map<SourceStorageTerm, Map<SourceStorageTerm, number>>();
  interface ReferenceCell extends SourceStorageScopedSubject {
    reference?: SourceStorageTerm;
    leaf?: SourceStorageTerm;
  }
  interface NormalizedWitness {
    readonly reference: ReferenceCell;
    readonly contributes: boolean;
  }
  const references = new Map<SourceStorageSubject, Map<SourceStorageScope, ReferenceCell>>();
  const witnesses = new Map<SourceStorageTerm, Map<ReferenceCell, number>>();
  const rows = budget.createRows();
  const referenceFor = (subject: SourceStorageSubject, bindings: SourceStorageScope): ReferenceCell | undefined => {
    if (!budget.step()) return undefined;
    const contexts = references.get(subject);
    const cached = contexts?.get(bindings);
    if (cached !== undefined) return cached;
    if (!rows.add(contexts === undefined ? 3 : 2)) return undefined;
    const reference: ReferenceCell = { subject, bindings };
    const selected = contexts ?? new Map<SourceStorageScope, ReferenceCell>();
    selected.set(bindings, reference); references.set(subject, selected);
    return reference;
  };
  const emptyTerm: SourceStorageTerm = Object.freeze({ kind: "empty" });
  const witnessScope = (subject: SourceStorageSubject, scope: SourceStorageScope): SourceStorageScope => {
    if (scope === scopes.empty || subject.kind === "member") return scope;
    const region = transport.regions.enclosing(subject.node);
    const owner = subject.kind === "return" || subject.kind === "receiver" ? subject.node
      : region === undefined ? undefined : sourceStorageRegionOwner(source.ast, region);
    return owner === undefined ? scopes.empty : scopes.owningScope(scope, owner) ?? scope;
  };
  let currentRead: ((term: SourceStorageTerm) => ReadonlySet<SourceStorageTerm> | undefined) | undefined;
  const successors = createSourceStorageScopedSuccessors(source, budget, transport, scopes, equations, keys.birthKey, keys.closed,
    term => currentRead === undefined ? undefined : currentRead(term));
  const addWitness = (term: SourceStorageTerm, reference: ReferenceCell, contributes = true): boolean => {
    if (budget.failure() !== undefined) return false;
    const states = witnesses.get(term);
    const mode = contributes ? 2 : 1;
    const previous = states?.get(reference);
    if (((previous ?? 0) & mode) !== 0) return true;
    if (previous === undefined && !rows.add(states === undefined ? 2 : 1)) return false;
    const selected = states ?? new Map<ReferenceCell, number>();
    selected.set(reference, (previous ?? 0) | mode); witnesses.set(term, selected);
    return true;
  };
  const normalize = (term: SourceStorageTerm, witnesses: NormalizedWitness[], temporary: SourceStorageRows,
    contributes = true): SourceStorageTerm | undefined => {
    while (true) {
      if (term.kind === "reference" || term.kind === "leaf") {
        const reference = referenceFor(term.subject, witnessScope(term.subject, term.scope));
        if (reference === undefined || !temporary.add(1)) return undefined;
        witnesses.push({ reference, contributes });
      } else if (!budget.step()) return undefined;
      if (term.kind === "reference") {
        const input = sourceStorageTransparentInput(term.subject, source.ast, transport);
        if (input !== undefined) { term = sourceStorageReference(input, term.scope); continue; }
        if (term.subject.kind === "input" || term.subject.kind === "receiver") {
          const selected = scopes.lookup(term.subject, term.scope);
          if (selected?.kind === "replace" && selected.terms.length === 1) { term = selected.terms[0]!; continue; }
        }
      }
      if (term.kind === "transition") {
        const condition = normalize(term.condition, witnesses, temporary, false);
        if (condition === undefined) return undefined;
        term = Object.freeze({ ...term, condition });
        if (condition.kind === "leaf") {
          const selected = successors.reduce(term);
          if (selected === undefined) return undefined;
          if (selected.kind === "replace" && selected.terms.length === 0) return emptyTerm;
          if (selected.kind === "replace" && selected.terms.length === 1) { term = selected.terms[0]!; continue; }
        }
      }
      break;
    }
    if (term.kind === "store") {
      const receiver = normalize(term.receiver, witnesses, temporary, false); const value = normalize(term.value, witnesses, temporary, contributes);
      return receiver === undefined || value === undefined ? undefined : Object.freeze({ ...term, receiver, value });
    }
    if (term.kind === "transition") {
      const value = normalize(term.value, witnesses, temporary, contributes);
      return value === undefined ? undefined : Object.freeze({ ...term, value });
    }
    if (term.kind === "member") {
      const receiver = normalize(term.receiver, witnesses, temporary, false);
      return receiver === undefined ? undefined : Object.freeze({ ...term, receiver });
    }
    if (term.kind === "application") {
      const callee = normalize(term.callee, witnesses, temporary, false);
      return callee === undefined ? undefined : Object.freeze({ ...term, callee });
    }
    if (term.kind === "reference" && term.subject.kind === "value" &&
      !source.ast.is.IsNewExpression(term.subject.node) && !source.ast.is.IsPropertyAccessExpression(term.subject.node) &&
      !source.ast.is.IsElementAccessExpression(term.subject.node) && !transport.invocations.has(term.subject.node) &&
      !transport.accessorTargets.has(term.subject.node) && transport.storedValuesFor(term.subject) === undefined &&
      transport.incomingFor(term.subject).size === 0) {
      return Object.freeze({ kind: "leaf", subject: term.subject, scope: witnessScope(term.subject, term.scope) });
    }
    return term;
  };
  const intern = (term: SourceStorageTerm): SourceStorageTerm | undefined => scopes.withQuery(() => budget.withRows(temporary => {
    const reference = term.kind === "reference" || term.kind === "leaf" ? referenceFor(term.subject, term.scope) : undefined;
    if (reference === undefined && !budget.step()) return undefined;
    if (budget.failure() !== undefined) return undefined;
    const cached = term.kind === "reference" || term.kind === "leaf" ? reference?.[term.kind] : undefined;
    if (cached !== undefined) return cached;
    const retained: NormalizedWitness[] = [];
    const normalized = normalize(term, retained, temporary);
    if (normalized === undefined) return undefined;
    const key = keys.encode(normalized);
    if (key === undefined) return undefined;
    let selected = terms.get(key);
    if (selected === undefined) {
      if (!rows.add(2)) return undefined;
      selected = normalized;
      terms.set(key, selected);
    }
    if (selected.kind !== "empty") for (const witness of retained)
      if (!addWitness(selected, witness.reference, witness.contributes)) return undefined;
    if (reference !== undefined && (term.kind === "reference" || term.kind === "leaf")) reference[term.kind] = selected;
    return selected;
  }));
  const results = graphQueries.fixedPoint<SourceStorageTerm, SourceStorageTerm>((current, read, emit) => scopes.withQuery(() => {
    const children = dependencies.get(current) ?? new Map<SourceStorageTerm, number>();
    if (!dependencies.has(current)) { if (!rows.add(1)) return false; dependencies.set(current, children); }
    const retain = (term: SourceStorageTerm, values = true): SourceStorageTerm | undefined => {
      const selected = intern(term);
      if (selected === undefined) return undefined;
      if (!children.has(selected) && !rows.add(1)) return undefined;
      children.set(selected, (children.get(selected) ?? 0) | (values ? 2 : 1));
      return selected;
    };
    const select = (term: SourceStorageTerm, values = true): ReadonlySet<SourceStorageTerm> | undefined => {
      const selected = retain(term, values);
      return selected === undefined ? undefined : read(selected);
    };
    currentRead = term => select(term, false);
    try {
      if (current.kind === "leaf" || current.kind === "effect") return emit(current);
      const selected = successors.reduce(current);
      if (selected === undefined) return budget.failure() === undefined;
      for (const dependency of selected.kind === "replace" ? selected.dependencies ?? [] : [])
        if (!budget.step() || select(dependency, false) === undefined) return false;
      for (const witness of selected.kind === "replace" ? selected.witnesses ?? [] : []) {
        const reference = referenceFor(witness.subject, witnessScope(witness.subject, witness.bindings));
        if (reference === undefined || !addWitness(current, reference)) return false;
      }
      const alternatives = selected.kind === "expand" ? equations.expand(selected.variable, current) : selected.terms;
      if (alternatives === undefined) return false;
      let operation: SourceStorageTerm = current;
      while (operation.kind === "transition") {
        if (!budget.step()) return false;
        operation = operation.value;
      }
      const execution = operation.kind === "execution-root" || operation.kind === "region" ||
        (operation.kind === "application" || operation.kind === "member") && operation.mode === "execution";
      for (const term of alternatives) {
        if (!budget.step()) return false;
        if (execution) {
          const successor = retain(term, false);
          if (successor === undefined || !emit(successor)) return false;
          continue;
        }
        const inputs = select(term);
        if (inputs === undefined) return false;
        for (const input of inputs) if (!budget.step() || !emit(input)) return false;
      }
      return budget.failure() === undefined;
    } finally { currentRead = undefined; }
  }));
  const selectRoot = (origin: SourceStorageSubject, scope: SourceStorageScope): SourceStorageTerm | undefined => intern(sourceStorageReference(origin, scope));
  const values = (origin: SourceStorageSubject, scope: SourceStorageScope): ReadonlySet<SourceStorageBoundSubject> | undefined => {
    const root = selectRoot(origin, scope);
    const selected = root === undefined ? undefined : results(root);
    if (selected === undefined) return undefined;
    const values = new Set<SourceStorageBoundSubject>();
    for (const value of selected) {
      if (!budget.step()) return undefined;
      if (value.kind === "leaf") values.add(Object.freeze({ subject: value.subject, bindings: value.scope }));
    }
    return values;
  };
  const origins = (origin: SourceStorageSubject, scope: SourceStorageScope): ReadonlySet<SourceStorageSubject> | undefined => {
    const root = selectRoot(origin, scope);
    const selected = root === undefined ? undefined : results(root);
    if (selected === undefined) return undefined;
    const subjects = new Set<SourceStorageSubject>();
    for (const value of selected) {
      if (!budget.step()) return undefined;
      if (value.kind === "leaf") subjects.add(value.subject);
    }
    return subjects;
  };
  const walk = (origin: SourceStorageSubject, scope: SourceStorageScope,
    stopAt?: (subject: SourceStorageBoundSubject) => boolean) => budget.withRows(temporary => {
    const root = selectRoot(origin, scope);
    if (root === undefined || results(root) === undefined) return undefined;
    const visited = new Map<SourceStorageTerm, number>(); const pending = [{ term: root, collect: true }];
    const subjects = new Map<SourceStorageScope, Map<SourceStorageSubject, number>>();
    const origins = new Set<SourceStorageSubject>();
    while (pending.length !== 0) {
      if (!budget.step()) return undefined;
      const entry = pending.pop()!; const current = entry.term;
      const flag = entry.collect ? 2 : 1;
      if (((visited.get(current) ?? 0) & flag) !== 0) continue;
      if (!temporary.add(1)) return undefined;
      visited.set(current, (visited.get(current) ?? 0) | flag);
      let stopped = false;
      for (const [reference, mode] of witnesses.get(current) ?? []) {
        const { subject: input, bindings: scope } = reference;
        const retained = subjects.get(scope) ?? new Map<SourceStorageSubject, number>();
        if (!budget.step()) return undefined;
        if (!retained.has(input) && !temporary.add(1)) return undefined;
        const contributes = entry.collect && (mode & 2) !== 0;
        retained.set(input, (retained.get(input) ?? 0) | (contributes ? 2 : 1));
        if (contributes && stopAt?.({ subject: input, bindings: scope })) { origins.add(input); stopped = true; }
        subjects.set(scope, retained);
      }
      if (stopped) continue;
      if (entry.collect && current.kind === "leaf") origins.add(current.subject);
      for (const [child, mode] of dependencies.get(current) ?? []) {
        if (!budget.step()) return undefined;
        if (child.kind !== "execution-root") pending.push({ term: child, collect: entry.collect && (mode & 2) !== 0 });
      }
    }
    const selected: SourceStorageRelationWitness[] = [];
    for (const [scope, inputs] of subjects) for (const [subject, mode] of inputs) {
      if (!budget.step()) return undefined;
      selected.push(Object.freeze({ subject, bindings: scope, contributes: (mode & 2) !== 0 }));
    }
    return Object.freeze({ subjects: Object.freeze(selected), origins });
  });
  const trace = (origin: SourceStorageSubject, scope: SourceStorageScope): readonly SourceStorageRelationWitness[] | undefined =>
    walk(origin, scope)?.subjects;
  const selection = (origin: SourceStorageSubject, scope: SourceStorageScope): readonly SourceStorageBoundSubject[] | undefined => {
    const selected = scopes.lookup(origin, scope);
    if (selected === undefined) return undefined;
    if (selected.kind === "expand") {
      const inputs = values(origin, scope);
      return inputs === undefined ? undefined : Object.freeze([...inputs]);
    }
    const inputs: SourceStorageBoundSubject[] = [];
    for (const input of selected.terms) {
      if (!budget.step()) return undefined;
      if (input.kind !== "reference" && input.kind !== "leaf") return undefined;
      inputs.push(Object.freeze({ subject: input.subject, bindings: input.scope }));
    }
    return Object.freeze(inputs);
  };
  return Object.freeze({ empty: scopes.empty, values, origins, trace, walk, selection, formals: scopes.formals,
    isBound: (origin: SourceStorageSubject, scope: SourceStorageScope): boolean =>
      scopes.withQuery(() => scopes.lookup(origin, scope) !== undefined),
    forInvocation: scopes.frameFor, identityFor: scopes.identity });
}
