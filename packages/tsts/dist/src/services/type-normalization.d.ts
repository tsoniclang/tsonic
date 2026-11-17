import type { Checker } from "../internal/checker/checker/state.js";
import type { Type } from "../internal/checker/types.js";
export interface TypeNormalization {
    readonly type: (type: Type) => Type;
}
export declare function createTypeNormalization(producer: Checker): TypeNormalization;
//# sourceMappingURL=type-normalization.d.ts.map