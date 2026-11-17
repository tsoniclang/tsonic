import type { DataflowResult, DataflowStop } from "../dataflow/contract.js";
import { chargeResultEntries, chargeWork, refuseAccount } from "../dataflow/index.js";
import type { Violation } from "../diag/contract.js";
import type { ConditionLimits, FactsSite, FactsVerification, FactsVerificationContext,
  Condition, Summary, SummaryRule, SummaryVerificationResources } from "./contract.js";
import type { InitializationWitness } from "./initialization-data.js";
import { compareAlternatives, validateCondition } from "./conditions.js";
import { summaryKey } from "./summary-key.js";
import { nodeOwnedBy, ownerKey, validIndex } from "./verify-relations.js";
import { admitOwnerIdentity, recordFinding } from "./verification.js";
import { sameSource, sameSubject, sameSummary, subjectProducer, summaryPositionExists } from "./verify-position.js";

function compareConditions(first: Condition, second: Condition,
  limits: ConditionLimits): DataflowResult<number> {
  const stop = chargeWork(limits.account, 1);
  if (stop !== null) return stop;
  const right = second.alternatives[Symbol.iterator]();
  for (const leftRow of first.alternatives) {
    const work = chargeWork(limits.account, 1);
    if (work !== null) return work;
    const rightRow = right.next();
    if (rightRow.done) return { kind: "complete", value: 1 };
    const order = compareAlternatives(leftRow, rightRow.value, limits);
    if (order.kind !== "complete" || order.value !== 0) return order;
  }
  return { kind: "complete", value: first.alternatives.length - second.alternatives.length };
}

function witnessExists(witness: InitializationWitness, summary: Summary,
  context: FactsVerificationContext, resources: SummaryVerificationResources): DataflowResult<boolean> {
  const { account } = resources;
  const start = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
  if (start !== null) return start;
  if (!context.nodeExists(witness.read)) return { kind: "complete", value: false };
  if (witness.via.length === 0) {
    const stop = admitOwnerIdentity({ kind: "summary", key: summary.key }, account);
    return stop === null ? { kind: "complete", value: nodeOwnedBy({ kind: "summary", key: summary.key }, witness.read, context) } : stop;
  }
  const visited = new Map<string, Set<number>>();
  for (let index = 0; index < witness.via.length; index += 1) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    const selected = witness.via[index];
    if (selected === undefined) return { kind: "complete", value: false };
    const admission = admitOwnerIdentity({ kind: "summary", key: selected.key }, account);
    if (admission !== null) return admission;
    const key = summaryKey(selected.key);
    let rows = visited.get(key);
    if (rows !== undefined && rows.has(selected.row)) return { kind: "complete", value: false };
    const growth = chargeResultEntries(account, rows === undefined ? 2 : 1);
    if (growth !== null) return growth;
    if (rows === undefined) { rows = new Set(); visited.set(key, rows); }
    rows.add(selected.row);
    const read = chargeWork(account, 1);
    if (read !== null) return read;
    const source = context.summaryOf(selected.key);
    if (source === null) return { kind: "complete", value: false };
    const exact = sameSummary(source.key, selected.key, account);
    if (exact.kind !== "complete" || !exact.value) return exact;
    const lookup = chargeWork(account, 1);
    if (lookup !== null) return lookup;
    const row = validIndex(selected.row, source.initialization.rows.length) ? source.initialization.rows[selected.row] : undefined;
    const point = row !== undefined && validIndex(row.point, source.initialization.points.length)
      ? source.initialization.points[row.point] : undefined;
    if (row === undefined || point === undefined || point.kind !== "need"
      || row.cell !== null && !Object.is(row.cell, point.cell)
      || !validIndex(point.cell, source.initialization.cells.length)
      || point.witness.via.length !== witness.via.length - index - 1) return { kind: "complete", value: false };
    const sameRead = sameSource(witness.read, point.witness.read, account);
    if (sameRead.kind !== "complete" || !sameRead.value) return sameRead;
    for (let tail = 0; tail < point.witness.via.length; tail += 1) {
      const work = chargeWork(account, 1);
      if (work !== null) return work;
      const actual = point.witness.via[tail];
      const expected = witness.via[index + tail + 1];
      if (actual === undefined || expected === undefined || !Object.is(actual.row, expected.row)) return { kind: "complete", value: false };
      const sameKey = sameSummary(actual.key, expected.key, account);
      if (sameKey.kind !== "complete" || !sameKey.value) return sameKey;
    }
    if (point.witness.via.length === 0) {
      const work = admitOwnerIdentity({ kind: "summary", key: source.key }, account);
      if (work !== null) return work;
      if (!nodeOwnedBy({ kind: "summary", key: source.key }, point.witness.read, context)) return { kind: "complete", value: false };
    }
  }
  return { kind: "complete", value: true };
}

export function verifyInitialization(summary: Summary, context: FactsVerificationContext,
  resources: SummaryVerificationResources): FactsVerification<SummaryRule> {
  const { account } = resources;
  const initial = chargeWork(account, 1) ?? chargeResultEntries(account, 8);
  if (initial !== null) return initial;
  const violations: Violation<SummaryRule, FactsSite>[] = [];
  const site: FactsSite = { kind: "summary", summary: summary.key };
  const report = (rule: SummaryRule, text: string): DataflowStop | null => recordFinding(account, violations, "last", rule, site, text);
  const table = summary.initialization;
  const limits: ConditionLimits = { account, refusal: resources.conditionRefusal, eventCount: table.events.length,
    maximumConditionAlternatives: context.limits.maximumConditionAlternatives };
  const cells = new Set<number>();
  for (const cell of table.cells) {
    const work = chargeWork(account, 1);
    if (work !== null) return work;
    if (!validIndex(cell, summary.arena.cells.length) || !Object.is(summary.arena.cells[cell]?.id, cell) || cells.has(cell)) {
      const stop = report("initialization-cells-resolve", "Initialization formal positions select distinct actual rows of this same source arena.");
      if (stop !== null) return stop;
    }
    const growth = chargeResultEntries(account, 1);
    if (growth !== null) return growth;
    cells.add(cell);
  }
  let previousEvent: readonly [number, string, number, number] | null = null;
  for (const event of table.events) {
    const work = chargeWork(account, 1);
    if (work !== null) return work;
    const selected = subjectProducer(event.subject, summary.key, summary.arena, context, account);
    if (selected.kind !== "complete") return selected;
    const producer = selected.value;
    const given = producer !== null && (producer.kind === "receiver" || producer.kind === "parameter"
      || producer.kind === "capture" || producer.kind === "shared" || producer.kind === "cell-content");
    if (producer === null || event.kind === "callback" && !given || event.kind === "handle" && !given && producer.kind !== "call-result") {
      const stop = report("initialization-subjects-exact", "Completion events retain their actual qualified given callback or handle value subject.");
      if (stop !== null) return stop;
    }
    const growth = chargeResultEntries(account, 1);
    if (growth !== null) return growth;
    const next: readonly [number, string, number, number] = [event.kind === "callback" ? 0 : 1,
      ownerKey(event.subject.owner), event.subject.producer, event.exit === "return" ? 0 : 1];
    if (previousEvent !== null && (previousEvent[0] > next[0] || previousEvent[0] === next[0]
      && (previousEvent[1] > next[1] || previousEvent[1] === next[1] && (previousEvent[2] > next[2]
        || previousEvent[2] === next[2] && previousEvent[3] >= next[3])))) {
      const stop = report("initialization-order", "Events are distinct in callback/handle, qualified subject and return/unwind order.");
      if (stop !== null) return stop;
    }
    previousEvent = next;
  }
  const validConditions = new Set<number>();
  let previousCondition: Condition | null = null;
  for (let index = 0; index < table.conditions.length; index += 1) {
    const work = chargeWork(account, 1);
    if (work !== null) return work;
    const condition = table.conditions[index];
    if (condition === undefined) {
      previousCondition = null;
      const stop = report("initialization-conditions-canonical", "Initialization conditions retain their dense canonical antichains.");
      if (stop !== null) return stop;
      continue;
    }
    if (condition.alternatives.length > limits.maximumConditionAlternatives) return refuseAccount(account, resources.conditionRefusal);
    const checked = validateCondition(condition, table.events.length, limits);
    if (checked.kind !== "complete") return checked;
    if (!checked.value) {
      previousCondition = null;
      const stop = report("initialization-conditions-canonical", "Each condition is the actual canonical positive event antichain.");
      if (stop !== null) return stop;
      continue;
    }
    const growth = chargeResultEntries(account, 1);
    if (growth !== null) return growth;
    validConditions.add(index);
    if (index >= 2 && previousCondition !== null) {
      const order = compareConditions(previousCondition, condition, limits);
      if (order.kind !== "complete") return order;
      if (order.value >= 0) {
        const stop = report("initialization-conditions-canonical", "Conditions after false and true are distinct in lexicographic canonical order.");
        if (stop !== null) return stop;
      }
    }
    previousCondition = condition;
  }
  if (table.conditions[0]?.alternatives.length !== 0 || table.conditions[1]?.alternatives.length !== 1
    || table.conditions[1].alternatives[0]?.length !== 0) {
    const stop = report("initialization-conditions-canonical", "Every initialization table retains canonical false at zero and true at one.");
    if (stop !== null) return stop;
  }
  let previousPoint = -1;
  let previousCell = -2;
  const defaults = new Map<number, number>();
  for (const row of table.rows) {
    const work = chargeWork(account, 1);
    if (work !== null) return work;
    const cell = row.cell === null ? -1 : row.cell;
    if (!validIndex(row.point, table.points.length) || table.points[row.point] === undefined
      || !validConditions.has(row.condition) || row.cell !== null && !validIndex(row.cell, table.cells.length)
      || row.point < previousPoint || row.point === previousPoint && cell <= previousCell
      || row.point !== previousPoint && row.cell !== null) {
      const stop = report("initialization-rows-exact", "Rows select actual points, formal cell positions and canonical conditions, default first then ascending formal.");
      if (stop !== null) return stop;
    }
    if (row.cell === null) {
      const growth = chargeResultEntries(account, 1);
      if (growth !== null) return growth;
      if (defaults.has(row.point)) {
        const stop = report("initialization-rows-exact", "Every point has exactly one distinguished default row.");
        if (stop !== null) return stop;
      }
      defaults.set(row.point, row.condition);
    } else if (Object.is(defaults.get(row.point), row.condition)) {
      const stop = report("initialization-rows-exact", "Sparse point rows retain only conditions differing from that same point's default.");
      if (stop !== null) return stop;
    }
    previousPoint = row.point;
    previousCell = cell;
  }
  let returns = 0;
  let unwinds = 0;
  for (let index = 0; index < table.points.length; index += 1) {
    const work = chargeWork(account, 1);
    if (work !== null) return work;
    const point = table.points[index];
    if (point === undefined || !defaults.has(index)) {
      const stop = report("initialization-rows-exact", "Every actual point, including each separate read, retains its own sparse cell state and default.");
      if (stop !== null) return stop;
      if (point === undefined) continue;
    }
    if (point.kind === "return" || point.kind === "unwind") {
      if (point.kind === "return") returns += 1; else unwinds += 1;
      continue;
    }
    if (point.kind === "completed") {
      const handle = subjectProducer(point.handle, summary.key, summary.arena, context, account);
      if (handle.kind !== "complete") return handle;
      if (handle.value?.kind !== "call-result") {
        const stop = report("initialization-subjects-exact", "A completed point retains its actual qualified call-result handle, not an allocation or type-based guess.");
        if (stop !== null) return stop;
      }
      continue;
    }
    if (point.kind === "need" || point.kind === "before") {
    const position = summaryPositionExists(point.at, summary.key, context, account);
    if (position.kind !== "complete") return position;
    if (!position.value) {
      const stop = report("relational-site-resolves", "A read or before point retains its actual selected execution position or exact selected declared source.");
      if (stop !== null) return stop;
    }
    if (point.kind === "need") {
      if (!validIndex(point.cell, table.cells.length)) {
        const stop = report("initialization-cells-resolve", "A read names a formal position selecting its actual required source-arena cell.");
        if (stop !== null) return stop;
      }
      const witness = witnessExists(point.witness, summary, context, resources);
      if (witness.kind !== "complete") return witness;
      if (!witness.value) {
        const stop = report("initialization-witness", "A requirement retains a finite decreasing chain of actual complete-key need rows ending at its original qualified read.");
        if (stop !== null) return stop;
      }
      continue;
    }
    let found = false;
    for (const exchange of summary.callbacks) {
      const next = chargeWork(account, 1);
      if (next !== null) return next;
      const same = sameSubject(point.subject, exchange.subject, account);
      if (same.kind !== "complete") return same;
      if (!same.value) continue;
      found = true;
      if (exchange.kind === "unknown" && summary.key.kind === "declared"
        && (point.at.kind !== "declared" || !Object.is(defaults.get(index), 0))) {
        const stop = report("initialization-subjects-exact", "A bodyless unknown callback retains the selected declaration occurrence and false before-default, without fabricated invocation credit.");
        if (stop !== null) return stop;
      }
    }
    if (!found) {
      const stop = report("initialization-subjects-exact", "A before point names an actual qualified given callback exchange of this summary.");
      if (stop !== null) return stop;
    }
    }
  }
  if (returns !== (summary.returns ? 1 : 0) || unwinds !== (summary.unwinds ? 1 : 0)) {
    const stop = report("initialization-rows-exact", "Reachable normal and unwinding completion each retain exactly their own point; absent completion grants no exit credit.");
    if (stop !== null) return stop;
  }
  for (const exchange of summary.callbacks) {
    const work = chargeWork(account, 1);
    if (work !== null) return work;
    let before = false;
    for (const point of table.points) {
      const next = chargeWork(account, 1);
      if (next !== null) return next;
      if (point.kind !== "before") continue;
      const same = sameSubject(point.subject, exchange.subject, account);
      if (same.kind !== "complete") return same;
      if (same.value) { before = true; break; }
    }
    if (!before) {
      const stop = report("initialization-subjects-exact", "Every actual given callback exchange retains its before-point cell state, including genuine unknown boundaries.");
      if (stop !== null) return stop;
    }
  }
  return { kind: "complete", violations };
}
