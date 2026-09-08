import { defineExtensionFactKey } from "@tsonic/tsts";
import type { ExtensionFactSubject, Node, ReadonlySourceFactResolver, Type } from "@tsonic/tsts";
import { tsonicCoreSourceExtensionId } from "../../identity.js";
import { exactRecord, opaqueSubject, recordsEqual } from "../snapshots.js";

const identityBrand = Symbol("memory type identity");
const identities = new WeakMap<TsonicMemoryTypeIdentity, WeakMap<Node, Type>>();

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
  identities.set(identity, new WeakMap());
  return identity;
}

export function bindMemoryTypeIdentity(identity: TsonicMemoryTypeIdentity, call: Node, type: Type): void {
  const bindings = identities.get(identity);
  if (bindings === undefined || bindings.has(call) && bindings.get(call) !== type) {
    throw new Error("Memory type identity cannot be rebound to different selected evidence.");
  }
  bindings.set(call, type);
}

function authentic(value: TsonicMemoryTypeFact): boolean {
  const bindings = identities.get(value.identity);
  return bindings !== undefined && bindings.has(value.call) && bindings.get(value.call) === value.sourceType;
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
