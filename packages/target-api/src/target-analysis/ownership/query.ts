import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/types.js";
import type { SourceControlFlowOptions, SourceFlowLimits } from "../flow/model.js";
import type { SourceStorageBindings, SourceStorageQueries } from "../source-storage/model/types.js";
import type { SourceAsyncOwnershipSelection, SourceContinuationDependenciesSelection, SourceOwnershipBudget, SourceOwnershipPremises } from "./model.js";
import { sourceOwnershipUnresolved } from "./contracts.js";
import { createSourceContinuationClosureQuery } from "./closure.js";
import { decideSourceAsyncResultUse } from "./result-decision.js";
import { createSourceRetentionQuery } from "./retention.js";
import { resolveSourceAsyncResultDisposition } from "./result-use.js";
import type { SourceDeclarationAsyncOwnershipSelection, SourceDeclarationContinuationSelection,
  SourceDeclarationOwnershipBudget, SourceDeclarationOwnershipPremises } from "./model.js";
import { createSourceDeclarationOwnershipValues } from "./flow.js";
import { createSourceDeclarationRetentionQuery } from "./retention.js";
import { createSourceDeclarationSuspensionQuery } from "./suspension.js";
import { createSourceDeclarationContinuationDependencyQuery } from "./dependencies.js";
import { createSourceDeclarationContinuationClosureQuery } from "./closure.js";
import { decideSourceDeclarationAsyncResultUse } from "./result-decision.js";
import { resolveSourceDeclarationAsyncResultDisposition } from "./result-use.js";
import { sourceDeclarationOwnershipUnresolved } from "./contracts.js";

export function createSourceOwnershipQuery(input: {
  readonly source: TargetSourceProgram;
  readonly storage: SourceStorageQueries;
  readonly premises: SourceOwnershipPremises;
  readonly budget: SourceOwnershipBudget;
  readonly flowLimits?: Partial<SourceFlowLimits>;
  readonly domain?: SourceControlFlowOptions["domain"];
}) {
  const { source, storage, premises, budget } = input;
  const closure = createSourceContinuationClosureQuery(input);
  const retention = createSourceRetentionQuery(input);
  const decisions = new Map<Node, Map<SourceStorageBindings, SourceAsyncOwnershipSelection>>();
  const rows = budget.createRows();
  const invocationBindings = (call: Node, bindings: SourceStorageBindings | undefined) => bindings === undefined
    ? storage.bindingsForLexicalOwner(call) : { kind: "resolved" as const, bindings };
  const continuationFor = (call: Node, bindings?: SourceStorageBindings): SourceContinuationDependenciesSelection => {
    const selected = invocationBindings(call, bindings);
    return selected.kind === "unresolved" ? sourceOwnershipUnresolved(call, selected.reason)
      : closure.forInvocation(call, selected.bindings);
  };
  return Object.freeze({
    continuationFor,
    forCall(call: Node, bindings?: SourceStorageBindings): SourceAsyncOwnershipSelection {
      if (!budget.step()) return sourceOwnershipUnresolved(call, budget.failure()!);
      const context = invocationBindings(call, bindings);
      if (context.kind === "unresolved") return sourceOwnershipUnresolved(call, context.reason);
      bindings = context.bindings;
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
      const completion = premises.completionFor(call, selected, bindings);
      const disposition = completion.kind !== "async" ? undefined
        : resolveSourceAsyncResultDisposition(source, storage, call, budget, bindings);
      const decision = completion.kind !== "async" ? completion : decideSourceAsyncResultUse({ source, storage, budget, call, completion,
        disposition: disposition!, continuation: () => continuationFor(call, context.bindings),
        retention: () => retention.forReference(call, context.bindings) });
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

export function createSourceDeclarationOwnershipQuery(input: {
  readonly source: TargetSourceProgram;
  readonly nodes: readonly Node[];
  readonly premises: SourceDeclarationOwnershipPremises;
  readonly budget: SourceDeclarationOwnershipBudget;
  readonly flowLimits?: Partial<SourceFlowLimits>;
}) {
  const { source, budget } = input;
  const nodes = Object.freeze([...input.nodes]);
  const premises = Object.freeze({ completionFor: input.premises.completionFor,
    retentionFor: input.premises.retentionFor, suspensionFor: input.premises.suspensionFor });
  const limits = Object.freeze({ ...input.flowLimits });
  const context = createSourceDeclarationOwnershipValues({ source, nodes, budget, limits });
  const retention = createSourceDeclarationRetentionQuery({ source, values: context.values, premises, budget });
  const suspensions = createSourceDeclarationSuspensionQuery({ source, values: context.values, premises, budget });
  const dependencies = createSourceDeclarationContinuationDependencyQuery({ source, budget, retention, suspensions });
  const closure = createSourceDeclarationContinuationClosureQuery({ source, context, budget, retention, suspensions,
    dependencies, limits });
  const decisions = new Map<Node, SourceDeclarationAsyncOwnershipSelection>();
  const continuationFor = (call: Node): SourceDeclarationContinuationSelection => closure.forCall(call);
  return Object.freeze({
    continuationFor,
    forReference: retention.forReference,
    forCall(call: Node): SourceDeclarationAsyncOwnershipSelection {
      if (!budget.step(call)) return budget.failure()!;
      const existing = decisions.get(call);
      if (existing !== undefined) return existing;
      const file = source.ast.getSourceFile(call);
      if (file === undefined || !source.semantics.includes(file) || !source.ast.is.IsCallExpression(call))
        return sourceDeclarationOwnershipUnresolved(call, "Async ownership requires its original checked declaration-local call.");
      const selected = source.semantics.forNode(call).operations.call(call);
      if (selected?.sourceSelectedSignatureKind !== "resolved")
        return sourceDeclarationOwnershipUnresolved(call, "Async ownership requires the exact completed selected signature.");
      const completion = premises.completionFor(call, selected);
      const decision = completion.kind !== "async" ? completion : decideSourceDeclarationAsyncResultUse({
        source, budget, call, completion,
        disposition: resolveSourceDeclarationAsyncResultDisposition({ source, expression: call, budget,
          regionFor: context.values.regionFor }),
        continuation: () => continuationFor(call),
      });
      if (decision.kind === "unresolved") return decision;
      const rows = budget.createRows(call);
      if (!rows.add(1)) { rows.release(); return budget.failure()!; }
      decisions.set(call, decision);
      return decision;
    },
  });
}

export type SourceDeclarationOwnershipQueries = ReturnType<typeof createSourceDeclarationOwnershipQuery>;
