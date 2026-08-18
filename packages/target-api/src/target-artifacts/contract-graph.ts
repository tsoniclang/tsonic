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

type TargetArtifactContractRejection = {
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

interface NormalizedContract<Facet extends string> {
  readonly facets: ReadonlyMap<Facet, string>;
  readonly snapshot: TargetArtifactContract<Facet>;
  readonly encoded: string;
  readonly codeUnits: number;
}

interface NormalizedDependencySet<Facet extends string> {
  readonly byKey: ReadonlyMap<string, TargetArtifactDependency<Facet>>;
  readonly snapshot: readonly TargetArtifactDependency<Facet>[];
}

interface ArtifactRecord<Facet extends string, Artifact> {
  contract: NormalizedContract<Facet>;
  dependencies: NormalizedDependencySet<Facet>;
  artifact: Artifact;
  readonly facetRevisions: Map<Facet, number>;
  readonly history: Set<string>;
}

interface PreparedArtifactUpdate<Facet extends string, Artifact> {
  readonly owner: string;
  readonly contract: NormalizedContract<Facet>;
  readonly dependencies: NormalizedDependencySet<Facet>;
  readonly artifact: Artifact;
  readonly current?: ArtifactRecord<Facet, Artifact>;
  readonly changedFacets: readonly Facet[];
  readonly contractChanged: boolean;
  readonly dependenciesChanged: boolean;
}

interface TargetArtifactContractGraphLimits {
  readonly maximumArtifactCount: number;
  readonly maximumFacetCountPerArtifact: number;
  readonly maximumDependencyCount: number;
  readonly maximumContractCodeUnits: number;
  readonly maximumContractHistoryCodeUnits: number;
  readonly maximumContractHistoryPerArtifact: number;
  readonly maximumIdentityCodeUnits: number;
  readonly maximumFacetValueCodeUnits: number;
}

const defaultLimits: TargetArtifactContractGraphLimits = Object.freeze({
  maximumArtifactCount: 131_072,
  maximumFacetCountPerArtifact: 64,
  maximumDependencyCount: 1_048_576,
  maximumContractCodeUnits: 67_108_864,
  maximumContractHistoryCodeUnits: 268_435_456,
  maximumContractHistoryPerArtifact: 256,
  maximumIdentityCodeUnits: 4_096,
  maximumFacetValueCodeUnits: 4_194_304,
});

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

function resolveLimits(
  options: TargetArtifactContractGraphOptions,
):
  | { readonly kind: "resolved"; readonly limits: TargetArtifactContractGraphLimits }
  | { readonly kind: "rejected"; readonly reason: string } {
  const limits = {
    maximumArtifactCount:
      options.maximumArtifactCount ?? defaultLimits.maximumArtifactCount,
    maximumFacetCountPerArtifact:
      options.maximumFacetCountPerArtifact ?? defaultLimits.maximumFacetCountPerArtifact,
    maximumDependencyCount:
      options.maximumDependencyCount ?? defaultLimits.maximumDependencyCount,
    maximumContractCodeUnits:
      options.maximumContractCodeUnits ?? defaultLimits.maximumContractCodeUnits,
    maximumContractHistoryCodeUnits:
      options.maximumContractHistoryCodeUnits ?? defaultLimits.maximumContractHistoryCodeUnits,
    maximumContractHistoryPerArtifact:
      options.maximumContractHistoryPerArtifact ?? defaultLimits.maximumContractHistoryPerArtifact,
    maximumIdentityCodeUnits:
      options.maximumIdentityCodeUnits ?? defaultLimits.maximumIdentityCodeUnits,
    maximumFacetValueCodeUnits:
      options.maximumFacetValueCodeUnits ?? defaultLimits.maximumFacetValueCodeUnits,
  };
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      return {
        kind: "rejected",
        reason: `Target artifact contract graph limit '${name}' must be a positive safe integer.`,
      };
    }
  }
  return { kind: "resolved", limits };
}

function normalizeContract<Facet extends string>(
  contract: TargetArtifactContract<Facet>,
  limits: TargetArtifactContractGraphLimits,
):
  | { readonly kind: "resolved"; readonly contract: NormalizedContract<Facet> }
  | { readonly kind: "rejected"; readonly result: TargetArtifactContractRejection } {
  if (!Array.isArray(contract?.facets)) {
    return {
      kind: "rejected",
      result: rejectedInvalid("Target artifact contract facets must be a readonly array."),
    };
  }
  if (contract.facets.length > limits.maximumFacetCountPerArtifact) {
    return {
      kind: "rejected",
      result: rejectedBudget(
        `One target artifact contract exceeds its finite ${limits.maximumFacetCountPerArtifact}-facet budget.`,
      ),
    };
  }
  if (contract.facets.length === 0) {
    return {
      kind: "rejected",
      result: rejectedInvalid(
        "Target artifact contract must contain at least one observable facet.",
      ),
    };
  }
  const facets = new Map<Facet, string>();
  let codeUnits = 0;
  for (const entry of contract.facets) {
    const facetFailure = validateIdentity(
      entry?.facet,
      "artifact facet",
      limits.maximumIdentityCodeUnits,
    );
    if (facetFailure !== undefined) {
      return { kind: "rejected", result: rejectedInvalid(facetFailure) };
    }
    if (typeof entry.value !== "string") {
      return {
        kind: "rejected",
        result: rejectedInvalid(
          `Target artifact facet '${entry.facet}' canonical value must be a string.`,
        ),
      };
    }
    if (entry.value.length > limits.maximumFacetValueCodeUnits) {
      return {
        kind: "rejected",
        result: rejectedBudget(
          `Target artifact facet '${entry.facet}' exceeds its finite ${limits.maximumFacetValueCodeUnits}-code-unit value budget.`,
        ),
      };
    }
    if (facets.has(entry.facet)) {
      return {
        kind: "rejected",
        result: rejectedInvalid(
          `Target artifact contract contains duplicate facet '${entry.facet}'.`,
        ),
      };
    }
    facets.set(entry.facet, entry.value);
    codeUnits = checkedAdd(codeUnits, entry.facet.length + entry.value.length) ?? Number.POSITIVE_INFINITY;
  }
  if (!Number.isSafeInteger(codeUnits)) {
    return {
      kind: "rejected",
      result: rejectedBudget("Target artifact contract code-unit accounting overflowed."),
    };
  }
  const snapshotFacets = [...facets]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([facet, value]) => Object.freeze({ facet, value }));
  const snapshot = Object.freeze({ facets: Object.freeze(snapshotFacets) });
  return {
    kind: "resolved",
    contract: {
      facets,
      snapshot,
      encoded: encodeContract(snapshotFacets),
      codeUnits,
    },
  };
}

function normalizeDependencies<Facet extends string>(
  dependencies: readonly TargetArtifactDependency<Facet>[],
  limits: TargetArtifactContractGraphLimits,
):
  | { readonly kind: "resolved"; readonly dependencies: NormalizedDependencySet<Facet> }
  | { readonly kind: "rejected"; readonly result: TargetArtifactContractRejection } {
  if (!Array.isArray(dependencies)) {
    return {
      kind: "rejected",
      result: rejectedInvalid("Target artifact dependencies must be a readonly array."),
    };
  }
  const byKey = new Map<string, TargetArtifactDependency<Facet>>();
  for (const dependency of dependencies) {
    const ownerFailure = validateIdentity(
      dependency?.owner,
      "dependency owner",
      limits.maximumIdentityCodeUnits,
    );
    const facetFailure = validateIdentity(
      dependency?.facet,
      "dependency facet",
      limits.maximumIdentityCodeUnits,
    );
    if (ownerFailure !== undefined || facetFailure !== undefined) {
      return {
        kind: "rejected",
        result: rejectedInvalid(ownerFailure ?? facetFailure!),
      };
    }
    const key = dependencyKey(dependency.owner, dependency.facet);
    if (!byKey.has(key)) {
      byKey.set(key, Object.freeze({
        owner: dependency.owner,
        facet: dependency.facet,
      }));
    }
  }
  const snapshot = Object.freeze(
    [...byKey.values()].sort(compareDependencies),
  );
  return { kind: "resolved", dependencies: { byKey, snapshot } };
}

function changedContractFacets<Facet extends string>(
  current: ReadonlyMap<Facet, string> | undefined,
  next: ReadonlyMap<Facet, string>,
): readonly Facet[] {
  const facets = new Set<Facet>([
    ...(current?.keys() ?? []),
    ...next.keys(),
  ]);
  return Object.freeze(
    [...facets]
      .filter((facet) => current?.get(facet) !== next.get(facet))
      .sort((left, right) => left.localeCompare(right)),
  );
}

function dependencySetsEqual<Facet extends string>(
  left: ReadonlyMap<string, TargetArtifactDependency<Facet>>,
  right: ReadonlyMap<string, TargetArtifactDependency<Facet>>,
): boolean {
  return left.size === right.size && [...left.keys()].every((key) => right.has(key));
}

function dependencyKey(owner: string, facet: string): string {
  return `${owner.length}:${owner}${facet.length}:${facet}`;
}

function compareDependencies<Facet extends string>(
  left: TargetArtifactDependency<Facet>,
  right: TargetArtifactDependency<Facet>,
): number {
  return left.owner.localeCompare(right.owner) || left.facet.localeCompare(right.facet);
}

function encodeContract<Facet extends string>(
  facets: readonly TargetArtifactFacetContract<Facet>[],
): string {
  return facets.map(({ facet, value }) =>
    `${facet.length}:${facet}${value.length}:${value}`
  ).join("");
}

function validateIdentity(
  value: unknown,
  label: string,
  maximumCodeUnits: number,
): string | undefined {
  if (typeof value !== "string" || value.length === 0) {
    return `Target artifact ${label} must be a non-empty string.`;
  }
  if (value.length > maximumCodeUnits) {
    return `Target artifact ${label} exceeds its finite ${maximumCodeUnits}-code-unit budget.`;
  }
  return undefined;
}

function checkedAdd(left: number, right: number): number | undefined {
  const result = left + right;
  return Number.isSafeInteger(result) && result >= 0 ? result : undefined;
}

function checkedReplaceTotal(
  total: number,
  previous: number,
  next: number,
): number | undefined {
  if (
    !Number.isSafeInteger(total) ||
    !Number.isSafeInteger(previous) ||
    !Number.isSafeInteger(next) ||
    total < previous ||
    previous < 0 ||
    next < 0
  ) {
    return undefined;
  }
  return checkedAdd(total - previous, next);
}

function accepted<Facet extends string>(
  changedFacets: readonly Facet[],
  contractChanged: boolean,
  dependenciesChanged: boolean,
): TargetArtifactContractGraphResult<Facet> {
  return {
    kind: "accepted",
    changedFacets: Object.freeze([...changedFacets]),
    contractChanged,
    dependenciesChanged,
  };
}

function rejectedInvalid(
  reason: string,
): TargetArtifactContractRejection {
  return {
    kind: "rejected",
    code: "TARGET_ARTIFACT_CONTRACT_INVALID",
    reason,
  };
}

function rejectedBudget(
  reason: string,
): TargetArtifactContractRejection {
  return {
    kind: "rejected",
    code: "TARGET_ARTIFACT_CONTRACT_BUDGET_EXCEEDED",
    reason,
  };
}

class DeterministicOwnerQueue {
  readonly #heap: string[] = [];
  readonly #members = new Set<string>();

  get size(): number {
    return this.#members.size;
  }

  push(owner: string): void {
    if (this.#members.has(owner)) {
      return;
    }
    this.#members.add(owner);
    this.#heap.push(owner);
    this.#bubbleUp(this.#heap.length - 1);
  }

  pop(): string | undefined {
    while (this.#heap.length > 0) {
      const owner = this.#removeRoot();
      if (!this.#members.delete(owner)) {
        continue;
      }
      return owner;
    }
    return undefined;
  }

  discard(owner: string): void {
    this.#members.delete(owner);
  }

  #removeRoot(): string {
    const root = this.#heap[0]!;
    const tail = this.#heap.pop();
    if (this.#heap.length > 0 && tail !== undefined) {
      this.#heap[0] = tail;
      this.#bubbleDown(0);
    }
    return root;
  }

  #bubbleUp(start: number): void {
    let index = start;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.#heap[parent]!.localeCompare(this.#heap[index]!) <= 0) {
        return;
      }
      [this.#heap[parent], this.#heap[index]] = [
        this.#heap[index]!,
        this.#heap[parent]!,
      ];
      index = parent;
    }
  }

  #bubbleDown(start: number): void {
    let index = start;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;
      if (
        left < this.#heap.length &&
        this.#heap[left]!.localeCompare(this.#heap[smallest]!) < 0
      ) {
        smallest = left;
      }
      if (
        right < this.#heap.length &&
        this.#heap[right]!.localeCompare(this.#heap[smallest]!) < 0
      ) {
        smallest = right;
      }
      if (smallest === index) {
        return;
      }
      [this.#heap[index], this.#heap[smallest]] = [
        this.#heap[smallest]!,
        this.#heap[index]!,
      ];
      index = smallest;
    }
  }
}
