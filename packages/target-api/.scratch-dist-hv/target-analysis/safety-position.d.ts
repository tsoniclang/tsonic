import type { AstReader, Node } from "@tsonic/tsts";
export declare function sourceSafetyPositionIssue(ast: AstReader, subject: Node, operation: {
    readonly kind: "safety-builder";
    readonly fact: {
        readonly kind: string;
    };
} | {
    readonly kind: "unsafe-context";
    readonly fact: {
        readonly kind: string;
    };
}, read: (node: Node) => {
    readonly kind: string;
} | undefined): "marker-runtime" | "block-position" | undefined;
//# sourceMappingURL=safety-position.d.ts.map