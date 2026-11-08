export const defaultSourceStorageLimits = Object.freeze({
    maximumNodes: 1048576,
    maximumEdges: 262144,
    maximumSubjectRows: 1048576,
    maximumTransportRows: 4194304,
    maximumSteps: 33554432,
});
export function createSourceStorageBudget(selection) {
    let failure;
    const limits = { ...defaultSourceStorageLimits };
    if (selection === null || typeof selection !== "object") {
        failure = "Source storage limits require a finite data-only selection.";
    }
    else {
        for (const key of Object.keys(defaultSourceStorageLimits)) {
            const descriptor = Object.getOwnPropertyDescriptor(selection, key);
            const value = descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
            if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0 || value > defaultSourceStorageLimits[key]) {
                failure = "Source storage limits must be positive safe integers no greater than the bounded defaults.";
                break;
            }
            limits[key] = value;
        }
    }
    let nodes = 0;
    let edges = 0;
    let subjects = 0;
    let rows = 0;
    let peakRows = 0;
    let steps = 0;
    const reject = (reason) => { failure ?? (failure = reason); };
    const admit = (value, maximum, label) => {
        if (failure !== undefined)
            return false;
        if (value > maximum)
            reject(`Source storage transport exceeds its finite ${label} budget.`);
        return failure === undefined;
    };
    const createRows = () => {
        let retained = 0;
        let released = false;
        return Object.freeze({
            add(cost) {
                if (released || !Number.isSafeInteger(cost) || cost <= 0) {
                    reject("Source storage rows require a live owner and a finite positive reservation.");
                    return false;
                }
                if (!admit(rows + cost, limits.maximumTransportRows, "transport-row"))
                    return false;
                rows += cost;
                peakRows = Math.max(peakRows, rows);
                retained += cost;
                return true;
            },
            release() {
                if (released)
                    return;
                rows -= retained;
                retained = 0;
                released = true;
            },
        });
    };
    return Object.freeze({
        limits: Object.freeze({ ...limits }),
        failure: () => failure,
        usage: () => Object.freeze({ nodes, edges, subjects, rows, peakRows, steps }),
        reject,
        node: () => admit(++nodes, limits.maximumNodes, "source-node"),
        edge: () => admit(++edges, limits.maximumEdges, "edge"),
        subject: (cost) => {
            if (!Number.isSafeInteger(cost) || cost <= 0) {
                reject("A source storage subject requires a finite positive row cost.");
                return false;
            }
            subjects += cost;
            return admit(subjects, limits.maximumSubjectRows, "subject");
        },
        row: () => {
            if (!admit(rows + 1, limits.maximumTransportRows, "transport-row"))
                return false;
            rows += 1;
            peakRows = Math.max(peakRows, rows);
            return true;
        },
        createRows,
        withRows(collect) {
            const owned = createRows();
            try {
                return collect(owned);
            }
            finally {
                owned.release();
            }
        },
        step: () => admit(++steps, limits.maximumSteps, "analysis-work"),
    });
}
//# sourceMappingURL=resource-budget.js.map