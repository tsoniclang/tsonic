import type { AstReader, Node } from "@tsonic/tsts";
export declare function sourceControlTransferTarget(ast: AstReader, node: Node): Node | undefined;
export declare function sourceNodeIsIteration(ast: AstReader, node: Node): boolean;
export interface SourceLabeledStatementTarget {
    readonly name: string;
    readonly body: Node;
    readonly loop: Node | undefined;
    readonly loopBody: Node | undefined;
}
export declare function sourceLabeledStatementTarget(ast: AstReader, node: Node): SourceLabeledStatementTarget | undefined;
//# sourceMappingURL=control-targets.d.ts.map