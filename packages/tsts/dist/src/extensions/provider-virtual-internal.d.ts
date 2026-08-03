import type { ProviderVirtualModuleArtifact } from "./host.js";
import type { ProviderRenderedFunctionSignature } from "./provider-callable-signatures.js";
export declare const providerVirtualInternalRoot = "tsts-provider://tsts-internal/";
export declare const providerVirtualPublicRoot = "tsts-provider://tsts-public/";
export declare const providerCanonicalExportOwnerMarker = ".tsts-export-owner-";
export declare const providerCanonicalModuleDependencyContextMarker = ".tsts-module-context";
export declare const providerPublicVirtualSliceMarker = ".tsts-slice-";
export declare const providerVirtualCompilerArtifactLookup: unique symbol;
export declare const providerVirtualCompilerMetadataLookup: unique symbol;
export interface ProviderVirtualCompilerMetadata {
    readonly directDeclarationIds: readonly string[];
    readonly renderedFunctionSignatures: readonly ProviderRenderedFunctionSignature[];
}
interface ProviderTypeFamilyVariantIdentity {
    readonly id: string;
    readonly sourceTypeFamily?: {
        readonly exportName: string;
        readonly typeArgumentCount: number;
    };
}
export declare function getStableProviderVirtualSliceSuffix(value: string): string;
export declare function getProviderTypeFamilyVariantNominalMemberName(moduleSpecifier: string, declaration: ProviderTypeFamilyVariantIdentity): string;
export type ProviderVirtualCompilerArtifact = ProviderVirtualModuleArtifact;
export interface ProviderVirtualCompilerRegistryAccess {
    [providerVirtualCompilerArtifactLookup](fileName: string): ProviderVirtualCompilerArtifact | undefined;
    [providerVirtualCompilerMetadataLookup](fileName: string): ProviderVirtualCompilerMetadata | undefined;
}
export declare function getProviderVirtualCompilerMetadata(registry: ProviderVirtualCompilerRegistryAccess, fileName: string): ProviderVirtualCompilerMetadata | undefined;
export declare function getProviderVirtualArtifactForCompiler(registry: ProviderVirtualCompilerRegistryAccess, fileName: string): ProviderVirtualCompilerArtifact | undefined;
export declare function isHostOwnedProviderVirtualFileName(fileName: string): boolean;
export {};
//# sourceMappingURL=provider-virtual-internal.d.ts.map