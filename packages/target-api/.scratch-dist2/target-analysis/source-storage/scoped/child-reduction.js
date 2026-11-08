export function sourceStorageChildDependencies(selected, dependencies) {
    return dependencies === undefined || selected?.kind !== "replace" ? selected
        : { ...selected, dependencies: [...selected.dependencies ?? [], ...dependencies] };
}
export function completeSourceStorageChildReduction(budget, initial, reduce) {
    return budget.withRows(rows => {
        const pending = [];
        let selected = initial;
        while (selected?.kind === "child-reduction") {
            if (!rows.add(1))
                return undefined;
            pending.push(selected);
            selected = reduce(selected.child, selected.context.correlated ?? true);
        }
        if (selected?.kind === "project" && pending.length !== 0) {
            const projection = selected;
            return { kind: "project", inputs: projection.inputs, select: value => {
                    let terms = projection.select(value);
                    for (let index = pending.length - 1; terms !== undefined && index >= 0; index -= 1) {
                        const frame = pending[index];
                        terms = terms.map(child => child.kind === "empty" ? child : frame.replace(child));
                    }
                    return terms;
                } };
        }
        for (let index = pending.length - 1; index >= 0 && selected?.kind === "replace"; index -= 1) {
            const { child, replace, context } = pending[index];
            selected = sourceStorageChildDependencies({ kind: "replace",
                terms: selected.terms.map(child => child.kind === "empty" ? child : replace(child)), dependencies: selected.dependencies,
                witnesses: [...(selected.witnesses ?? []).map(witness => context.contributes !== false ? witness
                        : { ...witness, contributes: false, observesValue: false }),
                    ...child.kind === "reference" || child.kind === "leaf"
                        ? [{ subject: child.subject, bindings: child.scope, contributes: context.contributes !== false,
                                observesValue: context.contributes !== false }] : []] }, context.dependencies);
        }
        return selected;
    });
}
//# sourceMappingURL=child-reduction.js.map