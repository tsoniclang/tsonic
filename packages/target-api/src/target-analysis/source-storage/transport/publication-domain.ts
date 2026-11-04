import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageBudget, SourceStorageRows } from "../model/resource-budget.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import type { createSourceStorageDomainPublications } from "../graph/domain-publications.js";
import type { createSourceStorageTransport } from "./transport.js";

export function sourceStoragePublicationDomain(source: TargetSourceProgram,
  transport: ReturnType<typeof createSourceStorageTransport>, budget: SourceStorageBudget,
  rows: SourceStorageRows, subject: SourceStorageSubject,
  publications: ReturnType<typeof createSourceStorageDomainPublications>): ReadonlySet<Node> | undefined {
  return budget.withRows(temporary => {
    const nodes = new Set<Node>();
    const pending: Node[] = [];
    const admit = (node: Node | undefined): void => {
      if (node === undefined || nodes.has(node) || !transport.hasNode(node) || source.ast.is.IsSourceFile(node)) return;
      if (!temporary.add(2)) return;
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
    const exposures = new Set<Node>();
    for (let index = 0; index < publications.size(); index += 1) {
      if (!budget.step()) return undefined;
      const publication = publications.at(index);
      if (publication === undefined || !nodes.has(publication.subject.node) || exposures.has(publication.exposure)) continue;
      if (!rows.add(1)) return undefined;
      exposures.add(publication.exposure);
    }
    return budget.failure() === undefined ? exposures : undefined;
  });
}
