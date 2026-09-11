import type { ExtensionFactSubject, ReadonlySourceFactResolver } from "@tsonic/tsts";
import { tsonicKeepAliveFactKey, tsonicRawMemoryOperationFactKey } from "../pointers/raw-memory/facts.js";
import { dataLayoutsEqual, memoryLayoutsEqual, tsonicDataLayoutFactKey, tsonicMemoryFieldLayoutFactKey, tsonicMemoryLayoutFactKey, tsonicMemoryLayoutQueryFactKey } from "./facts.js";
import type { TsonicMemoryLayoutFact } from "./facts.js";
import { memoryArrayTypeMatches, memoryLayoutTypeKindMatches, readTsonicMemoryType } from "./type-contract/facts.js";
import { tsonicFixedArrayFactKey, fixedArrayFactsEqual } from "../fixed-arrays/facts.js";

type MemoryFactReader = Pick<ReadonlySourceFactResolver, "getFact">;

export function readTsonicDataLayout(facts: MemoryFactReader, subject: ExtensionFactSubject | undefined) {
  return facts.getFact(subject, tsonicDataLayoutFactKey);
}

export function readTsonicMemoryFieldLayout(facts: MemoryFactReader, subject: ExtensionFactSubject | undefined) {
  return facts.getFact(subject, tsonicMemoryFieldLayoutFactKey);
}

export function readTsonicMemoryLayout(facts: MemoryFactReader, subject: ExtensionFactSubject | undefined) {
  return facts.getFact(subject, tsonicMemoryLayoutFactKey);
}

export function readTsonicMemoryLayoutQuery(facts: MemoryFactReader, subject: ExtensionFactSubject | undefined) {
  return facts.getFact(subject, tsonicMemoryLayoutQueryFactKey);
}

export function countTsonicMemoryLayoutValues(root: TsonicMemoryLayoutFact, maximum: number): number | undefined {
  if (!Number.isSafeInteger(maximum) || maximum < 1) return undefined;
  const counts = new Map<TsonicMemoryLayoutFact, number | undefined>();
  function count(layout: TsonicMemoryLayoutFact): number | undefined {
    if (counts.has(layout)) return counts.get(layout);
    counts.set(layout, undefined);
    let total = 1;
    const children = layout.kind === "array" ? [layout.elementLayout] : layout.fields.map(field => field.fieldLayout);
    for (const element of children) {
      const child = count(element);
      if (child === undefined || child > maximum - total) return undefined;
      total += child;
    }
    counts.set(layout, total);
    return total;
  }
  return count(root);
}

export function isFinalizedMemoryLayout(facts: MemoryFactReader, root: TsonicMemoryLayoutFact): boolean {
  const pending = [root];
  const visited = new Set<TsonicMemoryLayoutFact["call"]>();
  while (pending.length !== 0) {
    const layout = pending.pop()!;
    const selected = readTsonicMemoryLayout(facts, layout.call);
    const type = readTsonicMemoryType(facts, layout.call);
    if (selected === undefined || type === undefined || !memoryLayoutsEqual(layout, selected) || type.sourceType !== layout.sourceType ||
        !memoryLayoutTypeKindMatches(type.identity, layout.call, layout.kind)) return false;
    if (visited.has(layout.call)) continue;
    visited.add(layout.call);
    const abi = readTsonicDataLayout(facts, layout.dataLayoutExpression);
    if (abi === undefined || !dataLayoutsEqual(abi, layout.dataLayout)) return false;
    if (layout.kind === "array") {
      const fixedArray = facts.getFact(layout.call, tsonicFixedArrayFactKey);
      const selectedChild = readTsonicMemoryLayout(facts, layout.elementLayoutExpression);
      const childType = readTsonicMemoryType(facts, layout.elementLayout.call);
      if (fixedArray === undefined || childType === undefined || selectedChild === undefined ||
          !fixedArrayFactsEqual(fixedArray, layout.fixedArray) ||
          !memoryLayoutsEqual(layout.elementLayout, selectedChild) ||
          !memoryArrayTypeMatches(type.identity, childType.identity, layout.call, fixedArray)) return false;
      pending.push(layout.elementLayout);
      continue;
    }
    for (const field of layout.fields) {
      const selectedField = readTsonicMemoryFieldLayout(facts, field.call);
      const selectedChild = readTsonicMemoryLayout(facts, field.fieldLayoutExpression);
      const fieldType = readTsonicMemoryType(facts, field.call);
      const childType = readTsonicMemoryType(facts, field.fieldLayout.call);
      if (selectedField === undefined || selectedChild === undefined ||
          fieldType === undefined || childType === undefined || fieldType.sourceType !== field.fieldType ||
          fieldType.identity !== childType.identity ||
          !tsonicMemoryFieldLayoutFactKey.equals(field, selectedField) ||
          !memoryLayoutsEqual(field.fieldLayout, selectedChild)) return false;
      pending.push(field.fieldLayout);
    }
  }
  return true;
}

export function resolveTsonicMemoryLayoutObservation(facts: MemoryFactReader, subject: ExtensionFactSubject) {
  const query = readTsonicMemoryLayoutQuery(facts, subject);
  if (query === undefined) return undefined;
  const layout = readTsonicMemoryLayout(facts, query.layoutExpression);
  if (query.call !== subject || layout === undefined || !isFinalizedMemoryLayout(facts, layout)) return Object.freeze({
    kind: "rejected" as const, reason: "Layout observation has no exact finalized descriptor for its selected call.",
  });
  const values = { size: layout.byteSize, alignment: layout.byteAlignment, stride: layout.stride };
  const fields = query.operation === "field-offset"
    ? layout.kind === "value" ? layout.fields.filter(field => field.selectedDeclaration === query.selectedFieldDeclaration) : []
    : undefined;
  if (fields !== undefined && fields.length !== 1) return Object.freeze({
    kind: "rejected" as const, reason: "Layout field observation does not select exactly one declared field.",
  });
  const value = query.operation === "field-offset" ? fields![0]!.byteOffset : values[query.operation];
  return Object.freeze({ kind: "resolved" as const, query, layout, value });
}

export function readTsonicRawMemoryOperation(facts: ReadonlySourceFactResolver, subject: ExtensionFactSubject | undefined) {
  return facts.getFact(subject, tsonicRawMemoryOperationFactKey);
}

export function readTsonicKeepAlive(facts: ReadonlySourceFactResolver, subject: ExtensionFactSubject | undefined) {
  return facts.getFact(subject, tsonicKeepAliveFactKey);
}
