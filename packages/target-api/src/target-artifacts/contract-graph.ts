import type {
  TargetArtifactContract,
  TargetArtifactDependency,
  TargetArtifactContractUpdate,
  TargetArtifactContractGraphOptions,
  TargetArtifactContractGraphResult,
  TargetArtifactContractBatchResult,
  TargetArtifactContractClosureResult,
  TargetArtifactContractGraph,
  ArtifactRecord,
  PreparedArtifactUpdate,
} from "./contract-graph-model.js";
import {
  resolveLimits,
  normalizeContract,
  normalizeDependencies,
  changedContractFacets,
  dependencySetsEqual,
  dependencyKey,
  validateIdentity,
  checkedAdd,
  checkedReplaceTotal,
  accepted,
  rejectedInvalid,
  rejectedBudget,
} from "./contract-normalization.js";
import { DeterministicOwnerQueue } from "./contract-owner-queue.js";

export function createTargetArtifactContractGraph<Facet extends string, Artifact>(
  options: TargetArtifactContractGraphOptions = {},
): TargetArtifactContractGraph<Facet, Artifact> {
  const limitsResult = resolveLimits(options);
  if (limitsResult.kind === "rejected") {
    throw new Error(limitsResult.reason);
  }
  const limits = limitsResult.limits;
  const records = new Map<string, ArtifactRecord<Facet, Artifact>>();
  const reverse = new Map<string, Set<string>>();
  const dirty = new DeterministicOwnerQueue();
  const pendingUnpublished = new Set<string>();
  let revision = 0;
  let dependencyCount = 0;
  let contractCodeUnits = 0;
  let contractHistoryCodeUnits = 0;

  function markDirty(
    owner: string,
  ): TargetArtifactContractGraphResult<Facet> {
    const ownerFailure = validateIdentity(
      owner,
      "artifact owner",
      limits.maximumIdentityCodeUnits,
    );
    if (ownerFailure !== undefined) {
      return rejectedInvalid(ownerFailure);
    }
    if (!records.has(owner) && !pendingUnpublished.has(owner)) {
      const scheduledArtifactCount = checkedAdd(
        records.size,
        pendingUnpublished.size,
      );
      if (
        scheduledArtifactCount === undefined ||
        scheduledArtifactCount >= limits.maximumArtifactCount
      ) {
        return rejectedBudget(
          `Target artifact scheduling exceeds its finite ${limits.maximumArtifactCount}-artifact budget.`,
        );
      }
      pendingUnpublished.add(owner);
    }
    dirty.push(owner);
    return accepted([], false, false);
  }

  function commit(
    owner: string,
    contract: TargetArtifactContract<Facet>,
    dependencies: readonly TargetArtifactDependency<Facet>[],
    artifact: Artifact,
  ): TargetArtifactContractGraphResult<Facet> {
    const batch = commitBatch([{ owner, contract, dependencies, artifact }]);
    if (batch.kind === "rejected") {
      return batch;
    }
    const change = batch.changes[0];
    return change === undefined
      ? accepted([], false, false)
      : accepted(
          change.changedFacets,
          change.contractChanged,
          change.dependenciesChanged,
        );
  }

  function commitBatch(
    updates: readonly TargetArtifactContractUpdate<Facet, Artifact>[],
  ): TargetArtifactContractBatchResult<Facet> {
    if (!Array.isArray(updates)) {
      return rejectedInvalid(
        "Target artifact contract updates must be a readonly array.",
      );
    }
    const owners = new Set<string>();
    const prepared: PreparedArtifactUpdate<Facet, Artifact>[] = [];
    for (const update of updates) {
      const ownerFailure = validateIdentity(
        update?.owner,
        "artifact owner",
        limits.maximumIdentityCodeUnits,
      );
      if (ownerFailure !== undefined) {
        return rejectedInvalid(ownerFailure);
      }
      if (owners.has(update.owner)) {
        return rejectedInvalid(
          `Target artifact contract batch contains duplicate owner '${update.owner}'.`,
        );
      }
      owners.add(update.owner);
      const normalizedContract = normalizeContract<Facet>(update.contract, limits);
      if (normalizedContract.kind === "rejected") {
        return normalizedContract.result;
      }
      const normalizedDependencies = normalizeDependencies<Facet>(
        update.dependencies,
        limits,
      );
      if (normalizedDependencies.kind === "rejected") {
        return normalizedDependencies.result;
      }
      const current = records.get(update.owner);
      const changedFacets = changedContractFacets<Facet>(
        current?.contract.facets,
        normalizedContract.contract.facets,
      );
      const contractChanged = current === undefined || changedFacets.length > 0;
      const dependenciesChanged = current === undefined || !dependencySetsEqual(
        current.dependencies.byKey,
        normalizedDependencies.dependencies.byKey,
      );
      if (
        current !== undefined &&
        contractChanged &&
        current.history.has(normalizedContract.contract.encoded)
      ) {
        return {
          kind: "rejected",
          code: "TARGET_ARTIFACT_CONTRACT_OSCILLATION",
          reason:
            `Target artifact '${update.owner}' revisited an earlier observable contract while reconstructing facets ${changedFacets.join(", ")}.`,
        };
      }
      if (
        current !== undefined &&
        contractChanged &&
        current.history.size >= limits.maximumContractHistoryPerArtifact
      ) {
        return rejectedBudget(
          `Target artifact '${update.owner}' exceeds its finite ${limits.maximumContractHistoryPerArtifact}-revision contract history budget.`,
        );
      }
      prepared.push({
        owner: update.owner,
        contract: normalizedContract.contract,
        dependencies: normalizedDependencies.dependencies,
        artifact: update.artifact,
        current,
        changedFacets,
        contractChanged,
        dependenciesChanged,
      });
    }
    prepared.sort((left, right) => left.owner.localeCompare(right.owner));

    const newArtifactCount = prepared.filter((update) =>
      update.current === undefined
    ).length;
    const nextArtifactCount = checkedAdd(records.size, newArtifactCount);
    if (
      nextArtifactCount === undefined ||
      nextArtifactCount > limits.maximumArtifactCount
    ) {
      return rejectedBudget(
        `Target artifact contracts exceed their finite ${limits.maximumArtifactCount}-artifact budget.`,
      );
    }
    let nextDependencyCount = dependencyCount;
    let nextContractCodeUnits = contractCodeUnits;
    let nextContractHistoryCodeUnits = contractHistoryCodeUnits;
    for (const update of prepared) {
      nextDependencyCount = checkedReplaceTotal(
        nextDependencyCount,
        update.current?.dependencies.byKey.size ?? 0,
        update.dependencies.byKey.size,
      ) ?? Number.POSITIVE_INFINITY;
      nextContractCodeUnits = checkedReplaceTotal(
        nextContractCodeUnits,
        update.current?.contract.codeUnits ?? 0,
        update.contract.codeUnits,
      ) ?? Number.POSITIVE_INFINITY;
      if (update.contractChanged) {
        nextContractHistoryCodeUnits = checkedAdd(
          nextContractHistoryCodeUnits,
          update.contract.encoded.length,
        ) ?? Number.POSITIVE_INFINITY;
      }
    }
    if (
      !Number.isSafeInteger(nextDependencyCount) ||
      nextDependencyCount > limits.maximumDependencyCount
    ) {
      return rejectedBudget(
        `Target artifact dependencies exceed their finite ${limits.maximumDependencyCount}-edge budget.`,
      );
    }
    if (
      !Number.isSafeInteger(nextContractCodeUnits) ||
      nextContractCodeUnits > limits.maximumContractCodeUnits
    ) {
      return rejectedBudget(
        `Target artifact contracts exceed their finite ${limits.maximumContractCodeUnits}-code-unit budget.`,
      );
    }
    if (
      !Number.isSafeInteger(nextContractHistoryCodeUnits) ||
      nextContractHistoryCodeUnits > limits.maximumContractHistoryCodeUnits
    ) {
      return rejectedBudget(
        `Target artifact contract history exceeds its finite ${limits.maximumContractHistoryCodeUnits}-code-unit budget.`,
      );
    }

    const changed = prepared.filter((update) =>
      update.contractChanged || update.dependenciesChanged
    );
    for (const update of prepared) {
      if (update.current !== undefined && update.dependenciesChanged) {
        removeReverseEdges(update.owner, update.current.dependencies.byKey);
      }
    }
    for (const update of prepared) {
      const nextRecord: ArtifactRecord<Facet, Artifact> = update.current ?? {
        contract: update.contract,
        dependencies: update.dependencies,
        artifact: update.artifact,
        facetRevisions: new Map(),
        history: new Set(),
      };
      nextRecord.contract = update.contract;
      nextRecord.dependencies = update.dependencies;
      nextRecord.artifact = update.artifact;
      if (update.contractChanged) {
        nextRecord.history.add(update.contract.encoded);
        for (const facet of update.changedFacets) {
          nextRecord.facetRevisions.set(
            facet,
            (nextRecord.facetRevisions.get(facet) ?? 0) + 1,
          );
        }
      }
      records.set(update.owner, nextRecord);
      if (update.dependenciesChanged) {
        addReverseEdges(update.owner, update.dependencies.byKey);
      }
    }
    dependencyCount = nextDependencyCount;
    contractCodeUnits = nextContractCodeUnits;
    contractHistoryCodeUnits = nextContractHistoryCodeUnits;
    if (changed.length > 0) {
      revision += 1;
    }
    for (const update of prepared) {
      dirty.discard(update.owner);
      pendingUnpublished.delete(update.owner);
    }
    for (const update of changed) {
      invalidateConsumers(update.owner, update.changedFacets, owners);
    }
    return {
      kind: "accepted",
      changes: Object.freeze(prepared.map((update) => Object.freeze({
        owner: update.owner,
        changedFacets: Object.freeze([...update.changedFacets]),
        contractChanged: update.contractChanged,
        dependenciesChanged: update.dependenciesChanged,
      }))),
    };
  }

  function removeReverseEdges(
    consumer: string,
    dependencies: ReadonlyMap<string, TargetArtifactDependency<Facet>>,
  ): void {
    for (const key of dependencies.keys()) {
      const consumers = reverse.get(key);
      if (consumers === undefined) {
        continue;
      }
      consumers.delete(consumer);
      if (consumers.size === 0) {
        reverse.delete(key);
      }
    }
  }

  function addReverseEdges(
    consumer: string,
    dependencies: ReadonlyMap<string, TargetArtifactDependency<Facet>>,
  ): void {
    for (const key of dependencies.keys()) {
      const consumers = reverse.get(key) ?? new Set<string>();
      consumers.add(consumer);
      reverse.set(key, consumers);
    }
  }

  function invalidateConsumers(
    owner: string,
    facets: readonly Facet[],
    reconstructedOwners: ReadonlySet<string> = new Set(),
  ): void {
    for (const facet of facets) {
      const consumers = reverse.get(dependencyKey(owner, facet));
      if (consumers === undefined) {
        continue;
      }
      for (const consumer of consumers) {
        if (!reconstructedOwners.has(consumer)) {
          dirty.push(consumer);
        }
      }
    }
  }

  function verifyClosure(): TargetArtifactContractClosureResult {
    for (const [consumer, record] of [...records].sort(([left], [right]) => left.localeCompare(right))) {
      for (const dependency of record.dependencies.snapshot) {
        const provider = records.get(dependency.owner);
        if (provider === undefined) {
          return {
            kind: "rejected",
            code: "TARGET_ARTIFACT_CONTRACT_OPEN",
            reason:
              `Target artifact '${consumer}' depends on unpublished artifact '${dependency.owner}' facet '${dependency.facet}'.`,
          };
        }
        if (!provider.contract.facets.has(dependency.facet)) {
          return {
            kind: "rejected",
            code: "TARGET_ARTIFACT_CONTRACT_OPEN",
            reason:
              `Target artifact '${consumer}' depends on absent facet '${dependency.facet}' of artifact '${dependency.owner}'.`,
          };
        }
      }
    }
    return { kind: "closed" };
  }

  return Object.freeze({
    get revision(): number {
      return revision;
    },
    get artifactCount(): number {
      return records.size;
    },
    get dependencyCount(): number {
      return dependencyCount;
    },
    markDirty,
    commit,
    commitBatch,
    contract(owner: string): TargetArtifactContract<Facet> | undefined {
      return records.get(owner)?.contract.snapshot;
    },
    artifact(owner: string): Artifact | undefined {
      return records.get(owner)?.artifact;
    },
    dependencies(owner: string): readonly TargetArtifactDependency<Facet>[] {
      return records.get(owner)?.dependencies.snapshot ?? Object.freeze([]);
    },
    hasPublishedFacet(dependency: TargetArtifactDependency<Facet>): boolean {
      return records.get(dependency.owner)?.contract.facets.has(
        dependency.facet,
      ) === true;
    },
    facetRevision(owner: string, facet: Facet): number {
      return records.get(owner)?.facetRevisions.get(facet) ?? 0;
    },
    nextDirty(): string | undefined {
      return dirty.pop();
    },
    discardDirty(owner: string): void {
      dirty.discard(owner);
      if (!records.has(owner)) {
        pendingUnpublished.delete(owner);
      }
    },
    hasPending(): boolean {
      return dirty.size > 0;
    },
    verifyClosure,
  });
}
