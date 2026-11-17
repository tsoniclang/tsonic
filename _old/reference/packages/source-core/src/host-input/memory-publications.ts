import { defineExtensionFactKey } from "@tsonic/tsts";
import type { ExtensionFactSubject, Node, ReadonlySourceFactResolver, SourceProgramQueries } from "@tsonic/tsts";
import { tsonicCoreSourceExtensionId } from "../identity.js";
import { exactRecord } from "../memory-layout/snapshots.js";
import { assertMemorySource, memorySourcesEqual, type MemoryTypePublicationSources } from "./memory-provenance.js";

interface MemorySourcePublication extends MemoryTypePublicationSources {
  readonly call: Node;
  readonly authority: MemoryPublicationOwner;
}

class MemoryPublicationOwner {
  readonly #publications = new WeakSet<MemorySourcePublication>();
  readonly #program: SourceProgramQueries;

  constructor(program: SourceProgramQueries) {
    this.#program = program;
    Object.freeze(this);
  }

  create(call: Node, sources: MemoryTypePublicationSources): MemorySourcePublication {
    this.#assert(call, sources);
    const result = Object.freeze({ call, authority: this, source: Object.freeze({ ...sources.source }),
      owner: sources.owner === undefined ? undefined : Object.freeze({ ...sources.owner }) });
    this.#publications.add(result);
    return result;
  }

  #assert(call: Node, sources: MemoryTypePublicationSources): void {
    const file = this.#program.ast.getSourceFile(call);
    if (file === undefined || !this.#program.containsSourceFile(file))
      throw new Error("Memory provenance belongs to its exact original checked program.");
    assertMemorySource(sources.source, call);
    if (sources.owner !== undefined) assertMemorySource(sources.owner, call);
  }

  static #authority(value: MemorySourcePublication): MemoryPublicationOwner {
    const descriptor = value !== null && typeof value === "object"
      ? Object.getOwnPropertyDescriptor(value, "authority") : undefined;
    const authority: unknown = descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
    if (!(authority instanceof MemoryPublicationOwner) || !authority.#publications.has(value))
      throw new Error("Memory provenance requires its original per-program factual publication.");
    return authority;
  }

  static snapshot(value: MemorySourcePublication): MemorySourcePublication {
    const authority = MemoryPublicationOwner.#authority(value);
    const result = exactRecord(value, ["call", "authority", "source"], ["owner"]);
    authority.#assert(result.call, result);
    authority.#publications.add(result);
    return result;
  }

  static read(program: SourceProgramQueries, value: MemorySourcePublication, subject: ExtensionFactSubject):
    MemoryTypePublicationSources {
    const authority = MemoryPublicationOwner.#authority(value);
    if (authority.#program.containsSourceFile !== program.containsSourceFile || value.call !== subject)
      throw new Error("Memory provenance cannot cross its original program, publication or occurrence boundary.");
    authority.#assert(value.call, value);
    return value;
  }
}

Object.freeze(MemoryPublicationOwner.prototype);
Object.freeze(MemoryPublicationOwner);

export function createMemoryPublicationOwner(program: SourceProgramQueries): MemoryPublicationOwner {
  return new MemoryPublicationOwner(program);
}

export const tsonicMemorySourceFactKey = defineExtensionFactKey<MemorySourcePublication>({
  extensionId: tsonicCoreSourceExtensionId,
  name: "memorySource",
  snapshot: MemoryPublicationOwner.snapshot,
  equals(left, right) {
    return left.authority === right.authority && left.call === right.call && memorySourcesEqual(left.source, right.source) &&
      (left.owner === undefined ? right.owner === undefined : right.owner !== undefined && memorySourcesEqual(left.owner, right.owner));
  },
});

export function readMemoryPublicationSources(program: SourceProgramQueries, facts: Pick<ReadonlySourceFactResolver, "getFact">,
  subject: ExtensionFactSubject | undefined): MemoryTypePublicationSources | undefined {
  const selected = facts.getFact(subject, tsonicMemorySourceFactKey);
  return selected === undefined || subject === undefined ? undefined : MemoryPublicationOwner.read(program, selected, subject);
}
