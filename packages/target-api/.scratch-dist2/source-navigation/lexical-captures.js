import { isTypeSyntaxNode } from "../source-model/syntax.js";
import { sourceNodeHasRole } from "../source-model/callable-boundaries.js";
import { sourceReceiverOwner } from "./receiver-owner.js";
export function sourceLexicalCaptures(scope, roots, ast, navigation, domain, step = () => { }) {
    if (domain !== "source" && (domain === null || typeof domain !== "object" || typeof domain.has !== "function")) {
        throw new Error("Lexical captures require an explicit source-node domain.");
    }
    const includes = (node) => domain === "source" || domain.has(node);
    if (!includes(scope))
        throw new Error("A lexical-capture scope must belong to its explicit source-node domain.");
    const captures = new Map();
    const selfReferences = [];
    const receivers = new Map();
    const visited = new Set();
    const visit = (node) => {
        if (!includes(node))
            return;
        step(node);
        if (visited.has(node) || isTypeSyntaxNode(ast, node))
            return;
        visited.add(node);
        const nodeKind = ast.kindName(node);
        if (nodeKind === "KindThisKeyword" || nodeKind === "KindSuperKeyword") {
            step(node);
            const owner = sourceReceiverOwner(node, ast, "lexical-capture", () => { step(node); return true; });
            if (owner !== undefined && !within(owner, scope, ast, step)) {
                const references = receivers.get(owner) ?? [];
                references.push(node);
                receivers.set(owner, references);
            }
        }
        if (ast.is.IsIdentifier(node)) {
            const parent = ast.parent(node);
            if (parent !== undefined && ast.is.IsPropertyAccessExpression(parent) && ast.name(parent) === node)
                return;
            const selected = navigation.sourceReferenceFor(node);
            if (selected?.project === true) {
                const declaration = selected.declaration;
                const kind = ast.kindName(declaration);
                const binding = ["KindParameter", "KindVariableDeclaration", "KindBindingElement", "KindFunctionDeclaration",
                    "KindFunctionExpression", "KindClassDeclaration", "KindClassExpression", "KindEnumDeclaration"].includes(kind);
                if (!binding || ast.name(declaration) === node)
                    return;
                if (declaration === scope)
                    selfReferences.push(node);
                else if (!within(declaration, scope, ast, step) && !sourceDeclarationIsModuleScoped(declaration, ast, step)) {
                    const references = captures.get(declaration) ?? [];
                    references.push(node);
                    captures.set(declaration, references);
                }
            }
        }
        ast.forEachChild(node, child => { if (child !== undefined)
            visit(child); });
    };
    for (const root of roots) {
        if (!includes(root))
            throw new Error("A lexical-capture root must belong to its explicit source-node domain.");
        if (!within(root, scope, ast, step))
            throw new Error("A lexical-capture root must belong to its exact source scope.");
        visit(root);
    }
    return Object.freeze({
        captures: Object.freeze([...captures].map(([declaration, references]) => Object.freeze({
            declaration, references: Object.freeze(references),
        }))),
        selfReferences: Object.freeze(selfReferences),
        receivers: Object.freeze([...receivers].map(([owner, references]) => Object.freeze({
            owner, references: Object.freeze(references),
        }))),
    });
}
/**
 * The published lexical capture query (`facts.analyses.lexicalCaptures`): the full selection of an owner over the whole
 * owner (roots `[owner]`), with every captured binding's references, the owner's self references and the captured outer
 * receivers. Keyed by declaration Node; references resolve through the reference index (no Symbol, I3). One memo table
 * per program view (I5). The owner domain is exactly the role union `callable-body` ∪ `class-scope` of a project
 * declaration (callable-boundaries.ts); an owner outside it is an invariant failure. `navigation.scopes.captures` is a
 * projection of this selection (roles.ts), so both answer from one selection.
 */
export function createSourceLexicalCaptureQuery(ast, navigation) {
    const memo = new WeakMap();
    return (owner) => {
        const known = memo.get(owner);
        if (known !== undefined)
            return known;
        if (!navigation.isProjectDeclaration(owner) ||
            !sourceNodeHasRole(ast, owner, "callable-body") && !sourceNodeHasRole(ast, owner, "class-scope")) {
            throw new Error(`Lexical captures are published for a project callable with a body or a project class, not '${ast.kindName(owner)}'.`);
        }
        const selected = sourceLexicalCaptures(owner, [owner], ast, navigation, "source");
        memo.set(owner, selected);
        return selected;
    };
}
export function sourceDeclarationIsModuleScoped(declaration, ast, step = () => { }) {
    let current = declaration;
    while (current !== undefined) {
        step(current);
        const parent = ast.parent(current);
        if (parent === undefined)
            return false;
        const parentKind = ast.kindName(parent);
        // A declaration inside another execution (a callable body or a class static block) is not module scoped.
        if (sourceNodeHasRole(ast, parent, "execution-barrier"))
            return false;
        if (parentKind === "KindSourceFile") {
            const kind = ast.kindName(declaration);
            return current === declaration
                ? ["KindFunctionDeclaration", "KindClassDeclaration", "KindEnumDeclaration", "KindExportAssignment"].includes(kind)
                : ast.kindName(current) === "KindVariableStatement" && ["KindVariableDeclaration", "KindBindingElement"].includes(kind);
        }
        current = parent;
    }
    return false;
}
export function sourceBindingScope(declaration, ast) {
    const binding = rootBindingDeclaration(declaration, ast);
    if (binding === undefined)
        return undefined;
    if (ast.is.IsParameterDeclaration(binding)) {
        const callable = ast.parent(binding);
        return callable === undefined ? undefined : ast.body(callable);
    }
    const functionScoped = ast.is.IsVariableDeclaration(binding) && ast.variableDeclarationKind(binding) === "var";
    for (let current = ast.parent(binding); current !== undefined; current = ast.parent(current)) {
        const kind = ast.kindName(current);
        if (kind === "KindSourceFile")
            return current;
        // An execution barrier (a callable body or a class static block) owns its `var`s (E13; F2-1 static-block defect).
        if (sourceNodeHasRole(ast, current, "execution-barrier"))
            return ast.body(current) ?? current;
        if (!functionScoped && ["KindBlock", "KindForStatement", "KindForInStatement", "KindForOfStatement", "KindCaseBlock"].includes(kind))
            return current;
        if (!functionScoped && ast.is.IsCatchClause(current))
            return ast.as.AsCatchClause(current)?.Block;
    }
    return undefined;
}
export function sourceBindingIterationScope(declaration, ast) {
    const binding = rootBindingDeclaration(declaration, ast);
    if (binding === undefined || !ast.is.IsVariableDeclaration(binding))
        return undefined;
    const initializer = ast.parent(binding);
    if (initializer === undefined || !ast.is.IsVariableDeclarationList(initializer) ||
        ast.variableDeclarationKind(initializer) !== "let")
        return undefined;
    const scope = ast.parent(initializer);
    return scope !== undefined && ast.is.IsForStatement(scope) && ast.as.AsForStatement(scope)?.Initializer === initializer
        ? scope : undefined;
}
function rootBindingDeclaration(declaration, ast) {
    let binding = declaration;
    while (ast.is.IsBindingElement(binding)) {
        const pattern = ast.parent(binding);
        const owner = pattern === undefined ? undefined : ast.parent(pattern);
        if (owner === undefined)
            return undefined;
        binding = owner;
    }
    return binding;
}
function within(node, ancestor, ast, step) {
    for (let current = node; current !== undefined; current = ast.parent(current)) {
        step(current);
        if (current === ancestor)
            return true;
    }
    return false;
}
//# sourceMappingURL=lexical-captures.js.map