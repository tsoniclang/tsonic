import { sourceStorageTypesEqual } from "../model/components.js";
import { sourceStorageProjectionType } from "../scoped/projection-views.js";
export function createSourceStorageDomainSelection(source, budget, transport, domains, bindingStates, bindingView, subjectReason, unresolved) {
    const typedOrigins = (subjects, qualified) => {
        const origins = [];
        for (const origin of subjects) {
            if (!budget.step())
                return unresolved(budget.failure());
            const sourceFile = transport.sourceFileFor(origin);
            const views = qualified.get(origin);
            const types = [];
            for (const view of views === undefined ? [undefined] : views) {
                if (!budget.step())
                    return unresolved(budget.failure());
                const type = sourceStorageProjectionType(source, origin, view, sourceFile);
                if (type === undefined || sourceFile === undefined)
                    return unresolved("A source storage origin has no exact checked component type.");
                if (!types.some(seen => sourceStorageTypesEqual(seen, type))) {
                    origins.push(Object.freeze({ subject: origin, type, sourceFile }));
                    types.push(type);
                }
            }
        }
        return Object.freeze({ kind: "resolved", origins: Object.freeze(origins) });
    };
    const selectDomain = (subject, bindings, purpose) => transport.substitutions.withQuery(() => {
        const reason = subjectReason(subject) ?? transport.directlyUnresolvedFor(subject);
        if (reason !== undefined)
            return unresolved(reason);
        const states = bindingStates.get(bindings);
        if (states === undefined)
            return unresolved("Invocation substitutions belong to a different source storage query.");
        const subjects = new Set();
        const boundaries = [];
        const producerStates = new Map();
        const qualified = new Map();
        let absence = false;
        for (const state of states) {
            if (!budget.step())
                return unresolved(budget.failure());
            const selected = domains.select(subject, state, purpose);
            if (selected.reason !== undefined)
                return unresolved(selected.reason);
            absence || (absence = selected.absence);
            for (const origin of selected.boundSubjects) {
                if (origin.views === undefined)
                    continue;
                const views = qualified.get(origin.subject) ?? new Set();
                views.add(origin.views);
                qualified.set(origin.subject, views);
            }
            for (const origin of selected.subjects) {
                if (!budget.step())
                    return unresolved(budget.failure());
                subjects.add(origin);
            }
            if (purpose === "storage-producers")
                for (const origin of selected.boundSubjects) {
                    if (!budget.step())
                        return unresolved(budget.failure());
                    const states = producerStates.get(origin.subject) ?? new Set();
                    states.add(origin.bindings);
                    producerStates.set(origin.subject, states);
                }
            for (const boundary of selected.boundaries) {
                if (!budget.step())
                    return unresolved(budget.failure());
                const bindings = bindingView([boundary.bindings]);
                if (bindings === undefined)
                    return unresolved(budget.failure() ?? "A source boundary requires its original owned activation bindings.");
                if (!boundaries.some(selected => selected.kind === boundary.kind && selected.subject === boundary.subject &&
                    selected.owner === boundary.owner && selected.exposure === boundary.exposure && selected.bindings === bindings))
                    boundaries.push(Object.freeze({ ...boundary, bindings }));
            }
        }
        if (budget.failure() !== undefined)
            return unresolved(budget.failure());
        if (subjects.size === 0 && boundaries.length === 0 && !absence)
            return unresolved("A source storage cycle has no proven original owner.");
        const origins = typedOrigins([...subjects], qualified);
        if (origins.kind === "unresolved")
            return origins;
        return boundaries.length === 0 ? Object.freeze({ kind: "complete", origins: origins.origins, producerStates, includesAbsence: absence })
            : Object.freeze({ kind: "open", origins: origins.origins, producerStates, boundaries: Object.freeze(boundaries), includesAbsence: absence });
    });
    return { typedOrigins, selectDomain };
}
//# sourceMappingURL=domain-selection.js.map