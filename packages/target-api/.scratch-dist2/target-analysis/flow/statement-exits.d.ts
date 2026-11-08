import type { AstReader, Node } from "@tsonic/tsts";
export interface SourceStatementExitFacts {
    readonly erased: (node: Node) => boolean;
    readonly expressionExits: (node: Node) => boolean;
    readonly guardResult: (node: Node) => boolean | undefined;
    readonly controlTarget?: (node: Node) => Node | undefined;
    readonly continueFallsThrough?: (node: Node, target: Node | undefined) => boolean;
    /**
     * Whether a switch without a default clause has a case for every value of its checked discriminant
     * (`createSourceSwitchCoverage`). Without this fact such a switch keeps its normal fallthrough exit.
     */
    readonly switchCoversDiscriminant?: (node: Node) => boolean;
}
export declare function analyzeSourceStatementExits(ast: AstReader, nodes: readonly Node[], facts: SourceStatementExitFacts): ReadonlyMap<Node, boolean>;
//# sourceMappingURL=statement-exits.d.ts.map