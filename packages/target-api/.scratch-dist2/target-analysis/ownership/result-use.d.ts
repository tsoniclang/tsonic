import { type SourceAnalysisProgram } from "../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import type { SourceDeclarationFlowExecutionRegion } from "../flow/model.js";
import type { SourceDeclarationAsyncResultDisposition, SourceDeclarationOwnershipBudget, SourceDeclarationOwnershipUnresolved } from "./model.js";
import { type createSourceDeclarationParameterUseQuery } from "./contracts.js";
export declare function resolveSourceDeclarationAsyncResultDisposition(input: {
    readonly source: SourceAnalysisProgram;
    readonly expression: Node;
    readonly budget: SourceDeclarationOwnershipBudget;
    readonly regionFor: (node: Node) => SourceDeclarationFlowExecutionRegion | SourceDeclarationOwnershipUnresolved;
    readonly parameterUses: ReturnType<typeof createSourceDeclarationParameterUseQuery>;
}): SourceDeclarationAsyncResultDisposition | SourceDeclarationOwnershipUnresolved;
//# sourceMappingURL=result-use.d.ts.map