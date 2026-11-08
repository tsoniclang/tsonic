export function createSourceStorageDomainWitnesses(budget) {
    const groups = new Map();
    const rows = budget.createRows();
    let hasInputs = false;
    const empty = Object.freeze([]);
    const noInputs = new Set();
    return Object.freeze({
        hasInputs: () => hasInputs,
        add(subject, kind, exposure, owner, creationBindings) {
            if (subject === undefined || !budget.step())
                return;
            const group = groups.get(subject);
            const kinds = creationBindings === undefined ? group?.kinds : group?.contexts?.get(creationBindings);
            const exposures = kinds?.get(kind);
            const owners = exposures?.get(exposure);
            if (owners?.has(owner))
                return;
            const newInput = kind === "external-input" && group?.inputs?.has(owner) !== true;
            const cost = 2 + (group === undefined ? 1 : 0) + (exposures === undefined ? 1 : 0) + (owners === undefined ? 1 : 0)
                + (newInput ? group?.inputs === undefined ? 2 : 1 : 0)
                + (creationBindings === undefined ? 0 : 1 + (group?.contexts === undefined ? 1 : 0) + (kinds === undefined ? 1 : 0));
            if (!rows.add(cost))
                return;
            const selected = group ?? { values: [], kinds: new Map() };
            const selectedKinds = creationBindings === undefined ? selected.kinds
                : kinds ?? new Map();
            const selectedExposures = exposures ?? new Map();
            const selectedOwners = owners ?? new Set();
            selectedOwners.add(owner);
            selectedExposures.set(exposure, selectedOwners);
            selectedKinds.set(kind, selectedExposures);
            if (creationBindings !== undefined) {
                selected.contexts ?? (selected.contexts = new Map());
                selected.contexts.set(creationBindings, selectedKinds);
            }
            const witness = Object.freeze({ kind, subject, exposure, ...(owner === undefined ? {} : { owner }),
                ...(creationBindings === undefined ? {} : { creationBindings }) });
            selected.values.push(witness);
            if (newInput) {
                selected.inputs ?? (selected.inputs = new Set());
                selected.inputs.add(owner);
                hasInputs = true;
            }
            groups.set(subject, selected);
        },
        forSubject(subject, kind) {
            const group = groups.get(subject);
            if (kind === undefined)
                return group?.values ?? empty;
            if (group?.inputs === undefined)
                return empty;
            return group.values.filter(value => budget.step() && value.kind === kind);
        },
        inputOwners(subject) {
            return groups.get(subject)?.inputs ?? noInputs;
        },
    });
}
//# sourceMappingURL=domain-witnesses.js.map