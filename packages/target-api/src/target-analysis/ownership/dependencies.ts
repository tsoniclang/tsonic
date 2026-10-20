import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/types.js";
import type { SourceStorageBindings, SourceStorageQueries } from "../source-storage/model/types.js";
import type { SourceContinuationDependency, SourceContinuationDependenciesSelection, SourceOwnershipBudget, SourceOwnershipPremises } from "./model.js";
import type { SourceContinuationState, SourceContinuationTransfer } from "./continuation.js";
import type { SourceSuspensionQueries } from "./suspension.js";
import { createSourceRetentionQuery } from "./retention.js";
import { sourceOwnershipUnresolved } from "./contracts.js";

export function createSourceContinuationDependencyQuery(input: {
  readonly source: TargetSourceProgram;
  readonly storage: SourceStorageQueries;
  readonly premises: Pick<SourceOwnershipPremises, "retentionFor">;
  readonly budget: SourceOwnershipBudget;
  readonly transfer: SourceContinuationTransfer;
  readonly suspensions: SourceSuspensionQueries;
}) {
  const { source, budget, transfer, suspensions } = input;
  const retention = createSourceRetentionQuery(input);
  return Object.freeze({
    forRead(state: SourceContinuationState, reference: Node, candidate: Node,
      bindings: SourceStorageBindings): SourceContinuationDependenciesSelection {
      if (!budget.step()) return sourceOwnershipUnresolved(reference, budget.failure()!);
      const file = source.ast.getSourceFile(reference);
      const candidateFile = source.ast.getSourceFile(candidate);
      if (file === undefined || candidateFile === undefined || !source.semantics.includes(file) ||
        !source.semantics.includes(candidateFile)) {
        return sourceOwnershipUnresolved(reference, "Continuation dependencies require checked source references and their callable owner.");
      }
      if (state.size === 0) return Object.freeze({ kind: "resolved", dependencies: Object.freeze([]) });
      const selected = retention.forReference(reference, bindings);
      if (selected.kind === "unresolved") return selected;
      const rows = budget.createRows();
      let published = false;
      try {
        const dependencies: SourceContinuationDependency[] = [];
        let failure: SourceContinuationDependenciesSelection | undefined;
        const complete = transfer.read(state, reference, pending => {
          if (!suspensions.owns(pending)) {
            failure = sourceOwnershipUnresolved(reference, budget.failure() ?? "A continuation requires the original checked pending-operation evidence, not a copied or foreign witness.");
            return false;
          }
          for (const premise of selected.premises) {
            if (!budget.step() || !rows.add(1)) return false;
            dependencies.push(Object.freeze({ candidate, reference, actual: premise.value,
              suspension: pending, retention: premise }));
          }
          return true;
        });
        if (!complete) return failure ?? sourceOwnershipUnresolved(reference, budget.failure() ?? "Continuation dependencies have no complete checked selection.");
        published = true;
        return Object.freeze({ kind: "resolved", dependencies: Object.freeze(dependencies) });
      } finally {
        if (!published) rows.release();
      }
    },
  });
}

export type SourceContinuationDependencyQueries = ReturnType<typeof createSourceContinuationDependencyQuery>;
