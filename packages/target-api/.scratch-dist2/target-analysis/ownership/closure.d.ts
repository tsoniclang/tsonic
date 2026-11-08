import type { SourceAnalysisProgram } from "../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import type { SourceFlowLimits } from "../flow/model.js";
import type { SourceDeclarationContinuationSelection, SourceDeclarationOwnershipBudget, SourceDeclarationOwnershipUnresolved } from "./model.js";
import { type createSourceDeclarationOwnershipValues, type SourceDeclarationContinuationFlowSelection } from "./flow.js";
import type { createSourceDeclarationRetentionQuery } from "./retention.js";
import type { SourceDeclarationSuspensionQueries } from "./suspension.js";
import type { SourceDeclarationContinuationDependencyQueries } from "./dependencies.js";
export declare function createSourceDeclarationContinuationClosureQuery(input: {
    readonly source: SourceAnalysisProgram;
    readonly context: ReturnType<typeof createSourceDeclarationOwnershipValues>;
    readonly budget: SourceDeclarationOwnershipBudget;
    readonly retention: ReturnType<typeof createSourceDeclarationRetentionQuery>;
    readonly suspensions: SourceDeclarationSuspensionQueries;
    readonly dependencies: SourceDeclarationContinuationDependencyQueries;
    readonly limits: Partial<SourceFlowLimits>;
}): Readonly<{
    forDeclaration: (declaration: Node) => SourceDeclarationContinuationFlowSelection | SourceDeclarationOwnershipUnresolved;
    forCall(call: Node): SourceDeclarationContinuationSelection;
}>;
//# sourceMappingURL=closure.d.ts.map