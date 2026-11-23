import type { DataflowResult, DataflowStop } from "../../dataflow/contract.js";
import { accountFailure, chargeResultEntries, chargeWork } from "../../dataflow/index.js";
import { requirePresent } from "../../diag/index.js";
import type { BoundProducerId, LocalId, OriginsId } from "../../ids/contract.js";
import type { AppliedSummary, EscapeFact, EscapeTarget, MirPoint, RelationalArena, SummaryRetention } from "../../ir-facts/contract.js";
import { admitSummaryIdentity, escapeTargetKey, summaryPositionKey } from "../../ir-facts/index.js";
import type { MirSite, MirTerminator } from "../../ir-mir/contract.js";
import type { Execution } from "../../ir-types/contract.js";
import type { BodyRoundDeps, BodyRoundInput } from "./contract.js";
import { bodyFrontier, readLocal } from "./places.js";
import { orderedRows } from "./source.js";

export interface ValueEscape {
  readonly targetKey: string;
  readonly value: EscapeFact;
}

export interface ValueRetention {
  readonly key: string;
  readonly targetKey: string;
  readonly value: SummaryRetention;
}

export function retainValue(deps: BodyRoundDeps, execution: Execution, site: MirSite, point: MirPoint,
  target: EscapeTarget, origins: OriginsId, arena: RelationalArena,
  escapes: ValueEscape[], retention: ValueRetention[], copiedEntries: ReadonlySet<BoundProducerId> | null): DataflowStop | null {
  const { account } = deps;
  const read = chargeWork(account, 1);
  if (read !== null) return read;
  const value = requirePresent(arena.origins[origins], { owner: "analyses/body", query: null, origin: site.origin,
    message: "An actual retained value retains its bound Origins." });
  if (value.producers.length === 0) return null;
  let at: SummaryRetention["at"] | null = null;
  let targetKey = "";
  let key = "";
  for (const source of value.producers) {
    if (copiedEntries !== null) {
      const classification = chargeWork(account, 1);
      if (classification !== null) return classification;
      if (copiedEntries.has(source)) continue;
    }
    if (at === null) {
      const identity = admitSummaryIdentity({ kind: "body", execution }, account)
        ?? chargeWork(account, 4) ?? chargeResultEntries(account, 2);
      if (identity !== null) return identity;
      const targetIdentity = escapeTargetKey(target, account);
      if (targetIdentity.kind !== "complete") return targetIdentity;
      targetKey = targetIdentity.value;
      at = { kind: "body", execution, point, edge: null };
      key = summaryPositionKey(at);
    }
    const row = chargeWork(account, 1) ?? chargeResultEntries(account, 5);
    if (row !== null) return row;
    const bound = requirePresent(arena.boundProducers[source], { owner: "analyses/body", query: null, origin: site.origin,
      message: "An actual retained reference retains its bound value producer." });
    escapes.push({ targetKey, value: { point, node: site.tir.node, producer: bound.producer, target } });
    retention.push({ key, targetKey, value: { source, at, into: target } });
  }
  return null;
}

export function retainCallCaptures(deps: BodyRoundDeps, input: BodyRoundInput,
  operation: Extract<MirTerminator, { readonly kind: "call" }>, point: MirPoint, applied: AppliedSummary,
  captured: ReadonlyMap<number, number>, arena: RelationalArena,
  escapes: ValueEscape[], retention: ValueRetention[], copiedEntries: ReadonlySet<BoundProducerId> | null): DataflowStop | null {
  const prior = accountFailure(deps.account);
  if (prior !== null) return prior;
  for (const row of applied.retention) {
    const read = chargeWork(deps.account, 3);
    if (read !== null) return read;
    if (row.into.kind !== "capture") continue;
    const capture = operation.callee.kind === "body" && row.into.path === null ? operation.callee.captures[row.into.index] : undefined;
    if (capture === undefined || row.value.kind !== "caller")
      return bodyFrontier("BodyAnalysis requires the actual immediate capture target and value binding of this retained store.");
    const local: LocalId = readLocal(input.mir, { kind: "place", place: capture.place });
    const incoming = captured.get(local);
    if (incoming === undefined) continue;
    const target = chargeResultEntries(deps.account, 1);
    if (target !== null) return target;
    const retained = retainValue(deps, input.execution, operation, point, { kind: "capture", index: incoming, path: null },
      row.value.value.origins, arena, escapes, retention, copiedEntries);
    if (retained !== null) return retained;
  }
  return null;
}

export function collectRetainedValues(deps: BodyRoundDeps, escapes: readonly ValueEscape[], retention: readonly ValueRetention[]):
  DataflowResult<{ readonly escapes: readonly EscapeFact[]; readonly retention: readonly SummaryRetention[] }> {
  const { account } = deps;
  const text = (left: string, right: string): number => {
    if (chargeWork(account, Math.min(left.length, right.length)) !== null) return 0;
    return left < right ? -1 : left > right ? 1 : 0;
  };
  const compareEscapes = (left: ValueEscape, right: ValueEscape): number => {
    const first = left.value;
    const second = right.value;
    return first.point.block - second.point.block
      || (first.point.statement === null ? second.point.statement === null ? 0 : 1
        : second.point.statement === null ? -1 : first.point.statement - second.point.statement)
      || first.node - second.node || first.producer - second.producer || text(left.targetKey, right.targetKey);
  };
  const compareRetention = (left: ValueRetention, right: ValueRetention): number =>
    left.value.source - right.value.source || text(left.key, right.key) || text(left.targetKey, right.targetKey);
  const orderedEscapes = orderedRows(escapes, compareEscapes, account);
  if (orderedEscapes.kind !== "complete") return orderedEscapes;
  const orderedRetention = orderedRows(retention, compareRetention, account);
  if (orderedRetention.kind !== "complete") return orderedRetention;
  const setup = chargeResultEntries(account, 3);
  if (setup !== null) return setup;
  const escapeRows: EscapeFact[] = [];
  const retentionRows: SummaryRetention[] = [];
  let previousEscape: ValueEscape | null = null;
  for (const row of orderedEscapes.value) {
    const read = chargeWork(account, 1);
    if (read !== null) return read;
    const same = previousEscape !== null && compareEscapes(previousEscape, row) === 0;
    const stopped = accountFailure(account);
    if (stopped !== null) return stopped;
    if (!same) {
      const growth = chargeResultEntries(account, 1);
      if (growth !== null) return growth;
      escapeRows.push(row.value);
      previousEscape = row;
    }
  }
  let previousRetention: ValueRetention | null = null;
  for (const row of orderedRetention.value) {
    const read = chargeWork(account, 1);
    if (read !== null) return read;
    const same = previousRetention !== null && compareRetention(previousRetention, row) === 0;
    const stopped = accountFailure(account);
    if (stopped !== null) return stopped;
    if (!same) {
      const growth = chargeResultEntries(account, 1);
      if (growth !== null) return growth;
      retentionRows.push(row.value);
      previousRetention = row;
    }
  }
  return { kind: "complete", value: { escapes: escapeRows, retention: retentionRows } };
}
