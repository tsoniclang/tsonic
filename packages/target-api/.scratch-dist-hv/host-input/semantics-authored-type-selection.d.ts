import type { AstReader, Node, ReadonlySourceFactResolver, Type, TypeCheckerQueries, TypeShapeQueries } from "@tsonic/tsts";
import type { SourceFileSemantics } from "./semantics-types.js";
export type SourceAuthoredTypeSelection = {
    readonly kind: "authored-members";
    readonly nodes: readonly Node[];
    readonly selectedNullishTypes: readonly Type[];
} | {
    readonly kind: "ambiguous";
} | {
    readonly kind: "unrelated";
};
export declare function selectAuthoredSourceType(ast: AstReader, types: TypeShapeQueries, checker: TypeCheckerQueries, facts: ReadonlySourceFactResolver, authoredTypeNode: Node, selectedType: Type, semantics: SourceFileSemantics): SourceAuthoredTypeSelection;
//# sourceMappingURL=semantics-authored-type-selection.d.ts.map