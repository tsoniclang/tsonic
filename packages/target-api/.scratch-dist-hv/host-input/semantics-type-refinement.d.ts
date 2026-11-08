import type { ReadonlySourceFactResolver, Type, TypeCheckerQueries, TypeShapeQueries } from "@tsonic/tsts";
export type SourceTypeRefinement = {
    readonly kind: "exact";
    readonly type: Type;
} | {
    readonly kind: "members";
    readonly types: readonly Type[];
} | {
    readonly kind: "ambiguous";
} | {
    readonly kind: "unrelated";
};
export declare function selectSourceTypeRefinement(types: TypeShapeQueries, checker: TypeCheckerQueries, facts: ReadonlySourceFactResolver, declaredType: Type, selectedType: Type): SourceTypeRefinement;
export declare function sourceTypeMemberRefines(types: TypeShapeQueries, checker: TypeCheckerQueries, facts: ReadonlySourceFactResolver, declaredMember: Type, selectedMember: Type): boolean;
//# sourceMappingURL=semantics-type-refinement.d.ts.map