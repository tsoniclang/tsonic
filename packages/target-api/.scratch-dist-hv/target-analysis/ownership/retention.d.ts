import { type SourceAnalysisProgram } from "../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import type { SourceDeclarationOwnershipBudget, SourceDeclarationOwnershipPremises, SourceDeclarationOwnershipValue, SourceDeclarationOwnershipValues, SourceDeclarationRetentionReadSelection, SourceDeclarationRetentionSelection } from "./model.js";
export declare function createSourceDeclarationRetentionQuery(input: {
    readonly source: SourceAnalysisProgram;
    readonly values: SourceDeclarationOwnershipValues;
    readonly premises: Pick<SourceDeclarationOwnershipPremises, "retentionFor">;
    readonly budget: SourceDeclarationOwnershipBudget;
}): Readonly<{
    forValue(value: SourceDeclarationOwnershipValue): SourceDeclarationRetentionSelection;
    forReference(reference: Node): SourceDeclarationRetentionReadSelection;
}>;
//# sourceMappingURL=retention.d.ts.map