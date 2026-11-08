import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "./types.js";
import type { SourceExpressionResultDisposition } from "./expression-use-model.js";
export declare function sourceImmediatelyAwaitedLocal(ast: AstReader, navigation: Pick<SourceProgramNavigation, "declarationUseSummary" | "declarationUses" | "expressionResultDisposition">, call: Node): boolean;
export declare function sourceExpressionSelectsOperandValue(ast: AstReader, expression: Node, operand: Node): boolean;
export declare function sourceExpressionResultDisposition(ast: AstReader, expression: Node): SourceExpressionResultDisposition;
export declare function sourceExpressionResultUse(ast: AstReader, expression: Node): "consumed" | "discarded";
export declare function sourceCallableDefinitionIsDiscarded(declaration: Node, ast: AstReader, navigation: Pick<SourceProgramNavigation, "sourceFiles" | "expressionResultDisposition">): boolean;
export type SourceValueInputSlot = {
    readonly kind: "effect" | "initializer" | "return" | "thrown" | "condition" | "default" | "receiver" | "callee" | "key";
} | {
    readonly kind: "operand";
    readonly position: "only" | "left" | "right";
} | {
    readonly kind: "branch";
    readonly branch: "true" | "false";
} | {
    readonly kind: "element" | "member" | "span" | "case";
    readonly index: number;
};
export interface SourceValueInput {
    readonly owner: Node;
    readonly expression: Node;
    readonly slot: SourceValueInputSlot;
}
export declare function sourceConstructValueInputs(ast: AstReader, owner: Node): readonly SourceValueInput[];
export declare function sourceExpressionValueInputs(ast: AstReader, owner: Node): readonly SourceValueInput[] | undefined;
//# sourceMappingURL=expression-use.d.ts.map