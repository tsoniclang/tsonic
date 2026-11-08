import { sourceMayReadBeforeInitialization } from "./initialization-uses.js";
import { Node_Expression } from "../source-model/ast.js";
import { failTargetCompilerResourceLimit } from "../artifacts.js";
export function sourceCallableValueExpression(ast, node, options = {}) {
    const subject = node;
    for (let depth = 0; node !== undefined && depth < 256; depth += 1) {
        if (ast.is.IsParenthesizedExpression(node))
            node = ast.as.AsParenthesizedExpression(node)?.Expression;
        else if (ast.is.IsSatisfiesExpression(node))
            node = ast.as.AsSatisfiesExpression(node)?.Expression;
        else if (options.typeAssertions === "transparent" &&
            (ast.is.IsAsExpression(node) || ast.is.IsNonNullExpression(node) || ast.is.IsTypeAssertion(node)))
            node = Node_Expression(ast, node);
        else
            return node;
    }
    if (node !== undefined)
        failTargetCompilerResourceLimit("tsonic", "Callable value expression", "depth", 256, subject);
    return undefined;
}
export function createSourceCallableValueQuery(source, options = {}) {
    const { ast, navigation } = source;
    const expressionOptions = Object.freeze({ typeAssertions: options.typeAssertions });
    const stopAtDeclaration = options.stopAtDeclaration;
    const cache = new WeakMap();
    const member = (node) => ast.is.IsPropertyAccessExpression(node) || ast.is.IsElementAccessExpression(node);
    const receiverCache = new WeakMap();
    const receiverUnchanged = (declaration) => {
        const cached = receiverCache.get(declaration);
        if (cached !== undefined)
            return cached;
        const pending = [declaration];
        const visited = new Set();
        let remaining = 131072;
        let unchanged = true;
        for (let index = 0; unchanged && index < pending.length; index += 1) {
            if (--remaining < 0)
                failTargetCompilerResourceLimit("tsonic", "Callable receiver analysis", "steps", 131072, declaration);
            if (visited.size >= 1024)
                failTargetCompilerResourceLimit("tsonic", "Callable receiver analysis", "declarations", 1024, declaration);
            const current = pending[index];
            if (visited.has(current))
                continue;
            visited.add(current);
            const summary = navigation.declarationUseSummary(current);
            if (summary.bindingWritten || summary.memberWritten || current !== declaration && summary.exported) {
                unchanged = false;
                break;
            }
            for (const use of summary.uses) {
                if (--remaining < 0)
                    failTargetCompilerResourceLimit("tsonic", "Callable receiver analysis", "steps", 131072, declaration);
                if (use.throughMember || use.role === "type-only" || use.role === "source-linkage" ||
                    use.role === "call-target" || use.role === "comparison" || use.role === "condition")
                    continue;
                if (use.role !== "storage") {
                    unchanged = false;
                    break;
                }
                const flow = navigation.expressionValueFlow(use.reference);
                if (flow.storedOutsideBinding || flow.passedAsArgument || flow.returned || flow.yielded ||
                    flow.exported || flow.hasUnclassifiedUse || flow.memberWritten || flow.aliasDeclarations.length === 0) {
                    unchanged = false;
                    break;
                }
                for (const alias of flow.aliasDeclarations) {
                    if (--remaining < 0)
                        failTargetCompilerResourceLimit("tsonic", "Callable receiver analysis", "steps", 131072, declaration);
                    pending.push(alias);
                }
            }
        }
        receiverCache.set(declaration, unchanged);
        return unchanged;
    };
    const select = (input) => {
        const cached = cache.get(input);
        if (cached !== undefined)
            return cached ?? undefined;
        cache.set(input, null);
        const aliases = new Set();
        const visited = new Set();
        const resolve = (inputExpression, depth) => {
            if (depth >= 256)
                failTargetCompilerResourceLimit("tsonic", "Callable value selection", "depth", 256, inputExpression);
            let expression = sourceCallableValueExpression(ast, inputExpression, expressionOptions);
            while (expression !== undefined && ast.is.IsIdentifier(expression)) {
                const declaration = navigation.sourceReferenceFor(expression)?.declaration;
                if (declaration === undefined || navigation.declarationUseSummary(declaration).bindingWritten)
                    return undefined;
                if (declaration === stopAtDeclaration)
                    return {
                        expression, selectedDeclaration: declaration, aliases: Object.freeze([...aliases]),
                    };
                const initializer = ast.is.IsVariableDeclaration(declaration)
                    ? ast.as.AsVariableDeclaration(declaration)?.Initializer : undefined;
                if (initializer === undefined)
                    return {
                        expression, selectedDeclaration: declaration, aliases: Object.freeze([...aliases]),
                    };
                if (ast.variableDeclarationKind(declaration) !== "const" || !ast.is.IsIdentifier(ast.name(declaration)) ||
                    visited.has(declaration) ||
                    sourceMayReadBeforeInitialization(declaration, ast, navigation))
                    return undefined;
                if (visited.size >= 1024)
                    failTargetCompilerResourceLimit("tsonic", "Callable value aliases", "declarations", 1024, inputExpression);
                visited.add(declaration);
                aliases.add(declaration);
                expression = sourceCallableValueExpression(ast, initializer, expressionOptions);
            }
            if (expression === undefined || !member(expression))
                return undefined;
            const access = navigation.memberAccess(expression);
            const declaration = access?.declaration;
            if (access === undefined || access.optionalChain || declaration === undefined ||
                ast.is.IsGetAccessorDeclaration(declaration) || ast.is.IsSetAccessorDeclaration(declaration) ||
                navigation.expressionValueFlow(expression).memberWritten)
                return undefined;
            const receiver = resolve(access.receiver, depth + 1);
            if (receiver === undefined || !receiverUnchanged(receiver.selectedDeclaration))
                return undefined;
            const references = navigation.referencesToDeclaration(declaration);
            if (references.length > 131072)
                failTargetCompilerResourceLimit("tsonic", "Callable member references", "references", 131072, expression);
            for (const reference of references) {
                const parent = ast.parent(reference);
                const access = member(reference) ? reference : parent !== undefined && member(parent) ? parent : undefined;
                const selectedAccess = access === undefined ? undefined : navigation.memberAccess(access);
                if (selectedAccess === undefined || selectedAccess.accessMode === "read")
                    continue;
                return undefined;
            }
            return { expression, selectedDeclaration: declaration,
                access,
                receiverDeclaration: receiver.selectedDeclaration, aliases: Object.freeze([...aliases]) };
        };
        let selected;
        try {
            selected = resolve(input, 0);
        }
        catch (failure) {
            cache.delete(input);
            throw failure;
        }
        const result = selected === undefined ? undefined : Object.freeze(selected);
        cache.set(input, result ?? null);
        return result;
    };
    return select;
}
//# sourceMappingURL=callable-values.js.map