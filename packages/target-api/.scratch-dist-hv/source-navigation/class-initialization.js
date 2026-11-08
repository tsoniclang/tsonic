import { Node_Expression, Node_Initializer } from "../source-model/ast.js";
import { AsExpressionWithTypeArguments } from "./checked-casts.js";
import { sourceClassFieldIsTypeOnly } from "../source-model/class-members.js";
export function sourceConstructionExpression(invocation, source, step) {
    if (source.ast.is.IsNewExpression(invocation))
        return source.navigation.isProjectDeclaration(invocation)
            ? Node_Expression(source.ast, invocation) : undefined;
    return sourceSuperConstructor(invocation, source, step)?.callee;
}
export function sourceSuperConstructor(invocation, source, step) {
    const { ast, navigation } = source;
    if (!ast.is.IsCallExpression(invocation) || ast.kindName(Node_Expression(ast, invocation)) !== "KindSuperKeyword" ||
        !navigation.isProjectDeclaration(invocation))
        return undefined;
    for (let owner = ast.parent(invocation); owner !== undefined && step(); owner = ast.parent(owner)) {
        if (!ast.is.IsConstructorDeclaration(owner))
            continue;
        const declaration = ast.parent(owner);
        if (declaration === undefined || !navigation.isProjectDeclaration(declaration))
            return undefined;
        const heritage = navigation.declaredHeritage(declaration);
        if (heritage.kind !== "resolved")
            return undefined;
        const bases = heritage.edges.filter(edge => edge.kind === "extends");
        const callee = bases.length === 1 ? AsExpressionWithTypeArguments(ast, bases[0].heritage)?.Expression : undefined;
        return callee === undefined ? undefined : Object.freeze({ owner, callee });
    }
    return undefined;
}
export function sourceInstanceInitializers(declaration, source, step) {
    const { ast, navigation } = source;
    if (!navigation.isProjectDeclaration(declaration) ||
        !ast.is.IsClassDeclaration(declaration) && !ast.is.IsClassExpression(declaration))
        return undefined;
    const initializers = [];
    for (const member of ast.members(declaration)) {
        if (!step())
            return undefined;
        if (member === undefined || !ast.is.IsPropertyDeclaration(member) || ast.hasModifierKind(member, "static") ||
            sourceClassFieldIsTypeOnly(ast, member))
            continue;
        const initializer = Node_Initializer(ast, member);
        if (initializer !== undefined)
            initializers.push(initializer);
    }
    return Object.freeze(initializers);
}
//# sourceMappingURL=class-initialization.js.map