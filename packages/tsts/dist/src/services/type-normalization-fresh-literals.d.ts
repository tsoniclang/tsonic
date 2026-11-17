import type { Checker } from "../internal/checker/checker/state.js";
import type { LiteralCreationInput } from "../internal/checker/checker/literal-creation.js";
import type { Type } from "../internal/checker/types.js";
export declare function reacquireFreshLiteral(producer: Checker, type: Type, normalize: (type: Type) => Type, admitted: Map<Type, LiteralCreationInput | null>): Type;
//# sourceMappingURL=type-normalization-fresh-literals.d.ts.map