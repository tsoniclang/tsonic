import { defineExtensionFactKey } from "@tsonic/tsts";
import type { Node, Symbol, Type } from "@tsonic/tsts";
import type { TsonicDataLayoutDescriptor, TsonicDataLayoutIdentity } from "@tsonic/target-api/provider";
export type {
  TsonicDataLayoutDescriptor,
  TsonicDataLayoutIdentity,
  TsonicDataLayoutRegistration,
} from "@tsonic/target-api/provider";
import { tsonicCoreSourceExtensionId } from "../identity.js";
import { exactRecord, nonEmptyText, opaqueSubject, recordsEqual, snapshotDataArray } from "./snapshots.js";
import { memoryFieldDimensionsError, memoryLayoutDimensionsError } from "./dimensions.js";

export interface TsonicDataLayoutFact extends TsonicDataLayoutDescriptor {
  readonly providerDeclaration: TsonicDataLayoutIdentity;
}

export interface TsonicMemoryFieldLayoutFact {
  readonly call: Node;
  readonly sourceType: Type;
  readonly selector: Node;
  readonly selectedDeclaration: Node;
  readonly selectedSymbol?: Symbol;
  readonly fieldType: Type;
  readonly byteOffset: number;
  readonly byteAlignment: number;
}

export interface TsonicMemoryLayoutFact {
  readonly call: Node;
  readonly sourceType: Type;
  readonly explicitTypeNode?: Node;
  readonly dataLayoutExpression: Node;
  readonly dataLayout: TsonicDataLayoutFact;
  readonly byteSize: number;
  readonly byteAlignment: number;
  readonly stride: number;
  readonly fields: readonly TsonicMemoryFieldLayoutFact[];
}

export interface TsonicMemoryLayoutQueryFact {
  readonly operation: "size" | "alignment" | "stride" | "field-offset";
  readonly call: Node;
  readonly layoutExpression: Node;
  readonly layoutType: Type;
  readonly selectedFieldDeclaration?: Node;
  readonly resultType: Type;
}

export function snapshotDataLayoutIdentity(value: TsonicDataLayoutIdentity): TsonicDataLayoutIdentity {
  const result = exactRecord(value, [
    "providerId", "providerVersion", "providerModuleId", "moduleSpecifier", "exportId",
  ]);
  for (const entry of Object.values(result)) nonEmptyText(entry);
  return result;
}

export function snapshotDataLayoutDescriptor(value: TsonicDataLayoutDescriptor): TsonicDataLayoutDescriptor {
  const result = exactRecord(value, ["fingerprint", "byteOrder", "addressWidth"]);
  nonEmptyText(result.fingerprint);
  if ((result.byteOrder !== "little" && result.byteOrder !== "big") ||
      (result.addressWidth !== 32 && result.addressWidth !== 64)) {
    throw new Error("Data layout requires an explicit byte order and supported address width.");
  }
  return result;
}

export function snapshotDataLayout(value: TsonicDataLayoutFact): TsonicDataLayoutFact {
  const result = exactRecord(value, ["providerDeclaration", "fingerprint", "byteOrder", "addressWidth"]);
  return Object.freeze({
    ...snapshotDataLayoutDescriptor({
      fingerprint: result.fingerprint, byteOrder: result.byteOrder, addressWidth: result.addressWidth,
    }),
    providerDeclaration: snapshotDataLayoutIdentity(result.providerDeclaration),
  });
}

export function dataLayoutsEqual(left: TsonicDataLayoutFact, right: TsonicDataLayoutFact): boolean {
  return recordsEqual(left.providerDeclaration, right.providerDeclaration) &&
    left.fingerprint === right.fingerprint && left.byteOrder === right.byteOrder &&
    left.addressWidth === right.addressWidth;
}

export function snapshotMemoryField(value: TsonicMemoryFieldLayoutFact): TsonicMemoryFieldLayoutFact {
  const result = exactRecord(value,
    ["call", "sourceType", "selector", "selectedDeclaration", "fieldType", "byteOffset", "byteAlignment"],
    ["selectedSymbol"]);
  for (const subject of [result.call, result.sourceType, result.selector, result.selectedDeclaration, result.fieldType]) {
    opaqueSubject(subject);
  }
  if (result.selectedSymbol !== undefined) opaqueSubject(result.selectedSymbol);
  const error = memoryFieldDimensionsError(result);
  if (error !== undefined) throw new Error(error);
  return result;
}

export function snapshotMemoryLayout(value: TsonicMemoryLayoutFact): TsonicMemoryLayoutFact {
  const result = exactRecord(value,
    ["call", "sourceType", "dataLayoutExpression", "dataLayout", "byteSize", "byteAlignment", "stride", "fields"],
    ["explicitTypeNode"]);
  for (const subject of [result.call, result.sourceType, result.dataLayoutExpression]) opaqueSubject(subject);
  if (result.explicitTypeNode !== undefined) opaqueSubject(result.explicitTypeNode);
  const dataLayout = snapshotDataLayout(result.dataLayout);
  const fields = snapshotDataArray(result.fields, snapshotMemoryField);
  const error = memoryLayoutDimensionsError({ ...result, dataLayout, fields });
  if (error !== undefined) throw new Error(error);
  return Object.freeze({ ...result, dataLayout, fields });
}

export const tsonicDataLayoutFactKey = defineExtensionFactKey<TsonicDataLayoutFact>({
  extensionId: tsonicCoreSourceExtensionId, name: "dataLayout",
  snapshot: snapshotDataLayout, equals: dataLayoutsEqual,
});

export const tsonicMemoryFieldLayoutFactKey = defineExtensionFactKey<TsonicMemoryFieldLayoutFact>({
  extensionId: tsonicCoreSourceExtensionId, name: "memoryFieldLayout",
  snapshot: snapshotMemoryField, equals: recordsEqual,
});

export const tsonicMemoryLayoutFactKey = defineExtensionFactKey<TsonicMemoryLayoutFact>({
  extensionId: tsonicCoreSourceExtensionId, name: "memoryLayout",
  snapshot: snapshotMemoryLayout,
  equals: (left, right) => left.call === right.call && left.sourceType === right.sourceType &&
    left.explicitTypeNode === right.explicitTypeNode && left.dataLayoutExpression === right.dataLayoutExpression &&
    dataLayoutsEqual(left.dataLayout, right.dataLayout) && left.byteSize === right.byteSize &&
    left.byteAlignment === right.byteAlignment && left.stride === right.stride &&
    left.fields.length === right.fields.length && left.fields.every((field, index) =>
      right.fields[index] !== undefined && recordsEqual(field, right.fields[index])),
});

export const tsonicMemoryLayoutQueryFactKey = defineExtensionFactKey<TsonicMemoryLayoutQueryFact>({
  extensionId: tsonicCoreSourceExtensionId, name: "memoryLayoutQuery",
  snapshot(value) {
    const result = exactRecord(value, ["operation", "call", "layoutExpression", "layoutType", "resultType"],
      ["selectedFieldDeclaration"]);
    if (!["size", "alignment", "stride", "field-offset"].includes(result.operation) ||
        (result.operation === "field-offset") !== (result.selectedFieldDeclaration !== undefined)) {
      throw new Error("Layout query requires one exact operation and corresponding field selection.");
    }
    for (const subject of [result.call, result.layoutExpression, result.layoutType, result.resultType]) opaqueSubject(subject);
    if (result.selectedFieldDeclaration !== undefined) opaqueSubject(result.selectedFieldDeclaration);
    return result;
  },
  equals: recordsEqual,
});
