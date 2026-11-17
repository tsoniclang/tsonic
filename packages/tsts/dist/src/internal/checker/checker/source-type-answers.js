import { LinkStore_TryGet } from "../../core/linkstore.js";
export function sourceTypeAnswer(checker, node, type) {
    if (checker === undefined || node === undefined || type === undefined)
        return undefined;
    const retained = LinkStore_TryGet(checker.typeNodeLinks, node);
    return { type, cause: retained?.resolvedType === type ? retained.resolutionFailure : undefined };
}
//# sourceMappingURL=source-type-answers.js.map