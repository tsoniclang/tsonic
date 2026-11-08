import type { Node } from "@tsonic/tsts";
import type { SourceHostComponent, SourceHostQueries } from "../../host-input/queries.js";
import type { SourceTypeDescriptor, SourceTypeDescriptorSignature, SourceTypeFlowAnalysisContext, SourceTypeFlowRefusal } from "./types.js";
export interface SourceTypeFlowDeclaredSlot {
    readonly authority: "declared" | "inferred";
    readonly component?: SourceHostComponent;
    readonly type?: SourceTypeDescriptor;
    readonly refusal?: SourceTypeFlowRefusal;
}
interface AuthoredBinding {
    readonly type: SourceTypeDescriptor;
    readonly component?: SourceHostComponent;
}
export declare function createSourceTypeFlowDeclaredSlotReader(context: SourceTypeFlowAnalysisContext): Readonly<{
    get: (node: Node) => SourceTypeFlowDeclaredSlot | undefined;
    authoredBinding: (callNode: Node | undefined, variables: ReadonlySet<Node>) => ReadonlyMap<Node, AuthoredBinding> | undefined;
    annotation(node: Node): SourceTypeDescriptor | undefined;
    callable: (node: Node, query: SourceHostQueries) => {
        readonly type: Extract<SourceTypeDescriptor, {
            readonly kind: "callable" | "shape";
        }>;
        readonly signature: SourceTypeDescriptorSignature;
    } | undefined;
    parameter: (node: Node, query: SourceHostQueries) => SourceTypeDescriptor | undefined;
    returned: (node: Node, query: SourceHostQueries) => SourceTypeDescriptor | undefined;
    retainFixedConstruction(node: Node, type: SourceTypeDescriptor, component?: SourceHostComponent): void;
}>;
export {};
//# sourceMappingURL=declared-slots.d.ts.map