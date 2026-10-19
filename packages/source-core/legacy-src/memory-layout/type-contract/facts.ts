import { defineExtensionFactKey } from "@tsonic/tsts";
import type { ExtensionFactSubject, Node, ReadonlySourceFactResolver, Symbol as SourceSymbol, Type } from "@tsonic/tsts";
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
  readonly bindings: WeakMap<Node, { readonly type: Type; readonly array?: TsonicFixedArrayFact;
    readonly member?: MemoryTypeMemberSelection }>;
  readonly members: WeakMap<Node, SourceSymbol>;
  array?: MemoryArrayType;
}>();

export interface MemoryTypeMemberSelection {
  readonly owner: TsonicMemoryTypeIdentity;
  readonly declaration: Node;
  readonly member: SourceSymbol;
}

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
  identities.set(identity, { bindings: new WeakMap(), members: new WeakMap() });
  return identity;
}

export function bindMemoryTypeMember(identity: TsonicMemoryTypeIdentity, declaration: Node, member: SourceSymbol): void {
  const record = identities.get(identity);
  const previous = record?.members.get(declaration);
  if (record === undefined || previous !== undefined && previous !== member) {
    throw new Error("Memory member identity cannot be rebound to another selected property.");
  }
  record.members.set(declaration, member);
}

export function memoryTypeMember(identity: TsonicMemoryTypeIdentity, declaration: Node): SourceSymbol | undefined {
  return identities.get(identity)?.members.get(declaration);
}

export function bindMemoryTypeIdentity(
  identity: TsonicMemoryTypeIdentity, call: Node, type: Type, array?: TsonicFixedArrayFact,
  member?: MemoryTypeMemberSelection,
): void {
  const record = identities.get(identity);
  const previous = record?.bindings.get(call);
  if (record === undefined || array !== undefined && (array.sourceType !== type || record.array === undefined) ||
      member !== undefined && memoryTypeMember(member.owner, member.declaration) !== member.member ||
      previous !== undefined && (previous.type !== type || (previous.array === undefined) !== (array === undefined) ||
        previous.array !== undefined && array !== undefined && !fixedArrayFactsEqual(previous.array, array) ||
        previous.member?.owner !== member?.owner || previous.member?.declaration !== member?.declaration ||
        previous.member?.member !== member?.member)) {
    throw new Error("Memory type identity cannot be rebound to different selected evidence.");
  }
  record.bindings.set(call, Object.freeze({ type,
    ...(array === undefined ? {} : { array: snapshotFixedArrayFact(array) }),
    ...(member === undefined ? {} : { member: Object.freeze({ ...member }) }),
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
  facts: Pick<ReadonlySourceFactResolver, "getFact">,
  subject: ExtensionFactSubject | undefined,
): TsonicMemoryTypeFact | undefined {
  const fact = facts.getFact(subject, tsonicMemoryTypeFactKey);
  return fact !== undefined && fact.call === subject && authentic(fact) ? fact : undefined;
}

export function readMemoryTypeMember(
  facts: Pick<ReadonlySourceFactResolver, "getFact">, call: Node, declaration: Node,
): MemoryTypeMemberSelection | undefined {
  const fact = readTsonicMemoryType(facts, call);
  const member = fact === undefined ? undefined : identities.get(fact.identity)?.bindings.get(call)?.member;
  return member?.declaration === declaration ? member : undefined;
}
