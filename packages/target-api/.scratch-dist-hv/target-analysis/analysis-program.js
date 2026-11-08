import { sourceTypeDescriptorStructure } from "../source-semantics/descriptor-model.js";
/** Whether a source file is one of the program's checked files (project and library files). */
export function sourceAnalysisIncludesFile(source, sourceFile) {
    return sourceFile !== undefined && source.sourceFiles.includes(sourceFile);
}
/** Whether a node lies in one of the program's checked files. */
export function sourceAnalysisIncludesNode(source, node) {
    return sourceAnalysisIncludesFile(source, source.ast.getSourceFile(node));
}
/** The Host descriptor of a value node, or undefined when the Host refused the value (the refusal is in facts.refusals()). */
export function sourceAnalysisValueType(source, node) {
    const outcome = source.facts.values.type(node);
    return outcome.kind === "refused" ? undefined : outcome.type;
}
/** The Host result descriptor of a callable declaration (awaited payload for async non-generator callables), or undefined when refused. */
export function sourceAnalysisCallableResult(source, declaration) {
    // An async generator result is its declared AsyncGenerator, not an awaited payload.
    const awaited = source.ast.hasModifierKind(declaration, "async") && source.facts.selections.generator(declaration) === undefined;
    const outcome = awaited ? source.facts.values.awaited(declaration) : source.facts.values.callableReturn(declaration);
    return outcome.kind === "refused" ? undefined : outcome.type;
}
// The absence and present-arm classifier is source-semantics/descriptor-arms.ts (one owner, R4).
/**
 * A scalar arm: a primitive (number family, bool, char), string, bigint, symbol, or an enum (checker
 * isStringLike / isNumberLike / isBooleanLike / isBigIntLike / isSymbolLike on a non-union type).
 */
export function sourceAnalysisIsScalar(type, isEnumDeclaration) {
    const structure = sourceTypeDescriptorStructure(type);
    if (structure.kind === "primitive" || structure.kind === "string")
        return true;
    if (structure.kind === "intrinsic")
        return structure.intrinsic === "bigint" || structure.intrinsic === "symbol";
    return structure.kind === "declared" && isEnumDeclaration(structure.declaration);
}
/** The callable signatures a descriptor arm carries (call signatures of a callable or shape). */
export function sourceAnalysisCallSignatures(type) {
    const structure = sourceTypeDescriptorStructure(type);
    return structure.kind === "callable" || structure.kind === "shape" ? structure.calls : [];
}
/** The construct signatures a descriptor arm carries. */
export function sourceAnalysisConstructSignatures(type) {
    const structure = sourceTypeDescriptorStructure(type);
    return structure.kind === "callable" || structure.kind === "shape" ? structure.constructs : [];
}
//# sourceMappingURL=analysis-program.js.map