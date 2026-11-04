import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageBudget, SourceStorageRows } from "../model/resource-budget.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import type { createSourceStorageTransport } from "./transport.js";

export function sourceStoragePublicationDomain(source: TargetSourceProgram,
  transport: ReturnType<typeof createSourceStorageTransport>, budget: SourceStorageBudget,
  rows: SourceStorageRows, subject: SourceStorageSubject): ReadonlySet<Node> | undefined {
  const nodes = new Set<Node>();
  const pending: Node[] = [];
  const admit = (node: Node | undefined): void => {
    if (node === undefined || nodes.has(node) || !transport.hasNode(node) || source.ast.is.IsSourceFile(node)) return;
    if (!rows.add(2)) return;
    nodes.add(node);
    pending.push(node);
  };
  admit(subject.node);
  for (const component of subject.projection) {
    if (!budget.step()) return undefined;
    if (component.kind === "member" || component.kind === "method-value") admit(component.declaration);
  }
  for (let index = 0; index < pending.length; index += 1) {
    if (!budget.step()) return undefined;
    const node = pending[index]!;
    admit(source.ast.parent(node));
    source.ast.forEachChild(node, child => {
      if (budget.step()) admit(child);
    });
    const reference = source.navigation.sourceReferenceFor(node);
    admit(reference?.declaration);
    for (const reference of source.navigation.referencesToDeclaration(node)) {
      if (!budget.step()) return undefined;
      admit(reference);
    }
  }
  return budget.failure() === undefined ? nodes : undefined;
}
