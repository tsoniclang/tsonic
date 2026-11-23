import type { GoPtr } from "../go/compat.js";
import type { TypeMapper } from "../internal/checker/mapper.js";
import type { Type } from "../internal/checker/types.js";
export declare function flatTypeMapperInputs(mapper: TypeMapper): {
    readonly sources: GoPtr<Type>[];
    readonly targets: GoPtr<Type>[];
} | undefined;
//# sourceMappingURL=type-mapper-inputs.d.ts.map