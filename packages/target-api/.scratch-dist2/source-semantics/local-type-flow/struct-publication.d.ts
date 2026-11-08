import { type Node } from "@tsonic/tsts";
import type { SourceEffectiveTypeOutcome, SourceLiteralMemberCorrespondence, SourceTypeDescriptor, SourceTypeFlowAnalysisContext } from "./types.js";
export declare function sourceStructMemberCorrespondence(context: SourceTypeFlowAnalysisContext, node: Node, type: SourceTypeDescriptor): readonly SourceLiteralMemberCorrespondence[] | undefined;
export declare function publishSourceStructMemberCorrespondence(context: SourceTypeFlowAnalysisContext, nodes: readonly Node[], outcomes: WeakMap<Node, SourceEffectiveTypeOutcome>): void;
//# sourceMappingURL=struct-publication.d.ts.map