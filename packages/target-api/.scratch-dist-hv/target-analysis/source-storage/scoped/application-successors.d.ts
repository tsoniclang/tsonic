import type { SourceAnalysisProgram } from "../../analysis-program.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import { type SourceStorageTerm, type SourceStorageReduction } from "../graph/scoped-model.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
import type { SourceStorageScopes } from "./scoped-scopes.js";
import type { createSourceStorageEquations } from "./scoped-equations.js";
import type { createSourceStorageExecutionContext } from "./execution-context.js";
import type { createSourceStorageInputExecutions } from "./execution-reachability.js";
import type { createSourceStorageScopedRejections } from "./rejections.js";
import type { SourceStorageChildContext, SourceStoragePendingReduction } from "./child-reduction.js";
interface SourceStorageApplicationSuccessorContext extends Pick<ReturnType<typeof createSourceStorageExecutionContext>, "dispatchDependencies" | "independentCalleeFor" | "regionsFor" | "classLineages" | "leaf"> {
    readonly source: SourceAnalysisProgram;
    readonly budget: SourceStorageBudget;
    readonly transport: SourceStorageScopedTransport;
    readonly scopes: SourceStorageScopes;
    readonly equations: Pick<ReturnType<typeof createSourceStorageEquations>, "scopeFor">;
    readonly absent: Extract<SourceStorageReduction, {
        readonly kind: "replace";
    }>;
    readonly nativeInputExecutions: ReturnType<typeof createSourceStorageInputExecutions>["nativeInputExecutions"];
    readonly conditionalExecutions: ReturnType<typeof createSourceStorageInputExecutions>["conditionalExecutions"];
    readonly rejections: Pick<ReturnType<typeof createSourceStorageScopedRejections>, "callableThrows">;
    replaceChild(child: SourceStorageTerm, replace: (child: SourceStorageTerm) => SourceStorageTerm, context?: SourceStorageChildContext): SourceStoragePendingReduction | undefined;
}
export declare function createSourceStorageApplicationSuccessors(context: SourceStorageApplicationSuccessorContext): (term: Extract<SourceStorageTerm, {
    readonly kind: "application";
}>) => SourceStoragePendingReduction | undefined;
export {};
//# sourceMappingURL=application-successors.d.ts.map