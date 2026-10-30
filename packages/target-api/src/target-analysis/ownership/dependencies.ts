import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/types.js";
import type { SourceStorageBindings, SourceStorageQueries } from "../source-storage/model/types.js";
import type { SourceContinuationDependency, SourceContinuationDependenciesSelection, SourceOwnershipBudget, SourceOwnershipPremises } from "./model.js";
import type { SourceContinuationState, SourceContinuationTransfer } from "./continuation.js";
import type { SourceSuspensionQueries } from "./suspension.js";
import { createSourceRetentionQuery } from "./retention.js";
import { sourceOwnershipUnresolved } from "./contracts.js";
import type { SourceDeclarationContinuationDependency, SourceDeclarationContinuationSelection,
  SourceDeclarationOwnershipBudget, SourceDeclarationPendingOperation } from "./model.js";
import type { SourceDeclarationSuspensionQueries } from "./suspension.js";
import type { createSourceDeclarationRetentionQuery } from "./retention.js";
import { sourceDeclarationOwnershipUnresolved } from "./contracts.js";

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
