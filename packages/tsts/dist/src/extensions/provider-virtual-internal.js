export const providerVirtualInternalRoot = "tsts-provider://tsts-internal/";
export const providerVirtualPublicRoot = "tsts-provider://tsts-public/";
export const providerCanonicalExportOwnerMarker = ".tsts-export-owner-";
export const providerPublicVirtualSliceMarker = ".tsts-slice-";
export const providerVirtualCompilerArtifactLookup = Symbol("tsts.provider.virtualCompilerArtifactLookup");
export function getProviderVirtualArtifactForCompiler(registry, fileName) {
    return registry[providerVirtualCompilerArtifactLookup](fileName);
}
export function isHostOwnedProviderVirtualFileName(fileName) {
    return fileName.startsWith(providerVirtualInternalRoot) || fileName.startsWith(providerVirtualPublicRoot);
}
//# sourceMappingURL=provider-virtual-internal.js.map