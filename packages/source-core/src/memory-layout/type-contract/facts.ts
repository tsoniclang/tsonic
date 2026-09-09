import { defineExtensionFactKey } from "@tsonic/tsts";
import type { ExtensionFactSubject, Node, ReadonlySourceFactResolver, Type } from "@tsonic/tsts";
import { tsonicCoreSourceExtensionId } from "../../identity.js";
import { exactRecord, opaqueSubject, recordsEqual } from "../snapshots.js";
import { fixedArrayFactsEqual, snapshotFixedArrayFact } from "../../fixed-arrays/facts.js";
import type { TsonicFixedArrayFact } from "../../fixed-arrays/facts.js";

const identityBrand = Symbol("memory type identity");
interface MemoryArrayType {
  readonly element: TsonicMemoryTypeIdentity;
  readonly length: bigint;
  readonly lengthRuntimeBase: "number" | "bigint";
}
const identities = new WeakMap<TsonicMemoryTypeIdentity, {
  readonly bindings: WeakMap<Node, { readonly type: Type; readonly array?: TsonicFixedArrayFact }>;
  array?: MemoryArrayType;
}>();

export interface TsonicMemoryTypeIdentity {
  readonly [identityBrand]: true;
}

export interface TsonicMemoryTypeFact {
  readonly call: Node;
  readonly sourceType: Type;
  readonly identity: TsonicMemoryTypeIdentity;
}

export function createMemoryTypeIdentity(): TsonicMemoryTypeIdentity {
  const identity = Object.freeze({ [identityBrand]: true as const });
  identities.set(identity, { bindings: new WeakMap() });
  return identity;
}

export function bindMemoryTypeIdentity(
  identity: TsonicMemoryTypeIdentity, call: Node, type: Type, array?: TsonicFixedArrayFact,
): void {
  const record = identities.get(identity);
  const previous = record?.bindings.get(call);
  if (record === undefined || array !== undefined && (array.sourceType !== type || record.array === undefined) ||
      previous !== undefined && (previous.type !== type || (previous.array === undefined) !== (array === undefined) ||
        previous.array !== undefined && array !== undefined && !fixedArrayFactsEqual(previous.array, array))) {
    throw new Error("Memory type identity cannot be rebound to different selected evidence.");
  }
  record.bindings.set(call, Object.freeze({ type,
    ...(array === undefined ? {} : { array: snapshotFixedArrayFact(array) }),
  }));
}

export function bindMemoryArrayTypeIdentity(
  identity: TsonicMemoryTypeIdentity,
  element: TsonicMemoryTypeIdentity,
  length: bigint,
  lengthRuntimeBase: "number" | "bigint",
): void {
  const record = identities.get(identity);
  const previous = record?.array;
  if (record === undefined || !identities.has(element) || length < 0n ||
      previous !== undefined && (previous.element !== element || previous.length !== length ||
        previous.lengthRuntimeBase !== lengthRuntimeBase)) {
    throw new Error("Memory array identity cannot be rebound to another element or extent.");
  }
  record.array = Object.freeze({ element, length, lengthRuntimeBase });
}

export function memoryArrayTypeMatches(
  identity: TsonicMemoryTypeIdentity,
  element: TsonicMemoryTypeIdentity,
  call: Node,
  fixedArray: TsonicFixedArrayFact,
): boolean {
  const record = identities.get(identity);
  const array = record?.array;
  const selected = record?.bindings.get(call)?.array;
  return array !== undefined && selected !== undefined && fixedArrayFactsEqual(selected, fixedArray) &&
    array.element === element && array.length === fixedArray.length && array.lengthRuntimeBase === fixedArray.lengthRuntimeBase;
}

export function memoryLayoutTypeKindMatches(
  identity: TsonicMemoryTypeIdentity, call: Node, kind: "value" | "array",
): boolean {
  const selected = identities.get(identity)?.bindings.get(call);
  return selected !== undefined && (selected.array !== undefined) === (kind === "array");
}

function authentic(value: TsonicMemoryTypeFact): boolean {
  const bindings = identities.get(value.identity)?.bindings;
  return bindings !== undefined && bindings.get(value.call)?.type === value.sourceType;
}

export const tsonicMemoryTypeFactKey = defineExtensionFactKey<TsonicMemoryTypeFact>({
  extensionId: tsonicCoreSourceExtensionId,
  name: "memoryType",
  snapshot(value) {
    const result = exactRecord(value, ["call", "sourceType", "identity"]);
    opaqueSubject(result.call);
    opaqueSubject(result.sourceType);
    if (!authentic(result)) throw new Error("Memory type identity must certify this exact source-core selection.");
    return result;
  },
  equals: recordsEqual,
});

export function readTsonicMemoryType(
  facts: ReadonlySourceFactResolver,
  subject: ExtensionFactSubject | undefined,
): TsonicMemoryTypeFact | undefined {
  const fact = facts.getFact(subject, tsonicMemoryTypeFactKey);
  return fact !== undefined && fact.call === subject && authentic(fact) ? fact : undefined;
}
