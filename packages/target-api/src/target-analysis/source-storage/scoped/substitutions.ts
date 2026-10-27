import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import { sourceStorageHasOriginalCallableValue, sourceStorageHasOriginalValue, sourceStorageIsMemberProjection } from "../model/subjects.js";
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

const sourceStorageRelationKey = Symbol("source-storage-relation-key");
const sourceStorageRelationData = Symbol("source-storage-relation-data");

type SourceStorageRelation = SourceStorageTerm & {
  readonly [sourceStorageRelationKey]: string;
  readonly [sourceStorageRelationData]: SourceStorageRelationState;
};

type SourceStorageRelationState = Map<SourceStorageRelation, number> & {
    witnesses?: Map<SourceStorageScope, Map<SourceStorageSubject, number>>;
    filter?: { readonly reference: Node; readonly input: SourceStorageRelation };
    forwardProjection?: (value: SourceStorageTerm) =>
      readonly SourceStorageForwardSelection<SourceStorageRelation, SourceStorageTerm>[] | undefined;
    complete: boolean;
};

interface SourceStorageWalkDemand {
  readonly relation: SourceStorageRelation;
  readonly children: Set<SourceStorageWalkDemand>;
  boundary: boolean;
  terminal: boolean;
  coverage?: { readonly complete: boolean; readonly boundary: boolean };
}

export function createSourceStorageSubstitutions(source: TargetSourceProgram, budget: SourceStorageBudget,
  transport: SourceStorageScopedTransport,
  graphQueries: ReturnType<typeof createSourceStorageGraphQueries>) {
  const { invocationInputs } = transport;
  const recursion = createSourceStorageScopedRecursion(source, budget, transport, invocationInputs);
  const creation = Object.freeze({ footprints: createSourceStorageContextFootprints(budget, transport.contextualInputs,
    transport.contextLocation, transport.contextualInputs.applicationFor),
    ownerFor: (subject: SourceStorageSubject) => sourceStorageActivationOwner(source, transport.regions.enclosing, subject) });
  const scopes = createSourceStorageScopes(source, budget, transport.subject, invocationInputs, graphQueries, recursion.entryInputFor, creation, transport.inputSlotsFor);
  const keys = createSourceStorageScopedKeys(source, budget, transport, scopes, creation);
  const equations = createSourceStorageEquations(source, budget, transport, scopes, recursion, keys.invocation);
  const relations = new Map<string, SourceStorageRelation>();
  let querying = false;
  const withQuery = <Value>(collect: () => Value): Value => {
    if (querying) return collect();
    querying = true;
    try { return scopes.withQuery(collect); }
    finally {
      querying = false;
      keys.releaseReferenceMemo();
    }
  };
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
  const addWitness = (relation: SourceStorageRelation, reference: SourceStorageRelationWitness,
    data = relation[sourceStorageRelationData], reservation = rows): boolean => {
    if (budget.failure() !== undefined) return false;
    const current = relation;
    if ((current.kind === "reference" || current.kind === "leaf") && current.subject === reference.subject &&
      (current.scope === reference.bindings || witnessScope(current.subject, current.scope) === reference.bindings)) return true;
    const states = data.witnesses?.get(reference.bindings);
    const mode = (reference.contributes ? 2 : 1) | (reference.observesValue ? 4 : 0);
    const previous = states?.get(reference.subject);
    if (((previous ?? 0) & mode) === mode) return true;
    if (previous === undefined && !reservation.add(states === undefined ? 2 : 1)) return false;
    const selected = states ?? new Map<SourceStorageSubject, number>();
    const witnesses = data.witnesses ?? new Map<SourceStorageScope, Map<SourceStorageSubject, number>>();
    selected.set(reference.subject, (previous ?? 0) | mode);
    witnesses.set(reference.bindings, selected);
    data.witnesses = witnesses;
    return true;
  };
  const normalize = (term: SourceStorageTerm, witnesses: SourceStorageRelationWitness[], temporary: SourceStorageRows,
    contributes: boolean, observesValue: boolean): SourceStorageTerm | undefined => {
    while (true) {
      let witness: SourceStorageRelationWitness | undefined;
      if (term.kind === "reference" || term.kind === "leaf") {
        if (!budget.step() || !temporary.add(1)) return undefined;
        witness = { subject: term.subject, bindings: witnessScope(term.subject, term.scope), contributes, observesValue };
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
          !source.ast.is.IsVariableDeclaration(term.subject.node) && !source.ast.is.IsNewExpression(term.subject.node) &&
          !source.ast.is.IsPropertyAccessExpression(term.subject.node) &&
          !source.ast.is.IsElementAccessExpression(term.subject.node) && !transport.invocations.has(term.subject.node) &&
          !transport.accessorTargets.has(term.subject.node) && transport.storedValuesFor(term.subject) === undefined &&
          transport.incomingFor(term.subject).size === 0 && sourceStorageHasOriginalValue(term.subject, source.ast, false))
          return Object.freeze({ kind: "leaf", subject: term.subject, scope: witness!.bindings });
      }
      if (term.kind === "transition") {
        const condition = normalize(term.condition, witnesses, temporary, false, false);
        if (condition === undefined) return undefined;
        const transition = condition === term.condition ? term : Object.freeze({ ...term, condition });
        if (condition.kind === "leaf" && sourceStorageHasOriginalCallableValue(condition.subject, source.ast)) {
          const selected = successors.reduce(transition);
          if (selected === undefined) return undefined;
          if (selected.kind !== "replace" || selected.terms.length !== 1) {
            budget.reject("A selected callable transition requires its exact canonical replacement.");
            return undefined;
          }
          term = selected.terms[0]!;
          continue;
        }
        const guards: Extract<SourceStorageTerm, { readonly kind: "transition" }>[] = [];
        const conditions = new Map<number, Map<Node, Map<Node | undefined, Set<string>>>>();
        let current: SourceStorageTerm = transition;
        let duplicate = false;
        while (current.kind === "transition") {
          if (!budget.step()) return undefined;
          const key = keys.encode(current.condition);
          if (key === undefined) return undefined;
          const equation = conditions.get(current.capture.equation.identity);
          const owner = equation?.get(current.capture.owner);
          const selected = owner?.get(current.capture.capture);
          if (selected?.has(key)) {
            if (normalize(current.condition, witnesses, temporary, false, false) === undefined) return undefined;
            duplicate = true;
          } else {
            if (!temporary.add(2 + (equation === undefined ? 2 : 0) + (owner === undefined ? 2 : 0) +
              (selected === undefined ? 1 : 0))) return undefined;
            const retainedEquation = equation ?? new Map<Node, Map<Node | undefined, Set<string>>>();
            const retainedOwner = owner ?? new Map<Node | undefined, Set<string>>();
            const retained = selected ?? new Set<string>();
            retained.add(key);
            retainedOwner.set(current.capture.capture, retained);
            retainedEquation.set(current.capture.owner, retainedOwner);
            conditions.set(current.capture.equation.identity, retainedEquation);
            guards.push(current);
          }
          current = current.value;
        }
        if (!duplicate) return transition;
        for (let index = guards.length - 1; index >= 0; index -= 1) {
          const guard = guards[index]!;
          current = Object.freeze({ kind: "transition", capture: guard.capture, condition: guard.condition, value: current });
        }
        return current;
      }
      break;
    }
    if (term.kind === "store") {
      const destination = normalize(term.destination, witnesses, temporary, false, observesValue);
      const receiver = normalize(term.receiver, witnesses, temporary, false, observesValue);
      const value = normalize(term.value, witnesses, temporary, contributes, observesValue);
      return destination === undefined || receiver === undefined || value === undefined ? undefined
        : destination === term.destination && receiver === term.receiver && value === term.value ? term
          : Object.freeze({ ...term, destination, receiver, value });
    }
    if (term.kind === "empty" && term.absence !== undefined) {
      if (!budget.step() || !temporary.add(1)) return undefined;
      witnesses.push({ subject: term.absence.subject, bindings: witnessScope(term.absence.subject, term.absence.scope), contributes, observesValue });
    }
    if (term.kind === "guarded") {
      let current: SourceStorageTerm = term;
      let guards: SourceStorageValueGuards | undefined;
      const references = new Set<Node>();
      let duplicate = false;
      while (current.kind === "guarded") {
        if (!budget.step()) return undefined;
        duplicate ||= references.has(current.reference);
        if (!references.has(current.reference) && !temporary.add(1)) return undefined;
        references.add(current.reference);
        const selected = transport.guardedValues.conjoin(guards, current.reference);
        if (budget.failure() !== undefined) return undefined;
        if (selected === null) return emptyTerm;
        guards = selected;
        current = current.value;
      }
      const normalized = normalize(current, witnesses, temporary, false, observesValue);
      if (normalized === undefined) return undefined;
      if (!duplicate && normalized === current) return term;
      let value: SourceStorageTerm = normalized;
      for (const reference of [...references].reverse()) value = Object.freeze({ kind: "guarded", value, reference });
      return value;
    }
    if (term.kind === "member") {
      const receiver = normalize(term.receiver, witnesses, temporary, false, observesValue);
      return receiver === undefined ? undefined : receiver === term.receiver ? term : Object.freeze({ ...term, receiver });
    }
    if (term.kind === "pointer") {
      const pointer = normalize(term.pointer, witnesses, temporary, false, observesValue);
      const input = term.input === undefined ? undefined : normalize(term.input, witnesses, temporary, false, observesValue);
      return pointer === undefined || term.input !== undefined && input === undefined ? undefined
        : pointer === term.pointer && input === term.input ? term : Object.freeze({ ...term, pointer, input });
    }
    if (term.kind === "application") {
      const callee = normalize(term.callee, witnesses, temporary, false, false);
      if (term.activation.kind === "provided") {
        const argument = term.activation.argument === undefined ? undefined : normalize(term.activation.argument, witnesses, temporary, false, false);
        return callee === undefined || term.activation.argument !== undefined && argument === undefined ? undefined
          : callee === term.callee && argument === term.activation.argument ? term
            : Object.freeze({ ...term, callee, activation: argument === term.activation.argument
              ? term.activation : Object.freeze({ kind: "provided", argument }) });
      }
      return callee === undefined ? undefined : callee === term.callee ? term : Object.freeze({ ...term, callee });
    }
    return term;
  };
  const intern = (term: SourceStorageTerm): SourceStorageRelation | undefined => scopes.withTraversal(() => budget.withRows(temporary => {
    if (!budget.step()) return undefined;
    if (sourceStorageRelationKey in term && typeof term[sourceStorageRelationKey] === "string") {
      const canonical = relations.get(term[sourceStorageRelationKey]);
      if (canonical === term) return canonical;
    }
    const retained: SourceStorageRelationWitness[] = [];
    const normalized = term.kind === "leaf" ? term : normalize(term, retained, temporary, true, true);
    if (normalized === undefined) { budget.reject(`Source storage ${term.kind} terms require an exact normalized form.`); return undefined; }
    const key = keys.encode(normalized);
    if (key === undefined) { budget.reject(`Source storage ${normalized.kind} terms require an exact relation key.`); return undefined; }
    let selected = relations.get(key);
    if (selected === undefined) {
      if (!rows.add(2)) return undefined;
      const node: SourceStorageRelation = { ...normalized, [sourceStorageRelationKey]: key,
        [sourceStorageRelationData]: Object.assign(new Map<SourceStorageRelation, number>(), { complete: false }) };
      Object.defineProperties(node, {
        [sourceStorageRelationKey]: { enumerable: false },
        [sourceStorageRelationData]: { enumerable: false },
      });
      Object.freeze(node);
      selected = node;
      relations.set(key, selected);
    }
    if (selected.kind !== "empty" || selected.absence !== undefined) for (const witness of retained)
      if (!addWitness(selected, witness)) return undefined;
    if (term.kind === "leaf" && (selected.kind !== "leaf" || selected.subject !== term.subject ||
      selected.scope !== term.scope) && !addWitness(selected, { subject: term.subject,
        bindings: witnessScope(term.subject, term.scope), contributes: true, observesValue: true })) return undefined;
    return selected;
  }));
  const derive = (relation: SourceStorageRelation,
    read: (relation: SourceStorageRelation) => ReadonlySet<SourceStorageTerm> | undefined,
    emit: (relation: SourceStorageRelation, direct: boolean) => boolean,
    project: (input: SourceStorageRelation, select: (value: SourceStorageTerm) => readonly SourceStorageRelation[] | undefined) => boolean,
    stateFor: (relation: SourceStorageRelation) => SourceStorageRelationState | undefined = relation => relation[sourceStorageRelationData],
    reservation = rows): boolean => scopes.withTraversal(() => {
    const current = relation;
    const data = stateFor(relation);
    if (data === undefined) return false;
    const children = data;
    const retain = (term: SourceStorageTerm, values = true): SourceStorageRelation | undefined => {
      const selected = intern(term);
      if (selected === undefined) { budget.reject("Source storage relations require an interned successor term."); return undefined; }
      if (!children.has(selected) && !reservation.add(1)) return undefined;
      children.set(selected, (children.get(selected) ?? 0) | (values ? 2 : 1));
      return selected;
    };
    const select = (term: SourceStorageTerm, values = true): ReadonlySet<SourceStorageTerm> | undefined => {
      const selected = retain(term, values);
      if (selected === undefined) return undefined;
      children.set(selected, children.get(selected)! | 8);
      return read(selected);
    };
    const previousRead = currentRead;
    currentRead = term => select(term, false);
    try {
      for (const [child, mode] of children) {
        if (!budget.step()) return false;
        if ((mode & 2) !== 0 && !emit(child, child.kind === "leaf" || child.kind === "unresolved" || child.kind === "empty")) return false;
      }
      if (current.kind === "leaf" || current.kind === "unresolved" || current.kind === "effect" || current.kind === "empty") return emit(relation, true);
      const selected = successors.reduce(current);
      if (selected === undefined) return budget.failure() === undefined;
      if (selected.kind === "project") {
        for (const term of selected.inputs) {
          const input = retain(term, false);
          if (input === undefined) return false;
          children.set(input, children.get(input)! | 4);
          if (selected.valueFilter !== undefined) {
            if (selected.inputs.length !== 1) { budget.reject("A guarded storage projection requires one exact original value."); return false; }
            if (data.filter === undefined && !reservation.add(1)) return false;
            data.filter = { reference: selected.valueFilter, input };
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
        const reference = { ...witness, bindings: witnessScope(witness.subject, witness.bindings) };
        if (!budget.step() || !addWitness(relation, reference, data, reservation)) return false;
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
  const evaluateRelation = (current: SourceStorageRelation,
    read: (relation: SourceStorageRelation) => ReadonlySet<SourceStorageTerm> | undefined,
    emit: (value: SourceStorageTerm) => boolean,
    forward: (relation: SourceStorageRelation,
      projection?: (value: SourceStorageTerm) => readonly SourceStorageForwardSelection<SourceStorageRelation, SourceStorageTerm>[] | undefined) => boolean,
    stateFor: (relation: SourceStorageRelation) => SourceStorageRelationState | undefined = relation => relation[sourceStorageRelationData],
    reservation = rows): boolean => {
    const state = stateFor(current);
    if (state === undefined) return false;
    const complete = derive(current, read, (relation, direct) => direct ? emit(relation) : forward(relation), (input, select) => {
      let projection = state.forwardProjection;
      if (projection === undefined) {
        if (!reservation.add(1)) return false;
        projection = value => select(value)?.map(relation => relation.kind === "leaf" || relation.kind === "unresolved"
          ? { kind: "value", value: relation } : { kind: "relation", key: relation });
        state.forwardProjection = projection;
      }
      return forward(input, projection);
    }, stateFor, reservation);
    if (complete) state.complete = true;
    return complete;
  };
  const results = graphQueries.fixedPoint<SourceStorageRelation, SourceStorageTerm>(evaluateRelation, "storage-relations");
  const selectRoot = (origin: SourceStorageSubject, scope: SourceStorageScope): SourceStorageRelation | undefined => intern(sourceStorageReference(origin, scope));
  const values = (origin: SourceStorageSubject, scope: SourceStorageScope): ReadonlySet<SourceStorageScopedSubject> | undefined => withQuery(() => {
    const root = selectRoot(origin, scope);
    const selected = root === undefined ? undefined : results(root);
    if (selected === undefined) return undefined;
    const values = new Set<SourceStorageScopedSubject>();
    for (const value of selected) {
      if (!budget.step()) return undefined;
      if (value.kind === "unresolved" && value.executionOnly !== true) {
        if (value.exposure === undefined) budget.reject(value.reason); return undefined;
      }
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
      if (value.kind === "unresolved" && value.executionOnly !== true) {
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
  const hasStaticValue = (relation: SourceStorageRelation, data = relation[sourceStorageRelationData]): boolean | undefined => {
    if (relation.kind === "leaf" || relation.kind === "unresolved" || relation.kind === "empty") return true;
    if (!data.complete || data.forwardProjection !== undefined) return false;
    let present = false;
    for (const [child, mode] of data) {
      if (!budget.step()) return undefined;
      if ((mode & 12) !== 0) return false;
      present ||= (mode & 2) !== 0 && (child.kind === "leaf" || child.kind === "unresolved" || child.kind === "empty");
    }
    return present;
  };
  const walk = (origin: SourceStorageSubject, scope: SourceStorageScope,
    stopAt?: (subject: SourceStorageScopedSubject & { readonly original: boolean }) => boolean, preserveValuePath = false) => withQuery(() => scopes.withTraversal(() => budget.withRows(temporary => {
    const root = selectRoot(origin, scope);
    if (root === undefined) return undefined;
    const localStates = stopAt === undefined ? undefined : new Map<SourceStorageRelation, SourceStorageRelationState>();
    const stoppedRelations = new Set<SourceStorageRelation>();
    const stateFor = (relation: SourceStorageRelation): SourceStorageRelationState | undefined => {
      if (localStates === undefined) return relation[sourceStorageRelationData];
      const existing = localStates.get(relation);
      if (existing !== undefined) return existing;
      if (!temporary.add(2)) return undefined;
      const state: SourceStorageRelationState = Object.assign(new Map<SourceStorageRelation, number>(), { complete: false });
      localStates.set(relation, state);
      return state;
    };
    const stops = (relation: SourceStorageRelation): boolean | undefined => {
      if (stopAt === undefined) return false;
      if (stoppedRelations.has(relation)) return true;
      const inspect = (subject: SourceStorageSubject, bindings: SourceStorageScope, original: boolean): boolean =>
        stopAt({ subject, bindings, original });
      let stopped = (relation.kind === "reference" || relation.kind === "leaf") &&
        inspect(relation.subject, witnessScope(relation.subject, relation.scope), relation.kind === "leaf");
      for (const [bindings, witnesses] of relation[sourceStorageRelationData].witnesses ?? []) {
        for (const [subject, mode] of witnesses) {
          if (!budget.step()) return undefined;
          if ((mode & 2) !== 0 && inspect(subject, bindings, false)) stopped = true;
        }
      }
      if (stopped) {
        if (!temporary.add(1)) return undefined;
        stoppedRelations.add(relation);
      }
      return stopped;
    };
    const boundedResults = stopAt === undefined ? undefined
      : graphQueries.fixedPoint<SourceStorageRelation, SourceStorageTerm>((relation, read, emit, forward) => {
        const stopped = stops(relation);
        if (stopped === undefined) return false;
        if (stopped) {
          const state = stateFor(relation);
          if (state === undefined) return false;
          state.complete = true;
          return true;
        }
        return evaluateRelation(relation, read, emit, forward, stateFor, temporary);
      }, "storage-boundary-relations");
    const readResults = boundedResults ?? results;
    try {
    if (readResults(root) === undefined) return undefined;
    const visited = new Map<SourceStorageRelation, number | Map<string, number>>();
    const pending: { readonly relation: SourceStorageRelation; readonly collect: boolean; readonly observesValue: boolean;
      readonly frontier: boolean; readonly guards?: SourceStorageValueGuards }[] = [
      { relation: root, collect: true, observesValue: true, frontier: false }];
    const subjects = new Map<SourceStorageScope, Map<SourceStorageSubject, number>>();
    const origins = new Set<SourceStorageSubject>();
    const emptyDemands: SourceStorageTerm[] = [];
    const demands = new Map<SourceStorageRelation, Map<string, SourceStorageWalkDemand>>();
    const deferredDemands = new Set<SourceStorageWalkDemand>();
    const demandFor = (relation: SourceStorageRelation, guards: SourceStorageValueGuards | undefined):
      SourceStorageWalkDemand | undefined => {
      const key = guards?.key ?? "";
      const variants = demands.get(relation);
      const existing = variants?.get(key);
      if (existing !== undefined) return existing;
      if (!temporary.add(variants === undefined ? 3 : 2)) return undefined;
      const selected: SourceStorageWalkDemand = { relation, children: new Set(), boundary: false,
        terminal: relation.kind === "leaf" || relation.kind === "empty" };
      const states = variants ?? new Map<string, SourceStorageWalkDemand>();
      states.set(key, selected);
      demands.set(relation, states);
      return selected;
    };
    const coveredByBoundary = (root: SourceStorageWalkDemand): boolean | undefined => {
      const pending: { readonly demand: SourceStorageWalkDemand; readonly complete: boolean }[] = [{ demand: root, complete: false }];
      const active = new Set<SourceStorageWalkDemand>();
      while (pending.length !== 0) {
        if (!budget.step()) return undefined;
        const { demand, complete } = pending.pop()!;
        if (demand.coverage !== undefined) continue;
        if (demand.boundary || demand.terminal) {
          demand.coverage = { complete: true, boundary: demand.boundary };
          continue;
        }
        if (complete) {
          active.delete(demand);
          let proved = demand.children.size !== 0;
          let boundary = false;
          for (const child of demand.children) {
            if (!budget.step()) return undefined;
            proved &&= child.coverage?.complete === true;
            boundary ||= child.coverage?.boundary === true;
          }
          demand.coverage = { complete: proved, boundary: proved && boundary };
          continue;
        }
        if (active.has(demand)) {
          demand.coverage = { complete: false, boundary: false };
          continue;
        }
        if (!temporary.add(1 + demand.children.size)) return undefined;
        active.add(demand);
        pending.push({ demand, complete: true });
        for (const child of demand.children) pending.push({ demand: child, complete: false });
      }
      return root.coverage?.complete === true && root.coverage.boundary;
    };
    let reason: string | undefined;
    let fatalReason: string | undefined;
    let absence = false;
    const project = (input: SourceStorageRelation,
      select: (value: SourceStorageTerm) => readonly SourceStorageRelation[] | undefined): boolean => {
      const values = readResults(input);
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
    const collectWitnesses = (current: SourceStorageRelation, collect: boolean, observesValue: boolean,
      guards: SourceStorageValueGuards | undefined, frontier: boolean): boolean | undefined => {
      let stopped = false;
      const retain = (scope: SourceStorageScope, input: SourceStorageSubject, mode: number): boolean => {
        if (!budget.step()) return false;
        const retained = subjects.get(scope) ?? new Map<SourceStorageSubject, number>();
        const previous = retained.get(input) ?? 0;
        const observed = observesValue && (mode & 6) !== 0;
        const required = (collect && (mode & 2) !== 0 ? 2 | (mode & 16) : 1) | (observed ? 128 : 0);
        if (stopAt === undefined && guards === undefined && (previous & required) === required) return true;
        if (!retained.has(input) && !temporary.add(1)) return false;
        const contributes = collect && (mode & 2) !== 0 && admitted(input, guards);
        let selected = previous | (contributes ? 2 : 1) | (observed ? 128 : 0);
        if (contributes && (mode & 16) !== 0) selected |= 16;
        if ((contributes || frontier && (mode & 2) !== 0 && admitted(input, guards)) && stopAt !== undefined) {
          const original = (mode & 16) !== 0;
          const inspected = original ? 32 : 4;
          const boundary = original ? 64 : 8;
          if ((selected & inspected) === 0) selected |= inspected |
            (stopAt({ subject: input, bindings: scope, original }) ? boundary : 0);
          if ((selected & boundary) !== 0) { origins.add(input); selected |= 2 | 16; stopped = true; }
        }
        retained.set(input, selected); subjects.set(scope, retained);
        return true;
      };
      const term = current;
      if (term.kind === "reference" && !retain(witnessScope(term.subject, term.scope), term.subject, 2)) return undefined;
      if (term.kind === "leaf" && !retain(term.scope, term.subject, 2 | 16)) return undefined;
      for (const [scope, inputs] of current[sourceStorageRelationData].witnesses ?? []) for (const [input, mode] of inputs) {
        if (!retain(scope, input, mode)) return undefined;
      }
      const local = localStates?.get(current);
      for (const [scope, inputs] of local?.witnesses ?? []) for (const [input, mode] of inputs) {
        if (!retain(scope, input, mode)) return undefined;
      }
      return stopped;
    };
    while (pending.length !== 0) {
      if (!budget.step()) return undefined;
      const entry = pending.pop()!; const relation = entry.relation; const current = relation;
      const flag = (entry.collect ? 2 : 1) | (entry.observesValue ? 4 : 0) | (entry.frontier ? 8 : 0);
      const guardsKey = entry.guards?.key ?? "";
      const visitedGuards = visited.get(relation);
      const previous = typeof visitedGuards === "number" ? guardsKey === "" ? visitedGuards : 0
        : visitedGuards?.get(guardsKey) ?? 0;
      if ((previous & flag) === flag) continue;
      if (visitedGuards === undefined && guardsKey === "") {
        if (!temporary.add(1)) return undefined;
        visited.set(relation, flag);
      } else if (typeof visitedGuards === "number" && guardsKey === "") {
        visited.set(relation, visitedGuards | flag);
      } else {
        if ((visitedGuards === undefined || typeof visitedGuards === "number") && !temporary.add(2) ||
          visitedGuards instanceof Map && !visitedGuards.has(guardsKey) && !temporary.add(1)) return undefined;
        const retainedGuards = visitedGuards instanceof Map ? visitedGuards : new Map<string, number>(
          visitedGuards === undefined ? [] : [["", visitedGuards]]);
        retainedGuards.set(guardsKey, previous | flag);
        visited.set(relation, retainedGuards);
      }
      const stopped = collectWitnesses(relation, entry.collect, entry.observesValue, entry.guards, entry.frontier);
      if (stopped === undefined) return undefined;
      const demand = entry.collect || entry.frontier ? demandFor(relation, entry.guards) : undefined;
      if ((entry.collect || entry.frontier) && demand === undefined) return undefined;
      if (stopped) { if (demand !== undefined) demand.boundary = true; continue; }
      const data = stateFor(relation);
      if (data === undefined) return undefined;
      if (!data.complete) {
        if (!derive(relation, readResults, () => true, project, stateFor, localStates === undefined ? rows : temporary)) return undefined;
        data.complete = true;
        const completed = collectWitnesses(relation, entry.collect, entry.observesValue, entry.guards, entry.frontier);
        if (completed === undefined) return undefined;
        if (completed) { if (demand !== undefined) demand.boundary = true; continue; }
      }
      if (entry.collect && current.kind !== "execution-root" && current.kind !== "region" && current.kind !== "effect") {
        const present = hasStaticValue(relation, data);
        if (present === undefined) return undefined;
        if (!present) {
          if (demand === undefined || !deferredDemands.has(demand) && !temporary.add(1)) return undefined;
          deferredDemands.add(demand);
        }
      }
      if (entry.collect && current.kind === "leaf" && admitted(current.subject, entry.guards)) origins.add(current.subject);
      if (entry.collect && current.kind === "empty" && current.absence !== undefined &&
        admitted(current.absence.subject, entry.guards)) absence = true;
      if (current.kind === "unresolved" && current.executionOnly !== true) {
        reason ??= current.reason;
        if (current.exposure === undefined) fatalReason ??= current.reason;
      }
      const filter = preserveValuePath ? data.filter : undefined;
      if (filter !== undefined) {
        const guards = transport.guardedValues.conjoin(entry.guards, filter.reference);
        if (budget.failure() !== undefined) return undefined;
        if (guards !== null) {
          if (demand !== undefined) {
            const child = demandFor(filter.input, guards);
            if (child === undefined || !demand.children.has(child) && !temporary.add(1)) return undefined;
            demand.children.add(child);
          }
          pending.push({ relation: filter.input, collect: entry.collect, observesValue: entry.observesValue,
            frontier: entry.frontier, guards });
        } else if (demand !== undefined) demand.terminal = true;
        continue;
      }
      for (const [child, mode] of data) {
        if (!budget.step()) return undefined;
        if (child.kind !== "execution-root") {
          const frontier = entry.frontier && (mode & 2) !== 0 ||
            (entry.collect || entry.frontier) && (mode & 4) !== 0;
          if (demand !== undefined && ((mode & 2) !== 0 || frontier)) {
            const selected = demandFor(child, entry.guards);
            if (selected === undefined || !demand.children.has(selected) && !temporary.add(1)) return undefined;
            demand.children.add(selected);
          }
          pending.push({ relation: child, collect: entry.collect && (mode & 2) !== 0,
            observesValue: entry.observesValue && (mode & 6) !== 0, frontier, guards: entry.guards });
        }
      }
    }
    for (const demand of deferredDemands) {
      const covered = coveredByBoundary(demand);
      if (covered === undefined) return undefined;
      if (covered) continue;
      const completed = readResults(demand.relation);
      if (completed === undefined) return undefined;
      if (completed.size !== 0) continue;
      const current = demand.relation;
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
    const selected: (SourceStorageRelationWitness & { readonly original: boolean })[] = [];
    for (const [scope, inputs] of subjects) for (const [subject, mode] of inputs) {
      if (!budget.step()) return undefined;
      selected.push(Object.freeze({ subject, bindings: scope, contributes: (mode & 2) !== 0,
        observesValue: (mode & 128) !== 0, original: (mode & 16) !== 0 }));
    }
    return Object.freeze({ subjects: Object.freeze(selected), origins, reason, fatalReason, absence,
      emptyDemands: Object.freeze(emptyDemands) });
    } finally { boundedResults?.release(); }
  })));
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
  return Object.freeze({ empty: scopes.empty, withQuery, values, origins, provenance, trace, walk, frontier, selection, contributingExecutions, forLexicalOwner,
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
            inputs.push({ subject, term: selected });
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
    forInvocation: (candidate: Node, invocation: Node, caller: SourceStorageScope, captured: SourceStorageScope,
      callee: SourceStorageSubject | undefined) => withQuery(() => {
      if (transport.accessorTargets.has(invocation)) return scopes.frameFor(candidate, invocation, caller, captured);
      if (callee === undefined || !transport.invocationTargets.has(invocation)) {
        budget.reject("An invocation context requires its exact checked callee transport.");
        return undefined;
      }
      return equations.scopeFor(candidate, invocation, caller, captured, Object.freeze({ kind: "application",
        activation: Object.freeze({ kind: "invoke" }),
        mode: "execution", demand: invocation, invocation, callee: Object.freeze({ kind: "leaf", subject: callee, scope: captured }),
        scope: caller, projection: Object.freeze([]) }));
    }),
    identityFor: scopes.identity });
}
