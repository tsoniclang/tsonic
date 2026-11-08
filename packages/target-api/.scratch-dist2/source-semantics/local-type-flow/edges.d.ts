import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceHostComponent, SourceHostQueries } from "../../host-input/queries.js";
import type { SourceTypeDescriptor, SourceTypeFlowAnalysisContext, SourceTypeFlowGraph, SourceTypeFlowPathPart } from "./types.js";
export declare function collectSourceTypeFlowEdges(context: SourceTypeFlowAnalysisContext): SourceTypeFlowGraph;
export declare function sourceTypeFlowDeclaredPatternBindings(context: SourceTypeFlowAnalysisContext, node: Node, component: SourceHostComponent | undefined, query: SourceHostQueries, described: SourceTypeDescriptor | undefined, initializer?: Node): readonly ({
    readonly kind: "resolved";
    readonly node: Node;
    readonly component?: SourceHostComponent;
    readonly type?: SourceTypeDescriptor;
} | {
    readonly kind: "refused";
    readonly node: Node;
})[];
export declare function sourceTypeFlowDescriptorPart(context: SourceTypeFlowAnalysisContext, site: Node, type: SourceTypeDescriptor, part: SourceTypeFlowPathPart): SourceTypeDescriptor | undefined;
export declare function sourceTypeFlowObjectLiteralReceiver(ast: AstReader, node: Node): Node | undefined;
export declare function isWriteTarget(ast: AstReader, node: Node): boolean;
//# sourceMappingURL=edges.d.ts.map