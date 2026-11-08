import { type SourceAnalysisProgram } from "../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import type { SourceControlFlowGraph, SourceFlowLimits, SourceDeclarationFlowExecutionRegion, SourceFlowUnresolved } from "../flow/model.js";
import type { SourceDeclarationOwnershipBudget, SourceDeclarationOwnershipValues, SourceDeclarationOwnershipUnresolved, SourceDeclarationContinuationDependency, SourceDeclarationPendingOperation } from "./model.js";
import type { SourceDeclarationContinuationDependencyQueries } from "./dependencies.js";
import type { SourceDeclarationSuspensionQueries } from "./suspension.js";
export declare function sourceDeclarationOwnershipFlowFailure(selected: SourceFlowUnresolved, fallback: Node): SourceDeclarationOwnershipUnresolved;
export declare function createSourceDeclarationOwnershipValues(input: {
    readonly source: SourceAnalysisProgram;
    readonly sourceNodes: readonly Node[];
    readonly nodes: readonly Node[];
    readonly budget: SourceDeclarationOwnershipBudget;
    readonly limits: Partial<SourceFlowLimits>;
}): Readonly<{
    values: SourceDeclarationOwnershipValues;
    graphFor: (declaration: Node) => SourceDeclarationOwnershipUnresolved | {
        readonly kind: "resolved";
        readonly graph: SourceControlFlowGraph<SourceDeclarationFlowExecutionRegion>;
    };
    declarationFor: (node: Node) => Node | SourceDeclarationOwnershipUnresolved;
    runtimeNodes: ReadonlySet<Node>;
}>;
export interface SourceDeclarationContinuationFlowSelection {
    readonly kind: "resolved";
    readonly declaration: Node;
    readonly dependencies: readonly SourceDeclarationContinuationDependency[];
    readonly maySuspend: boolean;
    readonly reads: readonly {
        readonly reference: Node;
        readonly candidate: Node;
        readonly region: SourceDeclarationFlowExecutionRegion;
        readonly pending: ReadonlySet<SourceDeclarationPendingOperation>;
    }[];
    readonly calls: readonly {
        readonly call: Node;
        readonly region: SourceDeclarationFlowExecutionRegion;
        readonly pending: ReadonlySet<SourceDeclarationPendingOperation>;
    }[];
}
export declare function resolveSourceDeclarationContinuationFlow(input: {
    readonly source: SourceAnalysisProgram;
    readonly graph: SourceControlFlowGraph<SourceDeclarationFlowExecutionRegion>;
    readonly runtimeNodes: ReadonlySet<Node>;
    readonly budget: SourceDeclarationOwnershipBudget;
    readonly suspensions: SourceDeclarationSuspensionQueries;
    readonly dependencies: SourceDeclarationContinuationDependencyQueries;
    readonly limits: Partial<SourceFlowLimits>;
}): SourceDeclarationContinuationFlowSelection | SourceDeclarationOwnershipUnresolved;
//# sourceMappingURL=flow.d.ts.map