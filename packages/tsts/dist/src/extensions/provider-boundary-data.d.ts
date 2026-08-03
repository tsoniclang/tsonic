import type { ExtensionEvidence } from "./host.js";
export type ProviderBoundarySnapshotFailureReason = "shape" | "cycle" | "depth" | "complexity";
export type ProviderBoundarySnapshotResult<T> = {
    readonly kind: "valid";
    readonly value: T;
    readonly scalarCodeUnits: number;
    readonly physicalNodeAndCollectionEntryCount: number;
} | {
    readonly kind: "invalid";
    readonly reason: ProviderBoundarySnapshotFailureReason;
    readonly path: string;
    readonly message: string;
    readonly firstPath?: string;
    readonly depth?: number;
    readonly limit?: number;
};
export type ProviderBoundarySnapshotFailure = Extract<ProviderBoundarySnapshotResult<unknown>, {
    readonly kind: "invalid";
}>;
export declare function formatProviderBoundarySnapshotFailure(failure: ProviderBoundarySnapshotFailure): string;
export declare function snapshotProviderBoundaryData(value: unknown, path?: string): ProviderBoundarySnapshotResult<unknown>;
export declare function snapshotProviderEvidenceArray(value: unknown, path?: string): ProviderBoundarySnapshotResult<readonly ExtensionEvidence[] | undefined>;
export declare function assertProviderBoundaryString(value: unknown, path: string, allowEmpty: boolean): asserts value is string;
export declare function assertProviderAncillaryAggregateScalarCodeUnits(codeUnits: number, path: string): void;
//# sourceMappingURL=provider-boundary-data.d.ts.map