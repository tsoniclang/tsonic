import { isTypeSyntaxNode } from "./syntax.js";
/** The syntax kinds that can own a function body. `callable-body` additionally requires the body. */
const callableBodyBoundaryKinds = new Set([
    "KindFunctionDeclaration", "KindFunctionExpression", "KindArrowFunction", "KindMethodDeclaration",
    "KindConstructor", "KindGetAccessor", "KindSetAccessor",
]);
/** The bodyless signature kinds; with the body kinds they are the signature owners. */
const callableSignatureKinds = new Set([
    "KindMethodSignature", "KindCallSignature", "KindConstructSignature", "KindFunctionType", "KindConstructorType",
]);
/** The kinds whose authored grammar declares type parameters (`ast.typeParameters` is defined for each). */
const typeParameterOwnerKinds = new Set([
    "KindClassDeclaration", "KindClassExpression", "KindInterfaceDeclaration", "KindTypeAliasDeclaration",
    "KindFunctionDeclaration", "KindFunctionExpression", "KindArrowFunction", "KindMethodDeclaration", "KindMethodSignature",
    "KindCallSignature", "KindConstructSignature", "KindFunctionType", "KindConstructorType",
]);
/** Object-literal members that create a closure when the literal is evaluated. */
const objectLiteralClosureKinds = new Set([
    "KindMethodDeclaration", "KindGetAccessor", "KindSetAccessor",
]);
const blockScopeKinds = new Set([
    "KindBlock", "KindForStatement", "KindForInStatement", "KindForOfStatement", "KindCatchClause", "KindCaseBlock",
]);
const typeOnlyDeclarationKinds = new Set(["KindInterfaceDeclaration", "KindTypeAliasDeclaration"]);
/** Every role in `SourceNodeRole` declaration order; `sourceNodeRoles` lists a node's roles in this order. */
export const sourceNodeRoleOrder = Object.freeze([
    "callable-body", "callable-signature", "execution-barrier", "deferred-execution", "type-parameter-owner",
    "class-scope", "module-scope", "block-scope", "type-only", "ambient",
]);
/** The kind half of `callable-body`: a form that can own a body, with or without one. Not a role by itself. */
export function isSourceCallableBodyBoundary(ast, node) {
    return callableBodyBoundaryKinds.has(ast.kindName(node));
}
/** Exactly the `callable-signature` role: a body-owner kind (with or without a body) or a bodyless signature kind. */
export function isSourceCallableSignatureDeclaration(ast, node) {
    return isSourceCallableBodyBoundary(ast, node) || callableSignatureKinds.has(ast.kindName(node));
}
/** Whether `node` holds `role`. Each role is its own predicate; no role is derived from another by exclusion. */
export function sourceNodeHasRole(ast, node, role) {
    const kind = ast.kindName(node);
    switch (role) {
        case "callable-body":
            return callableBodyBoundaryKinds.has(kind) && ast.body(node) !== undefined;
        case "callable-signature":
            return isSourceCallableSignatureDeclaration(ast, node);
        case "execution-barrier":
            return kind === "KindClassStaticBlockDeclaration" ||
                callableBodyBoundaryKinds.has(kind) && ast.body(node) !== undefined;
        case "deferred-execution": {
            if (kind === "KindFunctionExpression" || kind === "KindArrowFunction")
                return true;
            if (!objectLiteralClosureKinds.has(kind))
                return false;
            const parent = ast.parent(node);
            return parent !== undefined && ast.kindName(parent) === "KindObjectLiteralExpression";
        }
        case "type-parameter-owner":
            return typeParameterOwnerKinds.has(kind) && ast.typeParameters(node).length > 0;
        case "class-scope":
            return kind === "KindClassDeclaration" || kind === "KindClassExpression";
        case "module-scope":
            return kind === "KindSourceFile";
        case "block-scope":
            return blockScopeKinds.has(kind);
        case "type-only":
            return typeOnlyDeclarationKinds.has(kind) || isTypeSyntaxNode(ast, node);
        case "ambient": {
            if (ast.hasModifierKind(node, "ambient"))
                return true;
            const sourceFile = ast.getSourceFile(node);
            if (sourceFile === undefined)
                throw new Error("Source roles require a node of the checked program.");
            return ast.isDeclarationFile(sourceFile);
        }
    }
}
/** Every role `node` holds, additively, in `sourceNodeRoleOrder`. */
export function sourceNodeRoles(ast, node) {
    return Object.freeze(sourceNodeRoleOrder.filter(role => sourceNodeHasRole(ast, node, role)));
}
/**
 * The nearest strict ancestor of `node` holding `role` (E13 `sourceEnclosing`; replaces the body-only
 * `sourceEnclosingCallable`). Undefined when no ancestor holds it. A cyclic parent chain is an invariant failure.
 * `hasRole` lets the role model pass its memoized classification; it must agree with `sourceNodeHasRole`.
 */
export function sourceEnclosing(ast, node, role, hasRole = (candidate, selected) => sourceNodeHasRole(ast, candidate, selected)) {
    const visited = new Set([node]);
    for (let current = ast.parent(node); current !== undefined; current = ast.parent(current)) {
        if (visited.has(current))
            throw new Error("Source ancestry must be acyclic.");
        visited.add(current);
        if (hasRole(current, role))
            return current;
    }
    return undefined;
}
//# sourceMappingURL=callable-boundaries.js.map