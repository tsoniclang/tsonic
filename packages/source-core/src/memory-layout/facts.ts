import { defineExtensionFactKey } from "@tsonic/tsts";
import type { Node } from "@tsonic/tsts";
import type { TsonicDataLayoutDescriptor, TsonicDataLayoutIdentity } from "@tsonic/target-api/provider";
import { failTargetCompilerResourceLimit } from "@tsonic/target-api/artifacts";
import { tsonicCoreSourceExtensionId } from "../identity.js";
import { exactRecord, nonEmptyText, opaqueSubject, recordsEqual, snapshotDataArray } from "./snapshots.js";
import { memoryFieldDimensionsError, memoryLayoutDimensionsError } from "./dimensions.js";

export interface TsonicDataLayoutFact extends TsonicDataLayoutDescriptor {
  readonly providerDeclaration: TsonicDataLayoutIdentity;
}

// Legacy-extension layout witnesses: selected nodes, ABI identity and exact dimensions only. No checker Type (I1); the
// Host publishes the laid-out, field and element descriptors (`TsonicMemoryLayoutRecord`, host-records.ts).
export interface TsonicMemoryFieldLayoutFact {
  readonly call: Node;
  readonly selector: Node;
  readonly selectedDeclaration: Node;
  readonly fieldLayoutExpression: Node;
  readonly fieldLayout: TsonicMemoryLayoutFact;
  readonly byteOffset: bigint;
  readonly byteAlignment: bigint;
}

interface MemoryLayoutBase {
  readonly call: Node;
  readonly explicitTypeNode?: Node;
  readonly dataLayoutExpression: Node;
  readonly dataLayout: TsonicDataLayoutFact;
  readonly byteSize: bigint;
  readonly byteAlignment: bigint;
  readonly stride: bigint;
}

export interface TsonicValueMemoryLayoutFact extends MemoryLayoutBase {
  readonly kind: "value";
  readonly fields: readonly TsonicMemoryFieldLayoutFact[];
}

export interface TsonicArrayMemoryLayoutFact extends MemoryLayoutBase {
  readonly kind: "array";
  readonly fixedArray: TsonicMemoryArrayExtent;
  readonly elementLayoutExpression: Node;
  readonly elementLayout: TsonicMemoryLayoutFact;
}

export type TsonicMemoryLayoutFact = TsonicValueMemoryLayoutFact | TsonicArrayMemoryLayoutFact;

/** The exact extent of a fixed-array layout and its authored element type node (the element type is a Host descriptor). */
export interface TsonicMemoryArrayExtent {
  readonly length: bigint;
  readonly lengthRuntimeBase: "number" | "bigint";
  readonly elementType?: Node;
}

export interface TsonicMemoryLayoutQueryFact {
  readonly operation: "size" | "alignment" | "stride" | "field-offset";
  readonly call: Node;
  readonly layoutExpression: Node;
  readonly selectedFieldDeclaration?: Node;
}

export function snapshotMemoryArrayExtent(value: TsonicMemoryArrayExtent): TsonicMemoryArrayExtent {
  const result = exactRecord(value, ["length", "lengthRuntimeBase"], ["elementType"]);
  if (typeof result.length !== "bigint" || result.length < 0n ||
    (result.lengthRuntimeBase !== "number" && result.lengthRuntimeBase !== "bigint")) {
    throw new Error("Memory array extent requires an exact non-negative length with its source runtime base.");
  }
  if (result.elementType !== undefined) opaqueSubject(result.elementType);
  return Object.freeze(result);
}

export function memoryArrayExtentsEqual(left: TsonicMemoryArrayExtent, right: TsonicMemoryArrayExtent): boolean {
  return left.length === right.length && left.lengthRuntimeBase === right.lengthRuntimeBase && left.elementType === right.elementType;
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
// I5: no module-level table. A captured snapshot carries its own depth under a module-private, non-enumerable key,
// so the provenance mark lives exactly as long as the snapshot (per program) and cannot be forged outside this module.
const capturedLayoutDepth: unique symbol = Symbol("tsonic.memoryLayout.capturedDepth");

function capturedDepthOf(value: TsonicMemoryLayoutFact): number | undefined {
  const descriptor = value !== null && typeof value === "object"
    ? Object.getOwnPropertyDescriptor(value, capturedLayoutDepth) : undefined;
  return descriptor !== undefined && typeof descriptor.value === "number" ? descriptor.value : undefined;
}

function sealCapturedLayout<T extends TsonicMemoryLayoutFact>(value: T, depth: number): T {
  Object.defineProperty(value, capturedLayoutDepth, { value: depth, enumerable: false, writable: false, configurable: false });
  return Object.freeze(value);
}

export function memoryLayoutCaptureLimitsError(children: readonly TsonicMemoryLayoutFact[], fieldCount = 0): string | undefined {
  if (children.length + fieldCount >= maximumMemoryLayoutValues) {
    failTargetCompilerResourceLimit("tsonic", "Memory layout capture", "values", maximumMemoryLayoutValues);
  }
  for (const child of children) {
    const depth = capturedDepthOf(child);
    if (depth === undefined) return "Memory child layout is not an immutable source-owned snapshot.";
    if (depth >= maximumMemoryLayoutDepth) failTargetCompilerResourceLimit("tsonic", "Memory layout capture", "depth", maximumMemoryLayoutDepth);
  }
  return undefined;
}

function memoryLayoutSnapshot() {
  const layouts = new Map<TsonicMemoryLayoutFact, TsonicMemoryLayoutFact>();
  const active = new Set<TsonicMemoryLayoutFact>();
  let values = 0;
  function visit(): void {
    values += 1;
    if (values > maximumMemoryLayoutValues) failTargetCompilerResourceLimit("tsonic", "Memory layout snapshot", "values", maximumMemoryLayoutValues);
  }
  function field(value: TsonicMemoryFieldLayoutFact): TsonicMemoryFieldLayoutFact {
    visit();
    const result = exactRecord(value,
      ["call", "selector", "selectedDeclaration", "byteOffset", "byteAlignment", "fieldLayoutExpression", "fieldLayout"]);
    for (const subject of [result.call, result.selector, result.selectedDeclaration, result.fieldLayoutExpression]) opaqueSubject(subject);
    const error = memoryFieldDimensionsError(result);
    if (error !== undefined) throw new Error(error);
    return Object.freeze({ ...result, fieldLayout: layout(result.fieldLayout) });
  }
  function layout(value: TsonicMemoryLayoutFact): TsonicMemoryLayoutFact {
    visit();
    const capturedDepth = capturedDepthOf(value);
    if (capturedDepth !== undefined) {
      if (active.size + capturedDepth > maximumMemoryLayoutDepth) {
        failTargetCompilerResourceLimit("tsonic", "Memory layout snapshot", "depth", maximumMemoryLayoutDepth);
      }
      return value;
    }
    const cached = layouts.get(value);
    if (cached !== undefined) {
      if (active.size + capturedDepthOf(cached)! > maximumMemoryLayoutDepth) {
        failTargetCompilerResourceLimit("tsonic", "Memory layout snapshot", "depth", maximumMemoryLayoutDepth);
      }
      return cached;
    }
    if (active.has(value)) throw new Error("Memory layout contains a recursive physical value.");
    if (active.size >= maximumMemoryLayoutDepth) failTargetCompilerResourceLimit("tsonic", "Memory layout snapshot", "depth", maximumMemoryLayoutDepth);
    const discriminator = value !== null && typeof value === "object"
      ? Object.getOwnPropertyDescriptor(value, "kind") : undefined;
    if (discriminator === undefined || !("value" in discriminator) ||
      (discriminator.value !== "value" && discriminator.value !== "array")) {
      throw new Error("Memory layout requires an exact own data discriminator.");
    }
    const result = discriminator.value === "value"
      ? exactRecord(value as TsonicValueMemoryLayoutFact,
        ["kind", "call", "dataLayoutExpression", "dataLayout", "byteSize", "byteAlignment", "stride", "fields"],
        ["explicitTypeNode"])
      : exactRecord(value as TsonicArrayMemoryLayoutFact,
        ["kind", "call", "dataLayoutExpression", "dataLayout", "byteSize", "byteAlignment", "stride",
          "fixedArray", "elementLayoutExpression", "elementLayout"], ["explicitTypeNode"]);
    for (const subject of [result.call, result.dataLayoutExpression]) opaqueSubject(subject);
    if (result.explicitTypeNode !== undefined) opaqueSubject(result.explicitTypeNode);
    active.add(value);
    try {
      const dataLayout = snapshotDataLayout(result.dataLayout);
      let captured: TsonicMemoryLayoutFact;
      let children: readonly TsonicMemoryLayoutFact[];
      if (result.kind === "value") {
        const fields = snapshotDataArray(result.fields, field);
        children = fields.map(entry => entry.fieldLayout);
        captured = { ...result, dataLayout, fields };
      } else {
        opaqueSubject(result.elementLayoutExpression);
        const fixedArray = snapshotMemoryArrayExtent(result.fixedArray);
        const elementLayout = layout(result.elementLayout);
        children = [elementLayout];
        captured = { ...result, dataLayout, fixedArray, elementLayout };
      }
      if (children.some(child => !dataLayoutsEqual(child.dataLayout, dataLayout))) {
        throw new Error("Memory child layout has a different ABI identity or descriptor from its aggregate.");
      }
      const error = memoryLayoutDimensionsError(captured);
      if (error !== undefined) throw new Error(error);
      let depth = 1;
      for (const child of children) depth = Math.max(depth, 1 + capturedDepthOf(child)!);
      captured = sealCapturedLayout(captured, depth);
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
  return sealCapturedLayout({ ...result }, capturedDepthOf(result)!);
}

function memoryFieldSubjectsEqual(left: TsonicMemoryFieldLayoutFact, right: TsonicMemoryFieldLayoutFact): boolean {
  return left.call === right.call && left.selector === right.selector &&
    left.selectedDeclaration === right.selectedDeclaration && left.byteOffset === right.byteOffset && left.byteAlignment === right.byteAlignment &&
    left.fieldLayoutExpression === right.fieldLayoutExpression;
}

export function memoryLayoutsEqual(left: TsonicMemoryLayoutFact, right: TsonicMemoryLayoutFact): boolean {
  const pending: [TsonicMemoryLayoutFact, TsonicMemoryLayoutFact][] = [[left, right]];
  const visited = new Map<TsonicMemoryLayoutFact, Set<TsonicMemoryLayoutFact>>();
  while (pending.length !== 0) {
    const [current, other] = pending.pop()!;
    if (current === other || visited.get(current)?.has(other)) continue;
    if (current.kind !== other.kind || current.call !== other.call ||
        current.explicitTypeNode !== other.explicitTypeNode || current.dataLayoutExpression !== other.dataLayoutExpression ||
        !dataLayoutsEqual(current.dataLayout, other.dataLayout) || current.byteSize !== other.byteSize ||
        current.byteAlignment !== other.byteAlignment || current.stride !== other.stride) return false;
    const peers = visited.get(current) ?? new Set<TsonicMemoryLayoutFact>();
    peers.add(other);
    visited.set(current, peers);
    if (current.kind === "array") {
      if (other.kind !== "array" || current.elementLayoutExpression !== other.elementLayoutExpression ||
          !memoryArrayExtentsEqual(current.fixedArray, other.fixedArray)) return false;
      pending.push([current.elementLayout, other.elementLayout]);
    } else {
      if (other.kind !== "value" || current.fields.length !== other.fields.length) return false;
      for (const [index, field] of current.fields.entries()) {
        const otherField = other.fields[index]!;
        if (!memoryFieldSubjectsEqual(field, otherField)) return false;
        pending.push([field.fieldLayout, otherField.fieldLayout]);
      }
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
    const result = exactRecord(value, ["operation", "call", "layoutExpression"], ["selectedFieldDeclaration"]);
    if (!["size", "alignment", "stride", "field-offset"].includes(result.operation) ||
        (result.operation === "field-offset") !== (result.selectedFieldDeclaration !== undefined)) {
      throw new Error("Layout query requires one exact operation and corresponding field selection.");
    }
    for (const subject of [result.call, result.layoutExpression]) opaqueSubject(subject);
    if (result.selectedFieldDeclaration !== undefined) opaqueSubject(result.selectedFieldDeclaration);
    return result;
  },
  equals: recordsEqual,
});
