export function sourceDeclarationAmbientContext(ast, node, inheritedAmbient) {
    return inheritedAmbient || (ast.is.IsSourceFile(node)
        ? ast.getSourceFile(node)?.IsDeclarationFile === true : ast.hasModifierKind(node, "ambient"));
}
//# sourceMappingURL=declaration-context.js.map