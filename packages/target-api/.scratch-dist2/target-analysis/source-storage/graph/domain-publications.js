export function createSourceStorageDomainPublications(budget, emptyBindings) {
    const pending = [];
    const admitted = new Map();
    const scopedAdmissions = new Map();
    const callables = new Map();
    const rows = budget.createRows();
    let closed = false;
    return Object.freeze({
        callable(owner, exposure) {
            if (closed) {
                budget.reject("Source storage publications require a live construction owner.");
                return false;
            }
            if (!budget.step())
                return false;
            const exposures = callables.get(owner);
            if (exposures?.has(exposure) || !rows.add(exposures === undefined ? 2 : 1))
                return false;
            const selected = exposures ?? new Set();
            selected.add(exposure);
            callables.set(owner, selected);
            return true;
        },
        add(subject, type, sourceFile, exposure, writes, kind, externalEntry, inputOwner, receiver, bindings) {
            if (closed) {
                budget.reject("Source storage publications require a live construction owner.");
                return;
            }
            if (!budget.step())
                return;
            const scoped = receiver !== undefined || bindings !== emptyBindings;
            const contextSubject = receiver?.subject ?? subject;
            const contexts = scoped ? scopedAdmissions.get(contextSubject) : undefined;
            const views = contexts?.get(bindings);
            const contracts = views?.get(receiver?.view);
            const existingAdmissions = scoped ? contracts?.get(receiver?.type) : admitted;
            const types = existingAdmissions?.get(subject);
            const owners = types?.get(type);
            const exposures = owners?.get(inputOwner);
            const previous = exposures?.get(exposure);
            const phase = kind === "opaque-write" ? 4 : kind === "unclassified-exposure" ? 8 : 0;
            const flag = 1 << (phase + (externalEntry ? 2 : 0) + (writes ? 1 : 0));
            if (((previous ?? 0) & flag) !== 0)
                return;
            const publication = Object.freeze({ subject, type, sourceFile, exposure, writes, kind, externalEntry,
                ...(inputOwner === undefined ? {} : { inputOwner }), receiver, bindings });
            if (!rows.add(2 + (types === undefined ? 1 : 0) +
                (owners === undefined ? 1 : 0) + (exposures === undefined ? 1 : 0) + (previous === undefined ? 1 : 0) +
                (scoped ? (contexts === undefined ? 1 : 0) + (views === undefined ? 1 : 0) +
                    (contracts === undefined ? 1 : 0) + (existingAdmissions === undefined ? 1 : 0) +
                    (receiver === undefined ? 0 : 1) : 0)))
                return;
            const selectedTypes = types ?? new Map();
            const selectedOwners = owners ?? new Map();
            const selectedExposures = exposures ?? new Map();
            selectedExposures.set(exposure, (previous ?? 0) | flag);
            selectedOwners.set(inputOwner, selectedExposures);
            selectedTypes.set(type, selectedOwners);
            const retainedAdmissions = existingAdmissions ?? new Map();
            retainedAdmissions.set(subject, selectedTypes);
            if (scoped) {
                const retainedContexts = contexts ?? new Map();
                const retainedViews = views ?? new Map();
                const retainedContracts = contracts ?? new Map();
                retainedContracts.set(receiver?.type, retainedAdmissions);
                retainedViews.set(receiver?.view, retainedContracts);
                retainedContexts.set(bindings, retainedViews);
                scopedAdmissions.set(contextSubject, retainedContexts);
            }
            pending.push(publication);
        },
        size: () => pending.length,
        at: (index) => pending[index],
        finish() {
            if (closed)
                return;
            closed = true;
            pending.length = 0;
            admitted.clear();
            scopedAdmissions.clear();
            callables.clear();
            rows.release();
        },
    });
}
//# sourceMappingURL=domain-publications.js.map