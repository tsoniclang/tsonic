import { providerAncillaryDataLimits } from "./provider-resource-limits.js";
export function formatProviderBoundarySnapshotFailure(failure) {
    return `${failure.path}: ${failure.message}`;
}
function createProviderBoundarySnapshotState() {
    return {
        active: new WeakMap(),
        completed: new WeakMap(),
        completedEvidence: new WeakMap(),
        physicalNodeAndCollectionEntryCount: 0,
        scalarCodeUnits: 0,
    };
}
export function snapshotProviderBoundaryData(value, path = "details") {
    const state = createProviderBoundarySnapshotState();
    try {
        const snapshot = snapshotProviderBoundaryDataNode(value, path, 0, state);
        return Object.freeze({
            kind: "valid",
            value: snapshot.value,
            scalarCodeUnits: state.scalarCodeUnits,
            physicalNodeAndCollectionEntryCount: state.physicalNodeAndCollectionEntryCount,
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
        return Object.freeze({
            kind: "valid",
            value: undefined,
            scalarCodeUnits: 0,
            physicalNodeAndCollectionEntryCount: 0,
        });
    }
    const state = createProviderBoundarySnapshotState();
    try {
        if (!Array.isArray(value)) {
            throw new ProviderBoundarySnapshotError("shape", path, "must be an array when present");
        }
        const ownKeys = Reflect.ownKeys(value);
        const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
        const length = lengthDescriptor !== undefined && "value" in lengthDescriptor
            ? lengthDescriptor.value
            : undefined;
        if (!Number.isSafeInteger(length) || length < 0 || length > providerAncillaryDataLimits.maxArrayEntries) {
            throw new ProviderBoundarySnapshotError("complexity", path, `exceeds the array limit of ${providerAncillaryDataLimits.maxArrayEntries}`, { limit: providerAncillaryDataLimits.maxArrayEntries });
        }
        if (ownKeys.some((key) => typeof key !== "string" || key !== "length" && !isExactArrayIndex(key, length))) {
            throw new ProviderBoundarySnapshotError("shape", path, "must contain only indexed evidence entries");
        }
        reserveProviderBoundaryPhysicalResources(state, 1 + length, path);
        state.active.set(value, path);
        const evidence = [];
        for (let index = 0; index < length; index++) {
            const entryPath = `${path}[${index}]`;
            const entryDescriptor = Object.getOwnPropertyDescriptor(value, String(index));
            if (entryDescriptor === undefined || !("value" in entryDescriptor) || entryDescriptor.enumerable !== true) {
                throw new ProviderBoundarySnapshotError("shape", entryPath, "must be an enumerable data property");
            }
            evidence.push(snapshotProviderEvidenceEntry(entryDescriptor.value, entryPath, 1, state).value);
        }
        state.active.delete(value);
        return Object.freeze({
            kind: "valid",
            value: Object.freeze(evidence),
            scalarCodeUnits: state.scalarCodeUnits,
            physicalNodeAndCollectionEntryCount: state.physicalNodeAndCollectionEntryCount,
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
    if (value.length > providerAncillaryDataLimits.maxStringCodeUnits) {
        throw new ProviderBoundarySnapshotError("complexity", path, `exceeds the string limit of ${providerAncillaryDataLimits.maxStringCodeUnits} UTF-16 code units`, { limit: providerAncillaryDataLimits.maxStringCodeUnits });
    }
}
export function assertProviderAncillaryAggregateScalarCodeUnits(codeUnits, path) {
    if (!Number.isSafeInteger(codeUnits)
        || codeUnits < 0
        || codeUnits > providerAncillaryDataLimits.maxTotalScalarCodeUnits) {
        throw new ProviderBoundarySnapshotError("complexity", path, `exceeds the total string limit of ${providerAncillaryDataLimits.maxTotalScalarCodeUnits} UTF-16 code units`, { limit: providerAncillaryDataLimits.maxTotalScalarCodeUnits });
    }
}
function snapshotProviderEvidenceEntry(value, path, depth, state) {
    if (depth > providerAncillaryDataLimits.maxDepth) {
        throw new ProviderBoundarySnapshotError("depth", path, `exceeds the nesting limit of ${providerAncillaryDataLimits.maxDepth}`, { depth, limit: providerAncillaryDataLimits.maxDepth });
    }
    if (typeof value !== "object" || value === null) {
        throw new ProviderBoundarySnapshotError("shape", path, "must be an object");
    }
    const completed = state.completedEvidence.get(value);
    if (completed !== undefined) {
        assertProviderBoundaryCompletedDepth(depth, completed.maximumRelativeDepth, path);
        return completed;
    }
    const firstPath = state.active.get(value);
    if (firstPath !== undefined) {
        throw new ProviderBoundarySnapshotError("cycle", path, "must not contain cycles", { firstPath, depth });
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
        throw new ProviderBoundarySnapshotError("shape", path, "must have Object.prototype or null prototype");
    }
    const entryKeys = Reflect.ownKeys(value);
    if (entryKeys.some((key) => typeof key !== "string" || key !== "message" && key !== "details")) {
        throw new ProviderBoundarySnapshotError("shape", path, "contains unsupported evidence fields");
    }
    reserveProviderBoundaryPhysicalResources(state, 1 + entryKeys.length, path);
    const messageDescriptor = Object.getOwnPropertyDescriptor(value, "message");
    if (messageDescriptor === undefined || !("value" in messageDescriptor) || messageDescriptor.enumerable !== true) {
        throw new ProviderBoundarySnapshotError("shape", `${path}.message`, "must be an enumerable data property");
    }
    const message = messageDescriptor.value;
    assertProviderBoundaryString(message, `${path}.message`, false);
    state.scalarCodeUnits = addProviderBoundaryCodeUnits(state.scalarCodeUnits, message.length, `${path}.message`);
    const detailsDescriptor = Object.getOwnPropertyDescriptor(value, "details");
    if (detailsDescriptor === undefined) {
        const snapshot = { value: Object.freeze({ message }), maximumRelativeDepth: 0 };
        state.completedEvidence.set(value, snapshot);
        return snapshot;
    }
    if (!("value" in detailsDescriptor) || detailsDescriptor.enumerable !== true) {
        throw new ProviderBoundarySnapshotError("shape", `${path}.details`, "must be an enumerable data property");
    }
    state.active.set(value, path);
    try {
        const details = snapshotProviderBoundaryDataNode(detailsDescriptor.value, `${path}.details`, depth + 1, state);
        const snapshot = {
            value: Object.freeze({ message, details: details.value }),
            maximumRelativeDepth: details.maximumRelativeDepth + 1,
        };
        state.completedEvidence.set(value, snapshot);
        return snapshot;
    }
    finally {
        state.active.delete(value);
    }
}
function assertProviderBoundaryCompletedDepth(depth, maximumRelativeDepth, path) {
    const maximumDepth = depth + maximumRelativeDepth;
    if (maximumDepth > providerAncillaryDataLimits.maxDepth) {
        throw new ProviderBoundarySnapshotError("depth", path, `exceeds the nesting limit of ${providerAncillaryDataLimits.maxDepth}`, { depth: maximumDepth, limit: providerAncillaryDataLimits.maxDepth });
    }
}
function snapshotProviderBoundaryDataNode(value, path, depth, state) {
    if (depth > providerAncillaryDataLimits.maxDepth) {
        throw new ProviderBoundarySnapshotError("depth", path, `exceeds the nesting limit of ${providerAncillaryDataLimits.maxDepth}`, { depth, limit: providerAncillaryDataLimits.maxDepth });
    }
    if (value === undefined || value === null || typeof value === "boolean") {
        return { value, maximumRelativeDepth: 0 };
    }
    if (typeof value === "number") {
        if (!Number.isFinite(value)) {
            throw new ProviderBoundarySnapshotError("shape", path, "must contain only finite numbers");
        }
        return { value, maximumRelativeDepth: 0 };
    }
    if (typeof value === "string") {
        assertProviderBoundaryString(value, path, true);
        state.scalarCodeUnits = addProviderBoundaryCodeUnits(state.scalarCodeUnits, value.length, path);
        return { value, maximumRelativeDepth: 0 };
    }
    if (typeof value !== "object") {
        throw new ProviderBoundarySnapshotError("shape", path, "must contain only immutable data values");
    }
    const completed = state.completed.get(value);
    if (completed !== undefined) {
        assertProviderBoundaryCompletedDepth(depth, completed.maximumRelativeDepth, path);
        return completed;
    }
    const firstPath = state.active.get(value);
    if (firstPath !== undefined) {
        throw new ProviderBoundarySnapshotError("cycle", path, "must not contain cycles", { firstPath, depth });
    }
    state.active.set(value, path);
    reserveProviderBoundaryPhysicalResources(state, 1, path);
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
    if (!Number.isSafeInteger(length) || length < 0 || length > providerAncillaryDataLimits.maxArrayEntries) {
        throw new ProviderBoundarySnapshotError("complexity", path, `exceeds the array limit of ${providerAncillaryDataLimits.maxArrayEntries}`, { limit: providerAncillaryDataLimits.maxArrayEntries });
    }
    if (keys.some((key) => typeof key !== "string" || key !== "length" && !isExactArrayIndex(key, length))) {
        throw new ProviderBoundarySnapshotError("shape", path, "arrays must contain only indexed data entries");
    }
    reserveProviderBoundaryPhysicalResources(state, length, path);
    const snapshot = [];
    let maximumRelativeDepth = 0;
    for (let index = 0; index < length; index++) {
        const elementPath = `${path}[${index}]`;
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
            throw new ProviderBoundarySnapshotError("shape", elementPath, "must be an enumerable data property");
        }
        const child = snapshotProviderBoundaryDataNode(descriptor.value, elementPath, depth + 1, state);
        snapshot.push(child.value);
        maximumRelativeDepth = Math.max(maximumRelativeDepth, child.maximumRelativeDepth + 1);
    }
    return { value: Object.freeze(snapshot), maximumRelativeDepth };
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
    reserveProviderBoundaryPhysicalResources(state, keys.length, path);
    const snapshot = Object.create(null);
    let maximumRelativeDepth = 0;
    for (const key of keys) {
        assertProviderBoundaryString(key, `${path}.${key}`, true);
        state.scalarCodeUnits = addProviderBoundaryCodeUnits(state.scalarCodeUnits, key.length, `${path}.${key}`);
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
            throw new ProviderBoundarySnapshotError("shape", `${path}.${key}`, "must be an enumerable data property");
        }
        const child = snapshotProviderBoundaryDataNode(descriptor.value, `${path}.${key}`, depth + 1, state);
        snapshot[key] = child.value;
        maximumRelativeDepth = Math.max(maximumRelativeDepth, child.maximumRelativeDepth + 1);
    }
    return { value: Object.freeze(snapshot), maximumRelativeDepth };
}
function isExactArrayIndex(value, length) {
    if (!/^(0|[1-9][0-9]*)$/.test(value)) {
        return false;
    }
    const index = Number(value);
    return Number.isSafeInteger(index) && index >= 0 && index < length && String(index) === value;
}
function reserveProviderBoundaryPhysicalResources(state, incoming, path) {
    const next = state.physicalNodeAndCollectionEntryCount + incoming;
    if (!Number.isSafeInteger(next)
        || incoming < 0
        || next > providerAncillaryDataLimits.maxTotalEntries) {
        throw new ProviderBoundarySnapshotError("complexity", path, `exceeds the total entry limit of ${providerAncillaryDataLimits.maxTotalEntries}`, { limit: providerAncillaryDataLimits.maxTotalEntries });
    }
    state.physicalNodeAndCollectionEntryCount = next;
}
function addProviderBoundaryCodeUnits(current, incoming, path) {
    const next = current + incoming;
    if (!Number.isSafeInteger(next) || next > providerAncillaryDataLimits.maxTotalScalarCodeUnits) {
        throw new ProviderBoundarySnapshotError("complexity", path, `exceeds the total string limit of ${providerAncillaryDataLimits.maxTotalScalarCodeUnits} UTF-16 code units`, { limit: providerAncillaryDataLimits.maxTotalScalarCodeUnits });
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