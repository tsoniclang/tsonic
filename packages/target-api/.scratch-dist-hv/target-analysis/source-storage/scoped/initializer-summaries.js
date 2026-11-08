import { sourceStorageIsDirectCreation } from "../model/subjects.js";
import { sourceStorageReference } from "../graph/scoped-model.js";
export function createSourceStorageInitializerSummaries(source, budget, scopes, creation, keys) {
    const summaries = new Map();
    const rows = budget.createRows();
    const initializer = (value) => {
        const retained = summaries.get(value);
        if (retained !== undefined)
            return retained;
        const owner = creation.ownerFor(value);
        if (owner === undefined || !source.ast.is.IsClassDeclaration(owner) && !source.ast.is.IsClassExpression(owner))
            return undefined;
        const footprint = creation.footprints.select(value);
        if (footprint === undefined)
            return undefined;
        const captures = [];
        for (const location of footprint.locations) {
            if (!budget.step())
                return undefined;
            const capturedOwner = creation.ownerFor(location);
            if (capturedOwner !== owner)
                captures.push({ subject: location, owner: capturedOwner });
        }
        if (!rows.add(2 + footprint.ports.size + captures.length))
            return undefined;
        const selected = Object.freeze({ owner, ports: Object.freeze([...footprint.ports]),
            captures: Object.freeze(captures), contexts: new Map() });
        summaries.set(value, selected);
        return selected;
    };
    return Object.freeze({
        instantiate(value, scope) {
            if (budget.failure() !== undefined)
                return undefined;
            if (sourceStorageIsDirectCreation(value, source.ast))
                return sourceStorageReference(value, scope);
            const selected = initializer(value);
            if (budget.failure() !== undefined)
                return undefined;
            if (selected === undefined || scope.kind !== "frame" || scope.owner !== selected.owner || scope.invocation === undefined)
                return sourceStorageReference(value, scope);
            return budget.withRows(temporary => {
                const inputs = [];
                for (const input of selected.ports) {
                    if (!budget.step() || !temporary.add(1))
                        return undefined;
                    inputs.push({ subject: input, term: sourceStorageReference(input, scope) });
                }
                for (const capture of selected.captures) {
                    if (!budget.step())
                        return undefined;
                    const captured = capture.owner === undefined ? scopes.empty : scopes.owningScope(scope, capture.owner);
                    if (captured === undefined)
                        return sourceStorageReference(value, scope);
                    if (!temporary.add(1))
                        return undefined;
                    inputs.push({ subject: capture.subject, term: sourceStorageReference(capture.subject, captured) });
                }
                const context = inputs.length === 0 ? undefined : keys.context([inputs]);
                if (inputs.length !== 0 && context === undefined)
                    return undefined;
                const parameter = selected.contexts.get(context);
                if (parameter === undefined) {
                    if (!rows.add(1))
                        return undefined;
                    selected.contexts.set(context, scope);
                    return sourceStorageReference(value, scope);
                }
                return parameter === scope ? sourceStorageReference(value, scope)
                    : Object.freeze({ kind: "instantiation", value: sourceStorageReference(value, parameter), parameter, scope });
            });
        },
        release() { summaries.clear(); rows.release(); },
    });
}
//# sourceMappingURL=initializer-summaries.js.map