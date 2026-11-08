import type { TargetArtifactContract, TargetArtifactContractGraph, TargetArtifactDependency } from "./contract-graph-model.js";
export type TargetArtifactReconstruction<Facet extends string, Artifact> = {
    readonly kind: "resolved";
    readonly contract: TargetArtifactContract<Facet>;
    readonly dependencies: readonly TargetArtifactDependency<Facet>[];
    readonly artifact: Artifact;
} | {
    readonly kind: "retry";
    readonly reason: string;
} | {
    readonly kind: "blocked";
    readonly reason: string;
    readonly dependencies: readonly TargetArtifactDependency<Facet>[];
} | {
    readonly kind: "rejected";
    readonly code: string;
    readonly reason: string;
};
export interface TargetArtifactReconstructionOptions {
    readonly maximumReconstructionCount: number;
}
export interface TargetArtifactOwnerFailure {
    readonly owner: string;
    readonly code: string;
    readonly reason: string;
}
export type TargetArtifactReconstructionRunResult = {
    readonly kind: "completed";
    readonly reconstructionCount: number;
} | {
    readonly kind: "rejected";
    readonly owner?: string;
    readonly code: string;
    readonly reason: string;
    readonly reconstructionCount: number;
} | {
    readonly kind: "failed";
    readonly failures: readonly TargetArtifactOwnerFailure[];
    readonly reconstructionCount: number;
};
export declare function reconstructTargetArtifacts<Facet extends string, Artifact>(graph: TargetArtifactContractGraph<Facet, Artifact>, roots: readonly string[], reconstruct: (owner: string, graph: TargetArtifactContractGraph<Facet, Artifact>) => TargetArtifactReconstruction<Facet, Artifact>, options: TargetArtifactReconstructionOptions): TargetArtifactReconstructionRunResult;
//# sourceMappingURL=reconstruction.d.ts.map