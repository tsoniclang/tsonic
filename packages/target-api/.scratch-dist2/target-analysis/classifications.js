import { targetUseSiteIdentity } from "./use-sites.js";
export function createTargetClassificationKey(id, equals = Object.is) {
    if (id.length === 0) {
        throw new Error("A target classification key requires a non-empty identity.");
    }
    return Object.freeze({ id, equals });
}
export function createTargetClassificationBuilder() {
    const values = new WeakMap();
    const keysById = new Map();
    let sealed = false;
    const get = (subject, key) => {
        const stored = values.get(subject)?.get(key.id);
        assertClassificationKeyIdentity(keysById.get(key.id) ?? stored?.key, key);
        return stored?.value;
    };
    const queries = Object.freeze({
        get,
        has(subject, key) {
            const stored = values.get(subject)?.get(key.id);
            assertClassificationKeyIdentity(keysById.get(key.id) ?? stored?.key, key);
            return stored !== undefined;
        },
    });
    return Object.freeze({
        ...queries,
        set(subject, key, value) {
            if (sealed) {
                throw new Error("Target classifications are sealed.");
            }
            let subjectValues = values.get(subject);
            if (subjectValues === undefined) {
                subjectValues = new Map();
                values.set(subject, subjectValues);
            }
            const untypedKey = key;
            registerClassificationKey(keysById, untypedKey);
            const stored = subjectValues.get(key.id);
            assertClassificationKeyIdentity(stored?.key, untypedKey);
            if (stored === undefined) {
                subjectValues.set(key.id, Object.freeze({
                    key: untypedKey,
                    value,
                }));
                return Object.freeze({ kind: "added" });
            }
            const previous = stored.value;
            if (key.equals(previous, value)) {
                return Object.freeze({ kind: "idempotent", value: previous });
            }
            return Object.freeze({
                kind: "conflict",
                previous,
                candidate: value,
            });
        },
        seal() {
            if (sealed) {
                throw new Error("Target classifications can be sealed exactly once.");
            }
            sealed = true;
            return queries;
        },
    });
}
export function createTargetUseClassificationBuilder() {
    const values = new WeakMap();
    const keysById = new Map();
    let sealed = false;
    const classificationsFor = (use) => values.get(use.subject)?.get(targetUseSiteIdentity(use));
    const get = (use, key) => {
        const stored = classificationsFor(use)?.get(key.id);
        assertClassificationKeyIdentity(keysById.get(key.id) ?? stored?.key, key);
        return stored?.value;
    };
    const queries = Object.freeze({
        get,
        has(use, key) {
            const stored = classificationsFor(use)?.get(key.id);
            assertClassificationKeyIdentity(keysById.get(key.id) ?? stored?.key, key);
            return stored !== undefined;
        },
    });
    return Object.freeze({
        ...queries,
        set(use, key, value) {
            if (sealed) {
                throw new Error("Target use classifications are sealed.");
            }
            let byIdentity = values.get(use.subject);
            if (byIdentity === undefined) {
                byIdentity = new Map();
                values.set(use.subject, byIdentity);
            }
            const identity = targetUseSiteIdentity(use);
            let classifications = byIdentity.get(identity);
            if (classifications === undefined) {
                classifications = new Map();
                byIdentity.set(identity, classifications);
            }
            const untypedKey = key;
            registerClassificationKey(keysById, untypedKey);
            const stored = classifications.get(key.id);
            assertClassificationKeyIdentity(stored?.key, untypedKey);
            if (stored === undefined) {
                classifications.set(key.id, Object.freeze({
                    key: untypedKey,
                    value,
                }));
                return Object.freeze({ kind: "added" });
            }
            const previous = stored.value;
            if (key.equals(previous, value)) {
                return Object.freeze({ kind: "idempotent", value: previous });
            }
            return Object.freeze({ kind: "conflict", previous, candidate: value });
        },
        seal() {
            if (sealed) {
                throw new Error("Target use classifications can be sealed exactly once.");
            }
            sealed = true;
            return queries;
        },
    });
}
function registerClassificationKey(keysById, key) {
    const registered = keysById.get(key.id);
    assertClassificationKeyIdentity(registered, key);
    if (registered === undefined) {
        keysById.set(key.id, key);
    }
}
function assertClassificationKeyIdentity(registered, candidate) {
    if (registered !== undefined && registered !== candidate) {
        throw new Error(`Target classification key identity '${candidate.id}' was registered by a different key object.`);
    }
}
//# sourceMappingURL=classifications.js.map