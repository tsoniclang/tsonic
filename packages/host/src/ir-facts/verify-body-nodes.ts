import type { DataflowAccount, DataflowResult } from "../dataflow/contract.js";
import { chargeResultEntries, chargeWork } from "../dataflow/index.js";
import type { BodyId, NodeId } from "../ids/contract.js";
import { bodyOccurrenceSlots, readChapterSyntaxSlot, tirBodySyntaxOf } from "../ir-tir/index.js";
import type { TirBody, TirSyntaxOccurrence, TirTypedSyntax } from "../ir-tir/contract.js";

export function bodyNodes(tir: TirBody, account: DataflowAccount): DataflowResult<{
  readonly nodes: ReadonlyMap<NodeId, TirSyntaxOccurrence>; readonly valueNodes: ReadonlySet<NodeId>;
}> {
  const entry = chargeWork(account, 1);
  if (entry !== null) return entry;
  const parameters = tir.params;
  const nested = tir.nestedBodies;
  const initial = chargeWork(account, nested.length + parameters.length)
    ?? chargeResultEntries(account, 4 + nested.length + parameters.length);
  if (initial !== null) return initial;
  const nodes = new Map<NodeId, TirSyntaxOccurrence>();
  const valueNodes = new Set<NodeId>();
  const nestedBodies = new Set(nested);
  const containsNested = (body: BodyId): boolean => nestedBodies.has(body);
  const pending: TirTypedSyntax[] = [tirBodySyntaxOf(tir.root)];
  for (const parameter of parameters) {
    if (parameter === undefined) throw new TypeError("ir-facts: selected parameter inventory must be dense.");
    pending.push({ kind: "formal", node: parameter });
  }
  for (let subject = pending.pop(); subject !== undefined; subject = pending.pop()) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

    const node = subject.node;
    if (nodes.has(node.id)) continue;
    const growth = chargeResultEntries(account, 2);
    if (growth !== null) return growth;
    nodes.set(node.id, node);
    const annotation = node.tsonic;
    if (subject.kind === "ordinary" && annotation !== null && "convertedType" in annotation) valueNodes.add(node.id);
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
  return { kind: "complete", value: { nodes, valueNodes } };
}
