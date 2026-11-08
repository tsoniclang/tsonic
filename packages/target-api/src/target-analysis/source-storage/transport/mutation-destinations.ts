import type { SourceStorageProgram } from "../model/program.js";
import type { SourceTypeEvidence } from "../../../public/source/contracts.js";
import type { Node } from "@tsonic/tsts";

import type { SourceStorageSubject } from "../../../source-model/storage.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageClassLineage } from "../model/construction.js";
import type { createSourceStorageMemberFlow } from "../graph/member-flow.js";

export function createSourceStorageMutationDestinations<Bindings>(source: SourceStorageProgram,
  budget: SourceStorageBudget, memberFlow: ReturnType<typeof createSourceStorageMemberFlow>,
  lineagesFor: (origin: SourceStorageSubject) => readonly SourceStorageClassLineage<Bindings>[] | undefined) {
  return (origin: SourceStorageSubject, declarations: readonly Node[], receiverType: SourceTypeEvidence): ReadonlySet<Node> | undefined => {
    const destinations = new Set<Node>();
    const ordinary = (): boolean => {
      if (memberFlow.excludes(origin, receiverType)) return true;
      for (const declaration of declarations) {
        if (!budget.step()) return false;
        const member = memberFlow.memberFor(origin, declaration, receiverType);
        if (member === undefined || member.kind === "absent" && !member.destination.property.optional) return false;
        for (const original of member.kind === "present" ? member.source.declarations : member.destination.declarations) {
          if (!budget.step()) return false;
          destinations.add(original);
        }
      }
      return true;
    };
    if (!source.ast.is.IsNewExpression(origin.node)) return ordinary() ? destinations : undefined;
    const lineages = lineagesFor(origin);
    if (lineages === undefined || lineages.length === 0) return undefined;
    for (const lineage of lineages) {
      if (!budget.step()) return undefined;
      if (lineage.classes.length === 0) {
        if (!ordinary()) return undefined;
        continue;
      }
      if (!lineage.complete) return undefined;
      for (const declaration of declarations) {
        if (!budget.step()) return undefined;
        const selected = memberFlow.membersInLineage(lineage, declaration, receiverType);
        if (selected === undefined || selected.absent) return undefined;
        for (const member of selected.members) {
          if (!budget.step()) return undefined;
          destinations.add(member.declaration);
        }
      }
    }
    return destinations;
  };
}
