import type { ExtensionHostOptions, ProviderDeclarationMaterialization, ProviderDeclarationModel, ProviderDeclarationRequest, ProviderIdentity, ProviderModuleContext, ProviderModuleResolution, ProviderVirtualDeclarationFact, SourceDeclarationMaterializationMode } from "./index.js";
import { type ProviderIncrementalExportContract } from "./provider-export-contract.js";
export declare class ProviderMaterializationCoordinator {
    #private;
    beginRound(options: ExtensionHostOptions): ProviderMaterializationRound;
    finishRound(round: ProviderMaterializationRound): boolean;
    seal(round: ProviderMaterializationRound): void;
}
export declare class ProviderMaterializationRound {
    #private;
    constructor(completeExportsByModule: ReadonlyMap<string, readonly ProviderCompleteExportDemand[]>, exportContractsByModule: Map<string, Map<string, ProviderIncrementalExportContract>>);
    createRequest(provider: ProviderIdentity, resolution: ProviderModuleResolution, context: ProviderModuleContext, mode: SourceDeclarationMaterializationMode): ProviderDeclarationRequest;
    recordCompleteExportDemand(provider: ProviderIdentity, fact: ProviderVirtualDeclarationFact, materialization: ProviderDeclarationMaterialization): boolean;
    recordDeclarationModel(provider: ProviderIdentity, resolution: ProviderModuleResolution, mode: SourceDeclarationMaterializationMode, model: ProviderDeclarationModel): ProviderIncrementalContractConflict | undefined;
    hasIncrementalProvider(): boolean;
    hasPendingDemands(): boolean;
    pendingDemands(): readonly (readonly [string, readonly ProviderCompleteExportDemand[]])[];
    exportContracts(): ReadonlyMap<string, ReadonlyMap<string, ProviderIncrementalExportContract>>;
    finish(): void;
    seal(): void;
}
interface ProviderCompleteExportDemand {
    readonly exportName: string;
    readonly exportId?: string;
}
export interface ProviderIncrementalContractConflict {
    readonly sourceExportName: string;
    readonly typeArgumentCount?: number;
    readonly reason: string;
}
export declare function getProviderMaterializationRound(options: ExtensionHostOptions): ProviderMaterializationRound | undefined;
export {};
//# sourceMappingURL=provider-materialization.d.ts.map