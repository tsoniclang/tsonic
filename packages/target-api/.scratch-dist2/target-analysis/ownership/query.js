import { sourceAnalysisIncludesFile } from "../analysis-program.js";
import { createSourceDeclarationOwnershipValues } from "./flow.js";
import { createSourceDeclarationRetentionQuery } from "./retention.js";
import { createSourceDeclarationSuspensionQuery } from "./suspension.js";
import { createSourceDeclarationContinuationDependencyQuery } from "./dependencies.js";
import { createSourceDeclarationContinuationClosureQuery } from "./closure.js";
import { decideSourceDeclarationAsyncResultUse } from "./result-decision.js";
import { resolveSourceDeclarationAsyncResultDisposition } from "./result-use.js";
import { sourceDeclarationOwnershipUnresolved, createSourceDeclarationParameterUseQuery } from "./contracts.js";
export function createSourceDeclarationOwnershipQuery(input) {
    const { source, budget } = input;
    const sourceNodes = Object.freeze([...input.sourceNodes]);
    const nodes = Object.freeze([...input.nodes]);
    const premises = Object.freeze({ completionFor: input.premises.completionFor,
        retentionFor: input.premises.retentionFor, suspensionFor: input.premises.suspensionFor });
    const limits = Object.freeze({ ...input.flowLimits });
    const context = createSourceDeclarationOwnershipValues({ source, sourceNodes, nodes, budget, limits });
    const parameterUses = createSourceDeclarationParameterUseQuery({ source, budget });
    const retention = createSourceDeclarationRetentionQuery({ source, values: context.values, premises, budget });
    const suspensions = createSourceDeclarationSuspensionQuery({ source, values: context.values, premises, budget });
    const dependencies = createSourceDeclarationContinuationDependencyQuery({ source, budget, retention, suspensions });
    const closure = createSourceDeclarationContinuationClosureQuery({ source, context, budget, retention, suspensions,
        dependencies, limits });
    const decisions = new Map();
    const continuationFor = (call) => closure.forCall(call);
    return Object.freeze({
        continuationForDeclaration: closure.forDeclaration,
        continuationFor,
        forReference: retention.forReference,
        forCall(call) {
            if (!budget.step(call))
                return budget.failure();
            const existing = decisions.get(call);
            if (existing !== undefined)
                return existing;
            const file = source.ast.getSourceFile(call);
            if (!sourceAnalysisIncludesFile(source, file) || !source.ast.is.IsCallExpression(call))
                return sourceDeclarationOwnershipUnresolved(call, "Async ownership requires its original checked declaration-local call.");
            const selected = source.navigation.call(call);
            if (selected?.selection !== "resolved")
                return sourceDeclarationOwnershipUnresolved(call, "Async ownership requires the exact completed selected signature.");
            const published = source.facts.selections.call(call);
            if (published === undefined || published.kind === "refused")
                return sourceDeclarationOwnershipUnresolved(call, "Async ownership requires the published call selection.");
            const completion = premises.completionFor(call, published);
            const decision = completion.kind !== "async" ? completion : decideSourceDeclarationAsyncResultUse({
                source, budget, call, completion,
                disposition: resolveSourceDeclarationAsyncResultDisposition({ source, expression: call, budget,
                    regionFor: context.values.regionFor, parameterUses }),
                continuation: () => continuationFor(call),
                retention: reference => retention.forReference(reference),
            });
            if (decision.kind === "unresolved")
                return decision;
            const rows = budget.createRows(call);
            if (!rows.add(1)) {
                rows.release();
                return budget.failure();
            }
            decisions.set(call, decision);
            return decision;
        },
    });
}
//# sourceMappingURL=query.js.map