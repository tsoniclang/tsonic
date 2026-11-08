import { type SourceAnalysisProgram } from "../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import type { SourceDeclarationOwnershipBudget, SourceDeclarationOwnershipPremises, SourceDeclarationOwnershipValues, SourceDeclarationPendingOperation, SourceDeclarationPendingSelection } from "./model.js";
export declare function createSourceDeclarationSuspensionQuery(input: {
    readonly source: SourceAnalysisProgram;
    readonly values: SourceDeclarationOwnershipValues;
    readonly premises: Pick<SourceDeclarationOwnershipPremises, "suspensionFor">;
    readonly budget: SourceDeclarationOwnershipBudget;
}): Readonly<{
    owns: (witness: SourceDeclarationPendingOperation) => boolean;
    forAwait(operation: Node): SourceDeclarationPendingSelection;
    forResourceCleanup(declaration: Node): SourceDeclarationPendingSelection;
    forCall(call: Node): SourceDeclarationPendingSelection;
    forResult(expression: Node): SourceDeclarationPendingSelection;
}>;
export type SourceDeclarationSuspensionQueries = ReturnType<typeof createSourceDeclarationSuspensionQuery>;
//# sourceMappingURL=suspension.d.ts.map