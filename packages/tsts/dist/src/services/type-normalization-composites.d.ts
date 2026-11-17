import type { Checker } from "../internal/checker/checker/state.js";
import type { Type } from "../internal/checker/types.js";
export declare function cachedCompositeConstruction(source: Checker, type: Type): {
    members: import("../go/compat.js").GoSlice<import("../go/compat.js").GoPtr<Type>>;
    union: boolean;
    origin: import("../go/compat.js").GoPtr<Type>;
    intersectionFlags: number;
} | undefined;
export declare function reacquireCompositeType(producer: Checker, type: Type, normalize: (type: Type) => Type): Type | undefined;
//# sourceMappingURL=type-normalization-composites.d.ts.map