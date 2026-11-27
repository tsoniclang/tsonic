import type { DataflowAccount, DataflowResult } from "../../dataflow/contract.js";
import { accountFailure, chargeResultEntries, chargeWork } from "../../dataflow/index.js";
import type { BodyId, NodeId } from "../../ids/contract.js";
import { bodyOccurrenceSlots, readChapterSyntaxSlot, tirBodySyntaxOf } from "../../ir-tir/index.js";
import type { TirApplication, TirBody, TirSyntaxOccurrence, TirTypedSyntax } from "../../ir-tir/contract.js";

export function selectedSourceApplication(syntax: TirSyntaxOccurrence | undefined): TirApplication | null {
  const phase = syntax?.kind === "CallExpression" || syntax?.kind === "NewExpression" ? syntax.tsonic : null;
  const application = phase != null && "application" in phase ? phase.application : null;
  return application?.kind === "decided" ? application.decision : null;
}

export function sourceOccurrences(tir: TirBody, account: DataflowAccount): DataflowResult<ReadonlyMap<NodeId, TirSyntaxOccurrence>> {
  const entry = chargeWork(account, 1);
  if (entry !== null) return entry;
  const initial = chargeWork(account, tir.nestedBodies.length + tir.params.length)
    ?? chargeResultEntries(account, 2 + tir.nestedBodies.length + tir.params.length);
  if (initial !== null) return initial;
  const nested = new Set(tir.nestedBodies);
  const containsNested = (body: BodyId): boolean => nested.has(body);
  const nodes = new Map<NodeId, TirSyntaxOccurrence>();
  const pending: TirTypedSyntax[] = [tirBodySyntaxOf(tir.root)];
  for (const header of tir.params) {
    if (header === undefined) throw new TypeError("BodyAnalysis retains every actual selected parameter header.");
    pending.push({ kind: "formal", node: header });
  }
  for (let subject = pending.pop(); subject !== undefined; subject = pending.pop()) {
    const read = chargeWork(account, 1);
    if (read !== null) return read;
    const node = subject.node;
    if (nodes.has(node.id)) continue;
    const growth = chargeResultEntries(account, 1);
    if (growth !== null) return growth;
    nodes.set(node.id, node);
    const children = bodyOccurrenceSlots(subject, containsNested)[Symbol.iterator]();
    for (;;) {
      const step = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
      if (step !== null) return step;
      const child = children.next();
      if (child.done) break;
      const selected = readChapterSyntaxSlot(child.value);
      if (selected !== null && selected.kind !== "checked") pending.push(selected);
    }
  }
  return { kind: "complete", value: nodes };
}

export function orderedRows<Value>(values: readonly Value[], compare: (left: Value, right: Value) => number,
  account: DataflowAccount): DataflowResult<readonly Value[]> {
  const admission = chargeWork(account, values.length) ?? chargeResultEntries(account, values.length * 2);
  if (admission !== null) return admission;
  let current = [...values];
  let buffer: Value[] = [];
  for (let width = 1; width < current.length; width *= 2) {
    buffer.length = 0;
    for (let start = 0; start < current.length; start += width * 2) {
      let left = start;
      let right = Math.min(start + width, current.length);
      const middle = right;
      const end = Math.min(start + width * 2, current.length);
      while (left < middle || right < end) {
        const step = chargeWork(account, 1);
        if (step !== null) return step;
        const first = current[left];
        const second = current[right];
        const takeLeft = right === end || left < middle && first !== undefined && second !== undefined && compare(first, second) <= 0;
        const stopped = accountFailure(account);
        if (stopped !== null) return stopped;
        const value = current[takeLeft ? left++ : right++];
        if (value === undefined) throw new TypeError("A body-analysis ordering retains every admitted row.");
        buffer.push(value);
      }
    }
    const previous = current;
    current = buffer;
    buffer = previous;
  }
  return { kind: "complete", value: current };
}
