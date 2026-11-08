import { type SourceAnalysisProgram } from "../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import type { TargetDiagnosticSourceSpan } from "../../artifacts.js";
import type { SourceDeclarationOwnershipBudget, SourceDeclarationOwnershipPremises, SourceDeclarationOwnershipUnresolved } from "./model.js";
export { sourceGenericAdoptionDiagnosticMessage } from "./generic-adoption-diagnostics.js";
export declare const sourceGenericAdoptionDiagnosticCode = "TSONIC_GENERIC_ASYNC_ADOPTION_UNSUPPORTED";
export interface SourceGenericAdoptionIssue {
    readonly site: Node;
    readonly parameter: Node;
    readonly declaration: Node;
    readonly operation: Node;
    readonly message: string;
    readonly sourceSpan: TargetDiagnosticSourceSpan;
    readonly evidence: readonly string[];
}
export declare function analyzeSourceDeclarationGenericAdoption(input: {
    readonly source: SourceAnalysisProgram;
    readonly projectRoot: string;
    readonly nodes: readonly Node[];
    readonly premises: Pick<SourceDeclarationOwnershipPremises, "completionFor">;
    readonly budget: SourceDeclarationOwnershipBudget;
    readonly exemptTypeParameter?: (parameter: Node) => boolean;
}): {
    readonly kind: "resolved";
    readonly issues: readonly SourceGenericAdoptionIssue[];
} | SourceDeclarationOwnershipUnresolved;
//# sourceMappingURL=generic-adoption.d.ts.map