import type { AstReader, Node, ReadonlySourceFactResolver } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "../source-navigation/types.js";
import type { SourceExpressionEffects } from "../source-navigation/records.js";
import type { SourceValueFacts } from "../public/source/facts.js";
/** One condition the checker's flow analysis applies at a reference (host-input witness; Node-only). */
export interface SourceFlowCondition {
    readonly expression: Node;
    readonly assumed: boolean;
    /** Assignments between the condition and the reference. */
    readonly assignments: readonly Node[];
}
/** The flow conditions at a reference: the checker witness plus the Host-retained guards (flow-conditions.ts). */
export interface SourceFlowConditions {
    readonly reference: Node;
    readonly conditions: readonly SourceFlowCondition[];
}
/** The Host services the value-flow selectors read. No checker access (I3). */
export interface SourceValueFlowQueryContext {
    readonly ast: AstReader;
    readonly navigation: SourceProgramNavigation;
    readonly sourceFacts?: ReadonlySourceFactResolver;
    /** The retained flow conditions at a reference (HostSourceProgram.flowConditions). */
    flowConditions(reference: Node): SourceFlowConditions | undefined;
    /** The Host value facts (guard operands are classified by their Host descriptor, R3). */
    readonly values: Pick<SourceValueFacts, "type">;
    /** The evaluation effects of an expression: the role model owner (facts.navigation.expressions.effects). */
    effects(expression: Node): SourceExpressionEffects;
}
export interface SourceNativeGuard<Predicate> {
    readonly sourceOperand: Node;
    readonly predicate: Predicate;
}
//# sourceMappingURL=value-flow-model.d.ts.map