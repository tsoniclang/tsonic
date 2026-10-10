import type { TargetSourceProgram } from "../../source-semantics/index.js";
import type { SourceStorageSubject } from "./subjects.js";
import type { SourceStorageBudget, SourceStorageRows } from "./resource-budget.js";
import type { SourceStorageInvocationInputQuery } from "./invocation-inputs.js";
import type { createSourceStorageGraphQueries } from "./graph-queries.js";
import { createSourceStorageScopes } from "./scoped-scopes.js";
import { createSourceStorageScopedKeys } from "./scoped-keys.js";
import { createSourceStorageEquations } from "./scoped-equations.js";
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
  const scopes = createSourceStorageScopes(source, budget, transport.subject, invocationInputs, graphQueries);
  const keys = createSourceStorageScopedKeys(source, budget, transport, scopes);
  const equations = createSourceStorageEquations(source, budget, transport, scopes, keys.encode);
  const terms = new Map<string, SourceStorageTerm>();
  const dependencies = new Map<SourceStorageTerm, Map<SourceStorageTerm, number>>();
  const witnesses = new Map<SourceStorageTerm, Map<SourceStorageScope, Map<SourceStorageSubject, number>>>();
  const referenceTerms = { reference: new Map<SourceStorageScope, Map<SourceStorageSubject, SourceStorageTerm>>(),
    leaf: new Map<SourceStorageScope, Map<SourceStorageSubject, SourceStorageTerm>>() };
  const rows = budget.createRows();
  const witnessScope = (subject: SourceStorageSubject, scope: SourceStorageScope): SourceStorageScope => {
    if (scope === scopes.empty || subject.kind === "member") return scope;
    const region = transport.regions.enclosing(subject.node);
    const owner = subject.kind === "return" || subject.kind === "receiver" ? subject.node
      : region === undefined ? undefined : sourceStorageRegionOwner(source.ast, region);
    return owner === undefined ? scopes.empty : scopes.owningScope(scope, owner) ?? scope;
  };
  let currentRead: ((term: SourceStorageTerm) => ReadonlySet<SourceStorageTerm> | undefined) | undefined;
  const successors = createSourceStorageScopedSuccessors(source, budget, transport, scopes, equations, keys.birthKey,
    term => currentRead === undefined ? undefined : currentRead(term));
  const addWitness = (term: SourceStorageTerm, subject: SourceStorageSubject, scope: SourceStorageScope, contributes = true): boolean => {
    scope = witnessScope(subject, scope);
    const states = witnesses.get(term);
    const subjects = states?.get(scope);
    const mode = contributes ? 2 : 1;
    const previous = subjects?.get(subject);
    if (((previous ?? 0) & mode) !== 0) return true;
    if (previous === undefined && !rows.add(1 + (states === undefined ? 1 : 0) + (subjects === undefined ? 1 : 0))) return false;
    const selected = states ?? new Map<SourceStorageScope, Map<SourceStorageSubject, number>>();
    const retained = subjects ?? new Map<SourceStorageSubject, number>();
    retained.set(subject, (previous ?? 0) | mode); selected.set(scope, retained); witnesses.set(term, selected);
    return true;
  };
  const normalize = (term: SourceStorageTerm, witnesses: SourceStorageRelationWitness[], temporary: SourceStorageRows,
    contributes = true): SourceStorageTerm | undefined => {
    while (true) {
      if (!budget.step()) return undefined;
      if (term.kind === "reference" || term.kind === "leaf") {
        if (!temporary.add(1)) return undefined;
        witnesses.push({ subject: term.subject, bindings: term.scope, contributes });
      }
      if (term.kind === "reference") {
        const input = sourceStorageTransparentInput(term.subject, source.ast, transport);
        if (input !== undefined) { term = sourceStorageReference(input, term.scope); continue; }
        if (term.subject.kind === "input" || term.subject.kind === "receiver") {
          const selected = scopes.lookup(term.subject, term.scope);
          if (selected?.kind === "replace" && selected.terms.length === 1) { term = selected.terms[0]!; continue; }
        }
      }
      break;
    }
    if (term.kind === "store") {
      const receiver = normalize(term.receiver, witnesses, temporary, false); const value = normalize(term.value, witnesses, temporary, contributes);
      return receiver === undefined || value === undefined ? undefined : Object.freeze({ ...term, receiver, value });
    }
    if (term.kind === "guard") {
      const condition = normalize(term.condition, witnesses, temporary, false); const value = normalize(term.value, witnesses, temporary, contributes);
      return condition === undefined || value === undefined ? undefined : Object.freeze({ ...term, condition, value });
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
  const intern = (term: SourceStorageTerm): SourceStorageTerm | undefined => budget.withRows(temporary => {
    if (!budget.step()) return undefined;
    const index = term.kind === "reference" || term.kind === "leaf" ? referenceTerms[term.kind] : undefined;
    const subjects = index !== undefined && "scope" in term ? index.get(term.scope) : undefined;
    const cached = subjects !== undefined && "subject" in term ? subjects.get(term.subject) : undefined;
    if (cached !== undefined) return cached;
    const retained: SourceStorageRelationWitness[] = [];
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
    for (const witness of retained) if (!addWitness(selected, witness.subject, witness.bindings, witness.contributes)) return undefined;
    if (index !== undefined && "subject" in term && "scope" in term) {
      if (!rows.add(subjects === undefined ? 2 : 1)) return undefined;
      const inputs = subjects ?? new Map<SourceStorageSubject, SourceStorageTerm>();
      inputs.set(term.subject, selected); index.set(term.scope, inputs);
    }
    return selected;
  });
  const results = graphQueries.fixedPoint<SourceStorageTerm, SourceStorageTerm>((current, read, emit) => {
    const children = dependencies.get(current) ?? new Map<SourceStorageTerm, number>();
    if (!dependencies.has(current)) { if (!rows.add(1)) return false; dependencies.set(current, children); }
    const select = (term: SourceStorageTerm, values = true): ReadonlySet<SourceStorageTerm> | undefined => {
      const selected = intern(term);
      if (selected === undefined) return undefined;
      if (!children.has(selected) && !rows.add(1)) return undefined;
      children.set(selected, (children.get(selected) ?? 0) | (values ? 2 : 1));
      return read(selected);
    };
    currentRead = term => select(term, false);
    try {
      if (current.kind === "leaf" || current.kind === "effect") return emit(current);
      const selected = successors.reduce(current);
      if (selected === undefined) return budget.failure() === undefined;
      for (const dependency of selected.kind === "replace" ? selected.dependencies ?? [] : [])
        if (!budget.step() || select(dependency, false) === undefined) return false;
      for (const witness of selected.kind === "replace" ? selected.witnesses ?? [] : [])
        if (!budget.step() || !addWitness(current, witness.subject, witness.bindings)) return false;
      const alternatives = selected.kind === "expand" ? equations.expand(selected.variable, current) : selected.terms;
      if (alternatives === undefined) return false;
      for (const term of alternatives) {
        if (!budget.step()) return false;
        const inputs = select(term);
        if (inputs === undefined) return false;
        for (const input of inputs) if (!budget.step() || !emit(input)) return false;
      }
      return budget.failure() === undefined;
    } finally { currentRead = undefined; }
  });
  const selectRoot = (origin: SourceStorageSubject, scope: SourceStorageScope): SourceStorageTerm | undefined => intern(sourceStorageReference(origin, scope));
  const values = (origin: SourceStorageSubject, scope: SourceStorageScope): ReadonlySet<SourceStorageBoundSubject> | undefined => scopes.withQuery(() => {
    const root = selectRoot(origin, scope);
    const selected = root === undefined ? undefined : results(root);
    if (selected === undefined) return undefined;
    const values = new Set<SourceStorageBoundSubject>();
    for (const value of selected) {
      if (!budget.step()) return undefined;
      if (value.kind === "leaf") values.add(Object.freeze({ subject: value.subject, bindings: value.scope }));
    }
    return values;
  });
  const origins = (origin: SourceStorageSubject, scope: SourceStorageScope): ReadonlySet<SourceStorageSubject> | undefined => scopes.withQuery(() => {
    const root = selectRoot(origin, scope);
    const selected = root === undefined ? undefined : results(root);
    if (selected === undefined) return undefined;
    const subjects = new Set<SourceStorageSubject>();
    for (const value of selected) {
      if (!budget.step()) return undefined;
      if (value.kind === "leaf") subjects.add(value.subject);
    }
    return subjects;
  });
  const walk = (origin: SourceStorageSubject, scope: SourceStorageScope,
    stopAt?: (subject: SourceStorageBoundSubject) => boolean) => scopes.withQuery(() => budget.withRows(temporary => {
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
      for (const [scope, inputs] of witnesses.get(current) ?? []) {
        const retained = subjects.get(scope) ?? new Map<SourceStorageSubject, number>();
        for (const [input, mode] of inputs) {
          if (!budget.step()) return undefined;
          if (!retained.has(input) && !temporary.add(1)) return undefined;
          const contributes = entry.collect && (mode & 2) !== 0;
          retained.set(input, (retained.get(input) ?? 0) | (contributes ? 2 : 1));
          if (contributes && stopAt?.({ subject: input, bindings: scope })) { origins.add(input); stopped = true; }
        }
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
  }));
  const trace = (origin: SourceStorageSubject, scope: SourceStorageScope): readonly SourceStorageRelationWitness[] | undefined =>
    walk(origin, scope)?.subjects;
  const selection = (origin: SourceStorageSubject, scope: SourceStorageScope): readonly SourceStorageBoundSubject[] | undefined => scopes.withQuery(() => {
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
  });
  return Object.freeze({ empty: scopes.empty, values, origins, trace, walk, selection, formals: scopes.formals,
    isBound: (origin: SourceStorageSubject, scope: SourceStorageScope): boolean =>
      scopes.withQuery(() => scopes.lookup(origin, scope) !== undefined),
    forInvocation: scopes.frameFor, identityFor: scopes.identity });
}
