import { encodeIdentityTuple } from "./identity-tuple.js";
import { providerDeclarationClosureLimits } from "./provider-resource-limits.js";
const providerMaterializationRounds = new WeakMap();
export class ProviderMaterializationCoordinator {
    #completeExportsByModule = new Map();
    #activeRound;
    #roundCount = 0;
    #sealed = false;
    beginRound(options) {
        if (this.#sealed) {
            throw new Error("Provider materialization is sealed.");
        }
        if (this.#activeRound !== undefined) {
            throw new Error("A provider materialization round is already active.");
        }
        this.#roundCount += 1;
        if (this.#roundCount > providerDeclarationClosureLimits.maxCandidates + 1) {
            throw new Error(`Provider materialization did not converge within ${providerDeclarationClosureLimits.maxCandidates + 1} rounds.`);
        }
        const round = new ProviderMaterializationRound(snapshotCompleteExports(this.#completeExportsByModule));
        this.#activeRound = round;
        providerMaterializationRounds.set(options, round);
        return round;
    }
    finishRound(round) {
        if (this.#activeRound !== round) {
            throw new Error("Provider materialization rounds must finish in creation order.");
        }
        this.#activeRound = undefined;
        round.finish();
        let changed = false;
        for (const [moduleKey, demands] of round.pendingDemands()) {
            const completeExports = this.#completeExportsByModule.get(moduleKey) ?? new Map();
            for (const demand of demands) {
                const demandKey = getCompleteExportDemandKey(demand);
                if (!completeExports.has(demandKey)) {
                    completeExports.set(demandKey, demand);
                    changed = true;
                }
            }
            this.#completeExportsByModule.set(moduleKey, completeExports);
        }
        return changed;
    }
    seal(round) {
        if (this.#activeRound !== round) {
            throw new Error("Only the active provider materialization round can be sealed.");
        }
        if (round.hasPendingDemands()) {
            throw new Error("Provider materialization cannot seal with unresolved complete-export demands.");
        }
        this.#activeRound = undefined;
        round.seal();
        this.#sealed = true;
    }
}
export class ProviderMaterializationRound {
    #completeExportsByModule;
    #pendingDemandsByModule = new Map();
    #incrementalProviderLoaded = false;
    #state = "active";
    constructor(completeExportsByModule) {
        this.#completeExportsByModule = completeExportsByModule;
    }
    createRequest(provider, resolution, context, mode) {
        if (mode === "complete") {
            return Object.freeze({
                context,
                materialization: completeProviderDeclarationMaterialization,
            });
        }
        this.#incrementalProviderLoaded = true;
        const moduleKey = getProviderMaterializationModuleKey(provider, resolution);
        const completeExports = this.#completeExportsByModule.get(moduleKey) ?? emptyCompleteExportDemands;
        return Object.freeze({
            context,
            materialization: Object.freeze({
                kind: "incremental",
                completeExports,
            }),
        });
    }
    recordCompleteExportDemand(provider, fact, materialization) {
        if (fact.exportName === undefined) {
            return false;
        }
        if (provider.id !== fact.providerId
            || provider.version !== fact.providerVersion) {
            throw new Error("Provider materialization evidence does not match its owning provider identity.");
        }
        if (providerMaterializationIncludes(materialization, fact.exportName, fact.exportId)) {
            return false;
        }
        if (this.#state !== "active") {
            throw new Error(`Provider materialization demand arrived after its round was ${this.#state}.`);
        }
        if (materialization.kind !== "incremental") {
            throw new Error("A complete provider declaration cannot request additional materialization.");
        }
        const moduleKey = getProviderMaterializationModuleKey(provider, {
            moduleSpecifier: fact.moduleSpecifier,
            providerModuleId: fact.providerModuleId,
        });
        const demand = Object.freeze({
            exportName: fact.exportName,
            ...(fact.exportId === undefined ? {} : { exportId: fact.exportId }),
        });
        const demands = this.#pendingDemandsByModule.get(moduleKey) ?? new Map();
        const demandKey = getCompleteExportDemandKey(demand);
        if (demands.has(demandKey)) {
            return false;
        }
        demands.set(demandKey, demand);
        this.#pendingDemandsByModule.set(moduleKey, demands);
        return true;
    }
    hasIncrementalProvider() {
        return this.#incrementalProviderLoaded;
    }
    hasPendingDemands() {
        return this.#pendingDemandsByModule.size !== 0;
    }
    pendingDemands() {
        return Object.freeze([...this.#pendingDemandsByModule]
            .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
            .map(([moduleKey, demands]) => Object.freeze([
            moduleKey,
            Object.freeze([...demands.values()].sort(compareCompleteExportDemands)),
        ])));
    }
    finish() {
        if (this.#state !== "active") {
            throw new Error("Provider materialization round can finish only once.");
        }
        this.#state = "finished";
    }
    seal() {
        if (this.#state !== "active") {
            throw new Error("Provider materialization round can seal only while active.");
        }
        this.#state = "sealed";
    }
}
const completeProviderDeclarationMaterialization = Object.freeze({
    kind: "complete",
});
const emptyCompleteExportDemands = Object.freeze([]);
export function getProviderMaterializationRound(options) {
    return providerMaterializationRounds.get(options);
}
function snapshotCompleteExports(source) {
    return new Map([...source]
        .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
        .map(([moduleKey, demands]) => [
        moduleKey,
        Object.freeze([...demands.values()].sort(compareCompleteExportDemands)),
    ]));
}
function getProviderMaterializationModuleKey(provider, resolution) {
    return encodeIdentityTuple([
        provider.id,
        provider.version,
        provider.extensionContractVersion,
        provider.configHash ?? "",
        resolution.providerModuleId,
        resolution.moduleSpecifier,
    ]);
}
function getCompleteExportDemandKey(demand) {
    return encodeIdentityTuple([demand.exportName, demand.exportId ?? ""]);
}
function compareCompleteExportDemands(left, right) {
    return left.exportName < right.exportName
        ? -1
        : left.exportName > right.exportName
            ? 1
            : (left.exportId ?? "") < (right.exportId ?? "")
                ? -1
                : (left.exportId ?? "") > (right.exportId ?? "")
                    ? 1
                    : 0;
}
function providerMaterializationIncludes(materialization, exportName, exportId) {
    return materialization.kind === "complete"
        || materialization.completeExports.some((request) => request.exportName === exportName
            && (request.exportId === undefined || request.exportId === exportId));
}
//# sourceMappingURL=provider-materialization.js.map