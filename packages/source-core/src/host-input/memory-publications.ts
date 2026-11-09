import { defineExtensionFactKey } from "@tsonic/tsts";
import type { ExtensionFactSubject, Node, ReadonlySourceFactResolver } from "@tsonic/tsts";
import { tsonicCoreSourceExtensionId } from "../identity.js";
import { exactRecord } from "../memory-layout/snapshots.js";
import { assertMemorySource, memorySourceType, type MemoryTypePublicationSources } from "./memory-provenance.js";

interface MemorySourcePublication extends MemoryTypePublicationSources {
  readonly call: Node;
}

const publications = new WeakSet<MemorySourcePublication>();

export function createMemorySourcePublication(call: Node, sources: MemoryTypePublicationSources): MemorySourcePublication {
  assertMemorySource(sources.source, call);
  if (sources.owner !== undefined) assertMemorySource(sources.owner, call);
  const result = Object.freeze({ call, source: Object.freeze({ ...sources.source }),
    owner: sources.owner === undefined ? undefined : Object.freeze({ ...sources.owner }) });
  publications.add(result);
  return result;
}

export const tsonicMemorySourceFactKey = defineExtensionFactKey<MemorySourcePublication>({
  extensionId: tsonicCoreSourceExtensionId,
  name: "memorySource",
  snapshot(value) {
    if (!publications.has(value)) throw new Error("Memory provenance requires its original factual publication.");
    const result = exactRecord(value, ["call", "source"], ["owner"]);
    assertMemorySource(result.source, result.call);
    if (result.owner !== undefined) assertMemorySource(result.owner, result.call);
    publications.add(result);
    return result;
  },
  equals(left, right) {
    return left.call === right.call && left.source.kind === right.source.kind &&
      left.source.application === right.source.application && memorySourceType(left.source) === memorySourceType(right.source) &&
      left.owner?.application === right.owner?.application &&
      (left.owner === undefined ? right.owner === undefined : right.owner !== undefined &&
        left.owner.kind === right.owner.kind && memorySourceType(left.owner) === memorySourceType(right.owner));
  },
});

export function readMemoryPublicationSources(facts: Pick<ReadonlySourceFactResolver, "getFact">,
  subject: ExtensionFactSubject | undefined): MemoryTypePublicationSources | undefined {
  const selected = facts.getFact(subject, tsonicMemorySourceFactKey);
  return selected?.call === subject && publications.has(selected) ? selected : undefined;
}
