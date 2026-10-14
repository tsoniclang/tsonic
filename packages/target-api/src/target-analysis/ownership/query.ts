import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/types.js";
import type { SourceFlowLimits } from "../flow/model.js";
import type { SourceStorageBindings, SourceStorageQueries } from "../source-storage/model/types.js";
import type { SourceAsyncOwnershipSelection, SourceContinuationDependenciesSelection, SourceOwnershipBudget,
  SourceOwnershipPremises } from "./model.js";
import { sourceOwnershipUnresolved } from "./contracts.js";
import { createSourceContinuationClosureQuery } from "./closure.js";
import { decideSourceAsyncResultUse } from "./result-decision.js";
import { resolveSourceAsyncResultDisposition } from "./result-use.js";

export function createSourceOwnershipQuery(input: {
  readonly source: TargetSourceProgram;
  readonly storage: SourceStorageQueries;
  readonly premises: SourceOwnershipPremises;
  readonly budget: SourceOwnershipBudget;
  readonly flowLimits?: Partial<SourceFlowLimits>;
}) {
  const { source, storage, premises, budget } = input;
  const closure = createSourceContinuationClosureQuery(input);
  const decisions = new Map<Node, Map<SourceStorageBindings, SourceAsyncOwnershipSelection>>();
  const rows = budget.createRows();
  const continuationFor = (call: Node, bindings: SourceStorageBindings = storage.emptyBindings): SourceContinuationDependenciesSelection => {
    const selected = closure.forInvocation(call, bindings);
    return selected;
  };
  return Object.freeze({
    continuationFor,
    forCall(call: Node, bindings: SourceStorageBindings = storage.emptyBindings): SourceAsyncOwnershipSelection {
      if (!budget.step()) return sourceOwnershipUnresolved(call, budget.failure()!);
      const existing = decisions.get(call)?.get(bindings);
      if (existing !== undefined) return existing;
      const file = source.ast.getSourceFile(call);
      if (file === undefined || !source.semantics.includes(file) || !source.ast.is.IsCallExpression(call)) {
        return sourceOwnershipUnresolved(call, "Async ownership requires its exact checked source call.");
      }
      const selected = source.semantics.forNode(call).operations.call(call);
      if (selected?.sourceSelectedSignatureKind !== "resolved") {
        return sourceOwnershipUnresolved(call, "Async ownership requires its checked selected source signature.");
      }
      const implementations = storage.invocationImplementationsFor(call, bindings);
      if (implementations.kind === "unresolved") return sourceOwnershipUnresolved(call, implementations.reason);
      const completion = premises.completionFor(call, selected, bindings);
      const decision = completion.kind !== "async" ? completion : decideSourceAsyncResultUse({ source, storage, budget, call, completion,
        disposition: resolveSourceAsyncResultDisposition(source, storage, call, budget, bindings),
        continuation: continuationFor(call, bindings) });
      if (decision.kind === "unresolved") return decision;
      if (!rows.add(2)) return sourceOwnershipUnresolved(call, budget.failure()!);
      const byBinding = decisions.get(call) ?? new Map<SourceStorageBindings, SourceAsyncOwnershipSelection>();
      byBinding.set(bindings, decision);
      decisions.set(call, byBinding);
      return decision;
    },
  });
}

export type SourceOwnershipQueries = ReturnType<typeof createSourceOwnershipQuery>;
