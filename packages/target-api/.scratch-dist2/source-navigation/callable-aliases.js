import { sourceMayReadBeforeInitialization } from "./initialization-uses.js";
import { createSourceCallableValueQuery, sourceCallableValueExpression } from "./callable-values.js";
import { failTargetCompilerResourceLimit } from "../artifacts.js";
export function createSourceCallOnlyAliasQuery(source) {
    const { ast, navigation } = source;
    const cache = new WeakMap();
    const selectValue = createSourceCallableValueQuery(source);
    const unwrap = (node) => sourceCallableValueExpression(ast, node);
    const initializer = (node) => node !== undefined && ast.is.IsVariableDeclaration(node) &&
        ast.variableDeclarationKind(node) === "const" && ast.is.IsIdentifier(ast.name(node))
        ? unwrap(ast.as.AsVariableDeclaration(node)?.Initializer) : undefined;
    const select = (declaration) => {
        const cached = cache.get(declaration);
        if (cached !== undefined)
            return cached ?? undefined;
        cache.set(declaration, null);
        try {
            const initial = initializer(declaration);
            const selected = initial === undefined ? undefined : selectValue(initial);
            if (selected === undefined)
                return undefined;
            const expression = selected.expression;
            if (expression === undefined || !ast.is.IsIdentifier(expression) && !ast.is.IsPropertyAccessExpression(expression))
                return undefined;
            const property = selected.access;
            const selectedDeclaration = selected.selectedDeclaration;
            if (selectedDeclaration === undefined || property?.optionalChain ||
                !ast.is.IsFunctionDeclaration(selectedDeclaration) &&
                    !ast.is.IsMethodDeclaration(selectedDeclaration) &&
                    ast.kindName(selectedDeclaration) !== "KindMethodSignature")
                return undefined;
            if (property !== undefined && selected.receiverDeclaration === undefined)
                return undefined;
            const flow = navigation.expressionValueFlow(expression);
            if (flow.aliasDeclarations.length > 1024)
                failTargetCompilerResourceLimit("tsonic", "Call-only alias declarations", "declarations", 1024, declaration);
            if (flow.uses.length > 131072)
                failTargetCompilerResourceLimit("tsonic", "Call-only alias uses", "uses", 131072, declaration);
            if (flow.aliasDeclarations.length === 0 || flow.memberWritten || flow.receiverUsed ||
                flow.identityCompared || flow.returned || flow.yielded || flow.passedAsArgument ||
                flow.storedOutsideBinding || flow.exported || flow.hasUnclassifiedUse)
                return undefined;
            const aliases = new Set(flow.aliasDeclarations);
            for (const alias of aliases) {
                const value = initializer(alias);
                const previous = value === undefined ? undefined : navigation.sourceReferenceFor(value)?.declaration;
                if (value === undefined || navigation.declarationUseSummary(alias).bindingWritten ||
                    sourceMayReadBeforeInitialization(alias, ast, navigation) ||
                    value !== expression && (!ast.is.IsIdentifier(value) || previous === undefined || !aliases.has(previous)))
                    return undefined;
            }
            const declarations = navigation.mergedDeclarations(selectedDeclaration);
            if (declarations.length > 1024)
                failTargetCompilerResourceLimit("tsonic", "Call-only alias signatures", "declarations", 1024, declaration);
            const overloads = new Set(declarations);
            const calls = new Set();
            for (const use of flow.uses) {
                if (use.kind === "type-only" || use.role === "storage")
                    continue;
                if (use.role !== "call-target")
                    return undefined;
                let callee = use.reference;
                let call = ast.parent(callee);
                for (let depth = 0; call !== undefined && unwrap(call) === unwrap(callee); depth += 1) {
                    if (depth >= 256)
                        failTargetCompilerResourceLimit("tsonic", "Call-only alias callee", "depth", 256, declaration);
                    callee = call;
                    call = ast.parent(callee);
                }
                if (call === undefined || !ast.is.IsCallExpression(call) || ast.as.AsCallExpression(call)?.Expression !== callee)
                    return undefined;
                const target = navigation.call(call)?.signature;
                if (target === undefined || !overloads.has(target))
                    return undefined;
                calls.add(call);
            }
            const result = Object.freeze({
                expression, selectedDeclaration, ...(property === undefined ? {} : { access: property }),
                ...(selected.receiverDeclaration === undefined ? {} : { receiverDeclaration: selected.receiverDeclaration }),
                declarations: Object.freeze([...aliases]), calls: Object.freeze([...calls]),
            });
            for (const alias of aliases)
                cache.set(alias, result);
            return result;
        }
        catch (failure) {
            cache.delete(declaration);
            throw failure;
        }
    };
    return select;
}
//# sourceMappingURL=callable-aliases.js.map