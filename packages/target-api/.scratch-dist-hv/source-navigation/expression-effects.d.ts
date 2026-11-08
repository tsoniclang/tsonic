import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceExpressionEffects } from "./types.js";
/** The inputs of the effect analysis: authored syntax and the Host value primitiveness of a coerced operand. */
export interface SourceExpressionEffectsInput {
    readonly ast: AstReader;
    /**
     * Whether the Host value type of `operand` is definitely primitive, so coercing it runs no user code (valueOf /
     * toString / Symbol.toPrimitive). The answer comes from the value model (`facts.values.type`), the one owner of a
     * value's Source type (R1); navigation never classifies types itself (R2 #15).
     */
    operandIsPrimitive(operand: Node): boolean;
}
export declare function sourceExpressionEffects(source: SourceExpressionEffectsInput, expression: Node, cache?: WeakMap<Node, SourceExpressionEffects>): SourceExpressionEffects;
//# sourceMappingURL=expression-effects.d.ts.map