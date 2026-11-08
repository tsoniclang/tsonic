import type { Node } from "@tsonic/tsts";
import type { SourceValueFlowQueryContext } from "./value-flow-model.js";
export type SourceNativeValueGuard = {
    readonly kind: "typeof";
    readonly sourceOperand: Node;
    readonly value: string;
    readonly negated: boolean;
} | {
    readonly kind: "absence";
    readonly sourceOperand: Node;
    readonly negated: boolean;
} | {
    readonly kind: "literal";
    readonly sourceOperand: Node;
    readonly category: "string" | "number" | "bigint" | "boolean";
    readonly negated: boolean;
} | {
    readonly kind: "nominal";
    readonly sourceOperand: Node;
    readonly sourceConstructor: Node;
    readonly declaration: Node;
};
export declare function selectSourceNativeValueGuard({ ast, navigation, values }: Pick<SourceValueFlowQueryContext, "ast" | "navigation" | "values">, expression: Node): SourceNativeValueGuard | undefined;
//# sourceMappingURL=native-value-guards.d.ts.map