export function sourceSafetyPositionIssue(ast, subject, operation, read) {
    let expression = subject;
    let parent = ast.parent(expression);
    while (parent !== undefined && ast.is.IsParenthesizedExpression(parent)) {
        expression = parent;
        parent = ast.parent(expression);
    }
    if (operation.kind === "safety-builder") {
        let enclosing = parent;
        while (enclosing !== undefined && (ast.is.IsPropertyAccessExpression(enclosing) ||
            ast.is.IsCallExpression(enclosing) || ast.is.IsParenthesizedExpression(enclosing))) {
            if (read(enclosing)?.kind === "safety-builder")
                return undefined;
            enclosing = ast.parent(enclosing);
        }
        return operation.fact.kind === "application" && parent !== undefined && ast.is.IsExpressionStatement(parent)
            ? undefined : "marker-runtime";
    }
    if (operation.fact.kind === "expression")
        return undefined;
    const block = parent === undefined ? undefined : ast.parent(parent);
    return parent !== undefined && ast.is.IsExpressionStatement(parent) && block !== undefined && ast.is.IsBlock(block) &&
        ast.statements(block)[0] === parent ? undefined : "block-position";
}
//# sourceMappingURL=safety-position.js.map