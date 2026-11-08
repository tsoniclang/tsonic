import { AsExpressionWithTypeArguments, sourceSuperConstructor } from "../../../source-navigation/index.js";
export function sourceStorageClassLineages(source, budget, values, queries, mode) {
    if (values === undefined)
        return undefined;
    return budget.withRows(rows => {
        const lineages = [];
        const pending = [];
        const schedule = (value, classes) => {
            if (!rows.add(2 + classes.length))
                return false;
            pending.push({ value, classes });
            return true;
        };
        const finish = (classes, complete, implementation, nativeBase) => {
            if (!rows.add(2 + classes.length + (nativeBase === undefined ? 0 : 4)))
                return false;
            lineages.push(Object.freeze({ classes: Object.freeze([...classes]), complete, implementation, nativeBase }));
            return true;
        };
        for (const value of values)
            if (!budget.step() || !schedule(value, []))
                return undefined;
        while (pending.length !== 0) {
            if (!budget.step())
                return undefined;
            const { value, classes } = pending.pop();
            const node = value.subject.node;
            if (value.subject.kind !== "value" || value.subject.projection.length !== 0 ||
                classes.some(previous => previous.subject === value.subject && previous.bindings === value.bindings)) {
                if (!finish(classes, false))
                    return undefined;
                continue;
            }
            if (!source.ast.is.IsClassDeclaration(node) && !source.ast.is.IsClassExpression(node) ||
                !source.navigation.isProjectDeclaration(node)) {
                const constructors = queries.nativeConstructorsFor(value.subject);
                const nativeBase = constructors === undefined || constructors.length === 0 ? undefined
                    : Object.freeze({ ...value, constructors });
                if (!finish(classes, nativeBase !== undefined, undefined, nativeBase))
                    return undefined;
                continue;
            }
            const lineage = [...classes, value];
            if (mode === undefined) {
                const constructors = source.navigation.classConstructors(node);
                if (constructors.kind !== "resolved") {
                    if (!finish(lineage, false))
                        return undefined;
                    continue;
                }
                if (!constructors.implicit) {
                    const implemented = source.ast.members(node).filter(member => member !== undefined &&
                        source.ast.is.IsConstructorDeclaration(member) && source.ast.body(member) !== undefined);
                    if (!finish(lineage, implemented.length === 1, implemented.length === 1 ? implemented[0] : undefined))
                        return undefined;
                    continue;
                }
            }
            const heritage = source.navigation.declaredHeritage(node);
            if (heritage.kind !== "resolved") {
                if (!finish(lineage, false))
                    return undefined;
                continue;
            }
            const bases = heritage.edges.filter(edge => edge.kind === "extends");
            if (bases.length === 0) {
                if (!finish(lineage, true))
                    return undefined;
                continue;
            }
            if (bases.length !== 1) {
                if (!finish(lineage, false))
                    return undefined;
                continue;
            }
            const subject = queries.subjectFor(AsExpressionWithTypeArguments(source.ast, bases[0].heritage)?.Expression);
            const inherited = subject === undefined ? undefined : queries.valuesFor(subject, value.bindings);
            if (inherited === undefined)
                return undefined;
            for (const selected of inherited)
                if (!budget.step() || !schedule(selected, lineage))
                    return undefined;
        }
        return Object.freeze(lineages);
    });
}
export function sourceStorageInstanceCaptures(source, budget, candidate, values, queries) {
    const constructor = source.ast.is.IsConstructorDeclaration(candidate);
    const owner = constructor ? source.ast.parent(candidate) : candidate;
    if (owner === undefined)
        return undefined;
    const lineages = sourceStorageClassLineages(source, budget, values, queries, constructor ? undefined : "heritage");
    if (lineages === undefined || lineages.some(lineage => !lineage.complete))
        return undefined;
    const captures = new Set();
    for (const lineage of lineages)
        for (const selected of lineage.classes) {
            if (!budget.step())
                return undefined;
            if (constructor && lineage.implementation !== candidate)
                continue;
            if (selected.subject.node === owner)
                captures.add(selected);
        }
    return captures;
}
export function sourceStorageAllocations(source, budget, invocation, bindings, receiverOriginsFor) {
    return budget.withRows(temporary => {
        if (source.ast.is.IsNewExpression(invocation))
            return Object.freeze({ kind: "resolved",
                allocations: Object.freeze([Object.freeze({ call: invocation, callerBindings: bindings })]) });
        const base = sourceSuperConstructor(invocation, source, budget.step);
        if (base === undefined)
            return Object.freeze({ kind: "unresolved",
                reason: "Constructor execution requires its actual checked allocation receiver, not guessed heritage order." });
        const selected = receiverOriginsFor(base.owner, bindings);
        if ("kind" in selected)
            return selected;
        const allocations = [];
        const seen = new Map();
        for (const origin of selected) {
            if (!budget.step())
                return Object.freeze({ kind: "unresolved", reason: budget.failure() });
            if (origin.subject.kind !== "value" || origin.subject.projection.length !== 0 || !source.ast.is.IsNewExpression(origin.subject.node))
                return Object.freeze({ kind: "unresolved", reason: "Constructor execution requires every actual receiver origin to identify its checked allocation." });
            const previous = seen.get(origin.subject.node);
            if (previous?.has(origin.bindings))
                continue;
            if (!temporary.add(previous === undefined ? 3 : 2))
                return Object.freeze({ kind: "unresolved", reason: budget.failure() });
            const contexts = previous ?? new Set();
            contexts.add(origin.bindings);
            seen.set(origin.subject.node, contexts);
            allocations.push(Object.freeze({ call: origin.subject.node, callerBindings: origin.bindings }));
        }
        return allocations.length === 0 ? Object.freeze({ kind: "unresolved",
            reason: "Constructor execution has no completed actual allocation receiver." })
            : Object.freeze({ kind: "resolved", allocations: Object.freeze(allocations) });
    });
}
//# sourceMappingURL=construction.js.map