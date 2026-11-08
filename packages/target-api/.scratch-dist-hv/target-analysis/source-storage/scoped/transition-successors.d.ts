import type { SourceAnalysisProgram } from "../../analysis-program.js";
import type { SourceStorageTerm, SourceStorageReduction } from "../graph/scoped-model.js";
import type { SourceStorageScopes } from "./scoped-scopes.js";
import type { createSourceStorageExecutionContext } from "./execution-context.js";
interface SourceStorageTransitionSuccessorContext extends Pick<ReturnType<typeof createSourceStorageExecutionContext>, "instanceCaptures"> {
    readonly source: SourceAnalysisProgram;
    readonly scopes: SourceStorageScopes;
    readonly absent: Extract<SourceStorageReduction, {
        readonly kind: "replace";
    }>;
}
export declare function createSourceStorageTransitionSuccessors(context: SourceStorageTransitionSuccessorContext): (term: Extract<SourceStorageTerm, {
    readonly kind: "transition";
}>) => SourceStorageReduction | undefined;
export {};
//# sourceMappingURL=transition-successors.d.ts.map