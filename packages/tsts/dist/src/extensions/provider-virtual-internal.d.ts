import type { ProviderVirtualModuleArtifact } from "./host.js";
export declare const providerVirtualInternalRoot = "tsts-provider://tsts-internal/";
export declare const providerVirtualPublicRoot = "tsts-provider://tsts-public/";
export declare const providerCanonicalExportOwnerMarker = ".tsts-export-owner-";
export declare const providerCanonicalModuleDependencyContextMarker = ".tsts-module-context";
export declare const providerPublicVirtualSliceMarker = ".tsts-slice-";
export declare const providerVirtualCompilerArtifactLookup: unique symbol;
export interface ProviderVirtualCompilerRegistryAccess {
    [providerVirtualCompilerArtifactLookup](fileName: string): ProviderVirtualModuleArtifact | undefined;
}
export declare function getProviderVirtualArtifactForCompiler(registry: ProviderVirtualCompilerRegistryAccess, fileName: string): ProviderVirtualModuleArtifact | undefined;
export declare function isHostOwnedProviderVirtualFileName(fileName: string): boolean;
//# sourceMappingURL=provider-virtual-internal.d.ts.map