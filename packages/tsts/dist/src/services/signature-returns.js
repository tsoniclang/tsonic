import { Checker_GetReturnTypeOfSignature } from "../internal/checker/exports.js";
import { Checker_instantiateType } from "../internal/checker/checker/types.js";
import { SignatureFlagsCallChainFlags, } from "../internal/checker/types.js";
export function readInvocationReturnType(checker, signature) {
    if (signature === undefined)
        return undefined;
    if (signature.target === undefined && (signature.flags & SignatureFlagsCallChainFlags) === 0) {
        return Checker_GetReturnTypeOfSignature(checker, signature);
    }
    const instantiations = [];
    const visited = new Set();
    let selected = signature;
    while ((selected.flags & SignatureFlagsCallChainFlags) === 0) {
        if (selected.target === undefined)
            return Checker_GetReturnTypeOfSignature(checker, signature);
        if (visited.has(selected))
            return undefined;
        visited.add(selected);
        instantiations.push(selected);
        selected = selected.target;
    }
    if ((selected.flags & SignatureFlagsCallChainFlags) === SignatureFlagsCallChainFlags ||
        selected.target === undefined || visited.has(selected) || visited.has(selected.target))
        return undefined;
    let result = Checker_instantiateType(checker, Checker_GetReturnTypeOfSignature(checker, selected.target), selected.mapper);
    for (let index = instantiations.length - 1; index >= 0; index--) {
        result = Checker_instantiateType(checker, result, instantiations[index].mapper);
    }
    return result;
}
//# sourceMappingURL=signature-returns.js.map