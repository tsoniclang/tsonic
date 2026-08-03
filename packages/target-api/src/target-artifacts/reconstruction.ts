import type {
  TargetArtifactContract,
  TargetArtifactContractGraph,
  TargetArtifactDependency,
} from "./contract-graph.js";

export type TargetArtifactReconstruction<Facet extends string, Artifact> =
  | {
      readonly kind: "resolved";
      readonly contract: TargetArtifactContract<Facet>;
      readonly dependencies: readonly TargetArtifactDependency<Facet>[];
      readonly artifact: Artifact;
    }
  | {
      readonly kind: "retry";
      readonly reason: string;
    }
  | {
      readonly kind: "rejected";
      readonly code: string;
      readonly reason: string;
    };

export interface TargetArtifactReconstructionOptions {
  readonly maximumReconstructionCount: number;
}

export type TargetArtifactReconstructionRunResult =
  | {
      readonly kind: "completed";
      readonly reconstructionCount: number;
    }
  | {
      readonly kind: "rejected";
      readonly owner?: string;
      readonly code: string;
      readonly reason: string;
      readonly reconstructionCount: number;
    };

export function reconstructTargetArtifacts<Facet extends string, Artifact>(
  graph: TargetArtifactContractGraph<Facet, Artifact>,
  roots: readonly string[],
  reconstruct: (
    owner: string,
    graph: TargetArtifactContractGraph<Facet, Artifact>,
  ) => TargetArtifactReconstruction<Facet, Artifact>,
  options: TargetArtifactReconstructionOptions,
): TargetArtifactReconstructionRunResult {
  const maximumReconstructionCount = options?.maximumReconstructionCount;
  if (
    !Number.isSafeInteger(maximumReconstructionCount) ||
    maximumReconstructionCount <= 0
  ) {
    throw new Error(
      "Target artifact maximum reconstruction count must be a positive safe integer.",
    );
  }
  for (const owner of [...new Set(roots)].sort((left, right) => left.localeCompare(right))) {
    const marked = graph.markDirty(owner);
    if (marked.kind === "rejected") {
      return {
        kind: "rejected",
        owner,
        code: marked.code,
        reason: marked.reason,
        reconstructionCount: 0,
      };
    }
  }
  let reconstructionCount = 0;
  while (graph.hasPending()) {
    const owner = graph.nextDirty();
    if (owner === undefined) {
      return {
        kind: "rejected",
        code: "TARGET_ARTIFACT_DIRTY_QUEUE_INCONSISTENT",
        reason:
          "Target artifact graph reported pending reconstruction without one exact dirty owner.",
        reconstructionCount,
      };
    }
    reconstructionCount += 1;
    if (reconstructionCount > maximumReconstructionCount) {
      return {
        kind: "rejected",
        owner,
        code: "TARGET_ARTIFACT_RECONSTRUCTION_BUDGET_EXCEEDED",
        reason:
          `Target artifact reconstruction exceeds its finite ${maximumReconstructionCount}-attempt budget.`,
        reconstructionCount: reconstructionCount - 1,
      };
    }
    const revisionBeforeReconstruction = graph.revision;
    const candidate = reconstruct(owner, graph);
    if (candidate.kind === "rejected") {
      return {
        ...candidate,
        owner,
        reconstructionCount,
      };
    }
    if (candidate.kind === "retry") {
      if (graph.revision === revisionBeforeReconstruction) {
        return {
          kind: "rejected",
          owner,
          code: "TARGET_ARTIFACT_RETRY_WITHOUT_PROGRESS",
          reason:
            `Target artifact '${owner}' requested reconstruction retry without changing any prerequisite contract: ${candidate.reason}`,
          reconstructionCount,
        };
      }
      const marked = graph.markDirty(owner);
      if (marked.kind === "rejected") {
        return {
          kind: "rejected",
          owner,
          code: marked.code,
          reason: marked.reason,
          reconstructionCount,
        };
      }
      continue;
    }
    const committed = graph.commit(
      owner,
      candidate.contract,
      candidate.dependencies,
      candidate.artifact,
    );
    if (committed.kind === "rejected") {
      return {
        kind: "rejected",
        owner,
        code: committed.code,
        reason: committed.reason,
        reconstructionCount,
      };
    }
  }
  const closure = graph.verifyClosure();
  return closure.kind === "closed"
    ? { kind: "completed", reconstructionCount }
    : {
        ...closure,
        reconstructionCount,
      };
}
