import { sourceStorageInstanceCaptures } from "../model/construction.js";
export function createSourceStorageInvocationResults(source, budget, queries) {
    const hasAllocation = (subject) => source.ast.is.IsNewExpression(subject.node) &&
        !queries.hasResultAlias(subject.node);
    const forInvocation = (candidate, invocation, bindings, capture) => {
        const target = queries.targetFor(invocation);
        const states = new Set();
        const selected = source.navigation.call(invocation);
        const contract = selected?.selection === "resolved" ? selected.signature : undefined;
        if (capture === undefined && contract === candidate && source.ast.body(candidate) === undefined) {
            const selected = queries.bindingsFor(candidate, invocation, bindings, bindings, target);
            if (selected !== undefined)
                states.add(selected);
            return states;
        }
        if (target === undefined) {
            if (capture !== undefined)
                return states;
            const selected = queries.bindingsFor(candidate, invocation, bindings, bindings, undefined);
            if (selected !== undefined)
                states.add(selected);
            return states;
        }
        const values = queries.valuesFor(target, bindings);
        if (values === undefined)
            return states;
        const owner = source.ast.is.IsConstructorDeclaration(candidate) ? source.ast.parent(candidate) : candidate;
        const captures = new Set();
        if (owner !== undefined && (source.ast.is.IsClassDeclaration(owner) || source.ast.is.IsClassExpression(owner))) {
            const selected = sourceStorageInstanceCaptures(source, budget, candidate, values, queries);
            if (selected === undefined)
                return states;
            for (const value of selected)
                captures.add(value);
        }
        else
            for (const value of values) {
                if (!budget.step())
                    break;
                const selected = source.navigation.callableImplementation(value.subject.node);
                if (selected.kind === "resolved" && selected.implementation.declaration === candidate)
                    captures.add(value);
            }
        for (const captured of captures) {
            if (!budget.step())
                break;
            if (capture !== undefined && (captured.subject !== capture.subject || captured.bindings !== capture.bindings))
                continue;
            const selected = queries.bindingsFor(candidate, invocation, bindings, captured.bindings, captured.subject);
            if (selected !== undefined)
                states.add(selected);
        }
        return states;
    };
    return Object.freeze({ forInvocation, hasAllocation });
}
//# sourceMappingURL=invocation-results.js.map