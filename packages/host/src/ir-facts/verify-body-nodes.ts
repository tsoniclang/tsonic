import type { DataflowAccount, DataflowResult } from "../dataflow/contract.js";
import { chargeResultEntries, chargeWork } from "../dataflow/index.js";
import type { NodeId } from "../ids/contract.js";
import { iterateChildrenOfSyntax } from "../ir-hir/index.js";
import type { TirBody, TirNode, TypedPhase } from "../ir-tir/contract.js";

export function bodyNodes(tir: TirBody, account: DataflowAccount): DataflowResult<{
  readonly nodes: ReadonlyMap<NodeId, TirNode>; readonly valueNodes: ReadonlySet<NodeId>;
}> {
  const entry = chargeWork(account, 1);
  if (entry !== null) return entry;
  const parameters = tir.params;
  const nested = tir.nestedBodies;
  const initial = chargeWork(account, nested.length + parameters.length)
    ?? chargeResultEntries(account, 4 + nested.length + parameters.length);
  if (initial !== null) return initial;
  const nodes = new Map<NodeId, TirNode>();
  const valueNodes = new Set<NodeId>();
  const nestedBodies = new Set(nested);
  const pending: TirNode[] = [tir.root];
  for (const parameter of parameters) {
    if (parameter === undefined) throw new TypeError("ir-facts: selected parameter inventory must be dense.");
    pending.push(parameter);
  }
  for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

    if (nodes.has(node.id)) continue;
    const growth = chargeResultEntries(account, 2);
    if (growth !== null) return growth;
    nodes.set(node.id, node);
    const annotation = node.tsonic;
    if (annotation !== null && "convertedType" in annotation) valueNodes.add(node.id);
    const template = annotation !== null && "callable" in annotation ? annotation.callable.template
      : annotation !== null && "template" in annotation ? annotation.template : null;
    const bodyRoot = template !== null && nestedBodies.has(template.body) && "body" in node && node.body !== null ? node.body.id : null;
    const callable = "parameters" in node && "body" in node;
    const initializerRoot = annotation !== null && "initializer" in annotation && annotation.initializer !== null &&
      "initializer" in node && node.initializer !== null ? node.initializer.id : null;
    const children = iterateChildrenOfSyntax<TypedPhase>(node);
    for (;;) {
      const step = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
      if (step !== null) return step;
      const child = children.next();
      if (child.done) break;
      if (child.value.id !== bodyRoot && child.value.id !== initializerRoot
        && !(callable && child.value.kind === "Parameter")) pending.push(child.value);
    }
  }
  return { kind: "complete", value: { nodes, valueNodes } };
}
