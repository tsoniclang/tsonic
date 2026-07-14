export const providerBoundaryMaxArrayEntries = 65_536;
export const providerBoundaryMaxDepth = 64;
export const providerBoundaryMaxStringCodeUnits = 65_536;
export const providerBoundaryMaxTotalStringCodeUnits = 262_144;
export function formatProviderBoundarySnapshotFailure(failure) {
    return `${failure.path}: ${failure.message}`;
}
export function snapshotProviderBoundaryData(value, path = "details") {
    const state = {
        active: new WeakMap(),
        completed: new WeakMap(),
        entries: 0,
        scalarCodeUnits: 0,
    };
    try {
        const snapshot = snapshotProviderBoundaryDataNode(value, path, 0, state);
        return Object.freeze({
            kind: "valid",
            value: snapshot,
            scalarCodeUnits: state.scalarCodeUnits,
            entries: state.entries,
        });
    }
    catch (error) {
        const failure = error instanceof ProviderBoundarySnapshotError
            ? error
            : new ProviderBoundarySnapshotError("shape", path, error instanceof Error ? error.message : String(error));
        return failure.toResult();
    }
}
export function snapshotProviderEvidenceArray(value, path = "evidence") {
    if (value === undefined) {
        return Object.freeze({ kind: "valid", value: undefined, scalarCodeUnits: 0, entries: 0 });
    }
    try {
        if (!Array.isArray(value)) {
            throw new ProviderBoundarySnapshotError("shape", path, "must be an array when present");
        }
        const ownKeys = Reflect.ownKeys(value);
        const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
        const length = lengthDescriptor !== undefined && "value" in lengthDescriptor
            ? lengthDescriptor.value
            : undefined;
        if (!Number.isSafeInteger(length) || length < 0 || length > providerBoundaryMaxArrayEntries) {
            throw new ProviderBoundarySnapshotError("complexity", path, `exceeds the array limit of ${providerBoundaryMaxArrayEntries}`, { limit: providerBoundaryMaxArrayEntries });
        }
        if (ownKeys.some((key) => typeof key !== "string" || key !== "length" && !isExactArrayIndex(key, length))) {
            throw new ProviderBoundarySnapshotError("shape", path, "must contain only indexed evidence entries");
        }
        const evidence = [];
        let totalEntries = length;
        let totalScalarCodeUnits = 0;
        for (let index = 0; index < length; index++) {
            const entryPath = `${path}[${index}]`;
            const entryDescriptor = Object.getOwnPropertyDescriptor(value, String(index));
            if (entryDescriptor === undefined || !("value" in entryDescriptor) || entryDescriptor.enumerable !== true) {
                throw new ProviderBoundarySnapshotError("shape", entryPath, "must be an enumerable data property");
            }
            const entry = entryDescriptor.value;
            if (typeof entry !== "object" || entry === null) {
                throw new ProviderBoundarySnapshotError("shape", entryPath, "must be an object");
            }
            const prototype = Object.getPrototypeOf(entry);
            if (prototype !== Object.prototype && prototype !== null) {
                throw new ProviderBoundarySnapshotError("shape", entryPath, "must have Object.prototype or null prototype");
            }
            const entryKeys = Reflect.ownKeys(entry);
            if (entryKeys.some((key) => typeof key !== "string" || key !== "message" && key !== "details")) {
                throw new ProviderBoundarySnapshotError("shape", entryPath, "contains unsupported evidence fields");
            }
            const messageDescriptor = Object.getOwnPropertyDescriptor(entry, "message");
            if (messageDescriptor === undefined || !("value" in messageDescriptor) || messageDescriptor.enumerable !== true) {
                throw new ProviderBoundarySnapshotError("shape", `${entryPath}.message`, "must be an enumerable data property");
            }
            const message = messageDescriptor.value;
            const detailsDescriptor = Object.getOwnPropertyDescriptor(entry, "details");
            const hasDetails = detailsDescriptor !== undefined;
            assertProviderBoundaryString(message, `${entryPath}.message`, false);
            totalScalarCodeUnits = addProviderBoundaryCodeUnits(totalScalarCodeUnits, message.length, `${entryPath}.message`);
            if (!hasDetails) {
                evidence.push(Object.freeze({ message }));
                continue;
            }
            if (!("value" in detailsDescriptor) || detailsDescriptor.enumerable !== true) {
                throw new ProviderBoundarySnapshotError("shape", `${entryPath}.details`, "must be an enumerable data property");
            }
            const details = detailsDescriptor.value;
            const detailsSnapshot = snapshotProviderBoundaryData(details, `${entryPath}.details`);
            if (detailsSnapshot.kind === "invalid") {
                throw ProviderBoundarySnapshotError.fromResult(detailsSnapshot);
            }
            totalEntries = addProviderBoundaryEntries(totalEntries, detailsSnapshot.entries, `${entryPath}.details`);
            totalScalarCodeUnits = addProviderBoundaryCodeUnits(totalScalarCodeUnits, detailsSnapshot.scalarCodeUnits, `${entryPath}.details`);
            evidence.push(Object.freeze({ message, details: detailsSnapshot.value }));
        }
        return Object.freeze({
            kind: "valid",
            value: Object.freeze(evidence),
            scalarCodeUnits: totalScalarCodeUnits,
            entries: totalEntries,
        });
    }
    catch (error) {
        const failure = error instanceof ProviderBoundarySnapshotError
            ? error
            : new ProviderBoundarySnapshotError("shape", path, error instanceof Error ? error.message : String(error));
        return failure.toResult();
    }
}
export function assertProviderBoundaryString(value, path, allowEmpty) {
    if (typeof value !== "string" || (!allowEmpty && value.length === 0)) {
        throw new ProviderBoundarySnapshotError("shape", path, `must be ${allowEmpty ? "a string" : "a non-empty string"}`);
    }
    if (value.length > providerBoundaryMaxStringCodeUnits) {
        throw new ProviderBoundarySnapshotError("complexity", path, `exceeds the string limit of ${providerBoundaryMaxStringCodeUnits} UTF-16 code units`, { limit: providerBoundaryMaxStringCodeUnits });
    }
}
function snapshotProviderBoundaryDataNode(value, path, depth, state) {
    if (depth > providerBoundaryMaxDepth) {
        throw new ProviderBoundarySnapshotError("depth", path, `exceeds the nesting limit of ${providerBoundaryMaxDepth}`, { depth, limit: providerBoundaryMaxDepth });
    }
    if (value === undefined || value === null || typeof value === "boolean") {
        return value;
    }
    if (typeof value === "number") {
        if (!Number.isFinite(value)) {
            throw new ProviderBoundarySnapshotError("shape", path, "must contain only finite numbers");
        }
        return value;
    }
    if (typeof value === "string") {
        assertProviderBoundaryString(value, path, true);
        state.scalarCodeUnits = addProviderBoundaryCodeUnits(state.scalarCodeUnits, value.length, path);
        return value;
    }
    if (typeof value !== "object") {
        throw new ProviderBoundarySnapshotError("shape", path, "must contain only immutable data values");
    }
    const completed = state.completed.get(value);
    if (completed !== undefined) {
        return completed;
    }
    const firstPath = state.active.get(value);
    if (firstPath !== undefined) {
        throw new ProviderBoundarySnapshotError("cycle", path, "must not contain cycles", { firstPath, depth });
    }
    state.active.set(value, path);
    try {
        const snapshot = Array.isArray(value)
            ? snapshotProviderBoundaryArray(value, path, depth, state)
            : snapshotProviderBoundaryObject(value, path, depth, state);
        state.completed.set(value, snapshot);
        return snapshot;
    }
    finally {
        state.active.delete(value);
    }
}
function snapshotProviderBoundaryArray(value, path, depth, state) {
    const keys = Reflect.ownKeys(value);
    const length = value.length;
    if (!Number.isSafeInteger(length) || length < 0 || length > providerBoundaryMaxArrayEntries) {
        throw new ProviderBoundarySnapshotError("complexity", path, `exceeds the array limit of ${providerBoundaryMaxArrayEntries}`, { limit: providerBoundaryMaxArrayEntries });
    }
    if (keys.some((key) => typeof key !== "string" || key !== "length" && !isExactArrayIndex(key, length))) {
        throw new ProviderBoundarySnapshotError("shape", path, "arrays must contain only indexed data entries");
    }
    state.entries = addProviderBoundaryEntries(state.entries, length, path);
    const snapshot = [];
    for (let index = 0; index < length; index++) {
        const elementPath = `${path}[${index}]`;
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
            throw new ProviderBoundarySnapshotError("shape", elementPath, "must be an enumerable data property");
        }
        snapshot.push(snapshotProviderBoundaryDataNode(descriptor.value, elementPath, depth + 1, state));
    }
    return Object.freeze(snapshot);
}
function snapshotProviderBoundaryObject(value, path, depth, state) {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
        throw new ProviderBoundarySnapshotError("shape", path, "objects must have Object.prototype or null prototype");
    }
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some((key) => typeof key !== "string")) {
        throw new ProviderBoundarySnapshotError("shape", path, "objects must not contain symbol keys");
    }
    const keys = ownKeys.sort();
    state.entries = addProviderBoundaryEntries(state.entries, keys.length, path);
    const snapshot = Object.create(null);
    for (const key of keys) {
        assertProviderBoundaryString(key, `${path}.${key}`, true);
        state.scalarCodeUnits = addProviderBoundaryCodeUnits(state.scalarCodeUnits, key.length, `${path}.${key}`);
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
            throw new ProviderBoundarySnapshotError("shape", `${path}.${key}`, "must be an enumerable data property");
        }
        snapshot[key] = snapshotProviderBoundaryDataNode(descriptor.value, `${path}.${key}`, depth + 1, state);
    }
    return Object.freeze(snapshot);
}
function isExactArrayIndex(value, length) {
    if (!/^(0|[1-9][0-9]*)$/.test(value)) {
        return false;
    }
    const index = Number(value);
    return Number.isSafeInteger(index) && index >= 0 && index < length && String(index) === value;
}
function addProviderBoundaryEntries(current, incoming, path) {
    const next = current + incoming;
    if (!Number.isSafeInteger(next) || next > providerBoundaryMaxArrayEntries) {
        throw new ProviderBoundarySnapshotError("complexity", path, `exceeds the total entry limit of ${providerBoundaryMaxArrayEntries}`, { limit: providerBoundaryMaxArrayEntries });
    }
    return next;
}
function addProviderBoundaryCodeUnits(current, incoming, path) {
    const next = current + incoming;
    if (!Number.isSafeInteger(next) || next > providerBoundaryMaxTotalStringCodeUnits) {
        throw new ProviderBoundarySnapshotError("complexity", path, `exceeds the total string limit of ${providerBoundaryMaxTotalStringCodeUnits} UTF-16 code units`, { limit: providerBoundaryMaxTotalStringCodeUnits });
    }
    return next;
}
class ProviderBoundarySnapshotError extends Error {
    reason;
    path;
    metadata;
    constructor(reason, path, message, metadata = {}) {
        super(message);
        this.reason = reason;
        this.path = path;
        this.metadata = metadata;
    }
    static fromResult(result) {
        return new ProviderBoundarySnapshotError(result.reason, result.path, result.message, {
            ...(result.firstPath === undefined ? {} : { firstPath: result.firstPath }),
            ...(result.depth === undefined ? {} : { depth: result.depth }),
            ...(result.limit === undefined ? {} : { limit: result.limit }),
        });
    }
    toResult() {
        return Object.freeze({
            kind: "invalid",
            reason: this.reason,
            path: this.path,
            message: this.message,
            ...(this.metadata.firstPath === undefined ? {} : { firstPath: this.metadata.firstPath }),
            ...(this.metadata.depth === undefined ? {} : { depth: this.metadata.depth }),
            ...(this.metadata.limit === undefined ? {} : { limit: this.metadata.limit }),
        });
    }
}
//# sourceMappingURL=provider-boundary-data.js.map