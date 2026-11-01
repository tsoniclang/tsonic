import { type Node } from "@tsonic/tsts";
import type { SourceDeclarationOwnershipBudget } from "../../../../../packages/target-api/src/target-analysis/ownership/model.js";
import type { SourceDeclarationOwnershipPremises } from "../../../../../packages/target-api/src/target-analysis/ownership/model.js";
export interface NativeFixtureLifetimeContract {
    readonly scope: string;
    readonly getter?: string;
    readonly owner: string;
    readonly bindings?: readonly string[];
    readonly results?: readonly string[];
    readonly fields?: readonly {
        readonly receiver: string;
        readonly member: string;
    }[];
}
export declare function fixture(reverse: boolean, recursive: "self" | "mutual", additional?: string, nativeLifetimes?: readonly NativeFixtureLifetimeContract[]): {
    source: import("../../../../../packages/target-api/src/source-semantics/types.js").TargetSourceProgram;
    sourceNodes: readonly Node[];
    nodes: readonly Node[];
    storage: import("../../../../../packages/target-api/src/target-analysis/index.js").SourceStorageQueries;
    budget: SourceDeclarationOwnershipBudget;
    context: Readonly<{
        values: import("../../../../../packages/target-api/src/target-analysis/ownership/model.js").SourceDeclarationOwnershipValues;
        graphFor: (declaration: Node) => import("../../../../../packages/target-api/src/target-analysis/ownership/model.js").SourceDeclarationOwnershipUnresolved | {
            readonly kind: "resolved";
            readonly graph: import("../../../../../packages/target-api/src/target-analysis/index.js").SourceControlFlowGraph<import("../../../../../packages/target-api/src/target-analysis/index.js").SourceDeclarationFlowExecutionRegion>;
        };
        declarationFor: (node: Node) => Node | import("../../../../../packages/target-api/src/target-analysis/ownership/model.js").SourceDeclarationOwnershipUnresolved;
        runtimeNodes: ReadonlySet<Node>;
    }>;
    values: import("../../../../../packages/target-api/src/target-analysis/ownership/model.js").SourceDeclarationOwnershipValues;
    premises: SourceDeclarationOwnershipPremises;
    query: Readonly<{
        continuationForDeclaration: (declaration: Node) => import("../../../../../packages/target-api/src/target-analysis/ownership/flow.js").SourceDeclarationContinuationFlowSelection | import("../../../../../packages/target-api/src/target-analysis/ownership/model.js").SourceDeclarationOwnershipUnresolved;
        continuationFor: (call: Node) => import("../../../../../packages/target-api/src/target-analysis/ownership/model.js").SourceDeclarationContinuationSelection;
        forReference: (reference: Node) => import("../../../../../packages/target-api/src/target-analysis/ownership/model.js").SourceDeclarationRetentionReadSelection;
        forCall(call: Node): import("../../../../../packages/target-api/src/target-analysis/ownership/model.js").SourceDeclarationAsyncOwnershipSelection;
    }>;
    callIn: (name: string) => Node;
    declaration: (name: string) => Node;
    selectedDeclaration: (call: Node) => Node | undefined;
    continuation: (premises: SourceDeclarationOwnershipPremises, budget: SourceDeclarationOwnershipBudget) => {
        context: Readonly<{
            values: import("../../../../../packages/target-api/src/target-analysis/ownership/model.js").SourceDeclarationOwnershipValues;
            graphFor: (declaration: Node) => import("../../../../../packages/target-api/src/target-analysis/ownership/model.js").SourceDeclarationOwnershipUnresolved | {
                readonly kind: "resolved";
                readonly graph: import("../../../../../packages/target-api/src/target-analysis/index.js").SourceControlFlowGraph<import("../../../../../packages/target-api/src/target-analysis/index.js").SourceDeclarationFlowExecutionRegion>;
            };
            declarationFor: (node: Node) => Node | import("../../../../../packages/target-api/src/target-analysis/ownership/model.js").SourceDeclarationOwnershipUnresolved;
            runtimeNodes: ReadonlySet<Node>;
        }>;
        closure: Readonly<{
            forDeclaration: (declaration: Node) => import("../../../../../packages/target-api/src/target-analysis/ownership/flow.js").SourceDeclarationContinuationFlowSelection | import("../../../../../packages/target-api/src/target-analysis/ownership/model.js").SourceDeclarationOwnershipUnresolved;
            forCall(call: Node): import("../../../../../packages/target-api/src/target-analysis/ownership/model.js").SourceDeclarationContinuationSelection;
        }>;
    };
};
