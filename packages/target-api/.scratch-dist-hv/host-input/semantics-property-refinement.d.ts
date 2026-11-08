import type { AstReader, ReadonlySourceFactResolver, ResolvedSourcePropertyAccessInfo, TypeCheckerQueries, TypeShapeQueries } from "@tsonic/tsts";
import type { SourceValueTypeRefinementSelection } from "./semantics-types.js";
export declare function selectRefinedSourcePropertyAccess(selected: ResolvedSourcePropertyAccessInfo, refinement: SourceValueTypeRefinementSelection, checker: TypeCheckerQueries, types: TypeShapeQueries, facts: ReadonlySourceFactResolver, ast: AstReader): ResolvedSourcePropertyAccessInfo;
//# sourceMappingURL=semantics-property-refinement.d.ts.map