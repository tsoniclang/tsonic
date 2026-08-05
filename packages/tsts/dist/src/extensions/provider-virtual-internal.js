import { encodeIdentityTuple } from "./identity-tuple.js";
export const providerVirtualInternalRoot = "tsts-provider://tsts-internal/";
export const providerVirtualPublicRoot = "tsts-provider://tsts-public/";
export const providerCanonicalExportOwnerMarker = ".tsts-export-owner-";
export const providerCanonicalModuleDependencyContextMarker = ".tsts-module-context";
export const providerPublicVirtualSliceMarker = ".tsts-slice-";
export const providerVirtualCompilerArtifactLookup = Symbol("tsts.provider.virtualCompilerArtifactLookup");
export const providerVirtualCompilerMetadataLookup = Symbol("tsts.provider.virtualCompilerMetadataLookup");
export const providerVirtualStructuredTypeDemand = Symbol("tsts.provider.structuredTypeDemand");
export function getStableProviderVirtualSliceSuffix(value) {
    const hashes = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35];
    for (let index = 0; index < value.length; index++) {
        const code = value.charCodeAt(index);
        for (let hashIndex = 0; hashIndex < hashes.length; hashIndex++) {
            hashes[hashIndex] = Math.imul((hashes[hashIndex] ^ code ^ hashIndex), 0x01000193);
        }
    }
    return hashes.map((hash) => (hash >>> 0).toString(36).padStart(7, "0")).join("");
}
export function getProviderTypeFamilyVariantNominalMemberName(moduleSpecifier, declaration) {
    const family = declaration.sourceTypeFamily;
    if (family === undefined) {
        throw new Error("A provider type-family nominal member requires a concrete family variant.");
    }
    return `__tstsProviderTypeFamilyVariant_${getStableProviderVirtualSliceSuffix(encodeIdentityTuple([
        moduleSpecifier,
        family.exportName,
        String(family.typeArgumentCount),
        declaration.id,
    ]))}`;
}
export function getProviderVirtualCompilerMetadata(registry, fileName) {
    return registry[providerVirtualCompilerMetadataLookup](fileName);
}
export function getProviderVirtualArtifactForCompiler(registry, fileName) {
    return registry[providerVirtualCompilerArtifactLookup](fileName);
}
export function isHostOwnedProviderVirtualFileName(fileName) {
    return fileName.startsWith(providerVirtualInternalRoot) || fileName.startsWith(providerVirtualPublicRoot);
}
//# sourceMappingURL=provider-virtual-internal.js.map