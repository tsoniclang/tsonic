const defaultLimits = Object.freeze({
    maximumArtifactCount: 131072,
    maximumFacetCountPerArtifact: 64,
    maximumDependencyCount: 1048576,
    maximumContractCodeUnits: 67108864,
    maximumContractHistoryCodeUnits: 268435456,
    maximumContractHistoryPerArtifact: 256,
    maximumIdentityCodeUnits: 4096,
    maximumFacetValueCodeUnits: 4194304,
});
export function resolveLimits(options) {
    const limits = {
        maximumArtifactCount: options.maximumArtifactCount ?? defaultLimits.maximumArtifactCount,
        maximumFacetCountPerArtifact: options.maximumFacetCountPerArtifact ?? defaultLimits.maximumFacetCountPerArtifact,
        maximumDependencyCount: options.maximumDependencyCount ?? defaultLimits.maximumDependencyCount,
        maximumContractCodeUnits: options.maximumContractCodeUnits ?? defaultLimits.maximumContractCodeUnits,
        maximumContractHistoryCodeUnits: options.maximumContractHistoryCodeUnits ?? defaultLimits.maximumContractHistoryCodeUnits,
        maximumContractHistoryPerArtifact: options.maximumContractHistoryPerArtifact ?? defaultLimits.maximumContractHistoryPerArtifact,
        maximumIdentityCodeUnits: options.maximumIdentityCodeUnits ?? defaultLimits.maximumIdentityCodeUnits,
        maximumFacetValueCodeUnits: options.maximumFacetValueCodeUnits ?? defaultLimits.maximumFacetValueCodeUnits,
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
export function normalizeContract(contract, limits) {
    if (!Array.isArray(contract?.facets)) {
        return {
            kind: "rejected",
            result: rejectedInvalid("Target artifact contract facets must be a readonly array."),
        };
    }
    if (contract.facets.length > limits.maximumFacetCountPerArtifact) {
        return {
            kind: "rejected",
            result: rejectedBudget(`One target artifact contract exceeds its finite ${limits.maximumFacetCountPerArtifact}-facet budget.`),
        };
    }
    if (contract.facets.length === 0) {
        return {
            kind: "rejected",
            result: rejectedInvalid("Target artifact contract must contain at least one observable facet."),
        };
    }
    const facets = new Map();
    let codeUnits = 0;
    for (const entry of contract.facets) {
        const facetFailure = validateIdentity(entry?.facet, "artifact facet", limits.maximumIdentityCodeUnits);
        if (facetFailure !== undefined) {
            return { kind: "rejected", result: rejectedInvalid(facetFailure) };
        }
        if (typeof entry.value !== "string") {
            return {
                kind: "rejected",
                result: rejectedInvalid(`Target artifact facet '${entry.facet}' canonical value must be a string.`),
            };
        }
        if (entry.value.length > limits.maximumFacetValueCodeUnits) {
            return {
                kind: "rejected",
                result: rejectedBudget(`Target artifact facet '${entry.facet}' exceeds its finite ${limits.maximumFacetValueCodeUnits}-code-unit value budget.`),
            };
        }
        if (facets.has(entry.facet)) {
            return {
                kind: "rejected",
                result: rejectedInvalid(`Target artifact contract contains duplicate facet '${entry.facet}'.`),
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
export function normalizeDependencies(dependencies, limits) {
    if (!Array.isArray(dependencies)) {
        return {
            kind: "rejected",
            result: rejectedInvalid("Target artifact dependencies must be a readonly array."),
        };
    }
    const byKey = new Map();
    for (const dependency of dependencies) {
        const ownerFailure = validateIdentity(dependency?.owner, "dependency owner", limits.maximumIdentityCodeUnits);
        const facetFailure = validateIdentity(dependency?.facet, "dependency facet", limits.maximumIdentityCodeUnits);
        if (ownerFailure !== undefined || facetFailure !== undefined) {
            return {
                kind: "rejected",
                result: rejectedInvalid(ownerFailure ?? facetFailure),
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
    const snapshot = Object.freeze([...byKey.values()].sort(compareDependencies));
    return { kind: "resolved", dependencies: { byKey, snapshot } };
}
export function changedContractFacets(current, next) {
    const facets = new Set([
        ...(current?.keys() ?? []),
        ...next.keys(),
    ]);
    return Object.freeze([...facets]
        .filter((facet) => current?.get(facet) !== next.get(facet))
        .sort((left, right) => left.localeCompare(right)));
}
export function dependencySetsEqual(left, right) {
    return left.size === right.size && [...left.keys()].every((key) => right.has(key));
}
export function dependencyKey(owner, facet) {
    return `${owner.length}:${owner}${facet.length}:${facet}`;
}
function compareDependencies(left, right) {
    return left.owner.localeCompare(right.owner) || left.facet.localeCompare(right.facet);
}
function encodeContract(facets) {
    return facets.map(({ facet, value }) => `${facet.length}:${facet}${value.length}:${value}`).join("");
}
export function validateIdentity(value, label, maximumCodeUnits) {
    if (typeof value !== "string" || value.length === 0) {
        return `Target artifact ${label} must be a non-empty string.`;
    }
    if (value.length > maximumCodeUnits) {
        return `Target artifact ${label} exceeds its finite ${maximumCodeUnits}-code-unit budget.`;
    }
    return undefined;
}
export function checkedAdd(left, right) {
    const result = left + right;
    return Number.isSafeInteger(result) && result >= 0 ? result : undefined;
}
export function checkedReplaceTotal(total, previous, next) {
    if (!Number.isSafeInteger(total) ||
        !Number.isSafeInteger(previous) ||
        !Number.isSafeInteger(next) ||
        total < previous ||
        previous < 0 ||
        next < 0) {
        return undefined;
    }
    return checkedAdd(total - previous, next);
}
export function accepted(changedFacets, contractChanged, dependenciesChanged) {
    return {
        kind: "accepted",
        changedFacets: Object.freeze([...changedFacets]),
        contractChanged,
        dependenciesChanged,
    };
}
export function rejectedInvalid(reason) {
    return {
        kind: "rejected",
        code: "TARGET_ARTIFACT_CONTRACT_INVALID",
        reason,
    };
}
export function rejectedBudget(reason) {
    return {
        kind: "rejected",
        code: "TARGET_ARTIFACT_CONTRACT_BUDGET_EXCEEDED",
        reason,
    };
}
//# sourceMappingURL=contract-normalization.js.map