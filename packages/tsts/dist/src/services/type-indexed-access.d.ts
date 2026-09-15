import type { GoPtr } from "../go/compat.js";
import type { Checker } from "../internal/checker/checker/state.js";
import type { Type } from "../internal/checker/types.js";
import type { TypeIndexInfo, TypePropertyInfo } from "./type-shape.js";
export interface TypeIndexedAccessComponents {
    readonly objectType: Type;
    readonly indexType: Type;
}
export type TypeIndexedAccessMember = {
    readonly indexType: Type;
    readonly readType: Type;
    readonly writeType: Type;
} & ({
    readonly kind: "property";
    readonly property: TypePropertyInfo;
} | {
    readonly kind: "index";
    readonly index: TypeIndexInfo;
});
export type TypeIndexedAccessSelection = TypeIndexedAccessComponents & {
    readonly readType: Type;
    readonly writeType: Type;
} & ({
    readonly kind: "deferred";
} | {
    readonly kind: "resolved";
    readonly members: readonly TypeIndexedAccessMember[];
});
export declare function readTypeIndexedAccessComponents(query: GoPtr<Checker>, type: GoPtr<Type>): TypeIndexedAccessComponents | undefined;
export declare function selectTypeIndexedAccess(query: GoPtr<Checker>, objectType: GoPtr<Type>, indexType: GoPtr<Type>): TypeIndexedAccessSelection | undefined;
//# sourceMappingURL=type-indexed-access.d.ts.map