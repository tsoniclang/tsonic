import type { GoPtr } from "../go/compat.js";
import type { Type } from "../internal/checker/types.js";
export declare function checkedSourceTypesShareStableIdentity(left: GoPtr<Type>, right: GoPtr<Type>): boolean;
export declare function preserveEquivalentCheckedSourceType(existing: GoPtr<Type>, incoming: GoPtr<Type>): GoPtr<Type>;
//# sourceMappingURL=checked-source-type-identity.d.ts.map