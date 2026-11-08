const ownThisBindingKinds = new Set([
    "KindClassDeclaration",
    "KindClassExpression",
    "KindConstructor",
    "KindFunctionDeclaration",
    "KindFunctionExpression",
    "KindGetAccessor",
    "KindMethodDeclaration",
    "KindSetAccessor",
]);
export function sourceCallableUsesLexicalThis(ast, callable) {
    const body = ast.body(callable);
    return body !== undefined && sourceExpressionUsesLexicalThis(ast, body);
}
export function sourceExpressionUsesLexicalThis(ast, expression) {
    return !ownThisBindingKinds.has(ast.kindName(expression)) && containsLexicalThis(ast, expression, expression);
}
function containsLexicalThis(ast, node, root) {
    const kind = ast.kindName(node);
    if (kind === "KindThisKeyword") {
        return true;
    }
    if (node !== root && ownThisBindingKinds.has(kind)) {
        return false;
    }
    return ast.children(node).some((child) => child !== undefined && containsLexicalThis(ast, child, root));
}
//# sourceMappingURL=lexical-this.js.map