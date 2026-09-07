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
  readonly fieldLayoutExpression: Node;
  readonly fieldLayout: TsonicMemoryLayoutFact;
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

export const maximumMemoryLayoutDepth = 128;
const maximumMemoryLayoutValues = 131072;
const capturedLayoutDepths = new WeakMap<TsonicMemoryLayoutFact, number>();

export function memoryLayoutCaptureLimitsError(fields: readonly TsonicMemoryFieldLayoutFact[]): string | undefined {
  if (fields.length > Math.floor((maximumMemoryLayoutValues - 1) / 2)) {
    return "Memory layout exceeds its metadata value budget.";
  }
  for (const field of fields) {
    const depth = capturedLayoutDepths.get(field.fieldLayout);
    if (depth === undefined) return "Memory field layout is not an immutable source-owned snapshot.";
    if (depth >= maximumMemoryLayoutDepth) return "Memory layout exceeds its supported nesting depth.";
  }
  return undefined;
}

function memoryLayoutSnapshot() {
  const layouts = new Map<TsonicMemoryLayoutFact, TsonicMemoryLayoutFact>();
  const active = new Set<TsonicMemoryLayoutFact>();
  let values = 0;
  function visit(): void {
    values += 1;
    if (values > maximumMemoryLayoutValues) throw new Error("Memory layout exceeds its metadata value budget.");
  }
  function field(value: TsonicMemoryFieldLayoutFact): TsonicMemoryFieldLayoutFact {
    visit();
    const result = exactRecord(value,
      ["call", "sourceType", "selector", "selectedDeclaration", "fieldType", "byteOffset", "byteAlignment",
        "fieldLayoutExpression", "fieldLayout"],
      ["selectedSymbol"]);
    for (const subject of [result.call, result.sourceType, result.selector, result.selectedDeclaration,
      result.fieldType, result.fieldLayoutExpression]) opaqueSubject(subject);
    if (result.selectedSymbol !== undefined) opaqueSubject(result.selectedSymbol);
    const error = memoryFieldDimensionsError(result);
    if (error !== undefined) throw new Error(error);
    return Object.freeze({ ...result, fieldLayout: layout(result.fieldLayout) });
  }
  function layout(value: TsonicMemoryLayoutFact): TsonicMemoryLayoutFact {
    visit();
    const capturedDepth = capturedLayoutDepths.get(value);
    if (capturedDepth !== undefined) {
      if (active.size + capturedDepth > maximumMemoryLayoutDepth) {
        throw new Error("Memory layout exceeds its supported nesting depth.");
      }
      return value;
    }
    const cached = layouts.get(value);
    if (cached !== undefined) {
      if (active.size + capturedLayoutDepths.get(cached)! > maximumMemoryLayoutDepth) {
        throw new Error("Memory layout exceeds its supported nesting depth.");
      }
      return cached;
    }
    if (active.has(value)) throw new Error("Memory layout contains a recursive physical value.");
    if (active.size >= maximumMemoryLayoutDepth) throw new Error("Memory layout exceeds its supported nesting depth.");
    const result = exactRecord(value,
      ["call", "sourceType", "dataLayoutExpression", "dataLayout", "byteSize", "byteAlignment", "stride", "fields"],
      ["explicitTypeNode"]);
    for (const subject of [result.call, result.sourceType, result.dataLayoutExpression]) opaqueSubject(subject);
    if (result.explicitTypeNode !== undefined) opaqueSubject(result.explicitTypeNode);
    active.add(value);
    try {
      const dataLayout = snapshotDataLayout(result.dataLayout);
      const fields = snapshotDataArray(result.fields, field);
      if (fields.some((entry) => !dataLayoutsEqual(entry.fieldLayout.dataLayout, dataLayout))) {
        throw new Error("Memory field layout has a different ABI identity or descriptor from its aggregate.");
      }
      const error = memoryLayoutDimensionsError({ ...result, dataLayout, fields });
      if (error !== undefined) throw new Error(error);
      const captured = Object.freeze({ ...result, dataLayout, fields });
      let depth = 1;
      for (const entry of fields) depth = Math.max(depth, 1 + capturedLayoutDepths.get(entry.fieldLayout)!);
      capturedLayoutDepths.set(captured, depth);
      layouts.set(value, captured);
      return captured;
    } finally {
      active.delete(value);
    }
  }
  return { field, layout };
}

export function snapshotMemoryField(value: TsonicMemoryFieldLayoutFact): TsonicMemoryFieldLayoutFact {
  return memoryLayoutSnapshot().field(value);
}

export function snapshotMemoryLayout(value: TsonicMemoryLayoutFact): TsonicMemoryLayoutFact {
  const result = memoryLayoutSnapshot().layout(value);
  if (result !== value) return result;
  const root = Object.freeze({ ...result });
  capturedLayoutDepths.set(root, capturedLayoutDepths.get(result)!);
  return root;
}

function memoryFieldSubjectsEqual(left: TsonicMemoryFieldLayoutFact, right: TsonicMemoryFieldLayoutFact): boolean {
  return left.call === right.call && left.sourceType === right.sourceType && left.selector === right.selector &&
    left.selectedDeclaration === right.selectedDeclaration && left.selectedSymbol === right.selectedSymbol &&
    left.fieldType === right.fieldType && left.byteOffset === right.byteOffset && left.byteAlignment === right.byteAlignment &&
    left.fieldLayoutExpression === right.fieldLayoutExpression;
}

export function memoryLayoutsEqual(left: TsonicMemoryLayoutFact, right: TsonicMemoryLayoutFact): boolean {
  const pending: [TsonicMemoryLayoutFact, TsonicMemoryLayoutFact][] = [[left, right]];
  const visited = new Map<TsonicMemoryLayoutFact, Set<TsonicMemoryLayoutFact>>();
  while (pending.length !== 0) {
    const [current, other] = pending.pop()!;
    if (current === other || visited.get(current)?.has(other)) continue;
    if (current.call !== other.call || current.sourceType !== other.sourceType ||
        current.explicitTypeNode !== other.explicitTypeNode || current.dataLayoutExpression !== other.dataLayoutExpression ||
        !dataLayoutsEqual(current.dataLayout, other.dataLayout) || current.byteSize !== other.byteSize ||
        current.byteAlignment !== other.byteAlignment || current.stride !== other.stride ||
        current.fields.length !== other.fields.length) return false;
    const peers = visited.get(current) ?? new Set<TsonicMemoryLayoutFact>();
    peers.add(other);
    visited.set(current, peers);
    for (const [index, field] of current.fields.entries()) {
      const otherField = other.fields[index]!;
      if (!memoryFieldSubjectsEqual(field, otherField)) return false;
      pending.push([field.fieldLayout, otherField.fieldLayout]);
    }
  }
  return true;
}

export const tsonicDataLayoutFactKey = defineExtensionFactKey<TsonicDataLayoutFact>({
  extensionId: tsonicCoreSourceExtensionId, name: "dataLayout",
  snapshot: snapshotDataLayout, equals: dataLayoutsEqual,
});

export const tsonicMemoryFieldLayoutFactKey = defineExtensionFactKey<TsonicMemoryFieldLayoutFact>({
  extensionId: tsonicCoreSourceExtensionId, name: "memoryFieldLayout",
  snapshot: snapshotMemoryField, equals: (left, right) =>
    memoryFieldSubjectsEqual(left, right) && memoryLayoutsEqual(left.fieldLayout, right.fieldLayout),
});

export const tsonicMemoryLayoutFactKey = defineExtensionFactKey<TsonicMemoryLayoutFact>({
  extensionId: tsonicCoreSourceExtensionId, name: "memoryLayout",
  snapshot: snapshotMemoryLayout,
  equals: memoryLayoutsEqual,
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
