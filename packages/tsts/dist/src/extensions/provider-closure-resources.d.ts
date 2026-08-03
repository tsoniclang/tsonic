export interface ProviderClosureResourceUsage {
    readonly snapshottedInputNodeAndCollectionEntryCount: number;
    readonly snapshottedInputScalarCodeUnitCount: number;
    readonly expandedSemanticNodeAndArrayEntryCount: number;
    readonly expandedSemanticScalarCodeUnitCount: number;
    readonly declarationSourceCodeUnitCount: number;
}
export type ProviderClosureResourceContribution = ProviderClosureResourceUsage;
export type ProviderClosureResourceReservation = {
    readonly kind: "reserved";
    readonly usage: ProviderClosureResourceUsage;
} | {
    readonly kind: "exceeded";
    readonly dimension: string;
    readonly actual: number;
    readonly limit: number;
};
export declare function emptyProviderClosureResourceUsage(): ProviderClosureResourceUsage;
export declare function reserveProviderClosureResources(current: ProviderClosureResourceUsage, contribution: ProviderClosureResourceContribution): ProviderClosureResourceReservation;
//# sourceMappingURL=provider-closure-resources.d.ts.map