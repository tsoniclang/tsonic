import type { Node } from "@tsonic/tsts";
import type { SourceFlowConditions, SourceValueFlowQueryContext } from "./value-flow-model.js";
/**
 * The flow conditions at a reference: the checker flow-condition witness (host-input) plus every enclosing guard the
 * Host proves still holds for the binding (sourceGuardPreservesBinding). Undefined when the work budget is exhausted.
 */
export declare function resolveSourceFlowConditions(context: Pick<SourceValueFlowQueryContext, "ast" | "navigation" | "sourceFacts" | "effects">, reference: Node, checked: SourceFlowConditions | undefined): SourceFlowConditions | undefined;
//# sourceMappingURL=flow-conditions.d.ts.map