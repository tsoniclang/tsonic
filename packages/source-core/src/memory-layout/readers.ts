import type { ExtensionFactSubject, ReadonlySourceFactResolver } from "@tsonic/tsts";
import { tsonicKeepAliveFactKey, tsonicRawMemoryOperationFactKey } from "../pointers/raw-memory/facts.js";
import { dataLayoutsEqual, tsonicDataLayoutFactKey, tsonicMemoryFieldLayoutFactKey, tsonicMemoryLayoutFactKey, tsonicMemoryLayoutQueryFactKey } from "./facts.js";

export function readTsonicDataLayout(facts: ReadonlySourceFactResolver, subject: ExtensionFactSubject | undefined) {
  return facts.getFact(subject, tsonicDataLayoutFactKey);
}

export function readTsonicMemoryFieldLayout(facts: ReadonlySourceFactResolver, subject: ExtensionFactSubject | undefined) {
  return facts.getFact(subject, tsonicMemoryFieldLayoutFactKey);
}

export function readTsonicMemoryLayout(facts: ReadonlySourceFactResolver, subject: ExtensionFactSubject | undefined) {
  return facts.getFact(subject, tsonicMemoryLayoutFactKey);
}

export function readTsonicMemoryLayoutQuery(facts: ReadonlySourceFactResolver, subject: ExtensionFactSubject | undefined) {
  return facts.getFact(subject, tsonicMemoryLayoutQueryFactKey);
}

export function resolveTsonicMemoryLayoutObservation(facts: ReadonlySourceFactResolver, subject: ExtensionFactSubject) {
  const query = readTsonicMemoryLayoutQuery(facts, subject);
  if (query === undefined) return undefined;
  const layout = readTsonicMemoryLayout(facts, query.layoutExpression);
  const abi = layout === undefined ? undefined : readTsonicDataLayout(facts, layout.dataLayoutExpression);
  if (query.call !== subject || layout === undefined || abi === undefined || !dataLayoutsEqual(abi, layout.dataLayout)) return Object.freeze({
    kind: "rejected" as const, reason: "Layout observation has no exact finalized descriptor for its selected call.",
  });
  const values = { size: layout.byteSize, alignment: layout.byteAlignment, stride: layout.stride };
  const fields = query.operation === "field-offset"
    ? layout.fields.filter(field => field.selectedDeclaration === query.selectedFieldDeclaration) : undefined;
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
