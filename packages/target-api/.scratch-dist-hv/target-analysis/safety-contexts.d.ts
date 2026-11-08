import type { AstReader, Node } from "@tsonic/tsts";
type SourceSafetyOperation = {
    readonly kind: "unsafe-context";
    readonly fact: {
        readonly kind: "expression";
        readonly expression: Node;
    } | {
        readonly kind: "remaining-block";
    };
} | {
    readonly kind: "safety-builder";
    readonly fact: {
        readonly kind: string;
    };
};
export declare function createSourceExplicitUnsafeContextIndex(ast: AstReader, roots: readonly Node[], read: (node: Node) => SourceSafetyOperation | undefined): ReadonlySet<Node>;
export {};
//# sourceMappingURL=safety-contexts.d.ts.map