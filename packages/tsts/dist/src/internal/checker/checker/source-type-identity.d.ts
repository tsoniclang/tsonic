import type { GoPtr } from "../../../go/compat.js";
import type { Type } from "../types.js";
export declare function sourceTypesShareStableIdentity(left: GoPtr<Type>, right: GoPtr<Type>): boolean;
export declare function preserveEquivalentSourceType(existing: GoPtr<Type>, incoming: GoPtr<Type>): GoPtr<Type>;
//# sourceMappingURL=source-type-identity.d.ts.map