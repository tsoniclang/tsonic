export function createSourceCallableImplementationNavigation(source, isProjectDeclaration) {
    const cache = new WeakMap();
    const callableImplementation = (contractDeclaration) => {
        const existing = cache.get(contractDeclaration);
        if (existing !== undefined) {
            return existing;
        }
        const result = resolveCallableImplementation(source, contractDeclaration, isProjectDeclaration);
        cache.set(contractDeclaration, result);
        return result;
    };
    return Object.freeze({ callableImplementation });
}
function resolveCallableImplementation(source, contractDeclaration, isProjectDeclaration) {
    const { ast } = source;
    const category = callableCategory(ast, contractDeclaration);
    const sourceFile = ast.getSourceFile(contractDeclaration);
    if (sourceFile !== undefined && isProjectDeclaration(contractDeclaration) &&
        (ast.is.IsArrowFunction(contractDeclaration) || ast.is.IsFunctionExpression(contractDeclaration)) &&
        ast.body(contractDeclaration) !== undefined) {
        return Object.freeze({
            kind: "resolved",
            contractDeclaration,
            implementation: Object.freeze({
                declaration: contractDeclaration,
                sourceFile,
                project: true,
            }),
        });
    }
    if (category === undefined || sourceFile === undefined ||
        !isProjectDeclaration(contractDeclaration)) {
        return Object.freeze({
            kind: "unresolved",
            reason: "Callable implementation resolution requires an exact project function, method, accessor, or constructor declaration.",
        });
    }
    const implementationDeclaration = ast.body(contractDeclaration) !== undefined ? contractDeclaration : selectCallableImplementationDeclaration(ast, contractDeclaration, category === "constructor" ? [] : source.mergedDeclarations(contractDeclaration));
    const implementationSourceFile = ast.getSourceFile(implementationDeclaration);
    if (implementationDeclaration === undefined ||
        implementationSourceFile === undefined ||
        !isProjectDeclaration(implementationDeclaration)) {
        return Object.freeze({
            kind: "unresolved",
            reason: "The checked source program did not expose one concrete project implementation for the callable declaration.",
        });
    }
    return Object.freeze({
        kind: "resolved",
        contractDeclaration,
        implementation: Object.freeze({
            declaration: implementationDeclaration,
            sourceFile: implementationSourceFile,
            project: true,
        }),
    });
}
/** The one implementation (declaration with a body, same callable category) among the merged declarations. */
export function selectCallableImplementationDeclaration(ast, contractDeclaration, mergedDeclarations) {
    const category = callableCategory(ast, contractDeclaration);
    if (category === undefined) {
        return undefined;
    }
    const candidates = category === "constructor"
        ? ast.members(ast.parent(contractDeclaration))
        : mergedDeclarations;
    const implementations = candidates.filter((candidate) => candidate !== undefined &&
        callableCategory(ast, candidate) === category &&
        ast.body(candidate) !== undefined);
    return implementations.length === 1 ? implementations[0] : undefined;
}
function callableCategory(ast, declaration) {
    const kind = declaration === undefined ? "" : ast.kindName(declaration);
    if (kind === "KindFunctionDeclaration") {
        return "function";
    }
    if (kind === "KindMethodDeclaration" || kind === "KindMethodSignature") {
        return "method";
    }
    if (kind === "KindGetAccessor") {
        return "get";
    }
    if (kind === "KindSetAccessor") {
        return "set";
    }
    return kind === "KindConstructor" ? "constructor" : undefined;
}
//# sourceMappingURL=callable-implementation.js.map