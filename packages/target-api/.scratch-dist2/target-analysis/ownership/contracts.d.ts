import { type SourceAnalysisProgram } from "../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import type { SourceDeclarationOwnershipBudget, SourceDeclarationOwnershipComponent, SourceDeclarationOwnershipContract, SourceDeclarationOwnershipLimits, SourceDeclarationOwnershipUnresolved } from "./model.js";
export declare const defaultSourceDeclarationOwnershipLimits: SourceDeclarationOwnershipLimits;
export declare function sourceDeclarationOwnershipUnresolved(at: Node, reason: string): SourceDeclarationOwnershipUnresolved;
export declare function createSourceDeclarationParameterUseQuery(input: {
    readonly source: SourceAnalysisProgram;
    readonly budget: SourceDeclarationOwnershipBudget;
}): Readonly<{
    forArgument(call: Node, argument: Node): {
        readonly kind: "resolved";
        readonly declaration: Node;
        readonly parameter: Node;
        readonly use: "result" | "retained";
        readonly sites: readonly Node[];
        readonly contract: SourceDeclarationOwnershipContract;
    } | SourceDeclarationOwnershipUnresolved;
}>;
export declare function createSourceDeclarationOwnershipBudget(subject: Node, limits: SourceDeclarationOwnershipLimits): SourceDeclarationOwnershipBudget;
export declare function sourceDeclarationOwnershipContractProblem(source: SourceAnalysisProgram, node: Node, component: SourceDeclarationOwnershipComponent, contract: SourceDeclarationOwnershipContract): string | undefined;
//# sourceMappingURL=contracts.d.ts.map