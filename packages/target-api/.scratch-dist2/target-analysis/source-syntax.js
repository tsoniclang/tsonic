/** Program-free composition over the published target handle (no Host program access). */
export function targetSourceSyntaxProgram(source) {
    const { analyses } = source.facts;
    return Object.freeze({
        ast: source.syntax,
        sourceFiles: Object.freeze([...source.sourceFiles]),
        documents: source.documents,
        propertyNames: Object.freeze({ get: (name) => analyses.propertyName(name) }),
    });
}
//# sourceMappingURL=source-syntax.js.map