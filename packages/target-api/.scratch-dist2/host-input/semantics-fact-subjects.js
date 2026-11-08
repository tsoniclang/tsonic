export function sourceSelectedFactSubjects(checker, symbol, declaration) {
    const subjects = new Set();
    if (symbol !== undefined) {
        subjects.add(symbol);
        for (const selectedDeclaration of checker.getSymbolDeclarations(symbol)) {
            if (selectedDeclaration !== undefined) {
                subjects.add(selectedDeclaration);
            }
        }
    }
    if (declaration !== undefined) {
        subjects.add(declaration);
    }
    return Object.freeze([...subjects]);
}
export function sourceTypeFactSubjects(checker, type) {
    const symbols = [
        checker.getTypeAliasSymbol(type),
        checker.getTypeSymbol(type),
    ].filter((symbol) => symbol !== undefined);
    const subjects = new Set([type]);
    for (const symbol of symbols) {
        for (const subject of sourceSelectedFactSubjects(checker, symbol, undefined)) {
            subjects.add(subject);
        }
    }
    return Object.freeze([...subjects]);
}
//# sourceMappingURL=semantics-fact-subjects.js.map