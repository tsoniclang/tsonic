import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/index.js";
import type { SourceStorageSubject } from "./subjects.js";
import { sourceStorageHasOriginalValue } from "./subjects.js";
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
import type { SourceStorageValueGuards } from "./guarded-values.js";

export type SourceStorageSubstitutions = SourceStorageScope;
export type SourceStorageBoundSubject = SourceStorageScopedSubject;

interface SourceStorageRelation {
  readonly children: Map<SourceStorageTerm, number>;
  filter?: { readonly reference: Node; readonly input: SourceStorageTerm };
  complete: boolean;
}

export function createSourceStorageSubstitutions(source: TargetSourceProgram, budget: SourceStorageBudget,
  transport: SourceStorageScopedTransport, invocationInputs: SourceStorageInvocationInputQuery,
  graphQueries: ReturnType<typeof createSourceStorageGraphQueries>) {
  const recursion = createSourceStorageScopedRecursion(source, budget, transport, invocationInputs);
  const scopes = createSourceStorageScopes(source, budget, transport.subject, invocationInputs, graphQueries, recursion.entryInputFor);
  const keys = createSourceStorageScopedKeys(source, budget, transport, scopes);
  const equations = createSourceStorageEquations(budget, transport, scopes, recursion, keys.invocation);
  const terms = new Map<string, SourceStorageTerm>();
  const relations = new Map<SourceStorageTerm, SourceStorageRelation>();
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
      const destination = normalize(term.destination, witnesses, temporary, false);
      const receiver = normalize(term.receiver, witnesses, temporary, false); const value = normalize(term.value, witnesses, temporary, contributes);
      return destination === undefined || receiver === undefined || value === undefined ? undefined : Object.freeze({ ...term, destination, receiver, value });
    }
    if (term.kind === "guarded") {
      let current: SourceStorageTerm = term;
      let guards: SourceStorageValueGuards | undefined;
      while (current.kind === "guarded") {
        if (!budget.step()) return undefined;
        const selected = transport.guardedValues.conjoin(guards, current.reference);
        if (budget.failure() !== undefined) return undefined;
        if (selected === null) return emptyTerm;
        guards = selected;
        current = current.value;
      }
      const value = normalize(term.value, witnesses, temporary, false);
      return value === undefined ? undefined : value.kind === "guarded" && value.reference === term.reference
        ? value : Object.freeze({ ...term, value });
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
      !term.subject.projection.some(component => component.kind === "member") &&
      !source.ast.is.IsNewExpression(term.subject.node) && !source.ast.is.IsPropertyAccessExpression(term.subject.node) &&
      !source.ast.is.IsElementAccessExpression(term.subject.node) && !transport.invocations.has(term.subject.node) &&
      !transport.accessorTargets.has(term.subject.node) && transport.storedValuesFor(term.subject) === undefined &&
      transport.incomingFor(term.subject).size === 0 && sourceStorageHasOriginalValue(term.subject, source.ast, false)) {
      return Object.freeze({ kind: "leaf", subject: term.subject, scope: witnessScope(term.subject, term.scope) });
    }
    return term;
  };
  const intern = (term: SourceStorageTerm): SourceStorageTerm | undefined => scopes.withTraversal(() => budget.withRows(temporary => {
    const reference = term.kind === "reference" || term.kind === "leaf" && term.guards === undefined
      ? referenceFor(term.subject, term.scope) : undefined;
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
  const derive = (current: SourceStorageTerm,
    read: (term: SourceStorageTerm) => ReadonlySet<SourceStorageTerm> | undefined,
    emit: (term: SourceStorageTerm, direct: boolean) => boolean,
    project: (input: SourceStorageTerm, select: (value: SourceStorageTerm) => readonly SourceStorageTerm[] | undefined) => boolean): boolean => scopes.withTraversal(() => {
    let relation = relations.get(current);
    if (relation === undefined) {
      if (!rows.add(1)) return false;
      relation = { children: new Map(), complete: false };
      relations.set(current, relation);
    }
    const children = relation.children;
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
    const previousRead = currentRead;
    currentRead = term => select(term, false);
    try {
      if (current.kind === "leaf" || current.kind === "unresolved" || current.kind === "effect") return emit(current, true);
      const selected = successors.reduce(current);
      if (selected === undefined) return budget.failure() === undefined;
      if (selected.kind === "project") {
        const input = retain(selected.input, false);
        if (input !== undefined && selected.valueFilter !== undefined) {
          if (relation.filter === undefined && !rows.add(1)) return false;
          relation.filter = { reference: selected.valueFilter, input };
        }
        return input !== undefined && project(input, value => scopes.withTraversal(() => {
          const projected = value.kind === "leaf" ? selected.select(value)
            : value.kind === "unresolved" ? [value] : [];
          if (projected === undefined) return undefined;
          const outputs: SourceStorageTerm[] = [];
          for (const output of projected) {
            if (!budget.step()) return undefined;
            const normalized = retain(output);
            if (normalized === undefined) return undefined;
            outputs.push(normalized);
          }
          return outputs;
        }));
      }
      for (const dependency of selected.kind === "replace" ? selected.dependencies ?? [] : []) {
        if (!budget.step() || retain(dependency, false) === undefined) return false;
      }
      for (const witness of selected.kind === "replace" ? selected.witnesses ?? [] : []) {
        const reference = referenceFor(witness.subject, witnessScope(witness.subject, witness.bindings));
        if (reference === undefined || !addWitness(current, reference, witness.contributes)) return false;
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
          if (successor === undefined || !emit(successor, true)) return false;
          continue;
        }
        const terminal = term.kind === "leaf" || term.kind === "unresolved";
        const successor = retain(term);
        if (successor === undefined) return false;
        if (terminal) {
          if (!emit(successor, true)) return false;
          continue;
        }
        if (!emit(successor, false)) return false;
      }
      return budget.failure() === undefined;
    } finally { currentRead = previousRead; }
  });
  const results = graphQueries.fixedPoint<SourceStorageTerm, SourceStorageTerm>((current, read, emit, forward) =>
    derive(current, read, (term, direct) => direct ? emit(term) : forward(term), (input, select) =>
      forward(input, value => select(value)?.map(term => term.kind === "leaf" || term.kind === "unresolved"
        ? { kind: "value", value: term } : { kind: "relation", key: term }))));
  const selectRoot = (origin: SourceStorageSubject, scope: SourceStorageScope): SourceStorageTerm | undefined => intern(sourceStorageReference(origin, scope));
  const values = (origin: SourceStorageSubject, scope: SourceStorageScope): ReadonlySet<SourceStorageBoundSubject> | undefined => scopes.withQuery(() => {
    const root = selectRoot(origin, scope);
    const selected = root === undefined ? undefined : results(root);
    if (selected === undefined) return undefined;
    const values = new Set<SourceStorageBoundSubject>();
    for (const value of selected) {
      if (!budget.step()) return undefined;
      if (value.kind === "unresolved") { budget.reject(value.reason); return undefined; }
      if (value.kind === "leaf") values.add(Object.freeze({ subject: value.subject, bindings: value.scope }));
    }
    return values;
  });
  const provenance = (origin: SourceStorageSubject, scope: SourceStorageScope) => scopes.withQuery(() => {
    const root = selectRoot(origin, scope);
    const selected = root === undefined ? undefined : results(root);
    if (selected === undefined) return undefined;
    const subjects = new Set<SourceStorageSubject>();
    let reason: string | undefined;
    for (const value of selected) {
      if (!budget.step()) return undefined;
      if (value.kind === "unresolved") reason ??= value.reason;
      if (value.kind === "leaf") subjects.add(value.subject);
    }
    return Object.freeze({ origins: subjects, reason });
  });
  const origins = (origin: SourceStorageSubject, scope: SourceStorageScope): ReadonlySet<SourceStorageSubject> | undefined => {
    const selected = provenance(origin, scope);
    if (selected?.reason !== undefined) { budget.reject(selected.reason); return undefined; }
    return selected?.origins;
  };
  const walk = (origin: SourceStorageSubject, scope: SourceStorageScope,
    stopAt?: (subject: SourceStorageBoundSubject) => boolean, preserveValuePath = false) => scopes.withQuery(() => budget.withRows(temporary => {
    const root = selectRoot(origin, scope);
    if (root === undefined) return undefined;
    const visited = new Map<SourceStorageTerm, Map<string, number>>();
    const pending: { readonly term: SourceStorageTerm; readonly collect: boolean; readonly guards?: SourceStorageValueGuards }[] =
      [{ term: root, collect: true }];
    const subjects = new Map<SourceStorageScope, Map<SourceStorageSubject, number>>();
    const origins = new Set<SourceStorageSubject>();
    let reason: string | undefined;
    const project = (input: SourceStorageTerm,
      select: (value: SourceStorageTerm) => readonly SourceStorageTerm[] | undefined): boolean => {
      const values = results(input);
      if (values === undefined) return false;
      for (const value of values) if (!budget.step() || select(value) === undefined) return false;
      return budget.failure() === undefined;
    };
    const admitted = (subject: SourceStorageSubject, guards: SourceStorageValueGuards | undefined): boolean => {
      for (const reference of guards?.references ?? []) {
        if (!budget.step() || transport.guardedValues.admits(subject, reference) === false) return false;
      }
      return budget.failure() === undefined;
    };
    const collectWitnesses = (current: SourceStorageTerm, collect: boolean,
      guards: SourceStorageValueGuards | undefined): boolean | undefined => {
      let stopped = false;
      for (const [reference, mode] of witnesses.get(current) ?? []) {
        const { subject: input, bindings: scope } = reference;
        const retained = subjects.get(scope) ?? new Map<SourceStorageSubject, number>();
        if (!budget.step()) return undefined;
        if (!retained.has(input) && !temporary.add(1)) return undefined;
        const contributes = collect && (mode & 2) !== 0 && admitted(input, guards);
        let selected = (retained.get(input) ?? 0) | (contributes ? 2 : 1);
        if (contributes && stopAt !== undefined) {
          if ((selected & 4) === 0) selected |= 4 | (stopAt({ subject: input, bindings: scope }) ? 8 : 0);
          if ((selected & 8) !== 0) { origins.add(input); stopped = true; }
        }
        retained.set(input, selected); subjects.set(scope, retained);
      }
      return stopped;
    };
    while (pending.length !== 0) {
      if (!budget.step()) return undefined;
      const entry = pending.pop()!; const current = entry.term;
      const flag = entry.collect ? 2 : 1;
      const guardsKey = entry.guards?.key ?? "";
      const visitedGuards = visited.get(current);
      if (((visitedGuards?.get(guardsKey) ?? 0) & flag) !== 0) continue;
      if (!temporary.add(visitedGuards === undefined ? 2 : 1)) return undefined;
      const retainedGuards = visitedGuards ?? new Map<string, number>();
      retainedGuards.set(guardsKey, (retainedGuards.get(guardsKey) ?? 0) | flag);
      visited.set(current, retainedGuards);
      const stopped = collectWitnesses(current, entry.collect, entry.guards);
      if (stopped === undefined) return undefined;
      if (stopped) continue;
      if (relations.get(current)?.complete !== true) {
        if (!derive(current, results, () => true, project)) return undefined;
        relations.get(current)!.complete = true;
      }
      const completed = collectWitnesses(current, entry.collect, entry.guards);
      if (completed === undefined) return undefined;
      if (completed) continue;
      if (entry.collect && current.kind === "leaf" && admitted(current.subject, entry.guards)) origins.add(current.subject);
      if (current.kind === "unresolved") reason ??= current.reason;
      const filter = preserveValuePath ? relations.get(current)?.filter : undefined;
      if (filter !== undefined) {
        const guards = transport.guardedValues.conjoin(entry.guards, filter.reference);
        if (budget.failure() !== undefined) return undefined;
        if (guards !== null) pending.push({ term: filter.input, collect: entry.collect, guards });
        continue;
      }
      for (const [child, mode] of relations.get(current)?.children ?? []) {
        if (!budget.step()) return undefined;
        if (child.kind !== "execution-root") pending.push({ term: child, collect: entry.collect && (mode & 2) !== 0, guards: entry.guards });
      }
    }
    const selected: SourceStorageRelationWitness[] = [];
    for (const [scope, inputs] of subjects) for (const [subject, mode] of inputs) {
      if (!budget.step()) return undefined;
      selected.push(Object.freeze({ subject, bindings: scope, contributes: (mode & 2) !== 0 }));
    }
    return Object.freeze({ subjects: Object.freeze(selected), origins, reason });
  }));
  const trace = (origin: SourceStorageSubject, scope: SourceStorageScope): readonly SourceStorageRelationWitness[] | undefined =>
    walk(origin, scope)?.subjects;
  const frontier = (origin: SourceStorageSubject, scope: SourceStorageScope,
    boundaries: ReadonlySet<SourceStorageSubject>, position: "value" | "input") => scopes.withQuery(() => budget.withRows(temporary => {
    const rootScope = witnessScope(origin, scope);
    const stopped = new Map<SourceStorageScope, Set<SourceStorageSubject>>();
    const selected = walk(origin, scope, current => {
      if (!boundaries.has(current.subject) || position === "input" &&
        current.subject === origin && current.bindings === rootScope) return false;
      const previous = stopped.get(current.bindings);
      if (previous?.has(current.subject) !== true && !temporary.add(previous === undefined ? 2 : 1)) return false;
      const subjects = previous ?? new Set<SourceStorageSubject>();
      subjects.add(current.subject);
      stopped.set(current.bindings, subjects);
      return true;
    }, true);
    if (selected === undefined || selected.reason !== undefined) return selected === undefined ? undefined
      : { reason: selected.reason, subjects: [] };
    const subjects: (SourceStorageScopedSubject & { readonly kind: "boundary" | "origin" })[] = [];
    for (const current of selected.subjects) {
      if (!budget.step()) return undefined;
      if (current.contributes && selected.origins.has(current.subject)) {
        if (!temporary.add(1)) return undefined;
        subjects.push(Object.freeze({ subject: current.subject, bindings: current.bindings,
          kind: stopped.get(current.bindings)?.has(current.subject) === true ? "boundary" : "origin" }));
      }
    }
    return { subjects: Object.freeze(subjects), reason: undefined };
  }));
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
  return Object.freeze({ empty: scopes.empty, values, origins, provenance, trace, walk, frontier, selection, formals: scopes.formals,
    boundActivation: scopes.boundActivation,
    isBound: (origin: SourceStorageSubject, scope: SourceStorageScope): boolean =>
      scopes.withTraversal(() => {
        const bound = scopes.lookup(origin, scope);
        return bound !== undefined && (bound.kind !== "replace" || !bound.terms.some(term => term.kind === "leaf" && scopes.isSymbolic(term)));
      }),
    forDeclaration: scopes.declarationFor, forInvocation: scopes.frameFor, identityFor: scopes.identity });
}
