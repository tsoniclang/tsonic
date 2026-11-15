import type { DataflowStop } from "../dataflow/contract.js";
import { chargeResultEntries, chargeWork } from "../dataflow/index.js";
import type { Violation } from "../diag/contract.js";
import type { LocalId, NodeId } from "../ids/contract.js";
import type { FactsRule, FactsSite, MirPoint, StoreEdge, VerifyLiveness } from "./contract.js";
import { compareNumbers, validIndex } from "./verify-relations.js";
import { recordFinding } from "./verification.js";
import { bodyNodes } from "./verify-body-nodes.js";
import { hasStoreEdge } from "./mir-point.js";

const compareText = (left: string, right: string): number => left === right ? 0 : left < right ? -1 : 1;
const compareNullableNumber = (left: number | null, right: number | null, nullOrder: -1 | 1): number => {
  if (left === null) return right === null ? 0 : nullOrder;
  if (right === null) return -nullOrder;
  return compareNumbers(left, right);
};

const comparePoints = (left: MirPoint, right: MirPoint): number =>
  compareNumbers(left.block, right.block) || compareNullableNumber(left.statement, right.statement, 1);

const storeEdgeOrder: readonly (StoreEdge | null)[] = [null, "continue", "resume", "return", "unwind"];
const compareEdges = (left: StoreEdge | null, right: StoreEdge | null): number => storeEdgeOrder.indexOf(left) - storeEdgeOrder.indexOf(right);

export const verifyLiveness: VerifyLiveness = (liveness, instance, mir, context, account) => {
  const initial = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
  if (initial !== null) return initial;
  const violations: Violation<FactsRule, FactsSite>[] = [];
  const report = (rule: FactsRule, site: FactsSite, text: string): DataflowStop | null =>
    recordFinding(account, violations, "last", rule, site, text);
  const selected = bodyNodes(context.tirBody(instance), account);
  if (selected.kind !== "complete") return selected;
  const { nodes } = selected.value;
  const at = (node: NodeId): FactsSite => ({ kind: "node", at: { kind: "body", value: { body: instance.body, node } } });
  const localSite = (local: LocalId): FactsSite => ({ kind: "local", local: { body: instance.body, local } });
  const ordered = <Value>(rows: readonly Value[], rule: FactsRule, comparator: (left: Value, right: Value) => number, site: (row: Value) => FactsSite): DataflowStop | null => {
    let previous: Value | null = null;
    for (const row of rows) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

      if (previous !== null && comparator(previous, row) >= 0) { const stop = report(rule, site(row), "Fact rows retain distinct canonical endpoint order."); if (stop !== null) return stop; }
      previous = row;
    }
    return null;
  };
  { const stop = ordered(liveness.stores, "stores-order", (left, right) => comparePoints(left.point, right.point) || compareEdges(left.edge, right.edge) ||
    compareNumbers(left.node, right.node), row => at(row.node)); if (stop !== null) return stop; }
  for (const store of liveness.stores) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

    if (!context.nodeExists({ kind: "body", value: { body: instance.body, node: store.node } }) || !nodes.has(store.node)) {
      { const stop = report("node-resolves", at(store.node), "Every fact retains an actual source occurrence in its declared body domain."); if (stop !== null) return stop; }
    }
    const block = validIndex(store.point.block, mir.blocks.length) ? mir.blocks[store.point.block] : undefined;
    if (block === undefined || !Object.is(block.id, store.point.block) || store.point.statement !== null &&
      (!validIndex(store.point.statement, block.statements.length) || block.statements[store.point.statement] === undefined)) {
      { const stop = report("mir-point-resolves", at(store.node), "A MIR point names an actual block and statement, or that block's terminator."); if (stop !== null) return stop; }
    } else if (store.edge !== null && (store.point.statement !== null || !hasStoreEdge(block.terminator, store.edge))) {
      { const stop = report("mir-point-resolves", at(store.node), "A store edge names a role of the terminator at its point: continue, resume, return or a handler unwind."); if (stop !== null) return stop; }
    }
  }
  { const stop = ordered(liveness.locals, "locals-order", (left, right) => compareNumbers(left.local, right.local), row => localSite(row.local)); if (stop !== null) return stop; }
  { const stop = ordered(liveness.bindings, "locals-order", (left, right) => compareNumbers(left.local, right.local), row => localSite(row.local)); if (stop !== null) return stop; }
  for (const local of liveness.locals) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

    const site = localSite(local.local);
    if (!validIndex(local.local, mir.locals.length) || !Object.is(mir.locals[local.local]?.id, local.local)) {
      { const stop = report("cross-owner-qualified", site, "A live local belongs to this actual MIR local table."); if (stop !== null) return stop; }
    }
    { const stop = ordered(local.segments, "live-segments-order", (left, right) => compareNumbers(left.block, right.block) || compareNumbers(left.first, right.first) || compareNumbers(left.last, right.last), () => site); if (stop !== null) return stop; }
    for (const segment of local.segments) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

      const block = validIndex(segment.block, mir.blocks.length) ? mir.blocks[segment.block] : undefined;
      if (block === undefined || !Object.is(block.id, segment.block) || !validIndex(segment.first, block.statements.length + 1) ||
        !validIndex(segment.last, block.statements.length + 1) || segment.last < segment.first ||
        segment.first < block.statements.length && block.statements[segment.first] === undefined ||
        segment.last < block.statements.length && block.statements[segment.last] === undefined) { const stop = report("live-segments-bounds", site,
        "A live interval contains ordered actual statement or terminator positions in its own block."); if (stop !== null) return stop; }
    }
  }
  // A binding row is one per source binding: a MIR local of this table that has a source.
  for (const storage of liveness.bindings) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

    const local = validIndex(storage.local, mir.locals.length) ? mir.locals[storage.local] : undefined;
    if (local === undefined || !Object.is(local.id, storage.local) || local.source === null) {
      { const stop = report("cross-owner-qualified", localSite(storage.local), "A binding-storage row belongs to a source binding of this actual MIR local table."); if (stop !== null) return stop; }
    }
  }
  { const stop = ordered(liveness.captures, "captures-order", (left, right) => compareText(left.local.body, right.local.body) || compareNumbers(left.local.local, right.local.local), row => ({ kind: "local", local: row.local })); if (stop !== null) return stop; }
  for (const capture of liveness.captures) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
if (!context.localExists(capture.local)) {
    { const stop = report("capture-locations-exact", { kind: "local", local: capture.local }, "A capture retains its actual qualified outer local."); if (stop !== null) return stop; }
  }
  }
  return { kind: "complete", violations };
};
