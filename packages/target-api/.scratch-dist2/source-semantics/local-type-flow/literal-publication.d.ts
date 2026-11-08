import type { Node } from "@tsonic/tsts";
import type { SourceHostComponent } from "../../host-input/queries.js";
import type { SourceLiteralValue } from "../literal-values-model.js";
import type { SourceTypeFlowDeclaredSlot } from "./declared-slots.js";
import type { SourceDeclaredSlot, SourceEffectiveTypeOutcome, SourceLiteralMemberCorrespondence, SourceMethodValueUse, SourceSlotAdmission, SourceTypeDescriptor, SourceTypeFlowAnalysisContext, SourceTypeFlowRefusal } from "./types.js";
export declare function createSourceMethodValueUses(context: SourceTypeFlowAnalysisContext, nodes: readonly Node[], outcomes: ReadonlyMap<Node, SourceEffectiveTypeOutcome>): ReadonlyMap<Node, SourceMethodValueUse>;
export interface SourceNumberOrigin {
    readonly origin: Node;
    readonly literal?: SourceLiteralValue;
}
export declare function createSourceSlotAdmissions(context: SourceTypeFlowAnalysisContext, uses: readonly {
    readonly site: Node;
    readonly association?: {
        readonly occurrence: Node;
        readonly component?: SourceHostComponent;
    };
}[], outcomes: {
    get(node: Node): SourceEffectiveTypeOutcome | undefined;
    set(node: Node, outcome: SourceEffectiveTypeOutcome): unknown;
}, declaredSlot: (use: Node) => SourceTypeFlowDeclaredSlot | undefined, retainSlot: (slot: Node, type: SourceTypeDescriptor) => SourceDeclaredSlot, numberOrigin: (value: Node) => SourceNumberOrigin | undefined): {
    readonly admissions: ReadonlyMap<Node, SourceSlotAdmission>;
    readonly refusals: readonly SourceTypeFlowRefusal[];
};
export declare function sourceLiteralMemberCorrespondence(context: SourceTypeFlowAnalysisContext, node: Node, type: SourceTypeDescriptor, destination?: {
    readonly component?: SourceHostComponent;
    readonly destinationAt?: Node;
}): readonly SourceLiteralMemberCorrespondence[] | undefined;
export declare function publishSourceLiteralMetadata(context: SourceTypeFlowAnalysisContext, nodes: readonly Node[], outcomes: {
    get(node: Node): SourceEffectiveTypeOutcome | undefined;
    set(node: Node, outcome: SourceEffectiveTypeOutcome): unknown;
}, callableReturn: (declaration: Node) => SourceEffectiveTypeOutcome | undefined, retainedFill: (node: Node) => SourceHostComponent | undefined, descriptorRefusal: (node: Node) => SourceTypeFlowRefusal | undefined): void;
//# sourceMappingURL=literal-publication.d.ts.map