import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/types.js";
import type { SourceStorageQueries } from "../source-storage/model/types.js";
import type { SourceAsyncCompletionSelection, SourceAsyncOwnershipSelection, SourceAsyncResultDisposition,
  SourceContinuationDependenciesSelection, SourceOwnershipBudget, SourceOwnershipUnresolved, SourceRetentionReadSelection } from "./model.js";
import { sourceOwnershipContractProblem, sourceOwnershipUnresolved } from "./contracts.js";

export function decideSourceAsyncResultUse(input: {
  readonly source: TargetSourceProgram;
  readonly storage: SourceStorageQueries;
  readonly budget: SourceOwnershipBudget;
  readonly call: Node;
  readonly completion: SourceAsyncCompletionSelection;
  readonly disposition: SourceAsyncResultDisposition | SourceOwnershipUnresolved;
  readonly continuation: SourceContinuationDependenciesSelection;
  readonly retention: SourceRetentionReadSelection;
}): SourceAsyncOwnershipSelection {
  const { source, storage, budget, call, completion, disposition, continuation, retention } = input;
  if (!budget.step()) return sourceOwnershipUnresolved(call, budget.failure()!);
  if (source !== storage.source) return sourceOwnershipUnresolved(call, "Result-use and storage require the identical checked source program.");
  const file = source.ast.getSourceFile(call);
  if (file === undefined || !source.semantics.includes(file) || !source.ast.is.IsCallExpression(call)) {
    return sourceOwnershipUnresolved(call, "Async result-use requires its exact checked source call.");
  }
  if (completion.kind === "not-async" || completion.kind === "unresolved") return completion;
  const selected = source.semantics.forNode(call).operations.call(call);
  if (selected?.sourceSelectedSignatureKind !== "resolved") {
    return sourceOwnershipUnresolved(call, "Async result-use requires the checked selected call signature.");
  }
  const contractProblem = sourceOwnershipContractProblem(source, call, selected.sourceResultType, completion);
  if (contractProblem !== undefined) return sourceOwnershipUnresolved(call, contractProblem);
  if (disposition.kind === "unresolved") return disposition;
  if (completion.resultPolicy === "must-observe" && disposition.kind === "discarded") {
    return Object.freeze({ kind: "resolved", call, disposition, dependencies: Object.freeze([]), decision: "rejected",
      diagnostic: Object.freeze({ code: "TSONIC_NATIVE_ASYNC_RESULT_DISCARDED", at: call,
        message: "A native asynchronous call result must be observed, not discarded." }) });
  }
  if (continuation.kind === "unresolved" && (retention.kind === "unresolved" || retention.premises.length === 0)) {
    return continuation;
  }
  if (continuation.kind === "unresolved" && retention.kind === "resolved" && retention.reference !== call) {
    return sourceOwnershipUnresolved(call, "Native async retention must describe this exact result-use call, not another source read.");
  }
  const dependencies = continuation.kind === "resolved" ? continuation.dependencies : Object.freeze([]);
  const leases = continuation.kind === "resolved" ? continuation.dependencies.map(dependency => dependency.retention)
    : retention.kind === "resolved" ? retention.premises : [];
  for (const lease of leases) {
    if (!budget.step()) return sourceOwnershipUnresolved(call, budget.failure()!);
    if (lease.kind !== "scoped-borrowed" && lease.kind !== "formal-borrowed") continue;
    if (disposition.kind === "awaited-in-scope") {
      const region = lease.kind === "scoped-borrowed" ? lease.region : lease.executionOwner;
      let current: Node | undefined = disposition.use;
      const visited = new Set<Node>();
      while (current !== undefined && current !== region) {
        if (!budget.step()) return sourceOwnershipUnresolved(call, budget.failure()!);
        if (visited.has(current)) return sourceOwnershipUnresolved(call, "The await's source scope has cyclic ancestry.");
        visited.add(current);
        current = source.ast.parent(current);
      }
      if (current === undefined) {
        return sourceOwnershipUnresolved(disposition.use, "The immediate await does not occur inside the checked source lease's valid region.");
      }
    } else if (completion.resultPolicy === "observe-rejection") {
      return Object.freeze({ kind: "resolved", call, disposition, dependencies, decision: "rejected",
        diagnostic: Object.freeze({ code: "TSONIC_BORROWED_ASYNC_RESULT_ESCAPES", at: call,
          message: "An asynchronous result retaining a source-scoped lease across pending work cannot be discarded, stored or returned." }) });
    }
  }
  return Object.freeze({ kind: "resolved", call, disposition, dependencies,
    decision: disposition.kind === "discarded" ? "observe-discarded-rejection" : "admitted" });
}
