import type { Node } from "../internal/ast/ast.js";
import type { FunctionPointerFact, PointerFact, RawPointerFact, SourceMarkerFact, SourceTypeMarkerKind } from "./facts.js";
export type SourceTypeMarkerReferenceFact = {
    readonly kind: "pointer";
    readonly value: PointerFact;
} | {
    readonly kind: "raw-pointer";
    readonly value: RawPointerFact;
} | {
    readonly kind: "function-pointer";
    readonly value: FunctionPointerFact;
} | {
    readonly kind: "marker";
    readonly value: SourceMarkerFact;
};
export declare function createSourceTypeMarkerReferenceFact(typeReference: Node, marker: SourceTypeMarkerKind): SourceTypeMarkerReferenceFact | undefined;
//# sourceMappingURL=source-semantics-type-markers.d.ts.map