export function sourceConstructorParametersMatch(declared, selected) {
    return declared.length === selected.length && declared.every((parameter, index) => {
        const candidate = selected[index];
        return candidate !== undefined && parameter.parameterDeclaration !== undefined &&
            parameter.parameterDeclaration === candidate.parameterDeclaration &&
            parameter.acceptsOmission === candidate.acceptsOmission && parameter.rest === candidate.rest;
    });
}
/** Effective constructors of a project class: the construct signatures host-input selects for its value (I3). */
export function createSourceClassConstructorNavigation(input, isProjectDeclaration) {
    const { ast } = input;
    const cache = new WeakMap();
    return (declaration) => {
        const existing = cache.get(declaration);
        if (existing !== undefined)
            return existing;
        const result = (() => {
            if ((!ast.is.IsClassDeclaration(declaration) && !ast.is.IsClassExpression(declaration)) ||
                !isProjectDeclaration(declaration)) {
                return Object.freeze({
                    kind: "unresolved", declaration,
                    reason: "Effective constructors require an exact project class declaration.",
                });
            }
            const selected = input.constructSignatures(declaration);
            if (selected.kind === "unresolved") {
                return Object.freeze({ kind: "unresolved", declaration: selected.site, reason: selected.reason });
            }
            return Object.freeze({
                kind: "resolved",
                declaration,
                implicit: !ast.members(declaration).some(member => member !== undefined && ast.is.IsConstructorDeclaration(member)),
                signatures: selected.signatures,
            });
        })();
        cache.set(declaration, result);
        return result;
    };
}
//# sourceMappingURL=constructors.js.map