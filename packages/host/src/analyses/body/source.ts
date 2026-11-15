import type { DataflowAccount, DataflowResult } from "../../dataflow/contract.js";
import { chargeResultEntries, chargeWork } from "../../dataflow/index.js";
import type { NodeId } from "../../ids/contract.js";
import { iterateChildrenOfSyntax } from "../../ir-hir/index.js";
import type { TirBody, TirNode, TypedPhase } from "../../ir-tir/contract.js";

export function sourceOccurrences(tir: TirBody, account: DataflowAccount): DataflowResult<ReadonlyMap<NodeId, TirNode>> {
  const entry = chargeWork(account, 1);
  if (entry !== null) return entry;
  const initial = chargeWork(account, tir.nestedBodies.length + tir.params.length)
    ?? chargeResultEntries(account, 2 + tir.nestedBodies.length + tir.params.length);
  if (initial !== null) return initial;
  const nested = new Set(tir.nestedBodies);
  const nodes = new Map<NodeId, TirNode>();
  const pending: TirNode[] = [tir.root];
  for (const header of tir.params) {
    if (header === undefined) throw new TypeError("BodyAnalysis retains every actual selected parameter header.");
    pending.push(header);
  }
  for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
    const read = chargeWork(account, 1);
    if (read !== null) return read;
    if (nodes.has(node.id)) continue;
    const growth = chargeResultEntries(account, 1);
    if (growth !== null) return growth;
    nodes.set(node.id, node);
    const annotation = node.tsonic;
    const template = annotation !== null && "callable" in annotation ? annotation.callable.template
      : annotation !== null && "template" in annotation ? annotation.template : null;
    const body = template !== null && nested.has(template.body) && "body" in node && node.body !== null ? node.body.id : null;
    const initializer = annotation !== null && "initializer" in annotation && annotation.initializer !== null
      && nested.has(annotation.initializer) && "initializer" in node && node.initializer !== null ? node.initializer.id : null;
    const children = iterateChildrenOfSyntax<TypedPhase>(node);
    for (;;) {
      const step = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
      if (step !== null) return step;
      const child = children.next();
      if (child.done) break;
      if ("parameters" in node && "body" in node && child.value.kind === "Parameter") continue;
      if (child.value.id !== body && child.value.id !== initializer) pending.push(child.value);
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
