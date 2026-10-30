import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/types.js";
import type { SourceFlowLimits } from "../flow/model.js";
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
