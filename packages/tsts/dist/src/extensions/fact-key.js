import { encodeIdentityTuple } from "./identity-tuple.js";
const extensionFactKeyIdentities = new WeakMap();
const extensionFactKeysByOwner = new Map();
const hostSourceReadableFactKeyIdentities = new WeakSet();
export function defineExtensionFactKey(options) {
    if (typeof options.extensionId !== "string" || options.extensionId.length === 0) {
        throw new Error("Extension fact key requires a non-empty extension id.");
    }
    if (typeof options.name !== "string" || options.name.length === 0) {
        throw new Error("Extension fact key requires a non-empty name.");
    }
    if (typeof options.snapshot !== "function") {
        throw new Error("Extension fact key requires an exact immutable snapshot function.");
    }
    if (options.equals !== undefined && typeof options.equals !== "function") {
        throw new Error("Extension fact key equality must be a function when present.");
    }
    const keysByName = extensionFactKeysByOwner.get(options.extensionId);
    if (keysByName?.has(options.name) === true) {
        throw new Error(`Extension fact key '${options.extensionId}:${options.name}' is already defined.`);
    }
    const key = Object.freeze({
        extensionId: options.extensionId,
        name: options.name,
        id: encodeIdentityTuple([options.extensionId, options.name]),
        equals: options.equals ?? Object.is,
        snapshot: options.snapshot,
    });
    extensionFactKeyIdentities.set(key, Object.freeze({}));
    if (keysByName === undefined) {
        extensionFactKeysByOwner.set(options.extensionId, new Map([[options.name, key]]));
    }
    else {
        keysByName.set(options.name, key);
    }
    return key;
}
export function formatExtensionFactKeyForDisplay(key) {
    getExtensionFactKeyIdentity(key);
    return `${key.extensionId}:${key.name}`;
}
export function getExtensionFactKeyIdentity(key) {
    if ((typeof key !== "object" && typeof key !== "function") || key === null) {
        throw new Error("Extension fact keys must be created by defineExtensionFactKey.");
    }
    const identity = extensionFactKeyIdentities.get(key);
    if (identity === undefined) {
        throw new Error("Extension fact keys must be created by defineExtensionFactKey.");
    }
    return identity;
}
/** Marks a host-owned invariant/source fact as readable by dependent source analyzers. */
export function markHostSourceReadableFactKey(key) {
    hostSourceReadableFactKeyIdentities.add(getExtensionFactKeyIdentity(key));
    return key;
}
export function isHostSourceReadableFactKey(key) {
    return hostSourceReadableFactKeyIdentities.has(getExtensionFactKeyIdentity(key));
}
//# sourceMappingURL=fact-key.js.map