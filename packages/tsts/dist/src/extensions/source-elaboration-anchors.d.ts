import type { Node } from "../internal/ast/ast.js";
import type { SourceProgramQueries } from "./source-program.js";
import type { SourceElaborationBudget } from "./source-elaboration-budget.js";
export interface SourceElaborationAnchor {
    readonly fileName: string;
    readonly path: readonly number[];
    readonly kind: number;
    readonly pos: number;
    readonly end: number;
    readonly id: string;
}
export declare class SourceElaborationAnchors {
    #private;
    constructor(source: SourceProgramQueries, maximumDepth: number, budget: SourceElaborationBudget, anchors: Iterable<SourceElaborationAnchor>);
    reference(node: Node): SourceElaborationAnchor;
    resolve(anchor: SourceElaborationAnchor): Node;
    sourceInputs(): ReadonlyMap<string, string>;
}
//# sourceMappingURL=source-elaboration-anchors.d.ts.map