export interface TargetArtifactFacetContract<Facet extends string> {
  readonly facet: Facet;
  readonly value: string;
}

export interface TargetArtifactContract<Facet extends string> {
  readonly facets: readonly TargetArtifactFacetContract<Facet>[];
}

export interface TargetArtifactDependency<Facet extends string> {
  readonly owner: string;
  readonly facet: Facet;
}

export interface TargetArtifactContractUpdate<
  Facet extends string,
  Artifact,
> {
  readonly owner: string;
  readonly contract: TargetArtifactContract<Facet>;
  readonly dependencies: readonly TargetArtifactDependency<Facet>[];
  readonly artifact: Artifact;
}

export interface TargetArtifactContractGraphOptions {
  readonly maximumArtifactCount?: number;
  readonly maximumFacetCountPerArtifact?: number;
  readonly maximumDependencyCount?: number;
  readonly maximumContractCodeUnits?: number;
  readonly maximumContractHistoryCodeUnits?: number;
  readonly maximumContractHistoryPerArtifact?: number;
  readonly maximumIdentityCodeUnits?: number;
  readonly maximumFacetValueCodeUnits?: number;
}

export type TargetArtifactContractRejection = {
  readonly kind: "rejected";
  readonly code:
    | "TARGET_ARTIFACT_CONTRACT_INVALID"
    | "TARGET_ARTIFACT_CONTRACT_BUDGET_EXCEEDED"
    | "TARGET_ARTIFACT_CONTRACT_OSCILLATION";
  readonly reason: string;
};

export type TargetArtifactContractGraphResult<Facet extends string> =
  | {
      readonly kind: "accepted";
      readonly changedFacets: readonly Facet[];
      readonly contractChanged: boolean;
      readonly dependenciesChanged: boolean;
    }
  | TargetArtifactContractRejection;

export interface TargetArtifactContractChange<Facet extends string> {
  readonly owner: string;
  readonly changedFacets: readonly Facet[];
  readonly contractChanged: boolean;
  readonly dependenciesChanged: boolean;
}

export type TargetArtifactContractBatchResult<Facet extends string> =
  | {
      readonly kind: "accepted";
      readonly changes: readonly TargetArtifactContractChange<Facet>[];
    }
  | TargetArtifactContractRejection;

export type TargetArtifactContractClosureResult =
  | { readonly kind: "closed" }
  | {
      readonly kind: "rejected";
      readonly code: "TARGET_ARTIFACT_CONTRACT_OPEN";
      readonly reason: string;
    };

export interface TargetArtifactContractGraph<Facet extends string, Artifact> {
  readonly revision: number;
  readonly artifactCount: number;
  readonly dependencyCount: number;
  markDirty(owner: string): TargetArtifactContractGraphResult<Facet>;
  commit(
    owner: string,
    contract: TargetArtifactContract<Facet>,
    dependencies: readonly TargetArtifactDependency<Facet>[],
    artifact: Artifact,
  ): TargetArtifactContractGraphResult<Facet>;
  commitBatch(
    updates: readonly TargetArtifactContractUpdate<Facet, Artifact>[],
  ): TargetArtifactContractBatchResult<Facet>;
  contract(owner: string): TargetArtifactContract<Facet> | undefined;
  artifact(owner: string): Artifact | undefined;
  dependencies(owner: string): readonly TargetArtifactDependency<Facet>[];
  hasPublishedFacet(dependency: TargetArtifactDependency<Facet>): boolean;
  facetRevision(owner: string, facet: Facet): number;
  nextDirty(): string | undefined;
  discardDirty(owner: string): void;
  hasPending(): boolean;
  verifyClosure(): TargetArtifactContractClosureResult;
}

export interface NormalizedContract<Facet extends string> {
  readonly facets: ReadonlyMap<Facet, string>;
  readonly snapshot: TargetArtifactContract<Facet>;
  readonly encoded: string;
  readonly codeUnits: number;
}

export interface NormalizedDependencySet<Facet extends string> {
  readonly byKey: ReadonlyMap<string, TargetArtifactDependency<Facet>>;
  readonly snapshot: readonly TargetArtifactDependency<Facet>[];
}

export interface ArtifactRecord<Facet extends string, Artifact> {
  contract: NormalizedContract<Facet>;
  dependencies: NormalizedDependencySet<Facet>;
  artifact: Artifact;
  readonly facetRevisions: Map<Facet, number>;
  readonly history: Set<string>;
}

export interface PreparedArtifactUpdate<Facet extends string, Artifact> {
  readonly owner: string;
  readonly contract: NormalizedContract<Facet>;
  readonly dependencies: NormalizedDependencySet<Facet>;
  readonly artifact: Artifact;
  readonly current?: ArtifactRecord<Facet, Artifact>;
  readonly changedFacets: readonly Facet[];
  readonly contractChanged: boolean;
  readonly dependenciesChanged: boolean;
}

export interface TargetArtifactContractGraphLimits {
  readonly maximumArtifactCount: number;
  readonly maximumFacetCountPerArtifact: number;
  readonly maximumDependencyCount: number;
  readonly maximumContractCodeUnits: number;
  readonly maximumContractHistoryCodeUnits: number;
  readonly maximumContractHistoryPerArtifact: number;
  readonly maximumIdentityCodeUnits: number;
  readonly maximumFacetValueCodeUnits: number;
}
