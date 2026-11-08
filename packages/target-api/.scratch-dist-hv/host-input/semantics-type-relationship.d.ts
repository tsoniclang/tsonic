import type { ReadonlySourceFactResolver, Type, TypeCheckerQueries, TypeShapeQueries } from "@tsonic/tsts";
export type SourceTypeRelationship = "identical" | "same-declaration" | "unrelated";
export declare function sourceTypeRelationship(types: TypeShapeQueries, checker: TypeCheckerQueries, facts: ReadonlySourceFactResolver, left: Type, right: Type): SourceTypeRelationship;
//# sourceMappingURL=semantics-type-relationship.d.ts.map