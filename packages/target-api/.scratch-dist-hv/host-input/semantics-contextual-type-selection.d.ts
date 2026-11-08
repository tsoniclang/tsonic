import { type AstReader, type Node, type Type, type TypeCheckerQueries, type TypeShapeQueries } from "@tsonic/tsts";
import type { SourceFileSemantics, SourceTypeComponentEvidence } from "./semantics-types.js";
export type SourceContextualValueTypeSelection = {
    readonly kind: "selected";
    readonly component: SourceTypeComponentEvidence;
} | {
    readonly kind: "ambiguous";
    readonly types: readonly Type[];
} | {
    readonly kind: "unavailable";
};
export declare function selectSourceContextualValueType(ast: AstReader, types: TypeShapeQueries, checker: TypeCheckerQueries, semantics: SourceFileSemantics, node: Node): SourceContextualValueTypeSelection;
export declare function selectSourceContextualType(ast: AstReader, checker: TypeCheckerQueries, semantics: SourceFileSemantics, node: Node): SourceTypeComponentEvidence | undefined;
//# sourceMappingURL=semantics-contextual-type-selection.d.ts.map