const defaultMaximumContracts = 131072;
const defaultMaximumRevisionsPerContract = 256;
const defaultMaximumEvaluations = 4194304;
export function resolveTargetContractFixedPoint(request) {
    const equals = request.equals ?? Object.is;
    const maximumContracts = checkedPositiveLimit(request.maximumContracts, defaultMaximumContracts, "maximumContracts");
    const maximumRevisionsPerContract = checkedPositiveLimit(request.maximumRevisionsPerContract, defaultMaximumRevisionsPerContract, "maximumRevisionsPerContract");
    const maximumEvaluations = checkedPositiveLimit(request.maximumEvaluations, defaultMaximumEvaluations, "maximumEvaluations");
    const roots = normalizeContractIds(request.roots);
    if (roots.kind === "rejected") {
        return rejectedContracts([{ reason: roots.reason }]);
    }
    const states = new Map();
    const dependenciesById = new Map();
    const reverse = new Map();
    const observedById = new Map();
    const observedReverse = new Map();
    const failures = new Map();
    const blocked = new Set();
    const deferred = new Map();
    const queue = [];
    let queueHead = 0;
    const queued = new Set();
    const discovered = new Set();
    let evaluations = 0;
    let currentReads;
    const discard = (id) => {
        states.delete(id);
        deferred.delete(id);
        replaceReverseDependencies(id, dependenciesById.get(id) ?? [], [], reverse);
        dependenciesById.delete(id);
    };
    const invalidateDependents = (owner, preserveTerminalFailures) => {
        const pending = [owner];
        const invalidated = new Set(pending);
        for (let cursor = 0; cursor < pending.length; cursor += 1) {
            const id = pending[cursor];
            const dependents = new Set([...reverse.get(id) ?? [], ...observedReverse.get(id) ?? []]);
            for (const dependent of dependents) {
                if (invalidated.has(dependent) || blocked.has(dependent) || preserveTerminalFailures && failures.has(dependent))
                    continue;
                invalidated.add(dependent);
                blocked.add(dependent);
                failures.delete(dependent);
                discard(dependent);
                pending.push(dependent);
            }
        }
    };
    const reject = (id, failure) => {
        discard(id);
        failures.set(id, Object.freeze(failure));
        invalidateDependents(id, false);
    };
    const block = (id) => {
        blocked.add(id);
        failures.delete(id);
        discard(id);
        invalidateDependents(id, true);
    };
    const fatal = (failure) => rejectedContracts([...failures.values(), failure]);
    const enqueue = (id) => {
        if (failures.has(id) || blocked.has(id))
            return undefined;
        if (discovered.size >= maximumContracts &&
            !discovered.has(id)) {
            return {
                contractId: id,
                reason: `Target contract closure exceeds the ${maximumContracts}-contract limit.`,
            };
        }
        if (!queued.has(id)) {
            discovered.add(id);
            queued.add(id);
            queue.push(id);
        }
        return undefined;
    };
    for (const root of roots.ids) {
        const rejection = enqueue(root);
        if (rejection !== undefined) {
            return fatal(rejection);
        }
    }
    const context = Object.freeze({
        get(id) {
            currentReads?.add(id);
            return states.get(id)?.contract;
        },
        revision(id) {
            currentReads?.add(id);
            return states.get(id)?.revision;
        },
    });
    while (queueHead < queue.length) {
        const id = queue[queueHead++];
        queued.delete(id);
        if (failures.has(id) || blocked.has(id))
            continue;
        evaluations += 1;
        if (evaluations > maximumEvaluations) {
            return fatal({
                contractId: id,
                reason: `Target contract closure exceeds the ${maximumEvaluations}-evaluation limit.`,
            });
        }
        const reads = new Set();
        let evaluation;
        currentReads = reads;
        try {
            evaluation = request.evaluate(id, context);
        }
        finally {
            currentReads = undefined;
        }
        const observed = normalizeContractIds([...reads]);
        if (observed.kind === "rejected")
            return fatal({ contractId: id, reason: observed.reason });
        replaceReverseDependencies(id, observedById.get(id) ?? [], observed.ids, observedReverse);
        observedById.set(id, observed.ids);
        const failedDependency = (dependency) => dependency !== id &&
            (failures.has(dependency) || blocked.has(dependency));
        if (evaluation.kind === "rejected") {
            if (observed.ids.some(failedDependency)) {
                block(id);
                continue;
            }
            reject(id, {
                contractId: id,
                reason: evaluation.reason,
                ...(evaluation.cause === undefined ? {} : { cause: evaluation.cause }),
            });
            continue;
        }
        const normalizedDependencies = normalizeContractIds(evaluation.kind === "resolved"
            ? evaluation.revision.dependencies
            : evaluation.dependencies);
        if (normalizedDependencies.kind === "rejected") {
            return fatal({ contractId: id, reason: normalizedDependencies.reason });
        }
        replaceReverseDependencies(id, dependenciesById.get(id) ?? [], normalizedDependencies.ids, reverse);
        dependenciesById.set(id, normalizedDependencies.ids);
        if (observed.ids.some(failedDependency) || normalizedDependencies.ids.some(failedDependency)) {
            block(id);
            continue;
        }
        for (const dependency of normalizedDependencies.ids) {
            if (!states.has(dependency) && !deferred.has(dependency)) {
                const rejection = enqueue(dependency);
                if (rejection !== undefined) {
                    return fatal(rejection);
                }
            }
        }
        if (evaluation.kind === "deferred") {
            deferred.set(id, evaluation.reason);
            continue;
        }
        deferred.delete(id);
        const previous = states.get(id);
        if (previous !== undefined &&
            equals(previous.contract, evaluation.revision.contract) &&
            stringArraysEqual(previous.dependencies, normalizedDependencies.ids)) {
            continue;
        }
        if (previous?.history.some((candidate) => equals(candidate.contract, evaluation.revision.contract) &&
            stringArraysEqual(candidate.dependencies, normalizedDependencies.ids)) === true) {
            reject(id, {
                contractId: id,
                reason: "Target contract analysis oscillated between previous revisions.",
            });
            continue;
        }
        const revision = (previous?.revision ?? 0) + 1;
        if (revision > maximumRevisionsPerContract) {
            reject(id, {
                contractId: id,
                reason: `Target contract '${id}' exceeds the ${maximumRevisionsPerContract}-revision limit.`,
            });
            continue;
        }
        states.set(id, {
            contract: evaluation.revision.contract,
            dependencies: normalizedDependencies.ids,
            revision,
            history: previous === undefined
                ? []
                : [...previous.history, Object.freeze({
                        contract: previous.contract,
                        dependencies: previous.dependencies,
                    })],
        });
        for (const dependent of reverse.get(id) ?? []) {
            const rejection = enqueue(dependent);
            if (rejection !== undefined) {
                return fatal(rejection);
            }
        }
        if (queueHead >= 131072 && queueHead * 2 >= queue.length) {
            queue.splice(0, queueHead);
            queueHead = 0;
        }
    }
    if (deferred.size > 0) {
        for (const [contractId, reason] of [...deferred.entries()].sort(([left], [right]) => left.localeCompare(right))) {
            if (blocked.has(contractId) || failures.has(contractId))
                continue;
            reject(contractId, { contractId, reason: `Target contract closure remained deferred. ${reason}` });
        }
    }
    if (failures.size > 0)
        return rejectedContracts([...failures.values()]);
    const ids = Object.freeze([...states.keys()].sort());
    const frozenStates = new Map([...states].map(([id, state]) => [
        id,
        Object.freeze({
            contract: state.contract,
            dependencies: Object.freeze([...state.dependencies]),
            revision: state.revision,
        }),
    ]));
    const frozenReverse = new Map([...reverse].map(([id, dependents]) => [
        id,
        Object.freeze([...dependents].sort()),
    ]));
    const program = Object.freeze({
        ids,
        get(id) {
            return frozenStates.get(id)?.contract;
        },
        revision(id) {
            return frozenStates.get(id)?.revision;
        },
        dependencies(id) {
            return frozenStates.get(id)?.dependencies ?? [];
        },
        dependents(id) {
            return frozenReverse.get(id) ?? [];
        },
    });
    return Object.freeze({ kind: "resolved", program });
}
function rejectedContracts(failures) {
    return Object.freeze({ kind: "rejected", failures: Object.freeze([...failures]
            .sort((left, right) => (left.contractId ?? "").localeCompare(right.contractId ?? ""))
            .map(failure => Object.freeze({ ...failure }))) });
}
function checkedPositiveLimit(candidate, fallback, name) {
    const value = candidate ?? fallback;
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new Error(`${name} must be a positive safe integer.`);
    }
    return value;
}
function normalizeContractIds(ids) {
    const unique = new Set();
    for (const id of ids) {
        if (id.length === 0) {
            return {
                kind: "rejected",
                reason: "Target contract identities must be non-empty strings.",
            };
        }
        unique.add(id);
    }
    return {
        kind: "resolved",
        ids: Object.freeze([...unique].sort()),
    };
}
function replaceReverseDependencies(owner, previous, candidate, reverse) {
    for (const dependency of previous) {
        if (candidate.includes(dependency)) {
            continue;
        }
        const dependents = reverse.get(dependency);
        dependents?.delete(owner);
        if (dependents?.size === 0) {
            reverse.delete(dependency);
        }
    }
    for (const dependency of candidate) {
        let dependents = reverse.get(dependency);
        if (dependents === undefined) {
            dependents = new Set();
            reverse.set(dependency, dependents);
        }
        dependents.add(owner);
    }
}
function stringArraysEqual(left, right) {
    return left.length === right.length &&
        left.every((value, index) => value === right[index]);
}
//# sourceMappingURL=contracts.js.map