import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/types.js";
import type { SourceDeclarationContinuationDependency, SourceDeclarationContinuationSelection,
  SourceDeclarationOwnershipBudget, SourceDeclarationPendingOperation } from "./model.js";
import type { SourceDeclarationSuspensionQueries } from "./suspension.js";
import type { createSourceDeclarationRetentionQuery } from "./retention.js";
import { sourceDeclarationOwnershipUnresolved } from "./contracts.js";

export function createSourceDeclarationContinuationDependencyQuery(input: {
  readonly source: TargetSourceProgram;
  readonly budget: SourceDeclarationOwnershipBudget;
  readonly suspensions: SourceDeclarationSuspensionQueries;
  readonly retention: ReturnType<typeof createSourceDeclarationRetentionQuery>;
}) {
  const { source, budget, suspensions, retention } = input;
  return Object.freeze({
    forRead(state: ReadonlySet<SourceDeclarationPendingOperation>, reference: Node,
      candidate: Node): SourceDeclarationContinuationSelection {
      if (!budget.step(reference)) return budget.failure()!;
      const file = source.ast.getSourceFile(reference);
      const ownerFile = source.ast.getSourceFile(candidate);
      if (file === undefined || ownerFile === undefined || !source.semantics.includes(file) || !source.semantics.includes(ownerFile))
        return sourceDeclarationOwnershipUnresolved(reference, "Continuation dependencies require original checked reads and their declaration owner.");
      if (state.size === 0) return Object.freeze({ kind: "resolved", dependencies: Object.freeze([]) });
      const selected = retention.forReference(reference);
      if (selected.kind === "unresolved") return selected;
      const rows = budget.createRows(reference);
      let published = false;
      try {
        const dependencies: SourceDeclarationContinuationDependency[] = [];
        for (const pending of state) {
          if (!budget.step(reference)) return budget.failure()!;
          if (!suspensions.owns(pending))
            return sourceDeclarationOwnershipUnresolved(reference,
              "A continuation requires this immutable query's real pending native operation, not a copied witness.");
          for (const premise of selected.premises) {
            if (premise.kind === "retained" && premise.reason === "owned-value") continue;
            if (!budget.step(reference) || !rows.add(1)) return budget.failure()!;
            dependencies.push(Object.freeze({ candidate, reference, actual: premise.value,
              suspension: pending, retention: premise }));
          }
        }
        published = true;
        return Object.freeze({ kind: "resolved", dependencies: Object.freeze(dependencies) });
      } finally { if (!published) rows.release(); }
    },
  });
}

export type SourceDeclarationContinuationDependencyQueries = ReturnType<typeof createSourceDeclarationContinuationDependencyQuery>;
