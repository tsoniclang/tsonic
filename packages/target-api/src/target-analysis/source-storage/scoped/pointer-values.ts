import { pointerOperationFactKey } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageProjection } from "../model/subjects.js";
import type { SourceStorageReference, SourceStorageReduction, SourceStorageScope, SourceStorageTerm } from "../graph/scoped-model.js";
import { sourceStorageReference } from "../graph/scoped-model.js";
import { sourceStorageProjectComponents } from "../graph/component-projections.js";
import type { SourceStorageStore } from "../graph/stored-values.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";

interface SourceStoragePointerQueries {
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
  return (term: SourceStorageReference): SourceStorageReduction | undefined => {
    if (term.subject.kind !== "value") return undefined;
    const operation = source.sourceFacts.getFact(term.subject.node, pointerOperationFactKey);
    if (operation?.operation === "allocate") return { kind: "replace", terms: [Object.freeze({ kind: "leaf",
      subject: term.subject, scope: queries.creatorScope(operation.call, term.scope) })] };
    if (operation?.operation !== "load") return undefined;
    const pointer = transport.subjectFor(operation.pointerExpression);
    if (pointer === undefined) return undefined;
    const project = (value: SourceStorageReference, from: typeof operation.pointeeType,
      projection: readonly SourceStorageProjection[]): readonly SourceStorageTerm[] | undefined => {
      const values: SourceStorageTerm[] = [];
      sourceStorageProjectComponents(value.subject.projection, from, operation.pointeeType, projection,
        source.semantics.forNode(operation.call), source.ast, budget, selected => {
          const subject = transport.subject(value.subject.node, value.subject.kind, selected);
          if (subject !== undefined) values.push(sourceStorageReference(subject, value.scope));
        });
      return budget.failure() === undefined ? values : undefined;
    };
    return queries.materializeChild(sourceStorageReference(pointer, term.scope), original => {
      const selected = source.sourceFacts.getFact(original.subject.node, pointerOperationFactKey);
      const value = selected?.operation === "allocate" ? transport.subjectFor(selected.initialExpression) : undefined;
      if (original.subject.projection.length !== 0 || value === undefined || selected?.operation !== "allocate")
        return [Object.freeze({ kind: "leaf", subject: term.subject, scope: term.scope })];
      const values = project(sourceStorageReference(value, original.scope),
        selected.initialType, term.subject.projection);
      if (values === undefined) return undefined;
      const terms = [...values];
      for (const store of stores) {
        if (!budget.step()) return undefined;
        const write = source.sourceFacts.getFact(store.reference, pointerOperationFactKey);
        if (write?.operation !== "store" || store.receiver === undefined || store.value === undefined) return undefined;
        for (const effect of queries.readEffects(store, { kind: "general" }, queries.deferred(term.scope), term.scope)) {
          if (!budget.step()) return undefined;
          if (effect.kind === "unresolved") { terms.push(effect); continue; }
          if (effect.kind !== "effect" || effect.store !== store) continue;
          const selected = project(sourceStorageReference(store.value, effect.scope), write.valueType, term.subject.projection);
          if (selected === undefined) return undefined;
          for (const value of selected) terms.push(Object.freeze({ kind: "store", destination: original,
            receiver: sourceStorageReference(store.receiver, effect.scope), value }));
        }
      }
      return terms;
    });
  };
}
