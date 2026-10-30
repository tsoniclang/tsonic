import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/types.js";
import type { SourceFlowLimits } from "../flow/model.js";
import type { SourceDeclarationContinuationDependency, SourceDeclarationContinuationSelection,
  SourceDeclarationOwnershipBudget, SourceDeclarationOwnershipUnresolved } from "./model.js";
import { resolveSourceDeclarationContinuationFlow, type createSourceDeclarationOwnershipValues,
  type SourceDeclarationContinuationFlowSelection } from "./flow.js";
import type { createSourceDeclarationRetentionQuery } from "./retention.js";
import type { SourceDeclarationSuspensionQueries } from "./suspension.js";
import type { SourceDeclarationContinuationDependencyQueries } from "./dependencies.js";
import { sourceDeclarationOwnershipUnresolved } from "./contracts.js";

export function createSourceDeclarationContinuationClosureQuery(input: {
  readonly source: TargetSourceProgram;
  readonly context: ReturnType<typeof createSourceDeclarationOwnershipValues>;
  readonly budget: SourceDeclarationOwnershipBudget;
  readonly retention: ReturnType<typeof createSourceDeclarationRetentionQuery>;
  readonly suspensions: SourceDeclarationSuspensionQueries;
  readonly dependencies: SourceDeclarationContinuationDependencyQueries;
  readonly limits: Partial<SourceFlowLimits>;
}) {
  const { source, budget } = input;
  const declarations = new Map<Node, SourceDeclarationContinuationFlowSelection>();
  const calls = new Map<Node, SourceDeclarationContinuationSelection>();
  const forDeclaration = (declaration: Node): SourceDeclarationContinuationFlowSelection | SourceDeclarationOwnershipUnresolved => {
    if (!budget.step(declaration)) return budget.failure()!;
    const existing = declarations.get(declaration);
    if (existing !== undefined) return existing;
    const graph = input.context.graphFor(declaration);
    if (graph.kind === "unresolved") return graph;
    const selected = resolveSourceDeclarationContinuationFlow({ source, graph: graph.graph, budget,
      suspensions: input.suspensions, dependencies: input.dependencies, limits: input.limits });
    if (selected.kind === "unresolved") return selected;
    const rows = budget.createRows(declaration);
    if (!rows.add(1)) { rows.release(); return budget.failure()!; }
    declarations.set(declaration, selected);
    return selected;
  };
  return Object.freeze({
    forDeclaration,
    forCall(call: Node): SourceDeclarationContinuationSelection {
      if (!budget.step(call)) return budget.failure()!;
      const existing = calls.get(call);
      if (existing !== undefined) return existing;
      const file = source.ast.getSourceFile(call);
      if (file === undefined || !source.semantics.includes(file) ||
        !source.ast.is.IsCallExpression(call) && !source.ast.is.IsNewExpression(call))
        return sourceDeclarationOwnershipUnresolved(call, "A native continuation requires its original checked call operation.");
      const semantics = source.semantics.forNode(call);
      const selected = semantics.operations.call(call);
      const declaration = selected?.sourceSelectedSignatureKind === "resolved"
        ? semantics.declarations.signatureDeclaration(selected.selectedSignature) : undefined;
      if (declaration === undefined)
        return sourceDeclarationOwnershipUnresolved(call, "A native continuation needs its exact selected declaration contract.");
      const body = source.ast.body(declaration);
      let declarationDependencies: readonly SourceDeclarationContinuationDependency[] = [];
      if (body !== undefined && source.navigation.isProjectDeclaration(declaration)) {
        const summary = forDeclaration(declaration);
        if (summary.kind === "unresolved") return summary;
        declarationDependencies = summary.dependencies;
      }
      const pending = input.suspensions.forCall(call);
      if (pending.kind === "unresolved") return pending;
      const rows = budget.createRows(call);
      let published = false;
      try {
        const dependencies: SourceDeclarationContinuationDependency[] = [];
        for (const dependency of declarationDependencies) {
          if (!budget.step(dependency.reference) || !rows.add(1)) return budget.failure()!;
          dependencies.push(dependency);
        }
        if (pending.kind === "resolved") {
          const retained = input.retention.forReference(call);
          if (retained.kind === "unresolved") return retained;
          for (const premise of retained.premises) {
            if (premise.kind === "retained" && premise.reason === "owned-value") continue;
            if (!budget.step(call) || !rows.add(1)) return budget.failure()!;
            dependencies.push(Object.freeze({ candidate: declaration, reference: call, actual: premise.value,
              suspension: pending.pending, retention: premise }));
          }
        }
        if (!rows.add(1)) return budget.failure()!;
        const result = Object.freeze({ kind: "resolved" as const, dependencies: Object.freeze(dependencies) });
        calls.set(call, result);
        published = true;
        return result;
      } finally { if (!published) rows.release(); }
    },
  });
}
