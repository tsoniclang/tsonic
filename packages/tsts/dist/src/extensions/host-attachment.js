export const extensionHostAllowsSemanticQueryPreflight = Symbol("tsts.extensionHost.allowsSemanticQueryPreflight");
export const extensionHostAllowsCompilerQuery = Symbol("tsts.extensionHost.allowsCompilerQuery");
const attachedExtensionHosts = new WeakMap();
export function registerAttachedExtensionHost(owner, host) {
    attachedExtensionHosts.set(owner, host);
}
export function lookupAttachedExtensionHost(owner) {
    return attachedExtensionHosts.get(owner);
}
export function hasAttachedExtensionHost(owner) {
    return attachedExtensionHosts.has(owner);
}
//# sourceMappingURL=host-attachment.js.map