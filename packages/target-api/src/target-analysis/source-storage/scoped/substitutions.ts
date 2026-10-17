import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import { sourceStorageHasOriginalValue, sourceStorageIsMemberProjection } from "../model/subjects.js";
import type { SourceStorageBudget, SourceStorageRows } from "../model/resource-budget.js";
import type { SourceStorageInvocationInputQuery } from "../graph/invocation-inputs.js";
import type { createSourceStorageGraphQueries } from "../graph/graph-queries.js";
import { createSourceStorageScopes } from "./scoped-scopes.js";
import { createSourceStorageScopedKeys } from "./scoped-keys.js";
import { createSourceStorageEquations } from "./scoped-equations.js";
import { createSourceStorageScopedRecursion } from "./scoped-recursion.js";
import { createSourceStorageScopedSuccessors, walkSourceStorageExecution } from "./scoped-successors.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
import { sourceStorageTransparentInput } from "./scoped-transport.js";
import type { SourceStorageScope, SourceStorageTerm, SourceStorageScopedSubject, SourceStorageRelationWitness } from "../graph/scoped-model.js";
import { sourceStorageReference } from "../graph/scoped-model.js";
import { sourceStorageRegionOwner } from "../graph/lexical-regions.js";
import { sourceStorageSubjectType } from "../model/components.js";
import type { SourceStorageValueGuards } from "../graph/guarded-values.js";

export type SourceStorageSubstitutions = SourceStorageScope;
export type SourceStorageBoundSubject = SourceStorageScopedSubject;

interface SourceStorageRelation {
  readonly term: SourceStorageTerm;
  readonly children: Map<SourceStorageRelation, number>;
  witnesses?: Map<SourceStorageScope, Map<SourceStorageSubject, number>>;
  filter?: { readonly reference: Node; readonly input: SourceStorageRelation };
  complete: boolean;
}

export function createSourceStorageSubstitutions(source: TargetSourceProgram, budget: SourceStorageBudget,
  transport: SourceStorageScopedTransport, invocationInputs: SourceStorageInvocationInputQuery,
  graphQueries: ReturnType<typeof createSourceStorageGraphQueries>) {
  const recursion = createSourceStorageScopedRecursion(source, budget, transport, invocationInputs);
  const scopes = createSourceStorageScopes(source, budget, transport.subject, invocationInputs, graphQueries, recursion.entryInputFor);
  const keys = createSourceStorageScopedKeys(source, budget, transport, scopes);
  const equations = createSourceStorageEquations(source, budget, transport, scopes, recursion, keys.invocation);
  const relations = new Map<string, SourceStorageRelation>();
  interface ReferenceMemo {
    reference?: SourceStorageRelation;
    leaf?: SourceStorageRelation;
  }
  const references = new Map<SourceStorageSubject, Map<SourceStorageScope, ReferenceMemo>>();
  const referenceRows = budget.createRows();
  const withQuery = scopes.withQuery;
  const rows = budget.createRows();
  const emptyTerm: SourceStorageTerm = Object.freeze({ kind: "empty" });
  const witnessScope = (subject: SourceStorageSubject, scope: SourceStorageScope): SourceStorageScope => {
    if (scope === scopes.empty || subject.kind === "member") return scope;
    const region = transport.regions.enclosing(subject.node);
    const owner = subject.kind === "return" || subject.kind === "receiver" ? subject.node
      : region === undefined ? undefined : sourceStorageRegionOwner(source.ast, region);
    return owner === undefined ? scopes.empty : scopes.owningScope(scope, owner) ?? scope;
  };
  let currentRead: ((term: SourceStorageTerm) => ReadonlySet<SourceStorageTerm> | undefined) | undefined;
  const successors = createSourceStorageScopedSuccessors(source, budget, transport, scopes, equations, keys.birth, keys.closed,
    term => currentRead === undefined ? undefined : currentRead(term));
  const addWitness = (relation: SourceStorageRelation, reference: SourceStorageScopedSubject, contributes = true): boolean => {
    if (budget.failure() !== undefined) return false;
    const states = relation.witnesses?.get(reference.bindings);
    const mode = contributes ? 2 : 1;
    const previous = states?.get(reference.subject);
    if (((previous ?? 0) & mode) !== 0) return true;
    if (previous === undefined && !rows.add(states === undefined ? 2 : 1)) return false;
    const selected = states ?? new Map<SourceStorageSubject, number>();
    const witnesses = relation.witnesses ?? new Map<SourceStorageScope, Map<SourceStorageSubject, number>>();
    selected.set(reference.subject, (previous ?? 0) | mode);
    witnesses.set(reference.bindings, selected); relation.witnesses = witnesses;
    return true;
  };
  const normalize = (term: SourceStorageTerm, witnesses: SourceStorageRelationWitness[], temporary: SourceStorageRows,
    contributes = true, binding = false): SourceStorageTerm | undefined => {
    while (true) {
      if (term.kind === "reference" || term.kind === "leaf") {
        if (!budget.step() || !temporary.add(1)) return undefined;
        witnesses.push({ subject: term.subject, bindings: witnessScope(term.subject, term.scope), contributes });
      } else if (!budget.step()) return undefined;
      if (term.kind === "reference") {
        const input = binding ? transport.bindingInputFor(term.subject)
          : sourceStorageTransparentInput(term.subject, source.ast, transport);
        if (input !== undefined) { term = sourceStorageReference(input, term.scope); continue; }
        if (term.subject.kind === "input" || term.subject.kind === "receiver") {
          const selected = scopes.lookup(term.subject, term.scope);
          if (selected?.kind === "replace" && selected.terms.length === 1) { term = selected.terms[0]!; continue; }
        }
      }
      if (term.kind === "transition") {
        const condition = normalize(term.condition, witnesses, temporary, false);
        if (condition === undefined) return undefined;
        return Object.freeze({ ...term, condition });
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
    if (term.kind === "member") {
      const receiver = normalize(term.receiver, witnesses, temporary, false, true);
      return receiver === undefined ? undefined : Object.freeze({ ...term, receiver });
    }
    if (term.kind === "application") {
      const callee = normalize(term.callee, witnesses, temporary, false, true);
      return callee === undefined ? undefined : Object.freeze({ ...term, callee });
    }
    if (term.kind === "reference" && term.subject.kind === "value" &&
      !term.subject.projection.some(sourceStorageIsMemberProjection) &&
      !source.ast.is.IsNewExpression(term.subject.node) && !source.ast.is.IsPropertyAccessExpression(term.subject.node) &&
      !source.ast.is.IsElementAccessExpression(term.subject.node) && !transport.invocations.has(term.subject.node) &&
      !transport.accessorTargets.has(term.subject.node) && transport.storedValuesFor(term.subject) === undefined &&
      transport.incomingFor(term.subject).size === 0 && sourceStorageHasOriginalValue(term.subject, source.ast, false)) {
      return Object.freeze({ kind: "leaf", subject: term.subject, scope: witnessScope(term.subject, term.scope) });
    }
    return term;
  };
  const intern = (term: SourceStorageTerm): SourceStorageRelation | undefined => scopes.withTraversal(() => budget.withRows(temporary => {
    if (!budget.step()) return undefined;
    const reference = term.kind === "reference" || term.kind === "leaf" && term.guards === undefined ? term : undefined;
    const contexts = reference === undefined ? undefined : references.get(reference.subject);
    const retainedMemo = reference === undefined ? undefined : contexts?.get(reference.scope);
    const cached = reference === undefined ? undefined : retainedMemo?.[reference.kind];
    if (cached !== undefined) return cached;
    const retained: SourceStorageRelationWitness[] = [];
    const normalized = normalize(term, retained, temporary);
    if (normalized === undefined) return undefined;
    const key = keys.encode(normalized);
    if (key === undefined) return undefined;
    let selected = relations.get(key);
    if (selected === undefined) {
      if (!rows.add(2)) return undefined;
      selected = { term: normalized, children: new Map(), complete: false };
      relations.set(key, selected);
    }
    if (selected.term.kind !== "empty") for (const witness of retained)
      if (!addWitness(selected, witness, witness.contributes)) return undefined;
    if (reference !== undefined) {
      if (retainedMemo === undefined && !referenceRows.add(contexts === undefined ? 3 : 2)) return undefined;
      const retained = retainedMemo ?? {};
      retained[reference.kind] = selected;
      const entries = contexts ?? new Map<SourceStorageScope, ReferenceMemo>();
      entries.set(reference.scope, retained); references.set(reference.subject, entries);
    }
    return selected;
  }));
  const derive = (relation: SourceStorageRelation,
    read: (relation: SourceStorageRelation) => ReadonlySet<SourceStorageTerm> | undefined,
    emit: (relation: SourceStorageRelation, direct: boolean) => boolean,
    project: (input: SourceStorageRelation, select: (value: SourceStorageTerm) => readonly SourceStorageRelation[] | undefined) => boolean): boolean => scopes.withTraversal(() => {
    const current = relation.term;
    const children = relation.children;
    const retain = (term: SourceStorageTerm, values = true): SourceStorageRelation | undefined => {
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
      if (current.kind === "leaf" || current.kind === "unresolved" || current.kind === "effect" || current.kind === "empty") return emit(relation, true);
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
            : value.kind === "unresolved" || value.kind === "empty" ? [value] : [];
          if (projected === undefined) return undefined;
          const outputs: SourceStorageRelation[] = [];
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
        const reference = { subject: witness.subject, bindings: witnessScope(witness.subject, witness.bindings) };
        if (!budget.step() || !addWitness(relation, reference, witness.contributes)) return false;
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
        const terminal = term.kind === "leaf" || term.kind === "unresolved" || term.kind === "empty";
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
  const results = graphQueries.fixedPoint<SourceStorageRelation, SourceStorageTerm>((current, read, emit, forward) =>
    derive(current, read, (relation, direct) => direct ? emit(relation.term) : forward(relation), (input, select) =>
      forward(input, value => select(value)?.map(relation => relation.term.kind === "leaf" || relation.term.kind === "unresolved"
        ? { kind: "value", value: relation.term } : { kind: "relation", key: relation }))));
  const selectRoot = (origin: SourceStorageSubject, scope: SourceStorageScope): SourceStorageRelation | undefined => intern(sourceStorageReference(origin, scope));
  const values = (origin: SourceStorageSubject, scope: SourceStorageScope): ReadonlySet<SourceStorageBoundSubject> | undefined => withQuery(() => {
    const root = selectRoot(origin, scope);
    const selected = root === undefined ? undefined : results(root);
    if (selected === undefined) return undefined;
    const values = new Set<SourceStorageBoundSubject>();
    for (const value of selected) {
      if (!budget.step()) return undefined;
      if (value.kind === "unresolved") { if (value.exposure === undefined) budget.reject(value.reason); return undefined; }
      if (value.kind === "leaf") values.add(Object.freeze({ subject: value.subject, bindings: value.scope }));
    }
    return values;
  });
  const provenance = (origin: SourceStorageSubject, scope: SourceStorageScope) => withQuery(() => {
    const root = selectRoot(origin, scope);
    const selected = root === undefined ? undefined : results(root);
    if (selected === undefined) return undefined;
    const subjects = new Set<SourceStorageSubject>();
    let reason: string | undefined;
    let fatalReason: string | undefined;
    for (const value of selected) {
      if (!budget.step()) return undefined;
      if (value.kind === "unresolved") {
        reason ??= value.reason;
        if (value.exposure === undefined) fatalReason ??= value.reason;
      }
      if (value.kind === "leaf") subjects.add(value.subject);
    }
    return Object.freeze({ origins: subjects, reason, fatalReason });
  });
  const origins = (origin: SourceStorageSubject, scope: SourceStorageScope): ReadonlySet<SourceStorageSubject> | undefined => {
    const selected = provenance(origin, scope);
    if (selected?.reason !== undefined) {
      if (selected.fatalReason !== undefined) budget.reject(selected.fatalReason);
      return undefined;
    }
    return selected?.origins;
  };
  const contributingExecutions = (origin: SourceStorageSubject, declaration: Node, creation: SourceStorageScope) =>
    withQuery(() => budget.withRows(temporary => {
      const body = source.ast.body(declaration);
      const scope = scopes.declarationFor(declaration, creation);
      if (body === undefined || scope === undefined) return undefined;
      const root: SourceStorageTerm = Object.freeze({ kind: "region", region: body, scope, demand: origin.node, deferred: true });
      const selected = walkSourceStorageExecution(budget, [root], term => {
        const relation = intern(term);
        return relation === undefined ? undefined : results(relation);
      });
      const subjects: SourceStorageBoundSubject[] = [];
      const boundaries: Extract<SourceStorageTerm, { readonly kind: "unresolved" }>[] = [];
      let reason: string | undefined;
      for (const value of selected) {
        if (!budget.step()) return undefined;
        if (value.kind === "unresolved") {
          if (value.exposure === undefined) reason ??= value.reason;
          else {
            if (!temporary.add(1)) return undefined;
            boundaries.push(value);
          }
        }
        if (value.kind !== "leaf" || value.subject !== origin) continue;
        if (!temporary.add(1)) return undefined;
        subjects.push(Object.freeze({ subject: value.subject, bindings: value.scope }));
      }
      return Object.freeze({ subjects: Object.freeze(subjects), boundaries: Object.freeze(boundaries), reason });
    }));
  const walk = (origin: SourceStorageSubject, scope: SourceStorageScope,
    stopAt?: (subject: SourceStorageBoundSubject) => boolean, preserveValuePath = false) => withQuery(() => budget.withRows(temporary => {
    const root = selectRoot(origin, scope);
    if (root === undefined) return undefined;
    if (stopAt === undefined && results(root) === undefined) return undefined;
    const visited = new Map<SourceStorageRelation, Map<string, number>>();
    const pending: { readonly relation: SourceStorageRelation; readonly collect: boolean; readonly guards?: SourceStorageValueGuards }[] =
      [{ relation: root, collect: true }];
    const subjects = new Map<SourceStorageScope, Map<SourceStorageSubject, number>>();
    const origins = new Set<SourceStorageSubject>();
    let reason: string | undefined;
    const project = (input: SourceStorageRelation,
      select: (value: SourceStorageTerm) => readonly SourceStorageRelation[] | undefined): boolean => {
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
    const collectWitnesses = (current: SourceStorageRelation, collect: boolean,
      guards: SourceStorageValueGuards | undefined): boolean | undefined => {
      let stopped = false;
      for (const [scope, inputs] of current.witnesses ?? []) for (const [input, mode] of inputs) {
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
      const entry = pending.pop()!; const relation = entry.relation; const current = relation.term;
      const flag = entry.collect ? 2 : 1;
      const guardsKey = entry.guards?.key ?? "";
      const visitedGuards = visited.get(relation);
      if (((visitedGuards?.get(guardsKey) ?? 0) & flag) !== 0) continue;
      if (!temporary.add(visitedGuards === undefined ? 2 : 1)) return undefined;
      const retainedGuards = visitedGuards ?? new Map<string, number>();
      retainedGuards.set(guardsKey, (retainedGuards.get(guardsKey) ?? 0) | flag);
      visited.set(relation, retainedGuards);
      const stopped = collectWitnesses(relation, entry.collect, entry.guards);
      if (stopped === undefined) return undefined;
      if (stopped) continue;
      if (!relation.complete) {
        if (!derive(relation, results, () => true, project)) return undefined;
        relation.complete = true;
      }
      const completed = collectWitnesses(relation, entry.collect, entry.guards);
      if (completed === undefined) return undefined;
      if (completed) continue;
      if (stopAt === undefined && entry.collect && current.kind !== "execution-root" && current.kind !== "region" && current.kind !== "effect") {
        const completed = results(relation);
        if (completed === undefined) return undefined;
        if (completed.size === 0) {
          const subject = current.kind === "reference" || current.kind === "leaf" || current.kind === "unresolved" ? current.subject
            : current.kind === "application" ? transport.subject(current.invocation, "value", current.projection)
            : current.kind === "member" ? current.selection.kind === "projection" ? current.selection.subject
              : transport.subject(current.selection.node) : undefined;
          const type = subject === undefined ? undefined : sourceStorageSubjectType(source, subject);
          if (type === undefined || !source.semantics.forNode(subject!.node).types.isNever(type))
            reason ??= "A demanded source storage relation has no completed correlated producer or absence proof.";
        }
      }
      if (entry.collect && current.kind === "leaf" && admitted(current.subject, entry.guards)) origins.add(current.subject);
      if (current.kind === "unresolved") reason ??= current.reason;
      const filter = preserveValuePath ? relation.filter : undefined;
      if (filter !== undefined) {
        const guards = transport.guardedValues.conjoin(entry.guards, filter.reference);
        if (budget.failure() !== undefined) return undefined;
        if (guards !== null) pending.push({ relation: filter.input, collect: entry.collect, guards });
        continue;
      }
      for (const [child, mode] of relation.children) {
        if (!budget.step()) return undefined;
        if (child.term.kind !== "execution-root") pending.push({ relation: child, collect: entry.collect && (mode & 2) !== 0, guards: entry.guards });
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
    boundaries: ReadonlySet<SourceStorageSubject>, position: "value" | "input") => withQuery(() => budget.withRows(temporary => {
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
  const selection = (origin: SourceStorageSubject, scope: SourceStorageScope): readonly SourceStorageBoundSubject[] | undefined => withQuery(() => {
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
  return Object.freeze({ empty: scopes.empty, values, origins, provenance, trace, walk, frontier, selection, contributingExecutions,
    formals: scopes.formals,
    invocationContextKeyFor(invocation: Node, bindings: readonly SourceStorageScope[]): string | undefined {
      return withQuery(() => budget.withRows(temporary => {
        const subject = transport.subject(invocation);
        if (subject === undefined) return undefined;
        const target = transport.invocationTargets.get(invocation);
        const operation = transport.accessorTargets.has(invocation)
          ? source.ast.is.IsPropertyAccessExpression(invocation) ? source.semantics.forNode(invocation).operations.propertyAccess(invocation)
            : source.semantics.forNode(invocation).operations.elementAccess(invocation) : undefined;
        const receiver = transport.subjectFor(operation?.receiver.expression);
        const states: { readonly subject: SourceStorageSubject; readonly term: SourceStorageTerm }[][] = [];
        for (const scope of bindings) {
          if (!budget.step() || !temporary.add(2)) return undefined;
          let term: SourceStorageTerm;
          if (target !== undefined) term = Object.freeze({ kind: "application", mode: "execution", demand: invocation,
            invocation, callee: sourceStorageReference(target, scope), scope, projection: Object.freeze([]) });
          else if (receiver !== undefined) term = Object.freeze({ kind: "member", mode: "execution", demand: invocation,
            selection: Object.freeze({ kind: "access", node: invocation }), receiver: sourceStorageReference(receiver, scope),
            scope, projection: Object.freeze([]) });
          else {
            budget.reject("An invocation context requires its exact checked callee or accessor receiver.");
            return undefined;
          }
          states.push([{ subject, term }]);
        }
        return keys.context(states);
      }));
    },
    contextKeyFor(subjects: readonly SourceStorageSubject[], bindings: readonly SourceStorageScope[]): string | undefined {
      return withQuery(() => budget.withRows(temporary => {
        const states: { readonly subject: SourceStorageSubject; readonly term: SourceStorageTerm }[][] = [];
        for (const scope of bindings) {
          const inputs: { readonly subject: SourceStorageSubject; readonly term: SourceStorageTerm }[] = [];
          for (const subject of subjects) {
            if (!budget.step() || !temporary.add(1)) return undefined;
            const selected = intern(sourceStorageReference(subject, scope));
            if (selected === undefined) return undefined;
            inputs.push({ subject, term: selected.term });
          }
          if (!temporary.add(1)) return undefined;
          states.push(inputs);
        }
        return keys.context(states);
      }));
    },
    boundActivation: scopes.boundActivation,
    ownerScope: scopes.owningScope,
    isBound: (origin: SourceStorageSubject, scope: SourceStorageScope): boolean =>
      scopes.withTraversal(() => {
        const bound = scopes.lookup(origin, scope);
        return bound !== undefined && (bound.kind !== "replace" || !bound.terms.some(term => term.kind === "leaf" && scopes.isSymbolic(term)));
      }),
    forDeclaration: scopes.declarationFor,
    forInvocation(candidate: Node, invocation: Node, caller: SourceStorageScope, captured: SourceStorageScope,
      callee: SourceStorageSubject | undefined) {
      if (transport.accessorTargets.has(invocation)) return scopes.frameFor(candidate, invocation, caller, captured);
      if (callee === undefined || !transport.invocationTargets.has(invocation)) {
        budget.reject("An invocation context requires its exact checked callee transport.");
        return undefined;
      }
      return equations.scopeFor(candidate, invocation, caller, captured, Object.freeze({ kind: "application",
        mode: "execution", demand: invocation, invocation, callee: Object.freeze({ kind: "leaf", subject: callee, scope: captured }),
        scope: caller, projection: Object.freeze([]) }));
    },
    identityFor: scopes.identity });
}
