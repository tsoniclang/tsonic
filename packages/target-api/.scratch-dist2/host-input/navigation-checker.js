/**
 * The one declaration -> checker symbol selector (R2 #3), asked in a given checker: navigation's merged declarations
 * ask the declaration's own file checker, the per-file checker views ask the consumer file's checker. A class expression
 * declares the symbol of its own class type; a named declaration declares the symbol of its name; an unnamed
 * declaration (`export default class {}`, `export default function () {}`) declares the module export whose
 * declarations include it. Declaration input only; there is no lookup through references.
 */
export function sourceDeclarationSymbol(ast, checker, declaration) {
    if (ast.is.IsClassExpression(declaration))
        return checker.getTypeSymbol(checker.getTypeAtLocation(declaration));
    const name = ast.name(declaration);
    const named = checker.getSymbolAtLocation(name ?? declaration);
    if (named !== undefined || name !== undefined)
        return named;
    const sourceFile = ast.getSourceFile(declaration);
    const moduleSymbol = sourceFile === undefined ? undefined : checker.getSymbolAtLocation(sourceFile);
    if (moduleSymbol === undefined)
        return undefined;
    return checker.getExportsOfModule(moduleSymbol).find((exported) => exported !== undefined && checker.getSymbolDeclarations(exported).includes(declaration));
}
/** The declared value type of a declaration in a given checker: a class expression's own value, else its symbol's type. */
export function sourceDeclaredValueType(ast, checker, symbolOf, declaration) {
    return ast.is.IsClassExpression(declaration) ? checker.getTypeAtLocation(declaration) : checker.getTypeOfSymbol(symbolOf(declaration));
}
/**
 * The per-consumer-file cache of the one selector (sourceDeclarationSymbol), for the per-file checker views
 * (semantics-program.ts). A declaration outside the checked program has no symbol; a consumer outside it is refused.
 */
export function createSourceDeclarationSymbolQuery(source) {
    const selections = new WeakMap();
    return (declaration, sourceFile) => {
        if (!source.containsSourceFile(sourceFile))
            throw new Error("A declaration-symbol query requires its actual checked consumer context.");
        let byDeclaration = selections.get(sourceFile);
        const retained = byDeclaration?.get(declaration);
        if (retained !== undefined)
            return retained ?? undefined;
        const declarationFile = source.ast.getSourceFile(declaration);
        const symbol = declarationFile !== undefined && source.containsSourceFile(declarationFile)
            ? sourceDeclarationSymbol(source.ast, source.getSourceFileQueries(sourceFile).checker, declaration) : undefined;
        byDeclaration ?? (byDeclaration = new WeakMap());
        byDeclaration.set(declaration, symbol ?? null);
        selections.set(sourceFile, byDeclaration);
        return symbol;
    };
}
/** The local type arguments of a checked type reference (moved from source-navigation/type-arguments.ts). */
export function getEffectiveSourceTypeArguments(ast, queries, type) {
    const bindings = queries.typeShape.getTypeReferenceArgumentInfos(type);
    if (bindings !== undefined) {
        return Object.freeze(bindings.filter(binding => binding.scope === "local").map(binding => binding.argument));
    }
    if (!queries.typeShape.isTypeReference(type))
        return Object.freeze([]);
    const target = queries.typeShape.getTypeReferenceTarget(type);
    const declarations = queries.checker.getSymbolDeclarations(queries.checker.getTypeSymbol(target ?? type));
    if (declarations.some(declaration => declaration !== undefined && (ast.is.IsClassDeclaration(declaration) || ast.is.IsClassExpression(declaration) ||
        ast.is.IsInterfaceDeclaration(declaration))))
        return undefined;
    const arguments_ = queries.typeShape.getTypeArguments(type);
    return arguments_.every((argument) => argument !== undefined) ? Object.freeze([...arguments_]) : undefined;
}
//# sourceMappingURL=navigation-checker.js.map