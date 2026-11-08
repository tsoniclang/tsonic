import { type SourceAnalysisProgram } from "../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import type { SourceFlowLimits } from "../flow/model.js";
import type { SourceDeclarationAsyncOwnershipSelection, SourceDeclarationContinuationSelection, SourceDeclarationOwnershipBudget, SourceDeclarationOwnershipPremises } from "./model.js";
export declare function createSourceDeclarationOwnershipQuery(input: {
    readonly source: SourceAnalysisProgram;
    readonly sourceNodes: readonly Node[];
    readonly nodes: readonly Node[];
    readonly premises: SourceDeclarationOwnershipPremises;
    readonly budget: SourceDeclarationOwnershipBudget;
    readonly flowLimits?: Partial<SourceFlowLimits>;
}): Readonly<{
    continuationForDeclaration: (declaration: Node) => import("./flow.js").SourceDeclarationContinuationFlowSelection | import("./model.js").SourceDeclarationOwnershipUnresolved;
    continuationFor: (call: Node) => SourceDeclarationContinuationSelection;
    forReference: (reference: Node) => import("./model.js").SourceDeclarationRetentionReadSelection;
    forCall(call: Node): SourceDeclarationAsyncOwnershipSelection;
}>;
export type SourceDeclarationOwnershipQueries = ReturnType<typeof createSourceDeclarationOwnershipQuery>;
//# sourceMappingURL=query.d.ts.map