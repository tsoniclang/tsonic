import { pointerOperationFactKey } from "@tsonic/tsts";
import type { Node, Type } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageProjection } from "../model/subjects.js";
import type { SourceStorageReference, SourceStorageReduction, SourceStorageScope, SourceStorageTerm, SourceStorageFrameInput, SourceStorageOperation } from "../graph/scoped-model.js";
import { sourceStorageReference } from "../graph/scoped-model.js";
import { sourceStorageProjectComponents } from "../graph/component-projections.js";
import type { SourceStorageStore } from "../graph/stored-values.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
import type { SourceStorageScopes } from "./scoped-scopes.js";
import { createSourceStoragePointerLocations } from "./pointer-locations.js";
import { sourceStorageSubjectType } from "../model/components.js";

interface SourceStoragePointerQueries {
  read(term: SourceStorageTerm): ReadonlySet<SourceStorageTerm> | undefined;
  readonly scopes: SourceStorageScopes;
  materializeChild(child: SourceStorageTerm,
    select: (value: SourceStorageReference) => readonly SourceStorageTerm[] | undefined): SourceStorageReduction;
  readEffects(store: SourceStorageStore, selection: { readonly kind: "general" }, deferred: boolean,
    scope: SourceStorageScope): Iterable<SourceStorageTerm>;
  deferred(scope: SourceStorageScope): boolean;
  creatorScope(node: SourceStorageReference["subject"]["node"], scope: SourceStorageScope): SourceStorageScope;
}

export function createSourceStoragePointerValues(source: TargetSourceProgram, budget: SourceStorageBudget,
  transport: SourceStorageScopedTransport, queries: SourceStoragePointerQueries) {
  const stores: SourceStorageStore[] = [];
  for (const invocation of transport.invocations) {
    if (!budget.step()) break;
    if (source.sourceFacts.getFact(invocation, pointerOperationFactKey)?.operation !== "store") continue;
    const location = transport.subject(invocation);
    for (const store of location === undefined ? [] : transport.storesFor(location) ?? []) {
      if (!budget.step() || !budget.row()) break;
      stores.push(store);
    }
  }
  const locations = createSourceStoragePointerLocations(source, budget, transport, queries);
  const unresolved = (original: SourceStorageReference, reason: string): SourceStorageTerm =>
    Object.freeze({ kind: "unresolved", subject: original.subject, scope: original.scope, reason });
  const project = (values: readonly SourceStorageTerm[], from: Type, to: Type,
    projection: readonly SourceStorageProjection[], invocation: Node): readonly SourceStorageTerm[] | undefined => {
    const result: SourceStorageTerm[] = [];
    const pending = [...values];
    while (pending.length !== 0) {
      const value = pending.pop()!;
      if (!budget.step()) return undefined;
      if (value.kind === "unresolved") { result.push(value); continue; }
      if (value.kind === "empty") { result.push(value); continue; }
      if (value.kind !== "reference" && value.kind !== "leaf") {
        const selected = queries.read(value);
        if (selected === undefined) return undefined;
        pending.push(...selected);
        continue;
      }
      sourceStorageProjectComponents(value.subject.projection, from, to, projection,
        source.semantics.forNode(invocation), source.ast, budget, selected => {
          const subject = transport.subject(value.subject.node, value.subject.kind, selected);
          if (subject !== undefined) result.push(sourceStorageReference(subject, value.scope));
        });
    }
    return budget.failure() === undefined ? result : undefined;
  };
  const materialized = (values: readonly SourceStorageTerm[]): readonly SourceStorageTerm[] | undefined => {
    const result: SourceStorageTerm[] = [];
    for (const term of values) {
      if (!budget.step()) return undefined;
      const selected = queries.read(term);
      if (selected === undefined) return undefined;
      result.push(...selected);
    }
    return result;
  };
  const accessor = (expression: Node, invocation: Node, caller: SourceStorageScope, captured: SourceStorageScope,
    actuals: readonly SourceStorageTerm[], operation: SourceStorageOperation = { mode: "value" }): readonly SourceStorageTerm[] | undefined => {
    const subject = transport.subjectFor(expression);
    const callees = subject === undefined ? undefined : queries.read(sourceStorageReference(subject, captured));
    const inputs = materialized(actuals);
    if (callees === undefined || inputs === undefined) return undefined;
    const result: SourceStorageTerm[] = [];
    const argumentsFor: readonly SourceStorageFrameInput["values"][] = actuals.length === 0 ? [[]]
      : inputs.filter((value): value is SourceStorageFrameInput["values"][number] => value.kind === "leaf" || value.kind === "empty")
        .map(value => [value]);
    for (const value of inputs) if (value.kind === "unresolved") result.push(value);
    for (const callee of callees) {
      if (!budget.step()) return undefined;
      if (callee.kind === "unresolved") { result.push(callee); continue; }
      if (callee.kind !== "leaf") return undefined;
      const selected = source.navigation.callableImplementation(callee.subject.node);
      if (selected.kind !== "resolved" || source.ast.body(selected.implementation.declaration) === undefined) {
        result.push(unresolved(callee, "A native pointer accessor requires its original checked source implementation."));
        continue;
      }
      const owner = selected.implementation.declaration;
      for (const arguments_ of argumentsFor) {
        if (!budget.step()) return undefined;
        const scope = queries.scopes.frameForActuals(owner, invocation, caller, callee.scope, arguments_);
        if (scope === undefined) return undefined;
        const actualTypes = Object.freeze(arguments_.map(value => {
          const type = value.kind === "empty" ? undefined : sourceStorageSubjectType(source, value.subject);
          return type === undefined ? undefined : Object.freeze([type]);
        }));
        result.push(Object.freeze({ kind: "application", invocation, callee,
          scope: caller, activation: Object.freeze({ kind: "entered", scope, actualTypes }), projection: Object.freeze([]), ...operation }));
      }
    }
    return result;
  };
  const writes = (destination: SourceStorageReference, store: SourceStorageStore,
    projection: readonly SourceStorageProjection[], to: Type, invocation: Node,
    context: SourceStorageScope): readonly SourceStorageTerm[] | undefined => {
    const operation = source.sourceFacts.getFact(store.reference, pointerOperationFactKey);
    if (operation?.operation !== "store") return undefined;
    const result: SourceStorageTerm[] = [];
    const pointer = transport.subjectFor(operation.pointerExpression);
    const value = transport.subjectFor(operation.valueExpression);
    if (pointer === undefined || value === undefined) return undefined;
    for (const effect of queries.readEffects(store, { kind: "general" }, queries.deferred(context), context)) {
      if (!budget.step()) return undefined;
      if (effect.kind === "unresolved") { result.push(effect); continue; }
      if (effect.kind !== "effect" || effect.store !== store) continue;
      const originals = queries.read(sourceStorageReference(pointer, effect.scope));
      if (originals === undefined) return undefined;
      const pending: { readonly pointer: SourceStorageTerm; readonly values: readonly SourceStorageTerm[]; readonly type: Type }[] =
        [...originals].map(pointer => ({ pointer, values: [sourceStorageReference(value, effect.scope)],
        type: operation.valueType }));
      while (pending.length !== 0) {
        if (!budget.step()) return undefined;
        const entry = pending.pop()!;
        if (entry.pointer.kind === "unresolved") { result.push(entry.pointer); continue; }
        if (entry.pointer.kind !== "leaf") return undefined;
        const selected = source.sourceFacts.getFact(entry.pointer.subject.node, pointerOperationFactKey);
        if (selected?.operation === "bind-pointer") continue;
        if (selected?.operation === "project-pointer") {
          const converted = accessor(selected.toSourceExpression, operation.call, effect.scope, entry.pointer.scope, entry.values);
          const next = transport.subjectFor(selected.pointerExpression);
          const targets = next === undefined ? undefined : queries.read(sourceStorageReference(next, entry.pointer.scope));
          if (converted === undefined || targets === undefined) return undefined;
          const convertedValues = materialized(converted);
          if (convertedValues === undefined) return undefined;
          for (const pointer of targets) pending.push({ pointer,
            values: convertedValues.filter((value): value is SourceStorageFrameInput["values"][number] => value.kind === "leaf" || value.kind === "empty"),
            type: selected.sourcePointeeType });
          for (const value of convertedValues) if (value.kind === "unresolved") result.push(value);
          continue;
        }
        const identities = locations.identities(entry.pointer);
        if (identities === undefined) {
          result.push(unresolved(entry.pointer, "A native pointer write requires its exact scoped backing location.")); continue;
        }
        for (const receiver of identities) {
          if (!budget.step()) return undefined;
          const root = transport.subject(destination.subject.node, destination.subject.kind,
            destination.subject.projection.slice(0, receiver.subject.projection.length));
          if (root !== receiver.subject) continue;
          const remaining = [...destination.subject.projection.slice(receiver.subject.projection.length), ...projection];
          const contract = root === destination.subject ? to : sourceStorageSubjectType(source, root);
          if (contract === undefined) return undefined;
          const values = project(entry.values, entry.type, contract, remaining, invocation);
          if (values === undefined) return undefined;
          for (const value of values) result.push(Object.freeze({ kind: "store",
            destination: Object.freeze({ ...destination, subject: root }), receiver, value }));
        }
      }
    }
    return result;
  };
  const loadKnown = (original: SourceStorageReference, invocation: Node,
    caller: SourceStorageScope): readonly SourceStorageTerm[] | undefined => {
    const selected = original.subject.kind === "value" && original.subject.projection.length === 0
      ? source.sourceFacts.getFact(original.subject.node, pointerOperationFactKey) : undefined;
    if (selected?.operation === "allocate") {
      const subject = transport.subjectFor(selected.initialExpression);
      if (subject === undefined) return undefined;
      const result: SourceStorageTerm[] = [sourceStorageReference(subject, original.scope)];
      for (const store of stores) {
        if (!budget.step()) return undefined;
        const written = writes(original, store, [], selected.pointeeType, invocation, caller);
        if (written === undefined) return undefined;
        result.push(...written);
      }
      return result;
    }
    if (selected?.operation === "address-of") {
      const subject = transport.subjectFor(selected.storageExpression);
      return subject === undefined ? undefined : [sourceStorageReference(subject, original.scope)];
    }
    if (selected?.operation === "bind-pointer")
      return accessor(selected.readExpression, invocation, caller, original.scope, []);
    if (selected?.operation === "project-pointer") {
      const pointer = transport.subjectFor(selected.pointerExpression);
      const values = pointer === undefined ? undefined : queries.read(sourceStorageReference(pointer, original.scope));
      if (values === undefined) return undefined;
      const result: SourceStorageTerm[] = [];
      for (const value of values) {
        if (!budget.step()) return undefined;
        if (value.kind === "unresolved") { result.push(value); continue; }
        if (value.kind !== "leaf") return undefined;
        const loaded = loadOrigin(value, invocation, caller);
        const converted = loaded === undefined ? undefined
          : accessor(selected.fromSourceExpression, invocation, caller, original.scope, loaded);
        if (converted === undefined) return undefined;
        result.push(...converted);
      }
      return result;
    }
    return [unresolved(original, "A native pointer load requires its completed original scoped pointee transport.")];
  };
  const activeLoads = new Map<SourceStorageScope, Set<SourceStorageReference["subject"]>>();
  const loadOrigin = (original: SourceStorageReference, invocation: Node,
    caller: SourceStorageScope): readonly SourceStorageTerm[] | undefined => budget.withRows(rows => {
    const retained = activeLoads.get(original.scope);
    if (retained?.has(original.subject)) return [unresolved(original,
      "A recursive native pointer view has no completed scoped pointee transport.")];
    if (!rows.add(retained === undefined ? 2 : 1)) return undefined;
    const selected = retained ?? new Set();
    selected.add(original.subject); activeLoads.set(original.scope, selected);
    try { return loadKnown(original, invocation, caller); }
    finally {
      selected.delete(original.subject);
      if (selected.size === 0) activeLoads.delete(original.scope);
    }
  });
  const execution = (invocation: Node, scope: SourceStorageScope, demand: Node,
    deferred = false, mode: "execution" | "throw" = "execution"): readonly SourceStorageTerm[] | undefined => {
    const operation = source.sourceFacts.getFact(invocation, pointerOperationFactKey);
    if (operation?.operation !== "load" && operation?.operation !== "store") return operation === undefined ? undefined : [];
    const pointer = transport.subjectFor(operation.pointerExpression);
    const selected = pointer === undefined ? undefined : queries.read(sourceStorageReference(pointer, scope));
    if (selected === undefined) return undefined;
    const actual = operation.operation === "store" ? transport.subjectFor(operation.valueExpression) : undefined;
    if (operation.operation === "store" && actual === undefined) return undefined;
    const result: SourceStorageTerm[] = [];
    const pending: { readonly pointer: SourceStorageTerm; readonly values: readonly SourceStorageTerm[] }[] = [...selected].map(pointer => ({ pointer,
      values: actual === undefined ? [] : [sourceStorageReference(actual, scope)] }));
    while (pending.length !== 0) {
      if (!budget.step()) return undefined;
      const entry = pending.pop()!;
      if (entry.pointer.kind === "unresolved") { result.push(entry.pointer); continue; }
      if (entry.pointer.kind !== "leaf") return undefined;
      const target = source.sourceFacts.getFact(entry.pointer.subject.node, pointerOperationFactKey);
      if (target?.operation === "bind-pointer") {
        const called = accessor(operation.operation === "load" ? target.readExpression : target.writeExpression,
          invocation, scope, entry.pointer.scope, entry.values, mode === "throw" ? { mode } : { mode, demand, deferred });
        if (called === undefined) return undefined;
        result.push(...called);
      } else if (target?.operation === "project-pointer") {
        const next = transport.subjectFor(target.pointerExpression);
        const originals = next === undefined ? undefined : queries.read(sourceStorageReference(next, entry.pointer.scope));
        if (originals === undefined) return undefined;
        const loaded: SourceStorageTerm[] = [];
        if (operation.operation === "load") for (const value of originals) {
          if (value.kind === "unresolved") { loaded.push(value); continue; }
          if (value.kind !== "leaf") return undefined;
          const values = loadOrigin(value, invocation, scope);
          if (values === undefined) return undefined;
          loaded.push(...values);
        }
        const expression = operation.operation === "load" ? target.fromSourceExpression : target.toSourceExpression;
        const values = operation.operation === "load" ? loaded : entry.values;
        const called = accessor(expression, invocation, scope, entry.pointer.scope, values,
          mode === "throw" ? { mode } : { mode, demand, deferred });
        if (called === undefined) return undefined;
        result.push(...called);
        const converted = operation.operation === "load" ? []
          : accessor(expression, invocation, scope, entry.pointer.scope, values);
        const material = converted === undefined ? undefined : materialized(converted);
        if (material === undefined) return undefined;
        for (const pointer of originals) pending.push({ pointer,
          values: material.filter((value): value is SourceStorageFrameInput["values"][number] => value.kind === "leaf" || value.kind === "empty") });
        for (const value of material) if (value.kind === "unresolved") result.push(value);
      }
    }
    return result;
  };
  const reduce = (term: SourceStorageReference): SourceStorageReduction | undefined => {
    if (term.subject.kind !== "value") return undefined;
    const operation = source.sourceFacts.getFact(term.subject.node, pointerOperationFactKey);
    if (operation?.operation === "allocate" || operation?.operation === "address-of" ||
      operation?.operation === "bind-pointer" || operation?.operation === "project-pointer")
      return { kind: "replace", terms: [Object.freeze({ kind: "leaf",
      subject: term.subject, scope: queries.creatorScope(operation.call, term.scope) })] };
    if (operation?.operation !== "load") return undefined;
    const pointer = transport.subjectFor(operation.pointerExpression);
    if (pointer === undefined) return undefined;
    return queries.materializeChild(sourceStorageReference(pointer, term.scope), original => {
      const loaded = loadOrigin(original, operation.call, term.scope);
      return loaded === undefined ? undefined : project(loaded, operation.pointeeType,
        operation.pointeeType, term.subject.projection, operation.call);
    });
  };
  return Object.freeze({ reduce, writes, locations, execution });
}
