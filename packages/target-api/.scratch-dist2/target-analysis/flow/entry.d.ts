import { type SourceAnalysisProgram } from "../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import type { SourceDeclarationFlowExecutionRegion } from "./model.js";
export interface SourceFlowEntry<Region = SourceDeclarationFlowExecutionRegion> {
    readonly body: Node | undefined;
    readonly parameters: readonly (Node | undefined)[];
    readonly bodyExecution: Region | undefined;
    readonly entryInitializers: readonly SourceFlowInitializer<Region>[];
    readonly superInitializers: readonly SourceFlowInitializer<Region>[];
    readonly completionInitializers: readonly SourceFlowInitializer<Region>[];
    readonly syntaxRoots: readonly Node[];
    readonly rootExecutions: ReadonlyMap<Node, Region>;
}
export interface SourceFlowInitializer<Region = SourceDeclarationFlowExecutionRegion> {
    readonly node: Node;
    readonly execution: Region | undefined;
}
export declare function sourceDeclarationFlowEntry(source: SourceAnalysisProgram, declaration: Node, step: (node?: Node) => void): SourceFlowEntry<SourceDeclarationFlowExecutionRegion>;
//# sourceMappingURL=entry.d.ts.map