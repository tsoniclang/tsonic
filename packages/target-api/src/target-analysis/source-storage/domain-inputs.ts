import type { createSourceStorageTransport } from "./transport.js";
import type { createSourceStorageDomainWitnesses } from "./domain-witnesses.js";
import type { SourceStorageBudget } from "./resource-budget.js";
import type { SourceStorageSubject } from "./subjects.js";
import { createSourceStorageGraphQueries } from "./graph-queries.js";

export function createSourceStorageDomainInputs(
  transport: ReturnType<typeof createSourceStorageTransport>,
  witnesses: ReturnType<typeof createSourceStorageDomainWitnesses>,
  budget: SourceStorageBudget,
) {
  const queries = createSourceStorageGraphQueries(budget);
  const channels = new Map<SourceStorageSubject["kind"], Map<SourceStorageSubject | undefined, symbol>>();
  const rows = budget.createRows();
  let sealed = false;
  const input = (subject: SourceStorageSubject, owner?: SourceStorageSubject) => {
    const root = owner === undefined || owner.projection.length === 0 ? owner : transport.subject(owner.node, owner.kind);
    if (owner !== undefined && root === undefined) return undefined;
    const owners = channels.get(subject.kind);
    const existing = owners?.get(root);
    if (existing !== undefined) return { node: subject.node, kind: existing };
    if (!rows.add(owners === undefined ? 3 : 1)) return undefined;
    const selected = owners ?? new Map<SourceStorageSubject | undefined, symbol>();
    const channel = Symbol();
    selected.set(root, channel);
    channels.set(subject.kind, selected);
    return { node: subject.node, kind: channel };
  };
  const owners = function* (subject: SourceStorageSubject): Iterable<SourceStorageSubject | undefined> {
    yield* witnesses.inputOwners(subject);
    for (let length = 0; length < subject.projection.length; length += 1) {
      if (!budget.step()) return;
      const parent = transport.subject(subject.node, subject.kind, subject.projection.slice(0, length));
      if (parent !== undefined) yield* witnesses.inputOwners(parent);
    }
  };
  return Object.freeze({
    query: queries.query,
    owners,
    has(subject: SourceStorageSubject): boolean {
      return owners(subject)[Symbol.iterator]().next().done !== true;
    },
    read(subject: SourceStorageSubject, owner?: SourceStorageSubject): void {
      if (sealed) return;
      const selected = input(subject, owner);
      if (selected !== undefined) queries.read(selected);
    },
    add(subject: SourceStorageSubject | undefined, kind: Parameters<typeof witnesses.add>[1], exposure: Parameters<typeof witnesses.add>[2],
      owner?: SourceStorageSubject): void {
      if (sealed) { budget.reject("Source storage domain inputs require a live construction owner."); return; }
      if (subject === undefined) return;
      const previous = witnesses.inputOwners(subject);
      const known = previous.has(owner);
      const present = previous.size !== 0;
      witnesses.add(subject, kind, exposure, owner);
      if (kind !== "external-input" || known || !witnesses.inputOwners(subject).has(owner)) return;
      if (owner !== undefined) {
        const selected = input(subject, owner);
        if (selected !== undefined) queries.invalidate(selected);
      }
      if (!present) {
        const selected = input(subject);
        if (selected !== undefined) queries.invalidate(selected);
      }
    },
    seal(): void {
      queries.seal();
      sealed = true;
      channels.clear();
      rows.release();
    },
  });
}
