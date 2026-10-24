import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import { sourceStorageHasOriginalValue, sourceStorageIsMemberProjection } from "../model/subjects.js";
import type { SourceStorageBudget, SourceStorageRows } from "../model/resource-budget.js";
import type { createSourceStorageGraphQueries } from "../graph/graph-queries.js";
import type { SourceStorageForwardSelection } from "../graph/graph-queries.js";
import { createSourceStorageScopes } from "./scoped-scopes.js";
import { createSourceStorageScopedKeys } from "./scoped-keys.js";
import { createSourceStorageEquations } from "./scoped-equations.js";
import { createSourceStorageScopedRecursion } from "./scoped-recursion.js";
import { createSourceStorageScopedSuccessors } from "./scoped-successors.js";
import { walkSourceStorageExecution } from "./execution-reachability.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
import { sourceStorageInputBinding } from "./scoped-transport.js";
import type { SourceStorageScope, SourceStorageTerm, SourceStorageScopedSubject, SourceStorageRelationWitness } from "../graph/scoped-model.js";
import { sourceStorageReference } from "../graph/scoped-model.js";
import { sourceStorageRegionOwner } from "../graph/lexical-regions.js";
import { sourceStorageSubjectType } from "../model/components.js";
import { isSourceCallableBodyBoundary, Node_Initializer } from "../../../source-navigation/index.js";
import { createSourceStorageContextFootprints } from "../graph/context-footprints.js";
import { sourceStorageActivationOwner } from "./activation-keys.js";
import type { SourceStorageValueGuards } from "../graph/guarded-values.js";

export const sourceStorageMissingProducerReason = "A demanded source storage relation has no completed correlated producer or absence proof.";

interface SourceStorageRelation {
  readonly term: SourceStorageTerm;
  readonly children: Map<SourceStorageRelation, number>;
  witnesses?: Map<SourceStorageScope, Map<SourceStorageSubject, number>>;
  filter?: { readonly reference: Node; readonly input: SourceStorageRelation };
  projection?: (value: SourceStorageTerm) => readonly SourceStorageForwardSelection<SourceStorageRelation, SourceStorageTerm>[] | undefined;
  complete: boolean;
}

export function createSourceStorageSubstitutions(source: TargetSourceProgram, budget: SourceStorageBudget,
  transport: SourceStorageScopedTransport,
  graphQueries: ReturnType<typeof createSourceStorageGraphQueries>) {
  const { invocationInputs } = transport;
  const recursion = createSourceStorageScopedRecursion(source, budget, transport, invocationInputs);
  const creation = Object.freeze({ footprints: createSourceStorageContextFootprints(budget, transport.contextualInputs,
    transport.contextLocation, transport.contextualInputs.applicationFor),
    ownerFor: (subject: SourceStorageSubject) => sourceStorageActivationOwner(source, transport.regions.enclosing, subject) });
  const scopes = createSourceStorageScopes(source, budget, transport.subject, invocationInputs, graphQueries, recursion.entryInputFor, creation);
  const keys = createSourceStorageScopedKeys(source, budget, transport, scopes, creation);
  const equations = createSourceStorageEquations(source, budget, transport, scopes, recursion, keys.invocation);
  const relations = new Map<string, SourceStorageRelation>();
  const withQuery = scopes.withQuery;
  const rows = budget.createRows();
  const emptyTerm: SourceStorageTerm = Object.freeze({ kind: "empty", absence: undefined });
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
    const current = relation.term;
    if ((current.kind === "reference" || current.kind === "leaf") && current.subject === reference.subject &&
      (current.scope === reference.bindings || witnessScope(current.subject, current.scope) === reference.bindings)) return true;
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
    contributes = true): SourceStorageTerm | undefined => {
    while (true) {
      let witness: SourceStorageRelationWitness | undefined;
      if (term.kind === "reference" || term.kind === "leaf") {
        if (!budget.step() || !temporary.add(1)) return undefined;
        witness = { subject: term.subject, bindings: witnessScope(term.subject, term.scope), contributes };
        witnesses.push(witness);
      } else if (!budget.step()) return undefined;
      if (term.kind === "reference") {
        if (term.subject.kind === "value" && term.subject.projection.length === 0 &&
          (source.ast.is.IsObjectLiteralExpression(term.subject.node) || source.ast.is.IsArrayLiteralExpression(term.subject.node) ||
            source.ast.is.IsArrowFunction(term.subject.node) || source.ast.is.IsFunctionExpression(term.subject.node)))
          return Object.freeze({ kind: "leaf", subject: term.subject, scope: witness!.bindings });
        const input = term.subject.kind === "value" ? transport.bindingInputFor(term.subject) : undefined;
        if (input !== undefined) { term = sourceStorageReference(input, term.scope); continue; }
        if (term.scope !== scopes.empty && (term.subject.kind === "receiver" ||
          term.subject.kind === "input" && Node_Initializer(source.ast, term.subject.node) === undefined)) {
          const selected = term.subject.kind === "input" ? sourceStorageInputBinding(source, budget, transport, scopes, term, undefined)
            : scopes.lookup(term.subject, term.scope);
          if (selected?.kind === "replace" && selected.terms.length === 1) { term = selected.terms[0]!; continue; }
        }
        if (term.subject.kind === "value" && !term.subject.projection.some(sourceStorageIsMemberProjection) &&
          !source.ast.is.IsNewExpression(term.subject.node) && !source.ast.is.IsPropertyAccessExpression(term.subject.node) &&
          !source.ast.is.IsElementAccessExpression(term.subject.node) && !transport.invocations.has(term.subject.node) &&
          !transport.accessorTargets.has(term.subject.node) && transport.storedValuesFor(term.subject) === undefined &&
          transport.incomingFor(term.subject).size === 0 && sourceStorageHasOriginalValue(term.subject, source.ast, false))
          return Object.freeze({ kind: "leaf", subject: term.subject, scope: witness!.bindings });
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
    if (term.kind === "empty" && term.absence !== undefined) {
      if (!budget.step() || !temporary.add(1)) return undefined;
      witnesses.push({ subject: term.absence.subject, bindings: witnessScope(term.absence.subject, term.absence.scope), contributes });
    }
    if (term.kind === "guarded") {
      let current: SourceStorageTerm = term;
      let guards: SourceStorageValueGuards | undefined;
      const references = new Set<Node>();
      while (current.kind === "guarded") {
        if (!budget.step()) return undefined;
        if (!references.has(current.reference) && !temporary.add(1)) return undefined;
        references.add(current.reference);
        const selected = transport.guardedValues.conjoin(guards, current.reference);
        if (budget.failure() !== undefined) return undefined;
        if (selected === null) return emptyTerm;
        guards = selected;
        current = current.value;
      }
      const normalized = normalize(current, witnesses, temporary, false);
      if (normalized === undefined) return undefined;
      let value: SourceStorageTerm = normalized;
      for (const reference of [...references].reverse()) value = Object.freeze({ kind: "guarded", value, reference });
      return value;
    }
    if (term.kind === "member") {
      const receiver = normalize(term.receiver, witnesses, temporary, false);
      return receiver === undefined ? undefined : Object.freeze({ ...term, receiver });
    }
    if (term.kind === "pointer") {
      const pointer = normalize(term.pointer, witnesses, temporary, false);
      const input = term.input === undefined ? undefined : normalize(term.input, witnesses, temporary, false);
      return pointer === undefined || term.input !== undefined && input === undefined ? undefined
        : Object.freeze({ ...term, pointer, input });
    }
    if (term.kind === "application") {
      const callee = normalize(term.callee, witnesses, temporary, false);
      if (term.activation.kind === "provided") {
        const argument = term.activation.argument === undefined ? undefined : normalize(term.activation.argument, witnesses, temporary, false);
        return callee === undefined || term.activation.argument !== undefined && argument === undefined ? undefined
          : Object.freeze({ ...term, callee, activation: Object.freeze({ kind: "provided", argument }) });
      }
      return callee === undefined ? undefined : Object.freeze({ ...term, callee });
    }
    return term;
  };
  const intern = (term: SourceStorageTerm): SourceStorageRelation | undefined => scopes.withTraversal(() => budget.withRows(temporary => {
    if (!budget.step()) return undefined;
    const retained: SourceStorageRelationWitness[] = [];
    const normalized = term.kind === "leaf" ? term : normalize(term, retained, temporary);
    if (normalized === undefined) { budget.reject(`Source storage ${term.kind} terms require an exact normalized form.`); return undefined; }
    const key = keys.encode(normalized);
    if (key === undefined) { budget.reject(`Source storage ${normalized.kind} terms require an exact relation key.`); return undefined; }
    let selected = relations.get(key);
    if (selected === undefined) {
      if (!rows.add(2)) return undefined;
      selected = { term: normalized, children: new Map(), complete: false };
      relations.set(key, selected);
    }
    if (selected.term.kind !== "empty" || selected.term.absence !== undefined) for (const witness of retained)
      if (!addWitness(selected, witness, witness.contributes)) return undefined;
    if (term.kind === "leaf" && (selected.term.kind !== "leaf" || selected.term.subject !== term.subject ||
      selected.term.scope !== term.scope) && !addWitness(selected, { subject: term.subject,
        bindings: witnessScope(term.subject, term.scope) })) return undefined;
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
      if (selected === undefined) { budget.reject("Source storage relations require an interned successor term."); return undefined; }
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
        for (const term of selected.inputs) {
          const input = retain(term, false);
          if (input === undefined) return false;
          if (selected.valueFilter !== undefined) {
            if (selected.inputs.length !== 1) { budget.reject("A guarded storage projection requires one exact original value."); return false; }
            if (relation.filter === undefined && !rows.add(1)) return false;
            relation.filter = { reference: selected.valueFilter, input };
          }
          if (!project(input, value => scopes.withTraversal(() => {
            const projected = value.kind === "leaf" || value.kind === "empty" ? selected.select(value)
              : value.kind === "unresolved" ? [value] : [];
            if (projected === undefined) return undefined;
            const outputs: SourceStorageRelation[] = [];
            for (const output of projected) {
              if (!budget.step()) return undefined;
              const normalized = retain(output);
              if (normalized === undefined) return undefined;
              outputs.push(normalized);
            }
            return outputs;
          }))) return false;
        }
        return true;
      }
      for (const dependency of selected.kind === "replace" ? selected.dependencies ?? [] : []) {
        if (!budget.step() || retain(dependency, false) === undefined) return false;
      }
      for (const witness of selected.kind === "replace" ? selected.witnesses ?? [] : []) {
        const reference = { subject: witness.subject, bindings: witnessScope(witness.subject, witness.bindings) };
        if (!budget.step() || !addWitness(relation, reference, witness.contributes)) return false;
      }
      const alternatives = selected.kind === "expand" ? equations.expand(selected.variable, current,
        term => select(term, false)) : selected.terms;
      if (alternatives === undefined) { budget.reject("Source storage variable expansion requires exact equation alternatives."); return false; }
      let operation: SourceStorageTerm = current;
      while (operation.kind === "transition") {
        if (!budget.step()) return false;
        operation = operation.value;
      }
      const execution = operation.kind === "execution-root" || operation.kind === "region" ||
        (operation.kind === "application" || operation.kind === "member" || operation.kind === "pointer") && operation.mode === "execution";
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
  const results = graphQueries.fixedPoint<SourceStorageRelation, SourceStorageTerm>((current, read, emit, forward) => {
    const complete = derive(current, read, (relation, direct) => direct ? emit(relation.term) : forward(relation), (input, select) => {
      let projection = current.projection;
      if (projection === undefined) {
        if (!rows.add(1)) return false;
        projection = value => select(value)?.map(relation => relation.term.kind === "leaf" || relation.term.kind === "unresolved"
          ? { kind: "value", value: relation.term } : { kind: "relation", key: relation });
        current.projection = projection;
      }
      return forward(input, projection);
    });
    if (complete) current.complete = true;
    return complete;
  }, "storage-relations");
  const selectRoot = (origin: SourceStorageSubject, scope: SourceStorageScope): SourceStorageRelation | undefined => intern(sourceStorageReference(origin, scope));
  const values = (origin: SourceStorageSubject, scope: SourceStorageScope): ReadonlySet<SourceStorageScopedSubject> | undefined => withQuery(() => {
    const root = selectRoot(origin, scope);
    const selected = root === undefined ? undefined : results(root);
    if (selected === undefined) return undefined;
    const values = new Set<SourceStorageScopedSubject>();
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
  const contributingExecutions = (origin: SourceStorageSubject, declaration: Node, creation: SourceStorageScope,
    entry: "callable" | "generator-result") =>
    withQuery(() => budget.withRows(temporary => {
      const body = source.ast.body(declaration);
      const scope = entry === "generator-result" ? scopes.owningScope(creation, declaration)
        : scopes.declarationFor(declaration, creation);
      if (body === undefined || scope === undefined) return undefined;
      const root: SourceStorageTerm = Object.freeze({ kind: "region", region: body, scope, demand: origin.node, deferred: true });
      const selected = walkSourceStorageExecution(budget, [root], term => {
        const relation = intern(term);
        return relation === undefined ? undefined : results(relation);
      });
      const subjects: SourceStorageScopedSubject[] = [];
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
    stopAt?: (subject: SourceStorageScopedSubject) => boolean, preserveValuePath = false) => withQuery(() => budget.withRows(temporary => {
    const root = selectRoot(origin, scope);
    if (root === undefined) return undefined;
    if (stopAt === undefined && results(root) === undefined) return undefined;
    const visited = new Map<SourceStorageRelation, Map<string, number>>();
    const pending: { readonly relation: SourceStorageRelation; readonly collect: boolean; readonly guards?: SourceStorageValueGuards }[] =
      [{ relation: root, collect: true }];
    const subjects = new Map<SourceStorageScope, Map<SourceStorageSubject, number>>();
    const origins = new Set<SourceStorageSubject>();
    const emptyDemands: SourceStorageTerm[] = [];
    let reason: string | undefined;
    let fatalReason: string | undefined;
    let absence = false;
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
      const retain = (scope: SourceStorageScope, input: SourceStorageSubject, mode: number): boolean => {
        if (!budget.step()) return false;
        const retained = subjects.get(scope) ?? new Map<SourceStorageSubject, number>();
        const previous = retained.get(input) ?? 0;
        const required = collect && (mode & 2) !== 0 ? 2 | (mode & 16) : 1;
        if (stopAt === undefined && guards === undefined && (previous & required) === required) return true;
        if (!retained.has(input) && !temporary.add(1)) return false;
        const contributes = collect && (mode & 2) !== 0 && admitted(input, guards);
        let selected = previous | (contributes ? 2 : 1);
        if (contributes && (mode & 16) !== 0) selected |= 16;
        if (contributes && stopAt !== undefined) {
          if ((selected & 4) === 0) selected |= 4 | (stopAt({ subject: input, bindings: scope }) ? 8 : 0);
          if ((selected & 8) !== 0) { origins.add(input); selected |= 16; stopped = true; }
        }
        retained.set(input, selected); subjects.set(scope, retained);
        return true;
      };
      const term = current.term;
      if (term.kind === "reference" && !retain(witnessScope(term.subject, term.scope), term.subject, 2)) return undefined;
      if (term.kind === "leaf" && !retain(term.scope, term.subject, 2 | 16)) return undefined;
      for (const [scope, inputs] of current.witnesses ?? []) for (const [input, mode] of inputs) {
        if (!retain(scope, input, mode)) return undefined;
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
        const completed = collectWitnesses(relation, entry.collect, entry.guards);
        if (completed === undefined) return undefined;
        if (completed) continue;
      }
      if (entry.collect && current.kind !== "execution-root" && current.kind !== "region" && current.kind !== "effect") {
        const completed = results(relation);
        if (completed === undefined) return undefined;
        if (completed.size === 0) {
          const subject = current.kind === "reference" || current.kind === "leaf" || current.kind === "unresolved" ? current.subject
            : current.kind === "application" || current.kind === "pointer" ? transport.subject(current.invocation, "value", current.projection)
            : current.kind === "member" ? current.selection.kind === "projection" ? current.selection.subject
              : transport.subject(current.selection.node) : undefined;
          const type = subject === undefined ? undefined : sourceStorageSubjectType(source, subject);
          if (type === undefined || !source.semantics.forNode(subject!.node).types.isNever(type)) {
            if (!temporary.add(1)) return undefined;
            emptyDemands.push(current);
          }
        }
      }
      if (entry.collect && current.kind === "leaf" && admitted(current.subject, entry.guards)) origins.add(current.subject);
      if (entry.collect && current.kind === "empty" && current.absence !== undefined &&
        admitted(current.absence.subject, entry.guards)) absence = true;
      if (current.kind === "unresolved") {
        reason ??= current.reason;
        if (current.exposure === undefined) fatalReason ??= current.reason;
      }
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
    const selected: (SourceStorageRelationWitness & { readonly original: boolean })[] = [];
    for (const [scope, inputs] of subjects) for (const [subject, mode] of inputs) {
      if (!budget.step()) return undefined;
      selected.push(Object.freeze({ subject, bindings: scope, contributes: (mode & 2) !== 0, original: (mode & 16) !== 0 }));
    }
    return Object.freeze({ subjects: Object.freeze(selected), origins, reason, fatalReason, absence,
      emptyDemands: Object.freeze(emptyDemands) });
  }));
  const trace = (origin: SourceStorageSubject, scope: SourceStorageScope): readonly SourceStorageRelationWitness[] | undefined => {
    const selected = walk(origin, scope);
    return selected?.reason === undefined && selected?.fatalReason === undefined && selected?.emptyDemands.length === 0
      ? selected.subjects : undefined;
  };
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
    if (selected === undefined || selected.reason !== undefined || selected.fatalReason !== undefined || selected.emptyDemands.length !== 0)
      return selected === undefined ? undefined
        : { reason: selected.fatalReason ?? selected.reason ?? sourceStorageMissingProducerReason, subjects: [] };
    const subjects: (SourceStorageScopedSubject & { readonly kind: "boundary" | "origin" })[] = [];
    for (const current of selected.subjects) {
      if (!budget.step()) return undefined;
      if (current.original) {
        if (!temporary.add(1)) return undefined;
        subjects.push(Object.freeze({ subject: current.subject, bindings: current.bindings,
          kind: stopped.get(current.bindings)?.has(current.subject) === true ? "boundary" : "origin" }));
      }
    }
    return { subjects: Object.freeze(subjects), reason: undefined };
  }));
  const selection = (origin: SourceStorageSubject, scope: SourceStorageScope): readonly SourceStorageScopedSubject[] | undefined => withQuery(() => {
    const selected = scopes.lookup(origin, scope);
    if (selected === undefined) return undefined;
    if (selected.kind === "expand") {
      const inputs = values(origin, scope);
      return inputs === undefined ? undefined : Object.freeze([...inputs]);
    }
    const inputs: SourceStorageScopedSubject[] = [];
    for (const input of selected.terms) {
      if (!budget.step()) return undefined;
      if (input.kind !== "reference" && input.kind !== "leaf") return undefined;
      inputs.push(Object.freeze({ subject: input.subject, bindings: input.scope }));
    }
    return Object.freeze(inputs);
  });
  const lexicalScopes = new Map<Node, SourceStorageScope>();
  const lexicalRows = budget.createRows();
  const forLexicalOwner = (node: Node): SourceStorageScope | undefined => budget.withRows(temporary => {
    const owners: Node[] = [];
    const visited = new Set<Node>();
    let current: Node | undefined = node;
    let parent: SourceStorageScope = scopes.empty;
    while (current !== undefined) {
      if (!budget.step()) return undefined;
      const existing = lexicalScopes.get(current);
      if (existing !== undefined) { parent = existing; break; }
      if (visited.has(current)) {
        budget.reject("Lexical substitution has a cyclic declaration ancestry."); return undefined;
      }
      if (!temporary.add(1)) return undefined;
      visited.add(current);
      if (isSourceCallableBodyBoundary(source.ast, current) || source.ast.is.IsClassDeclaration(current) ||
        source.ast.is.IsClassExpression(current)) {
        if (!temporary.add(1)) return undefined;
        owners.push(current);
      }
      const region = transport.regions.enclosing(current);
      current = region === undefined ? undefined : sourceStorageRegionOwner(source.ast, region);
    }
    while (owners.length !== 0) {
      if (!budget.step()) return undefined;
      const owner = owners.pop()!;
      const selected = scopes.declarationFor(owner, parent);
      if (selected === undefined || !lexicalRows.add(1)) return undefined;
      parent = selected;
      lexicalScopes.set(owner, parent);
    }
    return parent;
  });
  return Object.freeze({ empty: scopes.empty, values, origins, provenance, trace, walk, frontier, selection, contributingExecutions, forLexicalOwner,
    formals: scopes.formals,
    invocationContextKeyFor(invocation: Node, bindings: readonly SourceStorageScope[]): string | undefined {
      return withQuery(() => budget.withRows(temporary => {
        const subject = transport.subject(invocation);
        if (subject === undefined) return undefined;
        const target = transport.invocationTargets.get(invocation);
        const accessors = transport.accessorTargets.get(invocation);
        const operation = accessors === undefined ? undefined
          : source.ast.is.IsPropertyAccessExpression(invocation) ? source.semantics.forNode(invocation).operations.propertyAccess(invocation)
          : source.ast.is.IsElementAccessExpression(invocation) ? source.semantics.forNode(invocation).operations.elementAccess(invocation) : undefined;
        const receiver = transport.subjectFor(operation?.receiver.expression);
        const states: { readonly subject: SourceStorageSubject; readonly term: SourceStorageTerm }[][] = [];
        for (const scope of bindings) {
          if (!budget.step() || !temporary.add(1)) return undefined;
          const inputs: { readonly subject: SourceStorageSubject; readonly term: SourceStorageTerm }[] = [];
          const add = (term: SourceStorageTerm): boolean => {
            if (!temporary.add(1)) return false;
            inputs.push({ subject, term }); return true;
          };
          if (target !== undefined) {
            if (!add(Object.freeze({ kind: "application", mode: "execution", demand: invocation, activation: Object.freeze({ kind: "invoke" }),
              invocation, callee: sourceStorageReference(target, scope), scope, projection: Object.freeze([]) }))) return undefined;
          } else if (receiver !== undefined) {
            if (!add(Object.freeze({ kind: "member", mode: "execution", demand: invocation,
              selection: Object.freeze({ kind: "access", node: invocation }), receiver: sourceStorageReference(receiver, scope),
              scope, projection: Object.freeze([]) }))) return undefined;
          } else if (source.ast.is.IsSpreadAssignment(invocation) || source.ast.is.IsBindingElement(invocation)) {
            for (const accessor of accessors ?? []) {
              if (!budget.step()) return undefined;
              const receiver = transport.subjectFor(accessor.receiver);
              if (receiver === undefined || !add(Object.freeze({ kind: "member", mode: "execution", demand: invocation,
                selection: Object.freeze({ kind: "projection", subject: receiver, declaration: accessor.declaration,
                  evaluation: invocation, before: undefined }), receiver: sourceStorageReference(receiver, scope),
                scope, projection: Object.freeze([]) }))) return undefined;
            }
          }
          if (inputs.length === 0) {
            budget.reject("An invocation context requires its exact checked callee or accessor receiver.");
            return undefined;
          }
          states.push(inputs);
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
        activation: Object.freeze({ kind: "invoke" }),
        mode: "execution", demand: invocation, invocation, callee: Object.freeze({ kind: "leaf", subject: callee, scope: captured }),
        scope: caller, projection: Object.freeze([]) }));
    },
    identityFor: scopes.identity });
}
