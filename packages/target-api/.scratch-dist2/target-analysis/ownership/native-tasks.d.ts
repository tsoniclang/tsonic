import type { SourceAnalysisProgram } from "../analysis-program.js";
import type { Node, SourceFile } from "@tsonic/tsts";
import type { SourceDeclarationOwnershipBudget, SourceDeclarationOwnershipContract, SourceDeclarationOwnershipUnresolved, SourceDeclarationOwnershipValues } from "./model.js";
export interface SourceNativeTaskSpawn {
    readonly node: Node;
    readonly operand: Node;
    readonly owner: Node;
}
export interface SourceDeclarationNativeTaskScope {
    readonly kind: "parameter" | "capture" | "none";
    readonly contract: SourceDeclarationOwnershipContract;
}
export declare function analyzeSourceDeclarationNativeTaskGraph(input: {
    readonly source: SourceAnalysisProgram;
    readonly values: SourceDeclarationOwnershipValues;
    readonly nodes: readonly Node[];
    readonly spawns: readonly {
        readonly node: Node;
        readonly operand: Node;
    }[];
    readonly lifecycleOwner: SourceFile | undefined;
    readonly publishedDeclarations: ReadonlySet<Node>;
    readonly scopeFor: (declaration: Node) => SourceDeclarationOwnershipUnresolved | SourceDeclarationNativeTaskScope;
    readonly budget: SourceDeclarationOwnershipBudget;
}): {
    readonly kind: "resolved";
    readonly graph: SourceNativeTaskGraph;
} | {
    readonly kind: "unresolved";
    readonly issues: readonly SourceNativeTaskIssue[];
} | SourceDeclarationOwnershipUnresolved;
export interface SourceNativeTaskGraph {
    readonly lifecycleOwner: SourceFile | undefined;
    readonly spawns: readonly SourceNativeTaskSpawn[];
    readonly owners: readonly Node[];
    readonly parameterOwners: ReadonlySet<Node>;
    readonly calls: readonly {
        readonly node: Node;
        readonly owner: Node;
        readonly targets: readonly Node[];
    }[];
    readonly entries: readonly Node[];
}
export interface SourceNativeTaskIssue {
    readonly kind: "lifecycle-owner" | "scope-owner" | "call-graph" | "public-scope";
    readonly node: Node;
    readonly reason: string;
}
//# sourceMappingURL=native-tasks.d.ts.map