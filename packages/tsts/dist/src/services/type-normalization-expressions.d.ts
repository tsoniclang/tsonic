import type { Checker } from "../internal/checker/checker/state.js";
import type { Type } from "../internal/checker/types.js";
export declare function reacquireExpressionConstruction(producer: Checker, type: Type, normalize: (type: Type) => Type): Type | undefined;
export declare function reacquireContextWidening(producer: Checker, type: Type, normalize: (type: Type) => Type): Type | undefined;
export declare function reacquireCachedRestType(producer: Checker, type: Type): Type | undefined;
export declare function reacquireCachedObjectExpression(producer: Checker, type: Type): Type | undefined;
//# sourceMappingURL=type-normalization-expressions.d.ts.map