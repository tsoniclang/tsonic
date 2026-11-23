import type { GoPtr } from "../go/compat.js";
import type { Checker } from "../internal/checker/checker/state.js";
import type { IndexFlags, Type } from "../internal/checker/types.js";
export interface TypeKeyOfComponents {
    readonly target: Type;
    readonly indexFlags: IndexFlags;
}
export interface TypeSubstitutionComponents {
    readonly base: Type;
    readonly constraint: Type;
}
export declare function readTypeKeyOfComponents(checker: GoPtr<Checker>, type: GoPtr<Type>): TypeKeyOfComponents | undefined;
export declare function readTypeSubstitutionComponents(checker: GoPtr<Checker>, type: GoPtr<Type>): TypeSubstitutionComponents | undefined;
//# sourceMappingURL=type-dependent-operands.d.ts.map