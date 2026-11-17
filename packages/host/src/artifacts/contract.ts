import type { Diagnostic, Result } from "../diag/contract.js";
import type { EffectFailure } from "../snapshot/contract.js";

export interface Artifact {
  readonly kind: "source" | "project" | "configuration" | "asset";
  readonly path: string;
  readonly text: string;
}

export interface ArtifactLimits {
  readonly maximumReconstructionCount: number;
  readonly maximumArtifactCount: number;
  readonly maximumFacetCountPerArtifact: number;
  readonly maximumDependencyCount: number;
  readonly maximumContractCodeUnits: number;
  readonly maximumContractHistoryCodeUnits: number;
  readonly maximumContractHistoryPerArtifact: number;
  readonly maximumIdentityCodeUnits: number;
  readonly maximumFacetValueCodeUnits: number;
}

export interface ArtifactFacet {
  readonly facet: string;
  readonly value: string;
}

export interface ArtifactContract {
  readonly facets: readonly ArtifactFacet[];
}

export interface ArtifactDependency {
  readonly owner: string;
  readonly facet: string;
}

export interface ArtifactUpdate {
  readonly owner: string;
  readonly contract: ArtifactContract;
  readonly dependencies: readonly ArtifactDependency[];
  readonly artifact: Artifact;
}

export interface FacetRevision {
  readonly facet: string;
  readonly revision: number;
}

export interface ArtifactRecord {
  readonly update: ArtifactUpdate;
  readonly facetRevisions: readonly FacetRevision[];
  readonly history: readonly string[];
}

export interface BlockedArtifact {
  readonly owner: string;
  readonly dependencies: readonly ArtifactDependency[];
  readonly reason: string;
}

export interface ArtifactOwnerFailure {
  readonly owner: string;
  readonly diagnostics: readonly [Diagnostic, ...Diagnostic[]];
}

export interface ArtifactGraph {
  readonly revision: number;
  readonly records: readonly ArtifactRecord[];
  readonly dirtyOwners: readonly string[];
  readonly blocked: readonly BlockedArtifact[];
  readonly failures: readonly ArtifactOwnerFailure[];
  readonly reconstructionCount: number;
}

export interface ArtifactContractView {
  readonly owner: string;
  readonly contract: ArtifactContract;
  readonly facetRevisions: readonly FacetRevision[];
}

export interface ReconstructionRequest {
  readonly owner: string;
  readonly revision: number;
  readonly contracts: readonly ArtifactContractView[];
}

export type ArtifactReconstruction =
  | { readonly kind: "resolved"; readonly contract: ArtifactContract;
      readonly dependencies: readonly ArtifactDependency[]; readonly artifact: Artifact }
  | { readonly kind: "retry"; readonly reason: string }
  | { readonly kind: "blocked"; readonly reason: string; readonly dependencies: readonly ArtifactDependency[] }
  | { readonly kind: "refused"; readonly diagnostics: readonly [Diagnostic, ...Diagnostic[]] };

export interface ReconstructionResponse {
  readonly owner: string;
  readonly revision: number;
  readonly result: ArtifactReconstruction;
}

export type ReconstructionPlan =
  | { readonly kind: "reconstruct"; readonly graph: ArtifactGraph;
      readonly requests: readonly [ReconstructionRequest, ...ReconstructionRequest[]] }
  | { readonly kind: "complete"; readonly artifacts: readonly Artifact[]; readonly reconstructionCount: number };

export interface ReconstructionDeps {
  readonly limits: ArtifactLimits;
}

export type StartReconstruction = (
  deps: ReconstructionDeps,
  roots: readonly string[],
  initial: readonly ArtifactUpdate[],
) => Result<ArtifactGraph>;

export type PlanReconstruction = (
  deps: ReconstructionDeps,
  graph: ArtifactGraph,
  responses: readonly ReconstructionResponse[],
) => Result<ReconstructionPlan>;

export interface TargetOutput {
  readonly targetId: string;
  readonly artifacts: readonly Artifact[];
}

export interface PublicationInput {
  readonly outputRoot: string;
  readonly protectedPaths: readonly string[];
  readonly expectedTargetIds: readonly string[];
  readonly targets: readonly TargetOutput[];
}

export interface OutputPaths {
  readonly outputRoot: string;
  readonly parent: string;
  readonly backup: string;
  readonly lock: string;
  readonly lockOwner: string;
  readonly stagePrefix: string;
  readonly staleLockPrefix: string;
  readonly releasedLockPrefix: string;
}

export interface OutputLockOwner {
  readonly token: string;
  readonly pid: number;
  readonly createdAt: number;
  readonly processStart: string | null;
}

export type ProcessLiveness =
  | { readonly kind: "live"; readonly processStart: string | null }
  | { readonly kind: "dead" }
  | { readonly kind: "unverifiable"; readonly failure: EffectFailure };

export interface PublicationDeps {
  readonly pathStyle: "posix" | "windows";
  readonly now: number;
  readonly owner: OutputLockOwner;
  readonly unownedLockGraceMilliseconds: number;
  readonly unverifiableLiveLockMaximumAgeMilliseconds: number;
  readonly limits: PublicationLimits;
}

export interface PublicationLimits {
  readonly maximumSteps: number;
}

export interface PublishedTarget {
  readonly targetId: string;
  readonly root: string;
  readonly files: readonly string[];
}

export interface PublishedOutput {
  readonly outputRoot: string;
  readonly targets: readonly PublishedTarget[];
}

export interface OutputDirectoryEntry {
  readonly name: string;
  readonly kind: "file" | "directory" | "symlink" | "block-device" | "character-device" | "fifo" | "socket" | "unclassified";
}

export type OutputOperation =
  | { readonly kind: "stat"; readonly path: string }
  | { readonly kind: "list-directory"; readonly path: string }
  | { readonly kind: "read-text"; readonly path: string }
  | { readonly kind: "process-liveness"; readonly owner: OutputLockOwner }
  | { readonly kind: "create-directory"; readonly path: string; readonly mode: "exclusive" | "recursive" }
  | { readonly kind: "create-stage"; readonly prefix: string }
  | { readonly kind: "write-exclusive"; readonly path: string; readonly text: string }
  | { readonly kind: "write-file"; readonly path: string; readonly text: string }
  | { readonly kind: "rename"; readonly from: string; readonly to: string }
  | { readonly kind: "remove-tree"; readonly path: string };

export type OutputObservation =
  | { readonly kind: "absent"; readonly path: string }
  | { readonly kind: "directory"; readonly path: string; readonly entries: readonly OutputDirectoryEntry[] }
  | { readonly kind: "path"; readonly path: string; readonly realPath: string;
      readonly entryKind: "file" | "directory" | "symlink"; readonly modifiedAt: number }
  | { readonly kind: "text"; readonly path: string; readonly text: string }
  | { readonly kind: "process"; readonly owner: OutputLockOwner; readonly liveness: ProcessLiveness }
  | { readonly kind: "stage-directory"; readonly path: string };

export type OperationOutcome =
  | { readonly kind: "done"; readonly operation: OutputOperation; readonly observed: OutputObservation | null }
  | { readonly kind: "failed"; readonly operation: OutputOperation; readonly failure: EffectFailure };

export type PublicationStep =
  | { readonly kind: "perform"; readonly operations: readonly [OutputOperation, ...OutputOperation[]] }
  | { readonly kind: "published"; readonly output: PublishedOutput }
  | { readonly kind: "restored"; readonly diagnostics: readonly [Diagnostic, ...Diagnostic[]] };

export type OutputScratchPaths = (deps: PublicationDeps, outputRoot: string) => OutputPaths;

export type NextPublicationStep = (
  deps: PublicationDeps,
  desired: PublicationInput,
  history: readonly OperationOutcome[],
) => Result<PublicationStep>;

export interface ArtifactEffects {
  readonly perform: (operations: readonly OutputOperation[]) => Promise<readonly OperationOutcome[]>;
}
