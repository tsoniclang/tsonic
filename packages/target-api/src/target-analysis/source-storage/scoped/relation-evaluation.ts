import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import { sourceStorageHasOriginalCallableValue, sourceStorageHasOriginalValue, sourceStorageIsMemberProjection } from "../model/subjects.js";
import type { SourceStorageBudget, SourceStorageRows } from "../model/resource-budget.js";
import type { createSourceStorageGraphQueries, SourceStorageForwardSelection } from "../graph/graph-queries.js";
import type { createSourceStorageScopes } from "./scoped-scopes.js";
import type { createSourceStorageScopedKeys } from "./scoped-keys.js";
import type { createSourceStorageEquations } from "./scoped-equations.js";
import { createSourceStorageScopedSuccessors } from "./scoped-successors.js";
import type { createSourceStorageExecutionReachability } from "./execution-reachability.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
import { sourceStorageInputBinding } from "./scoped-transport.js";
import type { SourceStorageScope, SourceStorageTerm, SourceStorageScopedSubject, SourceStorageRelationWitness,
  SourceStorageReference } from "../graph/scoped-model.js";
import { sourceStorageReference } from "../graph/scoped-model.js";
import { sourceStorageRegionOwner } from "../graph/lexical-regions.js";
import { Node_Initializer } from "../../../source-navigation/index.js";
import type { SourceStorageValueGuards } from "../graph/guarded-values.js";
import type { SourceStorageCreationContext } from "./activation-keys.js";
import { createSourceStorageInitializerSummaries } from "./initializer-summaries.js";

const sourceStorageRelationKey = Symbol("source-storage-relation-key");
export const sourceStorageRelationData = Symbol("source-storage-relation-data");

export function sourceStorageIsTerminalValue(term: SourceStorageTerm): boolean {
  return term.kind === "leaf" || term.kind === "input-frontier" || term.kind === "unresolved" || term.kind === "empty";
}

export type SourceStorageInputWalkBoundary = {
  readonly kind: "input";
  admits(subject: SourceStorageScopedSubject & { readonly original: boolean }): boolean;
};

export type SourceStorageRelation = SourceStorageTerm & {
  readonly [sourceStorageRelationKey]: string;
  readonly [sourceStorageRelationData]: SourceStorageRelationState;
};

type SourceStorageRelationState = Map<SourceStorageRelation, number> & {
    witnesses?: Map<SourceStorageScope, Map<SourceStorageSubject, number>>;
    filter?: { readonly reference: Node; readonly input: SourceStorageRelation };
    forwardProjection?: (value: SourceStorageTerm) =>
      readonly SourceStorageForwardSelection<SourceStorageRelation, SourceStorageTerm>[] | undefined;
    complete: boolean;
    instantiation?: { readonly input: SourceStorageRelation;
      readonly substitutions: ReadonlyMap<SourceStorageScope, SourceStorageScope> };
};

type SourceStorageNormalizationWitness = SourceStorageRelationWitness & { readonly actual: boolean };

export function createSourceStorageRelationEvaluation(source: TargetSourceProgram, budget: SourceStorageBudget,
  transport: SourceStorageScopedTransport, scopes: ReturnType<typeof createSourceStorageScopes>,
  equations: ReturnType<typeof createSourceStorageEquations>, reachability: ReturnType<typeof createSourceStorageExecutionReachability>,
  keys: ReturnType<typeof createSourceStorageScopedKeys>, evaluationQueries: ReturnType<typeof createSourceStorageGraphQueries>,
  creation: SourceStorageCreationContext,
  boundary?: SourceStorageInputWalkBoundary) {
  const relations = new Map<string, SourceStorageRelation>();
  const rows = budget.createRows();
  const emptyTerm: SourceStorageTerm = Object.freeze({ kind: "empty", absence: undefined });
  const initializers = createSourceStorageInitializerSummaries(source, budget, scopes, creation, keys);
  const witnessScope = (subject: SourceStorageSubject, scope: SourceStorageScope): SourceStorageScope => {
    if (scope === scopes.empty || subject.kind === "member") return scope;
    const region = transport.regions.enclosing(subject.node);
    const owner = subject.kind === "return" || subject.kind === "receiver" ? subject.node
      : region === undefined ? undefined : sourceStorageRegionOwner(source.ast, region);
    return owner === undefined ? scopes.empty : scopes.owningScope(scope, owner) ?? scope;
  };
  let currentRead: ((term: SourceStorageTerm) => ReadonlySet<SourceStorageTerm> | undefined) | undefined;
  const outside = (subject: SourceStorageSubject, scope: SourceStorageScope): SourceStorageReference | undefined => {
    if (boundary?.kind !== "input") return undefined;
    const input = subject.projection.length === 0 ? subject : transport.subject(subject.node, subject.kind);
    return input !== undefined && boundary.admits({ subject: input, bindings: scope, original: true })
      ? sourceStorageReference(input, scope) : undefined;
  };
  const successors = createSourceStorageScopedSuccessors(source, budget, transport, scopes, equations, reachability, keys.birth, keys.closed,
    term => currentRead === undefined ? undefined : currentRead(term), initializers.instantiate, outside);
  const addWitness = (relation: SourceStorageRelation, reference: SourceStorageRelationWitness,
    actual = false): boolean => {
    if (budget.failure() !== undefined) return false;
    const current = relation;
    if ((current.kind === "reference" || current.kind === "leaf") && current.subject === reference.subject &&
      (current.scope === reference.bindings || witnessScope(current.subject, current.scope) === reference.bindings)) return true;
    const data = relation[sourceStorageRelationData];
    const states = data.witnesses?.get(reference.bindings);
    const mode = (reference.contributes ? 2 : 1) | (reference.observesValue ? 4 : 0) | (actual ? 8 : 0);
    const previous = states?.get(reference.subject);
    if (((previous ?? 0) & mode) === mode) return true;
    if (previous === undefined && !rows.add(states === undefined ? 2 : 1)) return false;
    const selected = states ?? new Map<SourceStorageSubject, number>();
    const witnesses = data.witnesses ?? new Map<SourceStorageScope, Map<SourceStorageSubject, number>>();
    selected.set(reference.subject, (previous ?? 0) | mode);
    witnesses.set(reference.bindings, selected);
    data.witnesses = witnesses;
    return true;
  };
  const normalize = (term: SourceStorageTerm, witnesses: SourceStorageNormalizationWitness[], temporary: SourceStorageRows,
    contributes: boolean, observesValue: boolean, actual = false): SourceStorageTerm | undefined => {
    while (true) {
      let witness: SourceStorageNormalizationWitness | undefined;
      if (term.kind === "reference" || term.kind === "leaf") {
        if (!budget.step() || !temporary.add(1)) return undefined;
        witness = { subject: term.subject, bindings: witnessScope(term.subject, term.scope), contributes, observesValue, actual };
        witnesses.push(witness);
      } else if (!budget.step()) return undefined;
      if (term.kind === "reference") {
        if (term.views !== undefined) return term;
        if (term.subject.kind === "value" && term.subject.projection.length === 0 &&
          (source.ast.is.IsObjectLiteralExpression(term.subject.node) || source.ast.is.IsArrayLiteralExpression(term.subject.node) ||
            source.ast.is.IsArrowFunction(term.subject.node) || source.ast.is.IsFunctionExpression(term.subject.node)))
          return Object.freeze({ kind: "leaf", subject: term.subject, scope: witness!.bindings });
        const input = term.subject.kind === "value" ? transport.bindingInputFor(term.subject) : undefined;
        if (input !== undefined) { term = sourceStorageReference(input, term.scope); continue; }
        if (term.scope !== scopes.empty && (term.subject.kind === "receiver" ||
          term.subject.kind === "input" && Node_Initializer(source.ast, term.subject.node) === undefined)) {
          const selected = sourceStorageInputBinding(source, budget, transport, scopes, term, undefined);
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
      witnesses.push({ subject: term.absence.subject, bindings: witnessScope(term.absence.subject, term.absence.scope), contributes, observesValue, actual });
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
    const retained: SourceStorageNormalizationWitness[] = [];
    let normalized = term.kind === "leaf" ? term : normalize(term, retained, temporary, true, true, true);
    if (normalized === undefined) { budget.reject(`Source storage ${term.kind} terms require an exact normalized form.`); return undefined; }
    if (normalized.kind === "leaf" && !sourceStorageHasOriginalCallableValue(normalized.subject, source.ast)) {
      const input = outside(normalized.subject, normalized.scope);
      if (input !== undefined) normalized = Object.freeze({ kind: "input-frontier", input,
        preservesInput: normalized.subject === input.subject,
        subject: normalized.subject, scope: normalized.scope, guards: normalized.guards, views: normalized.views });
    }
    const key = keys.encode(normalized);
    if (key === undefined) { budget.reject(`Source storage ${normalized.kind} terms require an exact relation key.`); return undefined; }
    let selected = relations.get(key);
    if (selected === undefined) {
      if (!rows.add(2)) return undefined;
      const node: SourceStorageRelation = { ...normalized, [sourceStorageRelationKey]: key,
        [sourceStorageRelationData]: Object.assign(new Map<SourceStorageRelation, number>(), {
          complete: sourceStorageIsTerminalValue(normalized) }) };
      Object.defineProperties(node, {
        [sourceStorageRelationKey]: { enumerable: false },
        [sourceStorageRelationData]: { enumerable: false },
      });
      Object.freeze(node);
      selected = node;
      relations.set(key, selected);
    }
    if (selected.kind !== "empty" || selected.absence !== undefined) for (const witness of retained)
      if (!addWitness(selected, witness, witness.actual)) return undefined;
    if (term.kind === "leaf" && (selected.kind !== "leaf" || selected.subject !== term.subject ||
      selected.scope !== term.scope) && !addWitness(selected, { subject: term.subject,
        bindings: witnessScope(term.subject, term.scope), contributes: true, observesValue: true }, true)) return undefined;
    return selected;
  }));
  const derive = (relation: SourceStorageRelation,
    read: (relation: SourceStorageRelation) => ReadonlySet<SourceStorageTerm> | undefined,
    emit: (relation: SourceStorageRelation, direct: boolean) => boolean,
    project: (input: SourceStorageRelation, select: (value: SourceStorageTerm) => readonly SourceStorageRelation[] | undefined) => boolean): boolean => scopes.withTraversal(() => {
    const current = relation;
    const data = relation[sourceStorageRelationData];
    const children = data;
    const retain = (term: SourceStorageTerm, values = true): SourceStorageRelation | undefined => {
      const selected = intern(term);
      if (selected === undefined) { budget.reject("Source storage relations require an interned successor term."); return undefined; }
      if (!children.has(selected) && !rows.add(1)) return undefined;
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
        if ((mode & 2) !== 0 && !emit(child, sourceStorageIsTerminalValue(child))) return false;
      }
      if (sourceStorageIsTerminalValue(current) || current.kind === "effect") return emit(relation, true);
      if (current.kind === "instantiation" && data.instantiation === undefined) {
        const input = intern(current.value);
        if (input === undefined || !rows.add(2)) return false;
        data.instantiation = { input, substitutions: new Map([[current.parameter, current.scope]]) };
      }
      const selected = successors.reduce(current);
      if (selected === undefined) return budget.failure() === undefined;
      if (selected.kind === "project") {
        for (const term of selected.inputs) {
          const input = retain(term, false);
          if (input === undefined) return false;
          children.set(input, children.get(input)! | 4);
          if (selected.valueFilter !== undefined) {
            if (selected.inputs.length !== 1) { budget.reject("A guarded storage projection requires one exact original value."); return false; }
            if (data.filter === undefined && !rows.add(1)) return false;
            data.filter = { reference: selected.valueFilter, input };
          }
          if (!project(input, value => scopes.withTraversal(() => {
            const projected = value.kind === "leaf" || value.kind === "input-frontier" || value.kind === "empty" ? selected.select(value)
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
        if (!budget.step() || !addWitness(relation, reference, reference.contributes)) return false;
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
        const terminal = sourceStorageIsTerminalValue(term);
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
      projection?: (value: SourceStorageTerm) => readonly SourceStorageForwardSelection<SourceStorageRelation, SourceStorageTerm>[] | undefined) => boolean): boolean => {
    const state = current[sourceStorageRelationData];
    const complete = derive(current, read, (relation, direct) => direct ? emit(relation) : forward(relation), (input, select) => {
      let projection = state.forwardProjection;
      if (projection === undefined) {
        if (!rows.add(1)) return false;
        projection = value => select(value)?.map(relation => sourceStorageIsTerminalValue(relation)
          ? { kind: "value", value: relation } : { kind: "relation", key: relation });
        state.forwardProjection = projection;
      }
      return forward(input, projection);
    });
    if (complete) state.complete = true;
    return complete;
  };
  const results = evaluationQueries.fixedPoint<SourceStorageRelation, SourceStorageTerm>(evaluateRelation, "storage-relations");
  return { intern, derive, results, witnessScope, release: () => {
    results.release(); relations.clear(); rows.release(); initializers.release();
  } };
}
