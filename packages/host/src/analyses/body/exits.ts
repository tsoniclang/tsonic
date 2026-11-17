import type { DataflowStop } from "../../dataflow/contract.js";
import { chargeResultEntries, chargeWork } from "../../dataflow/index.js";
import { requirePresent } from "../../diag/index.js";
import type { OriginsId } from "../../ids/contract.js";
import type { EscapeFact, MirPoint, RelationalArena, SummaryRetention } from "../../ir-facts/contract.js";
import { admitSummaryIdentity, summaryPositionKey } from "../../ir-facts/index.js";
import type { MirSite } from "../../ir-mir/contract.js";
import type { Execution } from "../../ir-types/contract.js";
import type { BodyRoundDeps } from "./contract.js";

export interface ExitRetention {
  readonly key: string;
  readonly value: SummaryRetention;
}

export function retainExitValue(deps: BodyRoundDeps, execution: Execution, site: MirSite, point: MirPoint,
  kind: "return" | "throw", origins: OriginsId, arena: RelationalArena,
  escapes: EscapeFact[], retention: ExitRetention[]): DataflowStop | null {
  const { account } = deps;
  const read = chargeWork(account, 1);
  if (read !== null) return read;
  const value = requirePresent(arena.origins[origins], { owner: "analyses/body", query: null, origin: site.origin,
    message: "An actual exit value retains its bound Origins." });
  if (value.producers.length === 0) return null;
  const identity = admitSummaryIdentity({ kind: "body", execution }, account)
    ?? chargeWork(account, 4) ?? chargeResultEntries(account, 2);
  if (identity !== null) return identity;
  const at = { kind: "body", execution, point, edge: null } satisfies SummaryRetention["at"];
  const key = summaryPositionKey(at);
  for (const source of value.producers) {
    const row = chargeWork(account, 1) ?? chargeResultEntries(account, 5);
    if (row !== null) return row;
    const bound = requirePresent(arena.boundProducers[source], { owner: "analyses/body", query: null, origin: site.origin,
      message: "An actual exit reference retains its bound value producer." });
    escapes.push({ point, node: site.tir.node, producer: bound.producer, target: { kind } });
    retention.push({ key, value: { source, at, into: { kind } } });
  }
  return null;
}
