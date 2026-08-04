import type { ExtensionHostOptions, ProviderDeclarationMaterialization, ProviderDeclarationRequest, ProviderIdentity, ProviderModuleContext, ProviderModuleResolution, ProviderVirtualDeclarationFact, SourceDeclarationMaterializationMode } from "./index.js";
export declare class ProviderMaterializationCoordinator {
    #private;
    beginRound(options: ExtensionHostOptions): ProviderMaterializationRound;
    finishRound(round: ProviderMaterializationRound): boolean;
    seal(round: ProviderMaterializationRound): void;
}
export declare class ProviderMaterializationRound {
    #private;
    constructor(completeExportsByModule: ReadonlyMap<string, readonly ProviderCompleteExportDemand[]>);
    createRequest(provider: ProviderIdentity, resolution: ProviderModuleResolution, context: ProviderModuleContext, mode: SourceDeclarationMaterializationMode): ProviderDeclarationRequest;
    recordCompleteExportDemand(provider: ProviderIdentity, fact: ProviderVirtualDeclarationFact, materialization: ProviderDeclarationMaterialization): boolean;
    hasIncrementalProvider(): boolean;
    hasPendingDemands(): boolean;
    pendingDemands(): readonly (readonly [string, readonly ProviderCompleteExportDemand[]])[];
    finish(): void;
    seal(): void;
}
interface ProviderCompleteExportDemand {
    readonly exportName: string;
    readonly exportId?: string;
}
export declare function getProviderMaterializationRound(options: ExtensionHostOptions): ProviderMaterializationRound | undefined;
export {};
//# sourceMappingURL=provider-materialization.d.ts.map