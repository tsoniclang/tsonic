import type { DataflowResult } from "../../dataflow/contract.js";
import { chargeResultEntries, chargeWork } from "../../dataflow/index.js";
import { requirePresent } from "../../diag/index.js";
import type { BoundProducerId, ProducerId } from "../../ids/contract.js";
import { boundProducerId, producerId } from "../../ids/index.js";
import type { BoundProducer, OpenBoundary, Origins, Producer, RelationalArena, SummaryRetention } from "../../ir-facts/contract.js";
import type { BodyRoundDeps } from "./contract.js";
import { bodyFrontier } from "./places.js";

type Subjects = Pick<RelationalArena, "producers" | "boundProducers" | "origins" | "boundaries">;

interface LocalInterval {
  readonly firstProducer: number;
  readonly firstBound: number;
  readonly length: number;
}

export function projectSummarySubjects(deps: BodyRoundDeps, arena: Subjects, local: LocalInterval,
  retention: readonly SummaryRetention[]): DataflowResult<Subjects & { readonly retention: readonly SummaryRetention[] }> {
  const { account } = deps;
  const { firstProducer, firstBound, length } = local;
  const pastProducer = firstProducer + length;
  const pastBound = firstBound + length;
  const producer = (id: ProducerId): ProducerId => id < firstProducer ? id : id >= pastProducer
    ? producerId(id - length) : bodyFrontier("A summary producer cannot name its executing caller's local storage subject.");
  const bound = (id: BoundProducerId): BoundProducerId => id < firstBound ? id : id >= pastBound
    ? boundProducerId(id - length) : bodyFrontier("A summary value cannot name its executing caller's local storage subject.");
  const setup = chargeResultEntries(account, 6);
  if (setup !== null) return setup;
  const producers: Producer[] = [];
  const boundProducers: BoundProducer[] = [];
  const origins: Origins[] = [];
  const boundaries: OpenBoundary[] = [];
  const retained: SummaryRetention[] = [];
  for (let index = 0; index < arena.producers.length; index += 1) {
    if (index === firstProducer) index = pastProducer;
    if (index >= arena.producers.length) break;
    const paid = chargeWork(account, 1) ?? chargeResultEntries(account, index < firstProducer ? 1 : 2);
    if (paid !== null) return paid;
    const row = requirePresent(arena.producers[index], { owner: "analyses/body", query: null, origin: null,
      message: "Summary projection retains the actual producer row." });
    producers.push(index < firstProducer ? row : { ...row, id: producer(row.id) });
  }
  for (let index = 0; index < arena.boundProducers.length; index += 1) {
    if (index === firstBound) index = pastBound;
    if (index >= arena.boundProducers.length) break;
    const paid = chargeWork(account, 1) ?? chargeResultEntries(account, index < firstBound ? 1 : 2);
    if (paid !== null) return paid;
    const row = requirePresent(arena.boundProducers[index], { owner: "analyses/body", query: null, origin: null,
      message: "Summary projection retains the actual bound producer row." });
    boundProducers.push(index < firstBound ? row : { ...row, id: bound(row.id), producer: producer(row.producer) });
  }
  for (let index = 0; index < arena.origins.length; index += 1) {
    const paid = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
    if (paid !== null) return paid;
    const row = requirePresent(arena.origins[index], { owner: "analyses/body", query: null, origin: null,
      message: "Summary projection retains the actual Origins row." });
    const last = row.producers.at(-1);
    if (last === undefined || last < firstBound) origins.push(row);
    else {
      const next = chargeWork(account, row.producers.length) ?? chargeResultEntries(account, 2 + row.producers.length);
      if (next !== null) return next;
      origins.push({ ...row, producers: row.producers.map(bound) });
    }
  }
  for (let index = 0; index < arena.boundaries.length; index += 1) {
    const paid = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
    if (paid !== null) return paid;
    const row = requirePresent(arena.boundaries[index], { owner: "analyses/body", query: null, origin: null,
      message: "Summary projection retains the actual boundary row." });
    const subject = producer(row.subject);
    const copy = subject === row.subject ? null : chargeResultEntries(account, 1);
    if (copy !== null) return copy;
    boundaries.push(subject === row.subject ? row : { ...row, subject });
  }
  for (let index = 0; index < retention.length; index += 1) {
    const paid = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
    if (paid !== null) return paid;
    const row = requirePresent(retention[index], { owner: "analyses/body", query: null, origin: null,
      message: "Summary projection retains the actual value retention row." });
    const source = bound(row.source);
    const copy = source === row.source ? null : chargeResultEntries(account, 1);
    if (copy !== null) return copy;
    retained.push(source === row.source ? row : { ...row, source });
  }
  return { kind: "complete", value: { producers, boundProducers, origins, boundaries, retention: retained } };
}
