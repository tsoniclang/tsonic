import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/types.js";
import type { SourceStorageQueries } from "../source-storage/model/types.js";
import type { SourceAsyncCompletionSelection, SourceAsyncOwnershipSelection, SourceAsyncResultDisposition, SourceContinuationDependenciesSelection, SourceOwnershipBudget, SourceOwnershipUnresolved, SourceRetentionPremise, SourceRetentionReadSelection } from "./model.js";
import { sourceOwnershipContractProblem, sourceOwnershipUnresolved } from "./contracts.js";
import type { SourceDeclarationAsyncCompletionSelection, SourceDeclarationAsyncOwnershipSelection,
  SourceDeclarationAsyncResultDisposition, SourceDeclarationContinuationSelection, SourceDeclarationOwnershipBudget,
  SourceDeclarationOwnershipUnresolved } from "./model.js";
import { sourceDeclarationOwnershipContractProblem, sourceDeclarationOwnershipUnresolved } from "./contracts.js";

export function decideSourceAsyncResultUse(input: {
  readonly source: TargetSourceProgram;
  readonly storage: SourceStorageQueries;
  readonly budget: SourceOwnershipBudget;
  readonly call: Node;
  readonly completion: SourceAsyncCompletionSelection;
  readonly disposition: SourceAsyncResultDisposition | SourceOwnershipUnresolved;
  readonly continuation: () => SourceContinuationDependenciesSelection;
  readonly retention: () => SourceRetentionReadSelection;
}): SourceAsyncOwnershipSelection {
  const { source, storage, budget, call, completion, disposition } = input;
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
  // An explicit `void` is the author's discard decision; the must-observe rule refuses only implicit drops.
  if (completion.resultPolicy === "must-observe" && disposition.kind === "discarded" && !source.ast.is.IsVoidExpression(disposition.use)) {
    return Object.freeze({ kind: "resolved", call, disposition, dependencies: Object.freeze([]), decision: "rejected",
      diagnostic: Object.freeze({ code: "TSONIC_NATIVE_ASYNC_RESULT_DISCARDED", at: call,
        message: "A native asynchronous call result must be observed, not discarded." }) });
  }
  const continuation = input.continuation();
  let leases: readonly SourceRetentionPremise[];
  if (continuation.kind === "resolved") {
    leases = continuation.dependencies.map(dependency => dependency.retention);
  } else {
    const retention = input.retention();
    if (retention.kind === "unresolved" || retention.premises.length === 0) return continuation;
    if (retention.reference !== call) {
      return sourceOwnershipUnresolved(call, "Native async retention must describe this exact result-use call, not another source read.");
    }
    leases = retention.premises;
  }
  const dependencies = continuation.kind === "resolved" ? continuation.dependencies : Object.freeze([]);
  for (const lease of leases) {
    if (!budget.step()) return sourceOwnershipUnresolved(call, budget.failure()!);
    if (lease.kind !== "scoped-borrowed" && lease.kind !== "formal-borrowed") continue;
    if (disposition.kind === "passed" || disposition.kind === "consumed") {
      return sourceOwnershipUnresolved(disposition.use,
        "A borrowed async result requires a proven source-scoped consumer; its selected use alone does not prove the lease lifetime.");
    }
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
    } else if (completion.resultPolicy === "observe-rejection" || completion.resultPolicy === "native-discard") {
      return Object.freeze({ kind: "resolved", call, disposition, dependencies, decision: "rejected",
        diagnostic: Object.freeze({ code: "TSONIC_BORROWED_ASYNC_RESULT_ESCAPES", at: call,
          message: "An asynchronous result retaining a source-scoped lease across pending work cannot be discarded, stored or returned." }) });
    }
  }
  return Object.freeze({ kind: "resolved", call, disposition, dependencies,
    decision: disposition.kind !== "discarded" ? "admitted"
      : completion.resultPolicy === "observe-rejection" ? "observe-discarded-rejection" : "discard-native-result" });
}

export function decideSourceDeclarationAsyncResultUse(input: {
  readonly source: TargetSourceProgram;
  readonly budget: SourceDeclarationOwnershipBudget;
  readonly call: Node;
  readonly completion: SourceDeclarationAsyncCompletionSelection;
  readonly disposition: SourceDeclarationAsyncResultDisposition | SourceDeclarationOwnershipUnresolved;
  readonly continuation: () => SourceDeclarationContinuationSelection;
}): SourceDeclarationAsyncOwnershipSelection {
  const { source, budget, call, completion, disposition } = input;
  if (!budget.step(call)) return budget.failure()!;
  const file = source.ast.getSourceFile(call);
  if (file === undefined || !source.semantics.includes(file) || !source.ast.is.IsCallExpression(call))
    return sourceDeclarationOwnershipUnresolved(call, "Async result-use requires its exact checked source call.");
  if (completion.kind !== "async") return completion;
  const selected = source.semantics.forNode(call).operations.call(call);
  if (selected?.sourceSelectedSignatureKind !== "resolved")
    return sourceDeclarationOwnershipUnresolved(call, "Async result-use requires the exact selected checked signature.");
  const problem = sourceDeclarationOwnershipContractProblem(source, call,
    { selectedType: selected.sourceResultType }, completion.contract);
  if (problem !== undefined) return sourceDeclarationOwnershipUnresolved(call, problem);
  if (disposition.kind === "unresolved") return disposition;
  if (completion.resultPolicy === "must-observe" && disposition.kind === "discarded" &&
    !source.ast.is.IsVoidExpression(disposition.use))
    return Object.freeze({ kind: "resolved", call, disposition, dependencies: Object.freeze([]), decision: "rejected",
      diagnostic: Object.freeze({ code: "TSONIC_NATIVE_ASYNC_RESULT_DISCARDED", at: call,
        message: "A native asynchronous call result must be observed, not discarded." }) });
  const continuation = input.continuation();
  if (continuation.kind === "unresolved") return continuation;
  const dependencies = continuation.dependencies;
  const leases = dependencies.map(dependency => dependency.retention);
  for (const lease of leases) {
    if (!budget.step(call)) return budget.failure()!;
    if (lease.kind !== "scoped-borrowed" && lease.kind !== "formal-borrowed") continue;
    if (disposition.kind === "passed" || disposition.kind === "consumed")
      return sourceDeclarationOwnershipUnresolved(disposition.use,
        "A selected async consumer does not prove this caller's exact borrowed-input lifetime.");
    if (disposition.kind === "awaited-in-scope") {
      const owner = lease.kind === "scoped-borrowed" ? lease.region : lease.value.region.owner;
      let current: Node | undefined = disposition.use;
      const visited = new Set<Node>();
      while (current !== undefined && current !== owner) {
        if (!budget.step(call)) return budget.failure()!;
        if (visited.has(current))
          return sourceDeclarationOwnershipUnresolved(call, "An awaited lease has cyclic checked ancestry.");
        visited.add(current);
        current = source.ast.parent(current);
      }
      if (current === undefined || disposition.region.owner !== lease.value.region.owner)
        return sourceDeclarationOwnershipUnresolved(disposition.use,
          "The actual await must be inside the same checked region and native lease owner.");
    } else if (completion.resultPolicy === "observe-rejection" || completion.resultPolicy === "native-discard")
      return Object.freeze({ kind: "resolved", call, disposition, dependencies, decision: "rejected",
        diagnostic: Object.freeze({ code: "TSONIC_BORROWED_ASYNC_RESULT_ESCAPES", at: call,
          message: "An asynchronous result retaining a source-scoped lease across pending work cannot be discarded, stored or returned." }) });
  }
  return Object.freeze({ kind: "resolved", call, disposition, dependencies,
    decision: disposition.kind !== "discarded" ? "admitted"
      : completion.resultPolicy === "observe-rejection" ? "observe-discarded-rejection" : "discard-native-result" });
}
