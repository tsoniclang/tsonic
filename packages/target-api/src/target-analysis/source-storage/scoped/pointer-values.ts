import { sourceAnalysisValueType, type SourceAnalysisProgram } from "../../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import type { SourceTypeDescriptor } from "../../../source-semantics/local-type-flow/types.js";
import { sourceStoragePointerOperation, sourceStorageProjectedSourcePointee } from "../transport/host-reads.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageProjection } from "../model/subjects.js";
import type { SourceStorageReference, SourceStorageReduction, SourceStorageScope, SourceStorageTerm, SourceStorageOperation } from "../graph/scoped-model.js";
import { sourceStorageReference } from "../graph/scoped-model.js";
import { sourceStorageProjectComponents } from "../graph/component-projections.js";
import type { SourceStorageStore } from "../model/stores.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
import { createSourceStoragePointerLocations } from "./pointer-locations.js";
import { sourceStorageSubjectType } from "../model/components.js";

interface SourceStoragePointerQueries {
  read(term: SourceStorageTerm): ReadonlySet<SourceStorageTerm> | undefined;
  readEffects(store: SourceStorageStore, selection: { readonly kind: "general" }, deferred: boolean,
    scope: SourceStorageScope): Iterable<SourceStorageTerm>;
  deferred(scope: SourceStorageScope): boolean;
  isSymbolic(value: SourceStorageReference): boolean;
  creatorScope(node: SourceStorageReference["subject"]["node"], scope: SourceStorageScope): SourceStorageScope;
}

export function createSourceStoragePointerValues(source: SourceAnalysisProgram, budget: SourceStorageBudget,
  transport: SourceStorageScopedTransport, queries: SourceStoragePointerQueries) {
  const stores: SourceStorageStore[] = [];
  for (const invocation of transport.invocations) {
    if (!budget.step()) break;
    if (sourceStoragePointerOperation(source, invocation)?.operation !== "store") continue;
    const location = transport.subject(invocation);
    for (const store of location === undefined ? [] : transport.storesFor(location) ?? []) {
      if (!budget.step() || !budget.row()) break;
      stores.push(store);
    }
  }
  const locations = createSourceStoragePointerLocations(source, budget, transport, queries);
  const operationFor = (selected: SourceStorageOperation): SourceStorageOperation => selected.mode === "execution"
    ? { mode: "execution", demand: selected.demand, deferred: selected.deferred } : { mode: selected.mode };
  const unresolved = (original: SourceStorageReference, reason: string, invocation: Node): SourceStorageTerm =>
    Object.freeze({ kind: "unresolved", subject: original.subject, scope: original.scope, reason,
      ...(queries.isSymbolic(original) || transport.isOpaque(original.subject.node) ? { exposure: invocation } : {}) });
  const accessor = (expression: Node, invocation: Node, caller: SourceStorageScope, captured: SourceStorageScope,
    argument: SourceStorageTerm | undefined, operation: SourceStorageOperation,
    projection: readonly SourceStorageProjection[] = []): SourceStorageTerm | undefined => {
    const subject = transport.subjectFor(expression);
    return subject === undefined ? undefined : Object.freeze({ kind: "application", invocation,
      callee: sourceStorageReference(subject, captured), scope: caller, projection,
      activation: Object.freeze({ kind: "provided", argument }), ...operationFor(operation) });
  };
  const pointer = (invocation: Node, original: SourceStorageTerm, input: SourceStorageTerm | undefined,
    scope: SourceStorageScope, operation: SourceStorageOperation,
    projection: readonly SourceStorageProjection[] = []): Extract<SourceStorageTerm, { readonly kind: "pointer" }> =>
    Object.freeze({ kind: "pointer", invocation, pointer: original, input, scope, projection, ...operationFor(operation) });
  const projected = (value: SourceStorageReference, from: SourceTypeDescriptor, to: SourceTypeDescriptor,
    projection: readonly SourceStorageProjection[]): readonly SourceStorageTerm[] | undefined => {
    const result: SourceStorageTerm[] = [];
    sourceStorageProjectComponents(value.subject.projection, from, to, projection,
      source, source.ast, budget, selected => {
        const subject = transport.subject(value.subject.node, value.subject.kind, selected);
        if (subject !== undefined) result.push(sourceStorageReference(subject, value.scope));
      });
    return budget.failure() === undefined ? result : undefined;
  };
  const writes = (destination: SourceStorageReference, store: SourceStorageStore,
    projection: readonly SourceStorageProjection[], context: SourceStorageScope): readonly SourceStorageTerm[] | undefined => {
    const operation = sourceStoragePointerOperation(source, store.reference);
    if (operation?.operation !== "store") return undefined;
    const result: SourceStorageTerm[] = [];
    const target = transport.subjectFor(operation.pointerExpression);
    const value = transport.subjectFor(operation.valueExpression);
    if (target === undefined || value === undefined) return undefined;
    for (const effect of queries.readEffects(store, { kind: "general" }, queries.deferred(context), context)) {
      if (!budget.step()) return undefined;
      if (effect.kind === "unresolved") { result.push(effect); continue; }
      if (effect.kind !== "effect" || effect.store !== store) continue;
      const originals = queries.read(sourceStorageReference(target, effect.scope));
      if (originals === undefined) return undefined;
      const valueType = sourceAnalysisValueType(source, operation.valueExpression);
      if (valueType === undefined) return undefined;
      const pending: { readonly pointer: SourceStorageTerm; readonly value: SourceStorageTerm; readonly type: SourceTypeDescriptor }[] =
        [...originals].map(pointer => ({ pointer, value: sourceStorageReference(value, effect.scope), type: valueType }));
      while (pending.length !== 0) {
        if (!budget.step()) return undefined;
        const entry = pending.pop()!;
        if (entry.pointer.kind === "unresolved" || entry.pointer.kind === "empty") { result.push(entry.pointer); continue; }
        if (entry.pointer.kind !== "leaf") return undefined;
        const selected = sourceStoragePointerOperation(source, entry.pointer.subject.node);
        if (selected?.operation === "bind-pointer") continue;
        if (selected?.operation === "project-pointer") {
          const converted = accessor(selected.toSourceExpression, operation.call, effect.scope,
            entry.pointer.scope, entry.value, { mode: "value" });
          const next = transport.subjectFor(selected.pointerExpression);
          const targets = next === undefined ? undefined : queries.read(sourceStorageReference(next, entry.pointer.scope));
          if (converted === undefined || targets === undefined) return undefined;
          const sourcePointee = sourceStorageProjectedSourcePointee(source, selected.call);
          if (sourcePointee === undefined) return undefined;
          for (const pointer of targets) pending.push({ pointer, value: converted, type: sourcePointee });
          continue;
        }
        const identities = locations.identities(entry.pointer);
        if (identities === undefined) return undefined;
        const values = queries.read(entry.value);
        if (values === undefined) return undefined;
        for (const receiver of identities) {
          if (!budget.step()) return undefined;
          if (receiver.kind === "empty" || receiver.kind === "unresolved") { result.push(receiver); continue; }
          const root = transport.subject(destination.subject.node, destination.subject.kind,
            destination.subject.projection.slice(0, receiver.subject.projection.length));
          if (root !== receiver.subject) continue;
          const remaining = [...destination.subject.projection.slice(receiver.subject.projection.length), ...projection];
          const contract = selected?.operation === "allocate" ? selected.pointee : sourceStorageSubjectType(source, root);
          if (contract === undefined) return undefined;
          for (const value of values) {
            if (!budget.step()) return undefined;
            const selected = value.kind === "unresolved" || value.kind === "empty" ? [value]
              : value.kind === "leaf" ? projected(value, entry.type, contract, remaining) : undefined;
            if (selected === undefined) return undefined;
            for (const written of selected) result.push(Object.freeze({ kind: "store",
              destination: Object.freeze({ ...destination, subject: root }), receiver, value: written }));
          }
        }
      }
    }
    return result;
  };
  const execution = (invocation: Node, scope: SourceStorageScope, demand: Node,
    deferred = false, mode: "execution" | "throw" = "execution"): readonly SourceStorageTerm[] | undefined => {
    const selected = sourceStoragePointerOperation(source, invocation);
    if (selected?.operation !== "load" && selected?.operation !== "store") return selected === undefined ? undefined : [];
    const target = transport.subjectFor(selected.pointerExpression);
    const input = selected.operation === "store" ? transport.subjectFor(selected.valueExpression) : undefined;
    if (target === undefined || selected.operation === "store" && input === undefined) return undefined;
    return [pointer(invocation, sourceStorageReference(target, scope), input === undefined ? undefined
      : sourceStorageReference(input, scope), scope, mode === "throw" ? { mode } : { mode, demand, deferred })];
  };
  const operation = (term: Extract<SourceStorageTerm, { readonly kind: "pointer" }>): SourceStorageReduction | undefined => {
    if (term.pointer.kind === "input-frontier") return { kind: "replace", terms: [Object.freeze({ kind: "unresolved",
      subject: term.pointer.subject, scope: term.pointer.scope, exposure: term.invocation,
      reason: "A native pointer operation requires its exact scoped backing location." })] };
    if (term.pointer.kind !== "leaf") return { kind: "project", inputs: [term.pointer], select: value =>
      value.kind === "empty" ? [value] : [value === term.pointer ? term : Object.freeze({ ...term, pointer: value })] };
    const original = term.pointer;
    const selected = original.subject.kind === "value" && original.subject.projection.length === 0
      ? sourceStoragePointerOperation(source, original.subject.node) : undefined;
    if (selected?.operation === "allocate" || selected?.operation === "address-of") {
      if (term.mode !== "value") return { kind: "replace", terms: [Object.freeze({ kind: "empty", absence: undefined })] };
      const subject = transport.subjectFor(selected.operation === "allocate" ? selected.initialExpression : selected.storageExpression);
      const type = selected.pointee;
      if (subject === undefined) return undefined;
      const terms = projected(sourceStorageReference(subject, original.scope), type, type, term.projection);
      if (terms === undefined) return undefined;
      const result = [...terms];
      if (selected.operation === "allocate") for (const store of stores) {
        if (!budget.step()) return undefined;
        const written = writes(original, store, term.projection, term.scope);
        if (written === undefined) return undefined;
        result.push(...written);
      }
      return { kind: "replace", terms: result };
    }
    if (selected?.operation === "bind-pointer") {
      const called = accessor(term.input === undefined ? selected.readExpression : selected.writeExpression,
        term.invocation, term.scope, original.scope, term.input, term, term.projection);
      return called === undefined ? undefined : { kind: "replace", terms: [called] };
    }
    if (selected?.operation === "project-pointer") {
      const target = transport.subjectFor(selected.pointerExpression);
      if (target === undefined) return undefined;
      const underlying = sourceStorageReference(target, original.scope);
      const argument = term.input ?? pointer(term.invocation, underlying, undefined, term.scope, { mode: "value" });
      const expression = term.input === undefined ? selected.fromSourceExpression : selected.toSourceExpression;
      const called = accessor(expression, term.invocation, term.scope, original.scope, argument, term,
        term.mode === "value" ? term.projection : []);
      if (called === undefined) return undefined;
      if (term.mode === "value") return { kind: "replace", terms: [called] };
      const converted = term.input === undefined ? undefined : accessor(expression, term.invocation, term.scope,
        original.scope, argument, { mode: "value" });
      if (term.input !== undefined && converted === undefined) return undefined;
      return { kind: "replace", terms: [called, pointer(term.invocation, underlying, converted, term.scope, term)] };
    }
    return { kind: "replace", terms: [unresolved(original,
      "A native pointer invocation requires its completed original scoped pointee transport.", term.invocation)] };
  };
  const reduce = (term: SourceStorageReference): SourceStorageReduction | undefined => {
    if (term.subject.kind !== "value") return undefined;
    const selected = sourceStoragePointerOperation(source, term.subject.node);
    if (selected?.operation === "allocate" || selected?.operation === "address-of" ||
      selected?.operation === "bind-pointer" || selected?.operation === "project-pointer")
      return { kind: "replace", terms: [Object.freeze({ kind: "leaf",
        subject: term.subject, scope: queries.creatorScope(selected.call, term.scope) })] };
    if (selected?.operation !== "load") return undefined;
    const target = transport.subjectFor(selected.pointerExpression);
    return target === undefined ? undefined : { kind: "replace", terms: [pointer(selected.call,
      sourceStorageReference(target, term.scope), undefined, term.scope, { mode: "value" }, term.subject.projection)] };
  };
  return Object.freeze({ reduce, operation, writes, locations, execution });
}
