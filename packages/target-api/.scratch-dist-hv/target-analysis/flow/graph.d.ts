import type { SourceAnalysisProgram } from "../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import type { SourceControlFlowSelectedDomain, SourceControlFlowSelection, SourceDeclarationControlFlowOptions, SourceDeclarationFlowExecutionRegion, SourceFlowUnresolved } from "./model.js";
export declare function createSourceControlFlowDomain(source: SourceAnalysisProgram, nodes: readonly Node[]): {
    readonly kind: "resolved";
    readonly domain: SourceControlFlowSelectedDomain;
} | SourceFlowUnresolved;
export declare function createSourceDeclarationControlFlow(source: SourceAnalysisProgram, declaration: Node, options: SourceDeclarationControlFlowOptions): SourceControlFlowSelection<SourceDeclarationFlowExecutionRegion>;
//# sourceMappingURL=graph.d.ts.map