import type { DataflowResult, DataflowStop } from "../../dataflow/contract.js";
import { chargeResultEntries, chargeWork } from "../../dataflow/index.js";
import type { BlockId, BoundProducerId, DefId } from "../../ids/contract.js";
import { decodeBodyId } from "../../ids/index.js";
import type { AppliedProducerValue, Producer, Summary } from "../../ir-facts/contract.js";
import type { MirTerminator } from "../../ir-mir/contract.js";
import type { BodyRoundDeps } from "./contract.js";
import { bodyFrontier } from "./places.js";

type Call = Extract<MirTerminator, { readonly kind: "call" }>;

export interface ArrayReturnSource {
  readonly summary: Summary;
  readonly origins: ReadonlySet<BoundProducerId>;
  readonly declaration: DefId;
}

export interface ArrayReturn extends ArrayReturnSource {
  readonly producer: BoundProducerId;
}

export type ArrayReturns = ReadonlyMap<BlockId, ArrayReturn> | null;

export function isCreatedProducer(summary: Summary, producer: Producer | undefined): boolean {
  if (summary.key.kind !== "body" || producer?.path !== null) return false;
  const body = summary.key.execution.instance.body;
  if (producer.kind === "allocation") return producer.at.kind === "node"
    && producer.at.node.kind === "body" && producer.at.node.value.body === body;
  return producer.kind === "call-result" && producer.callee.kind === "direct" && producer.at.body === body;
}

export function arrayReturnSource(deps: BodyRoundDeps, call: Call, summary: Summary): DataflowResult<ArrayReturnSource | null> {
  const { account } = deps;
  const setup = chargeWork(account, 1);
  if (setup !== null) return setup;
  if (!summary.returns || summary.key.kind !== "body") return { kind: "complete", value: null };
  const result = summary.arena.origins[summary.result];
  if (result === undefined || result.id !== summary.result) return bodyFrontier("A selected array call retains its actual summary result.");
  let created: Set<BoundProducerId> | null = null;
  for (let index = 0; index < result.producers.length; index += 1) {
    const work = chargeWork(account, 2);
    if (work !== null) return work;
    const identity = result.producers[index];
    const bound = identity === undefined ? undefined : summary.arena.boundProducers[identity];
    if (identity === undefined || bound === undefined || bound.id !== identity)
      return bodyFrontier("An array return retains its actual qualified producer alternatives.");
    if (!isCreatedProducer(summary, summary.arena.producers[bound.producer])) continue;
    const retained = chargeResultEntries(account, created === null ? 2 : 1);
    if (retained !== null) return retained;
    created ??= new Set();
    created.add(identity);
  }
  if (created === null) return { kind: "complete", value: null };
  const qualified = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
  if (qualified !== null) return qualified;
  if (call.callee.kind !== "body") return { kind: "complete", value: {
    summary, origins: created, declaration: call.callee.resolution.decision.api.declaration } };
  const body = call.callee.instance.body;
  const read = chargeWork(account, body.length);
  if (read !== null) return read;
  const owner = decodeBodyId(body);
  if (owner.kind !== "decoded") return bodyFrontier("A selected placed initializer has its actual body owner.");
  return { kind: "complete", value: { summary, origins: created, declaration: owner.value.owner } };
}

export function admitArrayReturn(deps: BodyRoundDeps, proof: ArrayReturn, summary: Summary, value: AppliedProducerValue,
  at: AppliedProducerValue["at"], context: AppliedProducerValue["context"]): DataflowStop | boolean {
  const work = chargeWork(deps.account, 1);
  if (work !== null) return work;
  const owner = value.producer.owner;
  return proof.summary === summary && value.at === at && value.context === context && owner.kind === "summary"
    && owner.key === summary.key && proof.origins.has(value.producer.producer);
}
