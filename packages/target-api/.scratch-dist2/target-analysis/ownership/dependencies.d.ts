import { type SourceAnalysisProgram } from "../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import type { SourceDeclarationContinuationSelection, SourceDeclarationOwnershipBudget, SourceDeclarationPendingOperation } from "./model.js";
import type { SourceDeclarationSuspensionQueries } from "./suspension.js";
import type { createSourceDeclarationRetentionQuery } from "./retention.js";
export declare function createSourceDeclarationContinuationDependencyQuery(input: {
    readonly source: SourceAnalysisProgram;
    readonly budget: SourceDeclarationOwnershipBudget;
    readonly suspensions: SourceDeclarationSuspensionQueries;
    readonly retention: ReturnType<typeof createSourceDeclarationRetentionQuery>;
}): Readonly<{
    forRead(state: ReadonlySet<SourceDeclarationPendingOperation>, reference: Node, candidate: Node): SourceDeclarationContinuationSelection;
}>;
export type SourceDeclarationContinuationDependencyQueries = ReturnType<typeof createSourceDeclarationContinuationDependencyQuery>;
//# sourceMappingURL=dependencies.d.ts.map