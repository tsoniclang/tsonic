import type {
  TargetArtifactFacetContract,
  TargetArtifactContract,
  TargetArtifactDependency,
  TargetArtifactContractGraphOptions,
  TargetArtifactContractRejection,
  TargetArtifactContractGraphResult,
  NormalizedContract,
  NormalizedDependencySet,
  TargetArtifactContractGraphLimits,
} from "./contract-graph-model.js";

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

export function resolveLimits(
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

export function normalizeContract<Facet extends string>(
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

export function normalizeDependencies<Facet extends string>(
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

export function changedContractFacets<Facet extends string>(
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

export function dependencySetsEqual<Facet extends string>(
  left: ReadonlyMap<string, TargetArtifactDependency<Facet>>,
  right: ReadonlyMap<string, TargetArtifactDependency<Facet>>,
): boolean {
  return left.size === right.size && [...left.keys()].every((key) => right.has(key));
}

export function dependencyKey(owner: string, facet: string): string {
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

export function validateIdentity(
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

export function checkedAdd(left: number, right: number): number | undefined {
  const result = left + right;
  return Number.isSafeInteger(result) && result >= 0 ? result : undefined;
}

export function checkedReplaceTotal(
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

export function accepted<Facet extends string>(
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

export function rejectedInvalid(
  reason: string,
): TargetArtifactContractRejection {
  return {
    kind: "rejected",
    code: "TARGET_ARTIFACT_CONTRACT_INVALID",
    reason,
  };
}

export function rejectedBudget(
  reason: string,
): TargetArtifactContractRejection {
  return {
    kind: "rejected",
    code: "TARGET_ARTIFACT_CONTRACT_BUDGET_EXCEEDED",
    reason,
  };
}
