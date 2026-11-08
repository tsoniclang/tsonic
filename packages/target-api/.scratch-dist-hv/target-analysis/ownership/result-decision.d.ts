import { type SourceAnalysisProgram } from "../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import type { SourceDeclarationAsyncCompletionSelection, SourceDeclarationAsyncOwnershipSelection, SourceDeclarationAsyncResultDisposition, SourceDeclarationContinuationSelection, SourceDeclarationOwnershipBudget, SourceDeclarationOwnershipUnresolved, SourceDeclarationRetentionReadSelection } from "./model.js";
export declare function decideSourceDeclarationAsyncResultUse(input: {
    readonly source: SourceAnalysisProgram;
    readonly budget: SourceDeclarationOwnershipBudget;
    readonly call: Node;
    readonly completion: SourceDeclarationAsyncCompletionSelection;
    readonly disposition: SourceDeclarationAsyncResultDisposition | SourceDeclarationOwnershipUnresolved;
    readonly continuation: () => SourceDeclarationContinuationSelection;
    readonly retention: (reference: Node) => SourceDeclarationRetentionReadSelection;
}): SourceDeclarationAsyncOwnershipSelection;
//# sourceMappingURL=result-decision.d.ts.map