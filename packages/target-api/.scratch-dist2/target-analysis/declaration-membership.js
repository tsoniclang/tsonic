export function createSourceDeclarationMembership(ast, nodes, definitions) {
    const selected = new Map(definitions);
    const membership = new Map(definitions);
    for (const node of nodes) {
        if (!selected.has(node)) {
            const path = [];
            let current = node;
            while (current !== undefined && !selected.has(current)) {
                path.push(current);
                current = ast.parent(current);
            }
            const definition = current === undefined ? undefined : selected.get(current);
            for (const member of path)
                selected.set(member, definition);
        }
        const definition = selected.get(node);
        if (definition !== undefined)
            membership.set(node, definition);
    }
    return membership;
}
//# sourceMappingURL=declaration-membership.js.map