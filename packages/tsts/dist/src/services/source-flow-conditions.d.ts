import type { GoPtr } from "../go/compat.js";
import type { Node } from "../internal/ast/spine.js";
import type { Checker } from "../internal/checker/checker/state.js";
export interface ResolvedSourceFlowCondition {
    readonly expression: Node;
    readonly assumed: boolean;
    readonly assignments: readonly Node[];
}
export interface ResolvedSourceFlowConditionInfo {
    readonly reference: Node;
    readonly conditions: readonly ResolvedSourceFlowCondition[];
}
export declare function resolveSourceFlowConditionInfo(checker: GoPtr<Checker>, reference: GoPtr<Node>): GoPtr<ResolvedSourceFlowConditionInfo>;
//# sourceMappingURL=source-flow-conditions.d.ts.map