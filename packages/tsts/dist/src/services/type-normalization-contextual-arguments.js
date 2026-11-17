import { CheckModeNormal } from "../internal/checker/checker/state.js";
import { Checker_getResolvedSignature } from "../internal/checker/checker/signatures.js";
import { cachedReferenceInputs } from "../internal/checker/checker.js";
import { LinkStore_TryGet } from "../internal/core/linkstore.js";
export function reacquireContextualArgument(producer, type) {
    const recipe = type.derivation;
    if (recipe?.kind !== "inferred-at")
        return undefined;
    const source = type.checker;
    if (source === undefined || source.program.SourceFiles() !== producer.program.SourceFiles())
        throw new TypeError("A contextual argument retains its actual producer in the same Program");
    const original = LinkStore_TryGet(source.signatureLinks, recipe.at);
    const evidence = original?.resolvedCallSelectionEvidence;
    if (!Number.isSafeInteger(recipe.index) || recipe.index < 0 || Object.is(recipe.index, -0)
        || evidence?.kind !== "applicable" || evidence.selection.application.invocation !== recipe.at
        || evidence.selection.application.instantiatedSignature !== original?.resolvedSignature || !Array.isArray(recipe.path))
        return undefined;
    let actual = evidence.selection.application.signatureTypeArguments[recipe.index]?.checkedArgument;
    for (const position of recipe.path) {
        if (!Number.isSafeInteger(position) || position < 0 || Object.is(position, -0) || actual === undefined)
            return undefined;
        actual = cachedReferenceInputs(source, actual)?.[position];
        if (actual === undefined)
            return undefined;
    }
    if (actual !== type)
        return undefined;
    const signature = Checker_getResolvedSignature(producer, recipe.at, undefined, CheckModeNormal);
    const selected = LinkStore_TryGet(producer.signatureLinks, recipe.at)?.resolvedCallSelectionEvidence;
    if (signature === undefined || selected?.kind !== "applicable" || selected.selection.application.instantiatedSignature !== signature)
        throw new Error("The target retains the actual completed selected application");
    let result = selected.selection.application.signatureTypeArguments[recipe.index]?.checkedArgument;
    for (const position of recipe.path)
        result = result === undefined ? undefined : cachedReferenceInputs(producer, result)?.[position];
    if (result === undefined || result.checker !== producer)
        throw new Error("The native selected application retains its actual contextual argument");
    return result;
}
//# sourceMappingURL=type-normalization-contextual-arguments.js.map