import type { AstReader, Node } from "@tsonic/tsts";
export interface SourceSequenceInputChoice {
    readonly expression: Node;
    readonly inputs: readonly Node[];
    readonly controlNodes: readonly Node[];
}
export declare function sourceSequenceInputIsEmpty(ast: AstReader, node: Node): boolean;
export declare function sourceSequenceInputChoice(ast: AstReader, expression: Node): SourceSequenceInputChoice | undefined;
export declare function sourceSequenceConsumptionRoot(ast: AstReader, node: Node): Node | undefined;
//# sourceMappingURL=sequence-inputs.d.ts.map