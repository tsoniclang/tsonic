import type { DataflowResult } from "../dataflow/contract.js";
import { chargeWork, refuseAccount } from "../dataflow/index.js";
import type { Condition, ConditionAnd, ConditionEquals, ConditionLimits, ConditionOr, ConditionSubstitute } from "./contract.js";

function count(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) throw new TypeError(`Invalid ${name}`);
}

export function checkConditionLimits(limits: ConditionLimits): void {
  count(limits.eventCount, "eventCount");
  count(limits.maximumConditionAlternatives, "maximumConditionAlternatives");
}

export function compareAlternatives(left: readonly number[], right: readonly number[], limits: ConditionLimits): DataflowResult<number> {
  const second = right.values();
  for (const first of left) {
    const stop = chargeWork(limits.account, 1);
    if (stop !== null) return stop;
    const current = second.next();
    if (current.done) return { kind: "complete", value: 1 };
    if (first !== current.value) return { kind: "complete", value: first < current.value ? -1 : 1 };
  }
  return { kind: "complete", value: left.length - right.length };
}

function subset(left: readonly number[], right: readonly number[], limits: ConditionLimits): DataflowResult<boolean> {
  const first = left.values();
  let needed = first.next();
  if (needed.done) return { kind: "complete", value: true };
  for (const current of right) {
    const stop = chargeWork(limits.account, 1);
    if (stop !== null) return stop;
    if (needed.value < current) return { kind: "complete", value: false };
    if (needed.value === current) {
      needed = first.next();
      if (needed.done) return { kind: "complete", value: true };
    }
  }
  return { kind: "complete", value: false };
}

export function validateCondition(condition: Condition, eventCount: number, limits: ConditionLimits): DataflowResult<boolean> {
  const start = chargeWork(limits.account, 1);
  if (start !== null) return start;
  let previous: readonly number[] | null = null;
  for (let index = 0; index < condition.alternatives.length; index += 1) {
    const rowStop = chargeWork(limits.account, 1);
    if (rowStop !== null) return rowStop;
    const row = condition.alternatives[index];
    if (row === undefined) return { kind: "complete", value: false };
    let last = -1;
    for (let member = 0; member < row.length; member += 1) {
      const stop = chargeWork(limits.account, 1);
      if (stop !== null) return stop;
      const event = row[member];
      if (event === undefined || !Number.isSafeInteger(event) || event <= last || event >= eventCount || Object.is(event, -0))
        return { kind: "complete", value: false };
      last = event;
    }
    if (previous !== null) {
      const order = compareAlternatives(previous, row, limits);
      if (order.kind !== "complete") return order;
      if (order.value >= 0) return { kind: "complete", value: false };
    }
    for (const [earlier, other] of condition.alternatives.entries()) {
      if (earlier === index) break;
      const pairStop = chargeWork(limits.account, 1);
      if (pairStop !== null) return pairStop;
      const forward = subset(other, row, limits);
      if (forward.kind !== "complete") return forward;
      if (forward.value) return { kind: "complete", value: false };
      const reverse = subset(row, other, limits);
      if (reverse.kind !== "complete") return reverse;
      if (reverse.value) return { kind: "complete", value: false };
    }
    previous = row;
  }
  return { kind: "complete", value: true };
}

function insert(rows: (readonly number[])[], candidate: readonly number[], limits: ConditionLimits): DataflowResult<null> {
  for (const row of rows) {
    const stop = chargeWork(limits.account, 1);
    if (stop !== null) return stop;
    const absorbs = subset(row, candidate, limits);
    if (absorbs.kind !== "complete") return absorbs;
    if (absorbs.value) return { kind: "complete", value: null };
  }
  let retained = 0;
  for (const row of rows) {
    const stop = chargeWork(limits.account, 1);
    if (stop !== null) return stop;
    const absorbed = subset(candidate, row, limits);
    if (absorbed.kind !== "complete") return absorbed;
    if (!absorbed.value) rows[retained++] = row;
  }
  rows.length = retained;
  if (retained >= limits.maximumConditionAlternatives) return refuseAccount(limits.account, limits.refusal);
  const candidateStop = chargeWork(limits.account, 1);
  if (candidateStop !== null) return candidateStop;
  let position = 0;
  for (const row of rows) {
    const order = compareAlternatives(row, candidate, limits);
    if (order.kind !== "complete") return order;
    if (order.value > 0) break;
    position += 1;
  }
  const moveStop = chargeWork(limits.account, retained - position);
  if (moveStop !== null) return moveStop;
  rows.splice(position, 0, candidate);
  return { kind: "complete", value: null };
}

export function orConditions(left: Condition, right: Condition, limits: ConditionLimits): DataflowResult<Condition> {
  const stop = chargeWork(limits.account, 1);
  if (stop !== null) return stop;
  const rows: (readonly number[])[] = [];
  for (const input of [left, right]) for (const row of input.alternatives) {
    const rowStop = chargeWork(limits.account, 1);
    if (rowStop !== null) return rowStop;
    const inserted = insert(rows, row, limits);
    if (inserted.kind !== "complete") return inserted;
  }
  return { kind: "complete", value: { alternatives: rows } };
}

export function andConditions(left: Condition, right: Condition, limits: ConditionLimits): DataflowResult<Condition> {
  const stop = chargeWork(limits.account, 1);
  if (stop !== null) return stop;
  const rows: (readonly number[])[] = [];
  for (const first of left.alternatives) for (const second of right.alternatives) {
    const pairStop = chargeWork(limits.account, 1);
    if (pairStop !== null) return pairStop;
    const row: number[] = [];
    const leftEvents = first.values();
    const rightEvents = second.values();
    let leftEvent = leftEvents.next();
    let rightEvent = rightEvents.next();
    while (!leftEvent.done || !rightEvent.done) {
      const memberStop = chargeWork(limits.account, 1);
      if (memberStop !== null) return memberStop;
      if (!leftEvent.done && (rightEvent.done || leftEvent.value < rightEvent.value)) {
        row.push(leftEvent.value); leftEvent = leftEvents.next();
      } else if (!rightEvent.done && (leftEvent.done || rightEvent.value < leftEvent.value)) {
        row.push(rightEvent.value); rightEvent = rightEvents.next();
      } else if (!leftEvent.done && !rightEvent.done) {
        row.push(leftEvent.value); leftEvent = leftEvents.next(); rightEvent = rightEvents.next();
      }
    }
    const inserted = insert(rows, row, limits);
    if (inserted.kind !== "complete") return inserted;
  }
  return { kind: "complete", value: { alternatives: rows } };
}

export function substituteCondition(condition: Condition, events: readonly Condition[], limits: ConditionLimits): DataflowResult<Condition> {
  let result: Condition = { alternatives: [] };
  for (const alternative of condition.alternatives) {
    const rowStop = chargeWork(limits.account, 1);
    if (rowStop !== null) return rowStop;
    let current: Condition = { alternatives: [[]] };
    for (const index of alternative) {
      const eventStop = chargeWork(limits.account, 1);
      if (eventStop !== null) return eventStop;
      const event = events[index];
      if (event === undefined) throw new TypeError("The condition binding must supply every referenced event");
      const combined = andConditions(current, event, limits);
      if (combined.kind !== "complete") return combined;
      current = combined.value;
    }
    const combined = orConditions(result, current, limits);
    if (combined.kind !== "complete") return combined;
    result = combined.value;
  }
  return { kind: "complete", value: result };
}

function inputs(left: Condition, right: Condition, limits: ConditionLimits): DataflowResult<null> {
  const stop = chargeWork(limits.account, 0);
  if (stop !== null) return stop;
  checkConditionLimits(limits);
  const first = validateCondition(left, limits.eventCount, limits);
  if (first.kind !== "complete") return first;
  if (!first.value) throw new TypeError("A condition retains its actual canonical event antichain");
  const second = validateCondition(right, limits.eventCount, limits);
  if (second.kind !== "complete") return second;
  if (!second.value) throw new TypeError("A condition retains its actual canonical event antichain");
  return { kind: "complete", value: null };
}

export const conditionOr: ConditionOr = (left, right, limits) => {
  const checked = inputs(left, right, limits);
  return checked.kind !== "complete" ? checked : orConditions(left, right, limits);
};

export const conditionAnd: ConditionAnd = (left, right, limits) => {
  const checked = inputs(left, right, limits);
  return checked.kind !== "complete" ? checked : andConditions(left, right, limits);
};

export const conditionEquals: ConditionEquals = (left, right, limits) => {
  const checked = inputs(left, right, limits);
  if (checked.kind !== "complete") return checked;
  const rightRows = right.alternatives.values();
  for (const first of left.alternatives) {
    const stop = chargeWork(limits.account, 1);
    if (stop !== null) return stop;
    const second = rightRows.next();
    if (second.done) return { kind: "complete", value: false };
    const order = compareAlternatives(first, second.value, limits);
    if (order.kind !== "complete") return order;
    if (order.value !== 0) return { kind: "complete", value: false };
  }
  const stop = chargeWork(limits.account, 1);
  return stop === null ? { kind: "complete", value: rightRows.next().done === true } : stop;
};

export const conditionSubstitute: ConditionSubstitute = (condition, events, limits) => {
  const stop = chargeWork(limits.account, 0);
  if (stop !== null) return stop;
  checkConditionLimits(limits);
  const checked = validateCondition(condition, events.length, limits);
  if (checked.kind !== "complete") return checked;
  if (!checked.value) throw new TypeError("A condition retains its actual canonical event antichain");
  for (let index = 0; index < events.length; index += 1) {
    const stop = chargeWork(limits.account, 1);
    if (stop !== null) return stop;
    const event = events[index];
    if (event === undefined) throw new TypeError("A condition binding has a missing event");
    const checkedEvent = validateCondition(event, limits.eventCount, limits);
    if (checkedEvent.kind !== "complete") return checkedEvent;
    if (!checkedEvent.value) throw new TypeError("A condition retains its actual canonical event antichain");
  }
  return substituteCondition(condition, events, limits);
};
