import { goReceiverKey } from "../internal/ast/spine.js";
import { TypeMapper_Kind, TypeMapperKindArray, TypeMapperKindSimple } from "../internal/checker/mapper.js";
export function flatTypeMapperInputs(mapper) {
    switch (TypeMapper_Kind(mapper)) {
        case TypeMapperKindSimple: {
            const data = mapper.data[goReceiverKey];
            if (data === undefined)
                throw new TypeError("A native simple mapper requires its actual construction data");
            return { sources: [data.source], targets: [data.target] };
        }
        case TypeMapperKindArray: {
            const data = mapper.data[goReceiverKey];
            if (data === undefined)
                throw new TypeError("A native array mapper requires its actual construction data");
            return data;
        }
        default: return undefined;
    }
}
//# sourceMappingURL=type-mapper-inputs.js.map