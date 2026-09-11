import type { AstReader, ExtensionFactSubject, ReadonlySourceFactResolver } from "@tsonic/tsts";
import { isFinalizedMemoryLayout, readTsonicMemoryFieldLayout, readTsonicMemoryLayout } from "../readers.js";
import { memoryLayoutsEqual, tsonicMemoryFieldLayoutFactKey } from "../facts.js";
import { readTsonicMemoryType } from "../type-contract/facts.js";
import { tsonicMemoryFieldBindingFactKey, tsonicMemoryRecordBindingFactKey } from "./facts.js";
import type { TsonicMemoryFieldBindingFact, TsonicMemoryRecordBindingFact } from "./facts.js";

export type TsonicMemoryBindingSelection<T> =
  | { readonly kind: "resolved"; readonly operation: T }
  | { readonly kind: "rejected"; readonly reason: string };

export function selectTsonicMemoryFieldBinding(
  ast: AstReader, facts: ReadonlySourceFactResolver, subject: ExtensionFactSubject,
): TsonicMemoryBindingSelection<TsonicMemoryFieldBindingFact> | undefined {
  const operation = facts.getFact(subject, tsonicMemoryFieldBindingFactKey);
  if (operation === undefined) return undefined;
  const arguments_ = ast.arguments(operation.call);
  const field = readTsonicMemoryFieldLayout(facts, operation.fieldExpression);
  const original = readTsonicMemoryFieldLayout(facts, operation.field.call);
  const child = readTsonicMemoryLayout(facts, operation.field.fieldLayoutExpression);
  const selectedType = readTsonicMemoryType(facts, operation.call);
  const fieldType = readTsonicMemoryType(facts, operation.field.call);
  const childType = readTsonicMemoryType(facts, operation.field.fieldLayout.call);
  if (operation.call !== subject || arguments_.length !== 2 || arguments_[0] !== operation.fieldExpression ||
      arguments_[1] !== operation.pointerExpression || field === undefined || original === undefined ||
      !tsonicMemoryFieldLayoutFactKey.equals(operation.field, field) || !tsonicMemoryFieldLayoutFactKey.equals(field, original) ||
      child === undefined || !memoryLayoutsEqual(child, field.fieldLayout) || !isFinalizedMemoryLayout(facts, child) ||
      selectedType === undefined || fieldType === undefined || childType === undefined ||
      selectedType.sourceType !== operation.pointeeType || fieldType.sourceType !== field.fieldType ||
      childType.sourceType !== child.sourceType || selectedType.identity !== fieldType.identity || fieldType.identity !== childType.identity) {
    return Object.freeze({ kind: "rejected", reason: "Memory field binding requires its exact field, pointer and finalized child memory type/layout." });
  }
  return Object.freeze({ kind: "resolved", operation });
}

export function selectTsonicMemoryRecordBinding(
  ast: AstReader, facts: ReadonlySourceFactResolver, subject: ExtensionFactSubject,
): TsonicMemoryBindingSelection<TsonicMemoryRecordBindingFact> | undefined {
  const operation = facts.getFact(subject, tsonicMemoryRecordBindingFactKey);
  if (operation === undefined) return undefined;
  const rejected = Object.freeze({ kind: "rejected" as const,
    reason: "Memory record binding requires its exact operands, complete field bindings and finalized record layout/type." });
  const arguments_ = ast.arguments(operation.call);
  const layout = readTsonicMemoryLayout(facts, operation.layoutExpression);
  const selectedType = readTsonicMemoryType(facts, operation.call);
  const layoutType = readTsonicMemoryType(facts, operation.layout.call);
  if (operation.call !== subject || arguments_.length !== operation.fields.length + 1 || arguments_[0] !== operation.layoutExpression ||
      layout?.kind !== "value" || !memoryLayoutsEqual(layout, operation.layout) || !isFinalizedMemoryLayout(facts, layout) ||
      selectedType === undefined || layoutType === undefined || selectedType.sourceType !== operation.sourceType ||
      layoutType.sourceType !== layout.sourceType || selectedType.identity !== layoutType.identity ||
      operation.fields.length !== layout.fields.length) return rejected;
  const remaining = new Map(layout.fields.map(field => [field.call, field]));
  for (const [index, entry] of operation.fields.entries()) {
    if (arguments_[index + 1] !== entry.expression) return rejected;
    const selected = selectTsonicMemoryFieldBinding(ast, facts, entry.binding.call);
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
