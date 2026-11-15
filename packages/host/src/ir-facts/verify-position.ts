import type { DataflowAccount, DataflowResult } from "../dataflow/contract.js";
import { chargeWork } from "../dataflow/index.js";
import type { SourceNodeRef } from "../ids/contract.js";
import type { BoundProducerRef, FactsVerificationContext, RelationalArena, SummaryKey } from "./contract.js";
import type { SummaryPosition } from "./initialization-data.js";
import type { Producer } from "./arena-data.js";
import { hasStoreEdge } from "./mir-point.js";
import { summaryKey } from "./summary-key.js";
import { ownerKey, validIndex } from "./verify-relations.js";
import { admitOwnerIdentity, selectedMirBody } from "./verification.js";

export function sameSource(left: SourceNodeRef, right: SourceNodeRef,
  account: DataflowAccount): DataflowResult<boolean> {
  const stop = chargeWork(account, 1 + (left.kind === "body" ? left.value.body.length : left.value.owner.length)
    + (right.kind === "body" ? right.value.body.length : right.value.owner.length));
  if (stop !== null) return stop;
  return { kind: "complete", value: Object.is(left.value.node, right.value.node) && (left.kind === "body"
    ? right.kind === "body" && left.value.body === right.value.body
    : right.kind === "item" && left.value.owner === right.value.owner) };
}

export function sameSummary(left: SummaryKey, right: SummaryKey,
  account: DataflowAccount): DataflowResult<boolean> {
  const stop = admitOwnerIdentity({ kind: "summary", key: left }, account)
    ?? admitOwnerIdentity({ kind: "summary", key: right }, account);
  return stop === null ? { kind: "complete", value: summaryKey(left) === summaryKey(right) } : stop;
}

export function sameSubject(left: BoundProducerRef, right: BoundProducerRef,
  account: DataflowAccount): DataflowResult<boolean> {
  const stop = admitOwnerIdentity(left.owner, account) ?? admitOwnerIdentity(right.owner, account);
  return stop === null ? { kind: "complete", value: Object.is(left.producer, right.producer)
    && ownerKey(left.owner) === ownerKey(right.owner) } : stop;
}

export function subjectProducer(reference: BoundProducerRef, key: SummaryKey, arena: RelationalArena,
  context: FactsVerificationContext, account: DataflowAccount): DataflowResult<Producer | null> {
  const stop = admitOwnerIdentity(reference.owner, account) ?? admitOwnerIdentity({ kind: "summary", key }, account);
  if (stop !== null) return stop;
  const supplied = ownerKey(reference.owner) === ownerKey({ kind: "summary", key }) ? arena : context.arenaOf(reference.owner);
  const bound = supplied !== null && validIndex(reference.producer, supplied.boundProducers.length)
    ? supplied.boundProducers[reference.producer] : undefined;
  const producer = bound !== undefined && supplied !== null && validIndex(bound.producer, supplied.producers.length)
    ? supplied.producers[bound.producer] : undefined;
  return { kind: "complete", value: bound !== undefined && Object.is(bound.id, reference.producer)
    && producer !== undefined && Object.is(producer.id, bound.producer) ? producer : null };
}

export function summaryPositionExists(at: SummaryPosition, key: SummaryKey,
  context: FactsVerificationContext, account: DataflowAccount): DataflowResult<boolean> {
  const selected: SummaryKey = at.kind === "body" ? { kind: "body", execution: at.execution }
    : { kind: "declared", execution: at.execution };
  const exact = sameSummary(selected, key, account);
  if (exact.kind !== "complete" || !exact.value) return exact;
  if (at.kind === "declared") {
    const stop = chargeWork(account, 1);
    if (stop !== null) return stop;
    const source = context.declarationSourceOf(at.execution.request.definition);
    if (source === null) return { kind: "complete", value: false };
    const equal = sameSource(source, at.source, account);
    if (equal.kind !== "complete" || !equal.value) return equal;
    const read = chargeWork(account, 1);
    return read === null ? { kind: "complete", value: context.nodeExists(at.source) } : read;
  }
  const selectedBody = selectedMirBody(at.execution, context, account);
  if (selectedBody.kind !== "complete") return selectedBody;
  const stop = chargeWork(account, 1);
  if (stop !== null) return stop;
  const mir = selectedBody.value;
  const block = mir !== null && validIndex(at.point.block, mir.blocks.length) ? mir.blocks[at.point.block] : undefined;
  if (block === undefined || !Object.is(block.id, at.point.block)) return { kind: "complete", value: false };
  if (at.point.statement !== null) return { kind: "complete", value: at.edge === null
    && validIndex(at.point.statement, block.statements.length) && block.statements[at.point.statement] !== undefined };
  return { kind: "complete", value: at.edge === null || hasStoreEdge(block.terminator, at.edge) };
}
