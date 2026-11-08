export function createSourceStorageTransitionSuccessors(context) {
    const { source, scopes, absent, instanceCaptures } = context;
    const { ast, navigation } = source;
    return (term) => {
        if (term.condition.kind === "input-frontier")
            return { kind: "replace", terms: [term.condition] };
        if (term.condition.kind !== "leaf")
            return { kind: "project", inputs: [term.condition], select: condition => [condition.kind === "empty" || condition.kind === "input-frontier" ? condition
                        : Object.freeze({ ...term, condition })] };
        const node = term.condition.subject.node;
        if (ast.is.IsClassDeclaration(node) || ast.is.IsClassExpression(node)) {
            const owner = ast.is.IsConstructorDeclaration(term.capture.owner) ? ast.parent(term.capture.owner) : term.capture.owner;
            if (owner === undefined)
                return undefined;
            const captures = instanceCaptures(term.capture.owner, term.condition);
            if (captures === undefined)
                return undefined;
            const terms = [];
            for (const captured of captures) {
                const value = scopes.applyTerm(term.value, new Map([[term.capture, captured.bindings]]));
                if (value === undefined)
                    return undefined;
                terms.push(value);
            }
            return { kind: "replace", terms };
        }
        else {
            const selected = navigation.callableImplementation(node);
            if (selected.kind !== "resolved")
                return { kind: "replace", terms: [] };
            if (selected.implementation.declaration !== term.capture.owner)
                return absent;
        }
        const value = scopes.applyTerm(term.value, new Map([[term.capture, term.condition.scope]]));
        return value === undefined ? undefined : { kind: "replace", terms: [value] };
    };
}
//# sourceMappingURL=transition-successors.js.map