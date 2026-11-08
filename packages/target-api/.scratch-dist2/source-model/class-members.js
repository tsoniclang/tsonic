export function sourceClassFieldIsTypeOnly(ast, declaration) {
    return ast.kindName(declaration) === "KindPropertyDeclaration" &&
        ast.hasModifierKind(declaration, "ambient");
}
export function sourceClassFieldHasStorage(ast, declaration) {
    return ast.is.IsPropertyDeclaration(declaration) && !sourceClassFieldIsTypeOnly(ast, declaration) &&
        !ast.hasModifierKind(declaration, "abstract");
}
export function sourceParameterIsProperty(ast, declaration) {
    if (ast.kindName(declaration) !== "KindParameter")
        return false;
    const constructor = ast.parent(declaration);
    const owner = constructor === undefined ? undefined : ast.parent(constructor);
    return constructor !== undefined && ast.kindName(constructor) === "KindConstructor" &&
        owner !== undefined && (ast.kindName(owner) === "KindClassDeclaration" || ast.kindName(owner) === "KindClassExpression") &&
        ["public", "private", "protected", "readonly"].some(modifier => ast.hasModifierKind(declaration, modifier));
}
export function sourceObjectMemberDeclarations(ast, declaration) {
    const members = ast.members(declaration);
    if (ast.kindName(declaration) !== "KindClassDeclaration" && ast.kindName(declaration) !== "KindClassExpression")
        return members;
    const properties = [];
    for (const member of members) {
        if (member === undefined || ast.kindName(member) !== "KindConstructor")
            continue;
        for (const parameter of ast.parameters(member)) {
            if (parameter === undefined || sourceParameterIsProperty(ast, parameter)) {
                properties.push(parameter);
            }
        }
    }
    return properties.length === 0 ? members : Object.freeze([...members, ...properties]);
}
export function sourceMemberOwner(ast, declaration) {
    const parent = ast.parent(declaration);
    return sourceParameterIsProperty(ast, declaration) && parent !== undefined
        ? ast.parent(parent)
        : parent;
}
//# sourceMappingURL=class-members.js.map