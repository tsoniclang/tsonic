import { createTargetGraphComponentQuery } from "../../graph-component-query.js";
export function createSourceStorageContextFootprints(budget, inputsFor, locationFor, applicationFor = () => undefined) {
    const noInputs = new Set();
    let empty;
    let pendingEmpty;
    let generated;
    let running = false;
    const ownRows = () => {
        const rows = budget.createRows();
        (generated ?? (generated = [])).push(rows);
        return rows;
    };
    const select = createTargetGraphComponentQuery(subject => {
        const port = subject.kind === "receiver" || subject.kind === "input";
        const application = port ? undefined : applicationFor(subject);
        if (budget.failure() !== undefined)
            return undefined;
        const location = port || application !== undefined ? undefined : locationFor(subject);
        const inputs = port || application !== undefined || location === "binding" ? noInputs : inputsFor(subject);
        if (inputs === undefined || budget.failure() !== undefined)
            return undefined;
        return { data: { port: port ? subject : undefined, location: location === undefined ? undefined : subject, application },
            neighbours: inputs };
    }, members => {
        let selected;
        let mutable;
        const add = (kind, value) => {
            if ((mutable ?? selected)?.[kind].has(value))
                return true;
            if (mutable === undefined) {
                const rows = ownRows();
                if (!rows.add(1))
                    return false;
                mutable = { rows, ports: new Set(), locations: new Set() };
                if (selected !== undefined)
                    for (const name of ["ports", "locations"])
                        for (const input of selected[name]) {
                            if (!budget.step() || !rows.add(1))
                                return false;
                            mutable[name].add(input);
                        }
            }
            if (!mutable.rows.add(1))
                return false;
            mutable[kind].add(value);
            return true;
        };
        const merge = (footprint) => {
            if (selected === footprint && mutable === undefined)
                return true;
            if (selected === undefined && mutable === undefined) {
                selected = footprint;
                return true;
            }
            for (const name of ["ports", "locations"])
                for (const input of footprint[name])
                    if (!budget.step() || !add(name, input))
                        return false;
            return true;
        };
        for (const member of members) {
            for (const successor of member.successors)
                if (!merge(successor))
                    return undefined;
            const { port, location, application } = member.data;
            if (application !== undefined && !merge(application))
                return undefined;
            if (port !== undefined && !add("ports", port))
                return undefined;
            if (location !== undefined && !add("locations", location))
                return undefined;
        }
        if (mutable !== undefined)
            return Object.freeze({ ports: mutable.ports, locations: mutable.locations });
        if (selected !== undefined)
            return selected;
        if (pendingEmpty === undefined) {
            if (!ownRows().add(1))
                return undefined;
            pendingEmpty = Object.freeze({ ports: new Set(), locations: new Set() });
        }
        return pendingEmpty;
    }, budget);
    return Object.freeze({ select(subject) {
            if (running) {
                budget.reject("Source storage context footprints cannot expose an unfinished reentrant selection.");
                return undefined;
            }
            running = true;
            pendingEmpty = empty;
            let completed = false;
            try {
                const selected = select(subject);
                if (selected === undefined || budget.failure() !== undefined)
                    return undefined;
                completed = true;
                empty = pendingEmpty;
                return selected;
            }
            finally {
                running = false;
                if (!completed)
                    for (const rows of generated ?? [])
                        rows.release();
                generated = undefined;
                pendingEmpty = undefined;
            }
        } });
}
//# sourceMappingURL=context-footprints.js.map