import type { Node } from "@tsonic/tsts";
import type { SourceTypeBinding, SourceTypeEvidence } from "../../../public/source/contracts.js";
import type { SourceMemorySelection } from "../../../source-model/memory.js";
import type { SourceStorageBindings, SourceStorageTypedSubject } from "../../../source-model/storage.js";
import type { SourceMemoryContext } from "../../source-memory-context.js";
import type { SourceStorageProgram } from "./program.js";
import { sourceStorageValue } from "./program.js";
import { sourceStorageOriginalSignature } from "./callable-heads.js";
import type { SourceStorageBudget } from "./resource-budget.js";
import type { SourceStorageScope } from "../graph/scoped-model.js";
import type { createSourceStorageTransport } from "../transport/transport.js";

export function createSourceMemoryEnvironments(input: {
  readonly source: SourceStorageProgram;
  readonly context: SourceMemoryContext;
  readonly budget: SourceStorageBudget;
  readonly transport: ReturnType<typeof createSourceStorageTransport>;
  readonly bindingStates: WeakMap<SourceStorageBindings, readonly SourceStorageScope[]>;
}) {
  const { source, context, budget, transport, bindingStates } = input;
  const retained = new WeakMap<SourceStorageBindings, WeakMap<Node, readonly (readonly SourceTypeBinding[])[]>>();
  const retainedRows = budget.createRows();
  const unresolved = (reason: string) => Object.freeze({ kind: "unresolved" as const, reason });
  const resolved = <Value>(value: Value): SourceMemorySelection<Value> => Object.freeze({ kind: "resolved", value });
  function parameters(owner: Node): SourceMemorySelection<readonly { readonly declaration: Node; readonly value: SourceTypeEvidence }[]> {
    if (source.ast.is.IsClassDeclaration(owner) || source.ast.is.IsClassExpression(owner)) {
      const original = sourceStorageValue(source.analysis.settle(source.analysis.declared(owner, Object.freeze([]))));
      if (original.type.type.kind !== "declared" || original.type.type.declaration !== owner)
        return unresolved("A memory class environment requires its genuine original instance template.");
      const selected: SourceTypeBinding[] = [];
      for (const [index] of original.type.type.typeArguments.entries()) {
        source.work(owner);
        const child = sourceStorageValue(source.facts.descriptors.component(original.type,
          { kind: "type-argument", declaration: owner, index }));
        if (child.type.kind !== "parameter")
          return unresolved("A memory class template requires its complete original binder vector.");
        selected.push(Object.freeze({ declaration: child.type.declaration, value: child }));
      }
      return resolved(Object.freeze(selected));
    }
    const original = sourceStorageOriginalSignature(source, owner, source.facts.navigation.callableRoles(owner).body ? "body" : "signature");
    if (original === undefined) return unresolved("A memory activation requires its exact original callable head.");
    const selected: SourceTypeBinding[] = [];
    for (const declaration of original.signature.identity.typeParameters) {
      source.work(declaration);
      const parameter = source.facts.descriptors.typeParameter(declaration);
      const original = sourceStorageValue(source.analysis.settle(source.analysis.declared(declaration, Object.freeze([]))));
      if (original.type.type.kind !== "parameter" || original.type.type.declaration !== parameter.declaration)
        throw new Error("A memory callable environment retains each original registered binder.");
      selected.push(Object.freeze({ declaration, value: original.type }));
    }
    return resolved(Object.freeze(selected));
  }
  function environments(original: Node, bindings: SourceStorageBindings):
    SourceMemorySelection<readonly (readonly SourceTypeBinding[])[]> {
    source.facts.navigation.callableRoles(original);
    const states = bindingStates.get(bindings);
    if (states === undefined) throw new Error("A memory environment belongs to its same original storage query.");
    const previous = retained.get(bindings)?.get(original);
    if (previous !== undefined) return resolved(previous);
    return budget.withRows(rows => {
      const owners: Node[] = [];
      for (let node: Node | undefined = original; node !== undefined; node = source.ast.parent(node)) {
        if (!budget.step() || !rows.add(1)) return unresolved(budget.failure()!);
        if (source.ast.is.IsClassDeclaration(node) || source.ast.is.IsClassExpression(node) ||
          source.facts.navigation.callableRoles(node).signature) owners.push(node);
      }
      owners.reverse();
      const results: (readonly SourceTypeBinding[])[] = [];
      const keys = new Set<string>();
      for (const state of states) {
        if (!budget.step()) return unresolved(budget.failure()!);
        let environment: readonly SourceTypeBinding[] = Object.freeze([]);
        for (const owner of owners) {
          if (!budget.step()) return unresolved(budget.failure()!);
          const required = parameters(owner);
          if (required.kind !== "resolved") return required;
          const activation = transport.substitutions.boundActivation(state, owner);
          if (activation?.invocation !== undefined && (source.ast.is.IsCallExpression(activation.invocation) ||
            source.ast.is.IsNewExpression(activation.invocation))) {
            const application = source.facts.applications.application(activation.invocation);
            if (application.kind === "refused") return application;
            if (application.value.argumentDisposition === "skip")
              return unresolved("A skipped invocation cannot supply an executed memory activation.");
            const combined = context.environment(environment,
              [...application.value.identity.classBindings, ...application.value.identity.signatureBindings]);
            if (combined.kind !== "resolved") return combined;
            environment = combined.value;
          }
          const missing = required.value.filter(parameter => !environment.some(binding => binding.declaration === parameter.declaration));
          if (missing.length !== 0) {
            if (activation?.invocation !== undefined)
              return unresolved("Memory requires the complete original API-body and class binder environment of its actual activation.");
            const combined = context.environment(environment, missing);
            if (combined.kind !== "resolved") return combined;
            environment = combined.value;
          }
        }
        const key = context.bindingKey(environment);
        if (!keys.has(key)) {
          if (!rows.add(1 + environment.length)) return unresolved(budget.failure()!);
          keys.add(key);
          results.push(environment);
        }
      }
      if (results.length === 0) return unresolved("Memory requires every original storage activation environment.");
      if (!retainedRows.add(2 + results.reduce((size, bindings) => size + 1 + bindings.length, 0)))
        return unresolved(budget.failure()!);
      const result = Object.freeze(results);
      let byOriginal = retained.get(bindings);
      if (byOriginal === undefined) { byOriginal = new WeakMap(); retained.set(bindings, byOriginal); }
      byOriginal.set(original, result);
      return resolved(result);
    });
  }
  function typed(subject: SourceStorageTypedSubject, bindings: SourceStorageBindings):
    SourceMemorySelection<readonly (SourceStorageTypedSubject & { readonly typeBindings: readonly SourceTypeBinding[] })[]> {
    source.facts.descriptors.assertEvidence(subject.type);
    if (source.ast.getSourceFile(subject.subject.node) !== subject.sourceFile)
      throw new Error("A typed memory subject retains its exact original Source file.");
    const selected = environments(subject.subject.node, bindings);
    if (selected.kind !== "resolved") return selected;
    const values: (SourceStorageTypedSubject & { readonly typeBindings: readonly SourceTypeBinding[] })[] = [];
    for (const typeBindings of selected.value) {
      source.work(subject.subject.node);
      const type = context.substitute(subject.type, typeBindings);
      if (type.kind !== "resolved") return type;
      values.push(Object.freeze({ ...subject, type: type.value, typeBindings }));
    }
    return resolved(Object.freeze(values));
  }
  return Object.freeze({ environments, typed });
}

export type SourceMemoryEnvironments = ReturnType<typeof createSourceMemoryEnvironments>;
