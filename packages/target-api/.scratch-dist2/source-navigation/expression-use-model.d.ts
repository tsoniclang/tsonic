import type { Node } from "@tsonic/tsts";
export type SourceExpressionResultDisposition = {
    readonly kind: "discarded";
    readonly use: Node;
} | {
    readonly kind: "stored";
    readonly use: Node;
} | {
    readonly kind: "returned";
    readonly use: Node;
} | {
    readonly kind: "consumed";
    readonly use: Node;
} | {
    readonly kind: "awaited-in-scope";
    readonly use: Node;
    readonly completionReturned: boolean;
} | {
    readonly kind: "passed";
    readonly use: Node;
    readonly invocation: Node;
    readonly argument: Node;
};
//# sourceMappingURL=expression-use-model.d.ts.map