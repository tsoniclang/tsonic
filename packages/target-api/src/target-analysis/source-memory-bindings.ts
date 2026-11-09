import type { Node } from "@tsonic/tsts";
import type { SourceTypeBinding } from "../public/source/contracts.js";
import type { SourceMemoryBindingInventory, SourceMemoryFieldBinding, SourceMemoryQueries, SourceMemoryRecordBinding,
  SourceMemorySelection } from "../source-model/memory.js";
import type { SourceStorageQueries } from "../source-model/program.js";
import type { SourceStorageBindings } from "../source-model/storage.js";
import type { SourceMemoryContext } from "./source-memory-context.js";
import type { SourceMemoryMetadataProduction } from "./source-memory-metadata.js";
import type { SourceMemoryEnvironments } from "./source-storage/model/memory-environments.js";
import type { SourceStorageBudget } from "./source-storage/model/resource-budget.js";

export function createSourceMemoryBindingQueries(input: {
  readonly context: SourceMemoryContext;
  readonly metadata: SourceMemoryMetadataProduction;
  readonly environments: SourceMemoryEnvironments;
  readonly storage: SourceStorageQueries;
  readonly budget: SourceStorageBudget;
}): SourceMemoryQueries["memoryBindings"] {
  const { context, metadata, environments, storage, budget } = input;
  const { source, original, equivalent } = context;
  const fields = new WeakMap<Node, WeakMap<SourceStorageBindings, SourceMemoryFieldBinding>>();
  const records = new WeakMap<Node, WeakMap<SourceStorageBindings, SourceMemoryRecordBinding>>();
  const retainedRows = budget.createRows();
  const none = Object.freeze({ kind: "none" } as const);
  const resolved = <Value>(value: Value): SourceMemorySelection<Value> => Object.freeze({ kind: "resolved", value });
  const unresolved = (reason: string) => Object.freeze({ kind: "unresolved" as const, reason });
  function environment(occurrence: Node, bindings: SourceStorageBindings): SourceMemorySelection<readonly SourceTypeBinding[]> {
    const selected = environments.environments(occurrence, bindings);
    return selected.kind !== "resolved" ? selected : selected.value.length === 1 ? resolved(selected.value[0]!)
      : unresolved("A memory binding requires its one original correlated activation environment.");
  }
  const field: SourceMemoryQueries["memoryBindings"]["field"] = (occurrence, bindings) => {
    context.assertNode(occurrence);
    const environments = environment(occurrence, bindings);
    if (environments.kind !== "resolved") return environments;
    const selected = original.fieldBinding(occurrence);
    if (selected.kind === "unavailable") return unresolved(selected.reason);
    if (selected.kind === "none") return resolved(none);
    const previous = fields.get(occurrence)?.get(bindings);
    if (previous !== undefined) return resolved(Object.freeze({ kind: "present", value: previous }));
    const originalField = selected.value;
    const owner = context.component(originalField.owner, environments.value);
    if (owner.kind !== "resolved") return owner;
    const pointee = context.component(originalField.pointee, environments.value);
    if (pointee.kind !== "resolved") return pointee;
    const selectedField = metadata.field(originalField.field, environments.value);
    if (selectedField.kind !== "resolved") return selectedField;
    if (!equivalent(owner.value.value, selectedField.value.owner) || !equivalent(pointee.value.value, selectedField.value.value))
      return unresolved("A memory field binding requires the same complete original Source owner and child layout domain.");
    const pointerValue = source.facts.values.type(originalField.pointerExpression);
    if (pointerValue.kind === "refused") return pointerValue;
    const pointer = context.substitute(pointerValue.value, environments.value);
    if (pointer.kind !== "resolved") return pointer;
    const pointerType = source.facts.protocols.pointerType(pointer.value);
    if (pointerType.kind === "refused") return pointerType;
    if (pointerType.value.kind === "none" || pointerType.value.value.kind !== "typed-location" ||
      !equivalent(pointerType.value.value.pointee, pointee.value.value))
      return unresolved("A memory field binding requires its exact non-absent Source pointer and pointee domain.");
    const application = source.facts.applications.application(occurrence);
    if (application.kind === "refused") return application;
    const result = context.substitute(application.value.result, environments.value);
    if (result.kind !== "resolved") return result;
    const binding: SourceMemoryFieldBinding = Object.freeze({ occurrence, result: result.value, owner: owner.value.value,
      fieldExpression: originalField.fieldExpression, field: selectedField.value,
      pointer: Object.freeze({ occurrence: originalField.pointerExpression, value: pointer.value }), pointee: pointee.value.value,
      bindings, typeBindings: pointee.value.typeBindings });
    if (!retainedRows.add(2 + binding.typeBindings.length)) return unresolved(budget.failure()!);
    let byBindings = fields.get(occurrence);
    if (byBindings === undefined) { byBindings = new WeakMap(); fields.set(occurrence, byBindings); }
    byBindings.set(bindings, binding);
    return resolved(Object.freeze({ kind: "present", value: binding }));
  };
  const record: SourceMemoryQueries["memoryBindings"]["record"] = (occurrence, bindings) => budget.withRows(rows => {
    context.assertNode(occurrence);
    const environments = environment(occurrence, bindings);
    if (environments.kind !== "resolved") return environments;
    const selected = original.recordBinding(occurrence);
    if (selected.kind === "unavailable") return unresolved(selected.reason);
    if (selected.kind === "none") return resolved(none);
    const previous = records.get(occurrence)?.get(bindings);
    if (previous !== undefined) return resolved(Object.freeze({ kind: "present", value: previous }));
    const originalRecord = selected.value;
    const owner = context.component(originalRecord.source, environments.value);
    if (owner.kind !== "resolved") return owner;
    const layout = metadata.layout(originalRecord.layout, environments.value);
    if (layout.kind !== "resolved") return layout;
    if (layout.value.kind !== "value" || !equivalent(owner.value.value, layout.value.source))
      return unresolved("A memory record binding requires its exact closed Source record layout.");
    const remaining = new Map(layout.value.fields.map(field => [field.occurrence, field]));
    if (remaining.size !== layout.value.fields.length || originalRecord.fields.length !== remaining.size)
      return unresolved("A memory record binding requires its complete independent original field inventory.");
    const selectedFields: SourceMemoryRecordBinding["fields"][number][] = [];
    for (const entry of originalRecord.fields) {
      if (!budget.step() || !rows.add(1)) return unresolved(budget.failure()!);
      const child = field(entry.binding, bindings);
      if (child.kind !== "resolved") return child;
      if (child.value.kind === "none") return unresolved("A memory record retains every original field binding.");
      const expected = remaining.get(child.value.value.field.occurrence);
      if (expected === undefined || child.value.value.field !== expected || !equivalent(child.value.value.owner, owner.value.value))
        return unresolved("Memory record fields cannot be missing, repeated or selected from another original owner.");
      remaining.delete(expected.occurrence);
      selectedFields.push(Object.freeze({ expression: entry.expression, binding: child.value.value }));
    }
    const application = source.facts.applications.application(occurrence);
    if (application.kind === "refused") return application;
    const result = context.substitute(application.value.result, environments.value);
    if (result.kind !== "resolved") return result;
    const binding: SourceMemoryRecordBinding = Object.freeze({ occurrence, result: result.value,
      layoutExpression: originalRecord.layoutExpression, layout: layout.value, bindings,
      typeBindings: owner.value.typeBindings, fields: Object.freeze(selectedFields) });
    if (!retainedRows.add(2 + binding.typeBindings.length + selectedFields.length)) return unresolved(budget.failure()!);
    let byBindings = records.get(occurrence);
    if (byBindings === undefined) { byBindings = new WeakMap(); records.set(occurrence, byBindings); }
    byBindings.set(bindings, binding);
    return resolved(Object.freeze({ kind: "present", value: binding }));
  });
  let capturedInventory: SourceMemoryBindingInventory | undefined;
  const inventory: SourceMemoryQueries["memoryBindings"]["inventory"] = () => budget.withRows(rows => {
    if (budget.failure() !== undefined) return unresolved(budget.failure()!);
    if (capturedInventory !== undefined) return resolved(capturedInventory);
    const records: SourceMemoryBindingInventory["records"][number][] = [];
    const declarations = new Set<Node>();
    for (const occurrence of storage.invocations) {
      if (!budget.step() || !rows.add(1)) return unresolved(budget.failure()!);
      const originalRecord = original.recordBinding(occurrence);
      if (originalRecord.kind === "none") continue;
      if (originalRecord.kind === "unavailable") {
        records.push(Object.freeze({ occurrence, selection: Object.freeze({ kind: "rejected", issues: Object.freeze([
          Object.freeze({ node: occurrence, reason: originalRecord.reason })]) }) }));
        continue;
      }
      const bindings = storage.bindingsForLexicalOwner(occurrence);
      if (bindings.kind !== "resolved") return bindings;
      const selected = record(occurrence, bindings.bindings);
      if (selected.kind !== "resolved") return selected;
      if (selected.value.kind === "none") throw new Error("A finalized record inventory retains its original binding operation.");
      for (const entry of selected.value.value.fields) for (const declaration of entry.binding.field.selectedDeclarations) {
        if (!budget.step() || !rows.add(1)) return unresolved(budget.failure()!);
        context.assertNode(declaration);
        declarations.add(declaration);
      }
      records.push(Object.freeze({ occurrence, selection: Object.freeze({ kind: "bound", value: selected.value.value }) }));
    }
    if (!retainedRows.add(1 + records.length + declarations.size)) return unresolved(budget.failure()!);
    capturedInventory = Object.freeze({ records: Object.freeze(records), selectedDeclarations: Object.freeze([...declarations]) });
    return resolved(capturedInventory);
  });
  return Object.freeze({ field, record, inventory });
}
