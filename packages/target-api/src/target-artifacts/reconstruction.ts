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
      readonly kind: "blocked";
      readonly reason: string;
      readonly dependencies: readonly TargetArtifactDependency<Facet>[];
    }
  | {
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
    }
  | {
      readonly kind: "failed";
      readonly failures: readonly TargetArtifactOwnerFailure[];
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
  const failuresByOwner = new Map<string, TargetArtifactOwnerFailure>();
  const blockedByOwner = new Map<string, {
    readonly reason: string;
    readonly dependencies: readonly TargetArtifactDependency<Facet>[];
  }>();
  while (graph.hasPending() || blockedByOwner.size > 0) {
    if (!graph.hasPending()) {
      const released = releaseAvailableBlockedOwners();
      if (released.kind === "rejected") {
        return {
          ...released,
          reconstructionCount,
        };
      }
      if (!graph.hasPending()) {
        const blockedByFailedOwner = [...blockedByOwner.entries()].every(
          ([_owner, blocked]) => blocked.dependencies.some((dependency) =>
            failuresByOwner.has(dependency.owner)
          ),
        );
        if (failuresByOwner.size > 0 && blockedByFailedOwner) {
          break;
        }
        const first = [...blockedByOwner.entries()].sort(([left], [right]) =>
          left.localeCompare(right)
        )[0]!;
        return {
          kind: "rejected",
          owner: first[0],
          code: "TARGET_ARTIFACT_BLOCKED_WITHOUT_PROGRESS",
          reason:
            `Target artifact '${first[0]}' remains blocked on unpublished prerequisite facets: ${formatDependencies(first[1].dependencies)}. ${first[1].reason}`,
          reconstructionCount,
        };
      }
    }
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
    if (failuresByOwner.has(owner)) {
      graph.discardDirty(owner);
      continue;
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
      failuresByOwner.set(owner, Object.freeze({
        owner,
        code: candidate.code,
        reason: candidate.reason,
      }));
      graph.discardDirty(owner);
      continue;
    }
    if (candidate.kind === "blocked") {
      const dependencies = normalizeBlockedDependencies(candidate.dependencies);
      if (dependencies.kind === "rejected") {
        return {
          kind: "rejected",
          owner,
          code: "TARGET_ARTIFACT_BLOCKED_DEPENDENCY_INVALID",
          reason: dependencies.reason,
          reconstructionCount,
        };
      }
      if (dependencies.value.every((dependency) => dependencyIsAvailable(dependency))) {
        return {
          kind: "rejected",
          owner,
          code: "TARGET_ARTIFACT_BLOCKED_WITHOUT_UNPUBLISHED_DEPENDENCY",
          reason:
            `Target artifact '${owner}' reported itself blocked even though every declared prerequisite facet is already published: ${candidate.reason}`,
          reconstructionCount,
        };
      }
      blockedByOwner.set(owner, Object.freeze({
        reason: candidate.reason,
        dependencies: dependencies.value,
      }));
      graph.discardDirty(owner);
      continue;
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
    const released = releaseAvailableBlockedOwners();
    if (released.kind === "rejected") {
      return {
        ...released,
        reconstructionCount,
      };
    }
  }
  if (failuresByOwner.size > 0) {
    return {
      kind: "failed",
      failures: Object.freeze(
        [...failuresByOwner.values()].sort((left, right) =>
          left.owner.localeCompare(right.owner)
        ),
      ),
      reconstructionCount,
    };
  }
  const closure = graph.verifyClosure();
  return closure.kind === "closed"
    ? { kind: "completed", reconstructionCount }
    : {
        ...closure,
        reconstructionCount,
      };

  function releaseAvailableBlockedOwners():
    | { readonly kind: "accepted" }
    | {
        readonly kind: "rejected";
        readonly owner: string;
        readonly code: string;
        readonly reason: string;
      } {
    for (const [owner, blocked] of [...blockedByOwner.entries()].sort(
      ([left], [right]) => left.localeCompare(right),
    )) {
      if (!blocked.dependencies.every(dependencyIsAvailable)) {
        continue;
      }
      const marked = graph.markDirty(owner);
      if (marked.kind === "rejected") {
        return {
          kind: "rejected",
          owner,
          code: marked.code,
          reason: marked.reason,
        };
      }
      blockedByOwner.delete(owner);
    }
    return { kind: "accepted" };
  }

  function dependencyIsAvailable(
    dependency: TargetArtifactDependency<Facet>,
  ): boolean {
    return graph.hasPublishedFacet(dependency);
  }
}

function normalizeBlockedDependencies<Facet extends string>(
  dependencies: readonly TargetArtifactDependency<Facet>[],
):
  | { readonly kind: "resolved"; readonly value: readonly TargetArtifactDependency<Facet>[] }
  | { readonly kind: "rejected"; readonly reason: string } {
  if (!Array.isArray(dependencies) || dependencies.length === 0) {
    return {
      kind: "rejected",
      reason:
        "A blocked target artifact must identify at least one exact prerequisite facet.",
    };
  }
  const byKey = new Map<string, TargetArtifactDependency<Facet>>();
  for (const dependency of dependencies) {
    if (
      dependency === undefined ||
      typeof dependency.owner !== "string" ||
      dependency.owner.length === 0 ||
      typeof dependency.facet !== "string" ||
      dependency.facet.length === 0
    ) {
      return {
        kind: "rejected",
        reason:
          "A blocked target artifact contains an invalid prerequisite owner or facet identity.",
      };
    }
    byKey.set(
      `${dependency.owner.length}:${dependency.owner}${dependency.facet.length}:${dependency.facet}`,
      Object.freeze({ ...dependency }),
    );
  }
  return {
    kind: "resolved",
    value: Object.freeze(
      [...byKey.values()].sort((left, right) =>
        left.owner.localeCompare(right.owner) ||
        left.facet.localeCompare(right.facet)
      ),
    ),
  };
}

function formatDependencies<Facet extends string>(
  dependencies: readonly TargetArtifactDependency<Facet>[],
): string {
  return dependencies.map((dependency) =>
    `'${dependency.owner}'/'${dependency.facet}'`
  ).join(", ");
}
