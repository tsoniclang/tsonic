import type { Node } from "@tsonic/tsts";
import type { SourceControlFlowGraph, SourceFlowLimits, SourceFlowSolution, SourceFlowUnresolved } from "./model.js";
export type SourceFlowWriteCount = 0 | 1 | 2;
export type SourceFlowLivenessSelection = SourceFlowUnresolved | (Extract<SourceFlowSolution<ReadonlySet<Node>>, {
    kind: "resolved";
}> & {
    readonly lastUsePoints: ReadonlySet<number>;
    readonly lastUses: ReadonlySet<Node>;
});
export type SourceFlowDefiniteAssignmentSelection = SourceFlowUnresolved | (Extract<SourceFlowSolution<ReadonlySet<Node>>, {
    kind: "resolved";
}> & {
    readonly unassignedReads: ReadonlySet<Node>;
});
export type SourceFlowWritesSelection = SourceFlowUnresolved | (Extract<SourceFlowSolution<ReadonlyMap<Node, SourceFlowWriteCount>>, {
    kind: "resolved";
}> & {
    readonly maximum: ReadonlyMap<Node, SourceFlowWriteCount>;
});
export declare function analyzeSourceLiveness(graph: SourceControlFlowGraph<unknown>, additionalReads: ReadonlyMap<number, readonly Node[]>, limits?: Partial<SourceFlowLimits>): SourceFlowLivenessSelection;
export declare function analyzeSourceDefiniteAssignment(graph: SourceControlFlowGraph<unknown>, limits?: Partial<SourceFlowLimits>): SourceFlowDefiniteAssignmentSelection;
export declare function analyzeSourceWrites(graph: SourceControlFlowGraph<unknown>, limits?: Partial<SourceFlowLimits>): SourceFlowWritesSelection;
//# sourceMappingURL=instances.d.ts.map