import type { AstReader, ExtensionFactSubject, ReadonlySourceFactResolver } from "@tsonic/tsts";
import { isFinalizedMemoryLayoutFacts, readTsonicMemoryFieldLayout, readTsonicMemoryLayout } from "./memory-readers.js";
import { memoryLayoutsEqual, tsonicMemoryFieldLayoutFactKey } from "./memory-layout-facts.js";
import { tsonicMemoryFieldBindingFactKey, tsonicMemoryRecordBindingFactKey } from "./memory-binding-facts.js";
import type { TsonicMemoryFieldBindingFact, TsonicMemoryRecordBindingFact } from "./memory-binding-facts.js";

export type TsonicMemoryBindingSelection<T> =
  | { readonly kind: "resolved"; readonly operation: T }
  | { readonly kind: "rejected"; readonly reason: string };

export function selectTsonicMemoryFieldBindingFacts(
  ast: AstReader, facts: ReadonlySourceFactResolver, subject: ExtensionFactSubject,
): TsonicMemoryBindingSelection<TsonicMemoryFieldBindingFact> | undefined {
  const operation = facts.getFact(subject, tsonicMemoryFieldBindingFactKey);
  if (operation === undefined) return undefined;
  const arguments_ = ast.arguments(operation.call);
  const field = readTsonicMemoryFieldLayout(facts, operation.fieldExpression);
  const original = readTsonicMemoryFieldLayout(facts, operation.field.call);
  const child = readTsonicMemoryLayout(facts, operation.field.fieldLayoutExpression);
  if (operation.call !== subject || arguments_.length !== 2 || arguments_[0] !== operation.fieldExpression ||
      arguments_[1] !== operation.pointerExpression || field === undefined || original === undefined ||
      !tsonicMemoryFieldLayoutFactKey.equals(operation.field, field) || !tsonicMemoryFieldLayoutFactKey.equals(field, original) ||
      child === undefined || !memoryLayoutsEqual(child, field.fieldLayout) || !isFinalizedMemoryLayoutFacts(facts, child)) {
    return Object.freeze({ kind: "rejected", reason: "Memory field binding requires its exact field, pointer and finalized child memory type/layout." });
  }
  return Object.freeze({ kind: "resolved", operation });
}

export function selectTsonicMemoryRecordBindingFacts(
  ast: AstReader, facts: ReadonlySourceFactResolver, subject: ExtensionFactSubject,
): TsonicMemoryBindingSelection<TsonicMemoryRecordBindingFact> | undefined {
  const operation = facts.getFact(subject, tsonicMemoryRecordBindingFactKey);
  if (operation === undefined) return undefined;
  const rejected = Object.freeze({ kind: "rejected" as const,
    reason: "Memory record binding requires its exact operands, complete field bindings and finalized record layout/type." });
  const arguments_ = ast.arguments(operation.call);
  const layout = readTsonicMemoryLayout(facts, operation.layoutExpression);
  if (operation.call !== subject || arguments_.length !== operation.fields.length + 1 || arguments_[0] !== operation.layoutExpression ||
      layout?.kind !== "value" || !memoryLayoutsEqual(layout, operation.layout) || !isFinalizedMemoryLayoutFacts(facts, layout) ||
      operation.fields.length !== layout.fields.length) return rejected;
  const remaining = new Map(layout.fields.map(field => [field.call, field]));
  for (const [index, entry] of operation.fields.entries()) {
    if (arguments_[index + 1] !== entry.expression) return rejected;
    const selected = selectTsonicMemoryFieldBindingFacts(ast, facts, entry.binding.call);
    const retained = facts.getFact(entry.expression, tsonicMemoryFieldBindingFactKey);
    const field = remaining.get(entry.binding.field.call);
    if (selected?.kind !== "resolved" || retained === undefined || field === undefined ||
        !tsonicMemoryFieldBindingFactKey.equals(entry.binding, selected.operation) ||
        !tsonicMemoryFieldBindingFactKey.equals(entry.binding, retained) ||
        !tsonicMemoryFieldLayoutFactKey.equals(entry.binding.field, field)) return rejected;
    remaining.delete(field.call);
  }
  return Object.freeze({ kind: "resolved", operation });
}
