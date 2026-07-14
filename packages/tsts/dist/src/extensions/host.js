import { SourceFile_FileName } from "../internal/ast/ast.js";
import { Program_GetSourceFile, Program_GetSourceFiles } from "../internal/compiler/program.js";
import { createAstReader } from "../services/ast-reader.js";
import { createTypeCheckerQueries } from "../services/type-checker.js";
import { createTypeShapeQueries } from "../services/type-shape.js";
import { ExtensionObservationPoint } from "./observations.js";
import { isArgumentPassingMode } from "./argument-passing.js";
import { getProviderExportContractKeyMap, getProviderTypeParameterContractKey } from "./provider-export-contract.js";
import { getProviderVirtualArtifactForCompiler, isHostOwnedProviderVirtualFileName, providerCanonicalExportOwnerMarker, providerPublicVirtualSliceMarker, providerVirtualCompilerArtifactLookup, providerVirtualInternalRoot, providerVirtualPublicRoot } from "./provider-virtual-internal.js";
import { canonicalizeProviderAbiModel, validateProviderDeclarationModelGraph, } from "./provider-model-graph.js";
import { assertProviderBoundaryString, formatProviderBoundarySnapshotFailure, providerBoundaryMaxArrayEntries, providerBoundaryMaxTotalStringCodeUnits, snapshotProviderEvidenceArray, } from "./provider-boundary-data.js";
export const ExtensionHostDiagnosticCode = {
    factConflict: 9000001,
    duplicateExtension: 9000002,
    missingDependency: 9000003,
    dependencyCycle: 9000004,
    observationOwnerConflict: 9000005,
    observationOwnerMissing: 9000006,
    initializationFailed: 9000007,
    factStoreSealed: 9000008,
    consumerBeforeFinalization: 9000009,
    invalidProvider: 9000010,
    observationOwnerDeferred: 9000011,
    observationConflict: 9000012,
    unknownObservationOwner: 9000013,
    multipleTargetExtensions: 9000014,
    duplicateProvider: 9000015,
    providerOwnershipConflict: 9000016,
    providerResolutionFailed: 9000017,
    invalidProviderDeclaration: 9000018,
    lifecycleHookFailed: 9000019,
    requiredFactMissing: 9000020,
    providerContractMismatch: 9000021,
    providerMissing: 9000022,
    providerOwnershipFailed: 9000023,
    providerResolveFailed: 9000024,
    providerDeclarationFailed: 9000025,
    observationHookFailed: 9000026,
    diagnosticRangeInvalid: 9000027,
    diagnosticCodeOutOfRange: 9000028,
    invalidFactSubject: 9000029,
    registrationClosed: 9000030,
};
export const TstsProviderContractVersion = "tsts.provider.1";
export const ExtensionLifecycleEvent = {
    afterSourceFileBound: "binder.afterSourceFileBound",
    beforeSemanticsFinalized: "semantics.beforeFinalized",
};
const sealProviderRegistrations = Symbol("tsts.provider.sealRegistrations");
const providerMaxRegisteredProviders = 4_096;
export function defineExtensionFactKey(options) {
    if (options.extensionId.length === 0) {
        throw new Error("Extension fact key requires a non-empty extension id.");
    }
    if (options.name.length === 0) {
        throw new Error("Extension fact key requires a non-empty name.");
    }
    return Object.freeze({
        extensionId: options.extensionId,
        name: options.name,
        id: `${options.extensionId}:${options.name}`,
        equals: options.equals ?? Object.is,
    });
}
export class ExtensionDiagnosticStore {
    #diagnostics = [];
    #identities = new Set();
    #diagnosticRanges = new Map();
    registerDiagnosticRange(extensionId, range) {
        if (range === undefined) {
            return true;
        }
        if (!isValidDiagnosticRange(range)) {
            this.#appendUnchecked(createHostDiagnostic({
                extensionCode: "DIAGNOSTIC_RANGE_INVALID",
                numericCode: ExtensionHostDiagnosticCode.diagnosticRangeInvalid,
                message: `Extension '${extensionId}' registered an invalid diagnostic range.`,
                evidence: [{ message: "Diagnostic range", details: range }],
                identity: `diagnostic-range-invalid:${extensionId}:${range.start}:${range.end}`,
            }));
            return false;
        }
        const existing = this.#diagnosticRanges.get(extensionId);
        if (existing !== undefined && (existing.start !== range.start || existing.end !== range.end)) {
            this.#appendUnchecked(createHostDiagnostic({
                extensionCode: "DIAGNOSTIC_RANGE_INVALID",
                numericCode: ExtensionHostDiagnosticCode.diagnosticRangeInvalid,
                message: `Extension '${extensionId}' registered conflicting diagnostic ranges.`,
                evidence: [
                    { message: "Existing diagnostic range", details: existing },
                    { message: "Incoming diagnostic range", details: range },
                ],
                identity: `diagnostic-range-conflict:${extensionId}:${existing.start}:${existing.end}:${range.start}:${range.end}`,
            }));
            return false;
        }
        for (const [existingExtensionId, existingRange] of this.#diagnosticRanges) {
            if (existingExtensionId === extensionId) {
                continue;
            }
            if (diagnosticRangesOverlap(existingRange, range)) {
                this.#appendUnchecked(createHostDiagnostic({
                    extensionCode: "DIAGNOSTIC_RANGE_INVALID",
                    numericCode: ExtensionHostDiagnosticCode.diagnosticRangeInvalid,
                    message: `Extension '${extensionId}' registered a diagnostic range that overlaps '${existingExtensionId}'.`,
                    evidence: [
                        { message: "Existing extension diagnostic range", details: { extensionId: existingExtensionId, range: existingRange } },
                        { message: "Incoming extension diagnostic range", details: { extensionId, range } },
                    ],
                    identity: `diagnostic-range-overlap:${extensionId}:${range.start}:${range.end}:${existingExtensionId}:${existingRange.start}:${existingRange.end}`,
                }));
                return false;
            }
        }
        this.#diagnosticRanges.set(extensionId, range);
        return true;
    }
    append(diagnostic) {
        const range = this.#diagnosticRanges.get(diagnostic.extensionId);
        if (range !== undefined && !isDiagnosticCodeInRange(diagnostic.numericCode, range)) {
            return this.#appendUnchecked(createHostDiagnostic({
                extensionCode: "DIAGNOSTIC_CODE_OUT_OF_RANGE",
                numericCode: ExtensionHostDiagnosticCode.diagnosticCodeOutOfRange,
                message: `Extension '${diagnostic.extensionId}' emitted diagnostic code ${diagnostic.numericCode}, outside its registered range ${range.start}-${range.end}.`,
                evidence: [
                    { message: "Registered diagnostic range", details: range },
                    { message: "Rejected diagnostic", details: diagnostic },
                ],
                identity: `diagnostic-code-out-of-range:${diagnostic.extensionId}:${diagnostic.numericCode}:${range.start}:${range.end}`,
            }));
        }
        return this.#appendUnchecked(diagnostic);
    }
    #appendUnchecked(diagnostic) {
        const identity = getDiagnosticIdentity(diagnostic);
        if (this.#identities.has(identity)) {
            return false;
        }
        this.#identities.add(identity);
        this.#diagnostics.push(diagnostic);
        return true;
    }
    all() {
        return this.#diagnostics;
    }
    hasErrors() {
        return this.#diagnostics.some((diagnostic) => diagnostic.category === "error");
    }
}
export class ExtensionFactStore {
    #objectFacts = new WeakMap();
    #objectSubjectIds = new WeakMap();
    #diagnostics;
    #nextObjectSubjectId = 1;
    #sealed = false;
    constructor(diagnostics) {
        this.#diagnostics = diagnostics;
    }
    set(subject, key, value, evidence = []) {
        return this.#set(subject, key, value, evidence, false);
    }
    setResolved(subject, key, value, evidence = []) {
        return this.#set(subject, key, value, evidence, true);
    }
    #set(subject, key, value, evidence, allowSealedResolverCacheWrite) {
        if (!isExtensionFactSubject(subject)) {
            this.#diagnostics.append(createHostDiagnostic({
                extensionCode: "INVALID_FACT_SUBJECT",
                numericCode: ExtensionHostDiagnosticCode.invalidFactSubject,
                message: `Extension fact '${key.id}' must be written to an object subject.`,
                evidence: [{ message: "Rejected subject", details: subject }],
                identity: `invalid-fact-subject:${key.id}:${String(subject)}`,
            }));
            return "invalid-subject";
        }
        if (this.#sealed && !allowSealedResolverCacheWrite) {
            this.#diagnostics.append(createHostDiagnostic({
                extensionCode: "FACT_STORE_SEALED",
                numericCode: ExtensionHostDiagnosticCode.factStoreSealed,
                message: `Cannot write extension fact '${key.id}' after semantic finalization.`,
                identity: `fact-store-sealed:${key.id}`,
            }));
            return "sealed";
        }
        const subjectFacts = this.#getOrCreateSubjectFacts(subject);
        const existing = subjectFacts.get(key.id);
        if (existing === undefined) {
            subjectFacts.set(key.id, { key: key, value, evidence });
            return "inserted";
        }
        if (key.equals(existing.value, value)) {
            return "idempotent";
        }
        this.#diagnostics.append(createHostDiagnostic({
            extensionCode: "FACT_CONFLICT",
            numericCode: ExtensionHostDiagnosticCode.factConflict,
            message: `Conflicting extension fact '${key.id}' for the same subject.`,
            evidence: [
                { message: "Existing fact", details: existing.value },
                { message: "Incoming fact", details: value },
            ],
            identity: `fact-conflict:${key.id}:${this.#getSubjectIdentity(subject)}`,
        }));
        return "conflict";
    }
    get(subject, key) {
        return this.getEntry(subject, key)?.value;
    }
    getEntry(subject, key) {
        if (subject === undefined) {
            return undefined;
        }
        const subjectFacts = this.#getSubjectFacts(subject);
        return subjectFacts?.get(key.id);
    }
    has(subject, key) {
        return this.getEntry(subject, key) !== undefined;
    }
    entries(subject) {
        if (subject === undefined) {
            return [];
        }
        return Array.from(this.#getSubjectFacts(subject)?.values() ?? []);
    }
    seal() {
        this.#sealed = true;
    }
    get sealed() {
        return this.#sealed;
    }
    #getSubjectFacts(subject) {
        return this.#objectFacts.get(subject);
    }
    #getOrCreateSubjectFacts(subject) {
        const existing = this.#getSubjectFacts(subject);
        if (existing !== undefined) {
            return existing;
        }
        const created = new Map();
        this.#objectFacts.set(subject, created);
        return created;
    }
    #getSubjectIdentity(subject) {
        const existing = this.#objectSubjectIds.get(subject);
        if (existing !== undefined) {
            return `object:${existing}`;
        }
        const created = this.#nextObjectSubjectId;
        this.#nextObjectSubjectId += 1;
        this.#objectSubjectIds.set(subject, created);
        return `object:${created}`;
    }
}
export class ExtensionFactResolver {
    #facts;
    #diagnostics;
    #resolvers = new Map();
    constructor(facts, diagnostics) {
        this.#facts = facts;
        this.#diagnostics = diagnostics;
    }
    register(key, resolver) {
        const resolvers = this.#resolvers.get(key.id);
        if (resolvers === undefined) {
            this.#resolvers.set(key.id, [resolver]);
            return;
        }
        resolvers.push(resolver);
    }
    resolve(subject, key) {
        const explicit = this.#facts.getEntry(subject, key);
        if (explicit !== undefined) {
            return explicit.value;
        }
        const resolvers = this.#resolvers.get(key.id);
        if (resolvers === undefined) {
            return undefined;
        }
        for (const resolver of resolvers) {
            const resolved = resolver(subject, { facts: this.#facts, diagnostics: this.#diagnostics });
            if (resolved !== undefined) {
                this.#facts.setResolved(subject, key, resolved.value, resolved.evidence ?? []);
                return resolved.value;
            }
        }
        return undefined;
    }
}
export class ProviderRegistry {
    #diagnostics;
    #requiredProviderModules;
    #bindingProviders = new Map();
    #bindingProviderRegistrations = new WeakMap();
    #semanticProviderIdentities = new Map();
    #semanticProviderRegistrations = new WeakMap();
    #virtualModules = new Map();
    #virtualModuleResultsByRequestKey = new Map();
    #declarationLoadOutcomesByRequestKey = new Map();
    #declarationCandidatesByCacheKey = new Map();
    #virtualArtifactsByFileName = new Map();
    #virtualDocumentsByUri = new Map();
    #publicVirtualDocumentsByUri = new Map();
    #virtualSourceVariantsByModuleIdentity = new Map();
    #virtualFileIdentities = new Map();
    #canonicalExportsByModuleIdentity = new Map();
    #canonicalExportOwnersByExportIdentity = new Map();
    #publicModuleIdentitiesByEnvironmentKey = new Map();
    #providerRegistrationsSealed = false;
    #activeResolutionTransaction;
    constructor(diagnostics, requiredProviderModules = []) {
        this.#diagnostics = diagnostics;
        this.#requiredProviderModules = requiredProviderModules;
    }
    registerTargetBindingProvider(provider) {
        if (this.#bindingProviderRegistrations.has(provider)) {
            return true;
        }
        if (this.#providerRegistrationsSealed) {
            this.#diagnostics.append(createRegistrationClosedDiagnostic("target binding provider"));
            return false;
        }
        const registration = snapshotTargetBindingProviderRegistration(provider);
        if (registration.kind === "invalid") {
            this.#diagnostics.append(createHostDiagnostic({
                extensionCode: "INVALID_TARGET_BINDING_PROVIDER",
                numericCode: ExtensionHostDiagnosticCode.invalidProvider,
                message: "Invalid target binding provider registration.",
                evidence: [{ message: "Registration rejection", details: registration.reason }],
                identity: `invalid-binding-provider-registration:${registration.reason}`,
            }));
            return false;
        }
        const registered = registration.provider;
        const diagnostic = validateProviderIdentity(registered.identity, "binding");
        if (diagnostic !== undefined) {
            this.#diagnostics.append(diagnostic);
            return false;
        }
        const existing = this.#bindingProviders.get(registered.identity.id);
        if (existing !== undefined) {
            this.#diagnostics.append(createHostDiagnostic({
                extensionCode: "DUPLICATE_TARGET_BINDING_PROVIDER",
                numericCode: ExtensionHostDiagnosticCode.duplicateProvider,
                message: `Duplicate target binding provider id '${registered.identity.id}'.`,
                identity: `duplicate-binding-provider:${registered.identity.id}`,
            }));
            return false;
        }
        if (this.#bindingProviders.size >= providerMaxRegisteredProviders) {
            this.#diagnostics.append(createProviderRegistrationLimitDiagnostic("target binding provider"));
            return false;
        }
        if (!this.#diagnostics.registerDiagnosticRange(registered.identity.id, registered.identity.diagnosticRange)) {
            return false;
        }
        this.#bindingProviders.set(registered.identity.id, registered);
        this.#bindingProviderRegistrations.set(provider, registered);
        return true;
    }
    registerTargetSemanticProvider(provider) {
        if (this.#semanticProviderRegistrations.has(provider)) {
            return true;
        }
        if (this.#providerRegistrationsSealed) {
            this.#diagnostics.append(createRegistrationClosedDiagnostic("target semantic provider"));
            return false;
        }
        let identity;
        try {
            identity = snapshotProviderIdentity(provider.identity);
        }
        catch (error) {
            this.#diagnostics.append(createHostDiagnostic({
                extensionCode: "INVALID_TARGET_SEMANTIC_PROVIDER",
                numericCode: ExtensionHostDiagnosticCode.invalidProvider,
                message: "Invalid target semantic provider registration.",
                evidence: [{ message: "Registration rejection", details: error instanceof Error ? error.message : String(error) }],
                identity: "invalid-semantic-provider-registration",
            }));
            return false;
        }
        const diagnostic = validateProviderIdentity(identity, "semantic");
        if (diagnostic !== undefined) {
            this.#diagnostics.append(diagnostic);
            return false;
        }
        const existing = this.#semanticProviderIdentities.get(identity.id);
        if (existing !== undefined) {
            this.#diagnostics.append(createHostDiagnostic({
                extensionCode: "DUPLICATE_TARGET_SEMANTIC_PROVIDER",
                numericCode: ExtensionHostDiagnosticCode.duplicateProvider,
                message: `Duplicate target semantic provider id '${identity.id}'.`,
                identity: `duplicate-semantic-provider:${identity.id}`,
            }));
            return false;
        }
        if (this.#semanticProviderIdentities.size >= providerMaxRegisteredProviders) {
            this.#diagnostics.append(createProviderRegistrationLimitDiagnostic("target semantic provider"));
            return false;
        }
        if (!this.#diagnostics.registerDiagnosticRange(identity.id, identity.diagnosticRange)) {
            return false;
        }
        this.#semanticProviderIdentities.set(identity.id, identity);
        this.#semanticProviderRegistrations.set(provider, identity);
        return true;
    }
    get hasBindingProviders() {
        return this.#bindingProviders.size !== 0;
    }
    requiresProviderForModule(specifier, context = {}) {
        return this.#requiredProviderModules.find((required) => specifier.startsWith(required.specifierPrefix)
            && (required.target === undefined || context.activeTarget === undefined || required.target === context.activeTarget));
    }
    [sealProviderRegistrations]() {
        this.#providerRegistrationsSealed = true;
    }
    resolveVirtualModule(specifier, context = {}) {
        const activeTransaction = this.#activeResolutionTransaction;
        if (activeTransaction !== undefined) {
            const diagnostic = createHostDiagnostic({
                extensionCode: "PROVIDER_RESOLUTION_REENTRANT",
                numericCode: ExtensionHostDiagnosticCode.providerResolutionFailed,
                message: `Provider virtual module resolution for '${specifier}' re-entered the provider registry before the active resolution transaction completed.`,
                evidence: [{
                        message: "Active provider resolution",
                        details: { specifier: activeTransaction.specifier },
                    }],
                identity: `provider-resolution-reentrant:${activeTransaction.specifier}:${specifier}`,
            });
            this.#diagnostics.append(diagnostic);
            activeTransaction.reentrantDiagnostic ??= diagnostic;
            return { kind: "rejected", diagnostic };
        }
        this[sealProviderRegistrations]();
        if (isHostOwnedProviderVirtualFileName(specifier)) {
            const diagnostic = createHostDiagnostic({
                extensionCode: "PROVIDER_RESERVED_MODULE_SPECIFIER",
                numericCode: ExtensionHostDiagnosticCode.providerResolutionFailed,
                message: `Provider virtual module resolution cannot target host-owned module identity '${specifier}'.`,
                evidence: [{ message: "Host-owned provider module identities are compiler-internal." }],
                identity: `provider-reserved-module-specifier:${specifier}`,
            });
            this.#diagnostics.append(diagnostic);
            return { kind: "rejected", diagnostic };
        }
        let exactContext;
        try {
            exactContext = snapshotProviderModuleContext(context);
        }
        catch (error) {
            const diagnostic = createHostDiagnostic({
                extensionCode: "INVALID_PROVIDER_MODULE_CONTEXT",
                numericCode: ExtensionHostDiagnosticCode.providerResolutionFailed,
                message: `Provider virtual module resolution for '${specifier}' received an unreadable module context.`,
                evidence: [{ message: "Context snapshot failure", details: error }],
                identity: `invalid-provider-module-context:${specifier}`,
            });
            this.#diagnostics.append(diagnostic);
            return { kind: "rejected", diagnostic };
        }
        const requestKey = getProviderRequestCacheKey(specifier, exactContext);
        const cachedResult = this.#virtualModuleResultsByRequestKey.get(requestKey);
        if (cachedResult !== undefined) {
            return cachedResult;
        }
        const transaction = { specifier };
        this.#activeResolutionTransaction = transaction;
        try {
            const result = Object.freeze(this.#resolveVirtualModuleTransaction(specifier, exactContext, transaction));
            this.#virtualModuleResultsByRequestKey.set(requestKey, result);
            return result;
        }
        finally {
            this.#activeResolutionTransaction = undefined;
        }
    }
    #resolveVirtualModuleTransaction(specifier, context, transaction) {
        const loaded = this.#loadProviderDeclarationCandidate(specifier, context);
        if (loaded.kind !== "candidate") {
            return loaded;
        }
        if (transaction.reentrantDiagnostic !== undefined) {
            return { kind: "rejected", diagnostic: transaction.reentrantDiagnostic };
        }
        const { providerIdentity, resolution, declarationModel, artifactDeclarationModel, cacheKey, context: exactContext, moduleIdentity: virtualModuleIdentity, } = loaded.candidate;
        const canonicalExportsPreparation = this.#prepareCanonicalProviderExports(loaded.candidate);
        if (canonicalExportsPreparation.kind === "rejected") {
            return canonicalExportsPreparation;
        }
        const canonicalExports = this.#getCanonicalExportsForRender(virtualModuleIdentity, artifactDeclarationModel, canonicalExportsPreparation.state);
        const expectedCanonicalExportCount = loaded.candidate.canonicalDeclarationModelsBySourceExportName.size;
        if (canonicalExports.size !== expectedCanonicalExportCount) {
            const diagnostic = createInvalidProviderDeclarationDiagnostic(providerIdentity, declarationModel, `Provider module '${declarationModel.moduleSpecifier}' did not close every public export through a canonical owner.`, `provider-canonical-export-closure-incomplete:${providerIdentity.id}:${virtualModuleIdentity}`, [{
                    message: "Canonical export closure",
                    details: { expected: expectedCanonicalExportCount, actual: canonicalExports.size },
                }]);
            this.#diagnostics.append(diagnostic);
            return { kind: "rejected", diagnostic };
        }
        const virtualSourceText = renderProviderDeclarationModel(artifactDeclarationModel, { canonicalExports });
        const effectiveVirtualFileNamePlan = this.#planEffectiveVirtualFileName(loaded.candidate, virtualSourceText);
        if (effectiveVirtualFileNamePlan.kind === "rejected") {
            return effectiveVirtualFileNamePlan;
        }
        const artifactPreparation = this.#preparePublicVirtualArtifact(loaded.candidate, artifactDeclarationModel, virtualSourceText, effectiveVirtualFileNamePlan.fileName);
        if (artifactPreparation.kind === "rejected") {
            return artifactPreparation;
        }
        const ownerPreparation = this.#preparePlannedCanonicalExportOwners(canonicalExportsPreparation.state);
        if (ownerPreparation.kind === "rejected") {
            return ownerPreparation;
        }
        const artifact = artifactPreparation.artifact;
        const module = Object.freeze({
            resolution,
            declarationModel,
            context: exactContext,
            artifact,
            cacheKey,
        });
        this.#commitProviderPublicModuleIdentities(canonicalExportsPreparation.state);
        this.#commitPreparedCanonicalExportOwners(ownerPreparation.owners);
        this.#commitVirtualArtifact(artifact, true);
        this.#recordVirtualSourceVariant(virtualModuleIdentity, virtualSourceText, artifact.fileName);
        this.#recordVirtualFileIdentity(resolution.virtualFileName, virtualModuleIdentity);
        this.#recordVirtualFileIdentity(artifact.fileName, virtualModuleIdentity);
        this.#virtualModules.set(cacheKey, module);
        this.#declarationCandidatesByCacheKey.set(cacheKey, loaded.candidate);
        return { kind: "resolved", module };
    }
    #loadProviderDeclarationCandidate(specifier, context, planningCandidates) {
        let exactContext;
        try {
            exactContext = snapshotProviderModuleContext(context);
        }
        catch (error) {
            const diagnostic = createHostDiagnostic({
                extensionCode: "INVALID_PROVIDER_MODULE_CONTEXT",
                numericCode: ExtensionHostDiagnosticCode.providerResolutionFailed,
                message: `Provider virtual module resolution for '${specifier}' received an unreadable module context.`,
                evidence: [{ message: "Context snapshot failure", details: error }],
                identity: `invalid-provider-module-context:${specifier}`,
            });
            this.#diagnostics.append(diagnostic);
            return { kind: "rejected", diagnostic };
        }
        const requestKey = getProviderRequestCacheKey(specifier, exactContext);
        const cachedResult = this.#virtualModuleResultsByRequestKey.get(requestKey);
        if (cachedResult !== undefined) {
            return cachedResult;
        }
        const cachedOutcome = this.#declarationLoadOutcomesByRequestKey.get(requestKey);
        if (cachedOutcome !== undefined) {
            if (cachedOutcome.kind === "candidate" && planningCandidates !== undefined) {
                planningCandidates.set(cachedOutcome.candidate.cacheKey, cachedOutcome.candidate);
            }
            return cachedOutcome;
        }
        const owner = this.#collectModuleOwners(specifier, exactContext);
        if (owner.kind === "unowned") {
            const required = this.requiresProviderForModule(specifier, exactContext);
            if (required !== undefined) {
                const diagnostic = createHostDiagnostic({
                    extensionCode: "REQUIRED_PROVIDER_MISSING",
                    numericCode: ExtensionHostDiagnosticCode.providerMissing,
                    message: required.message ?? `No target binding provider is installed for provider-owned module '${specifier}'.`,
                    evidence: [{ message: "Required provider module pattern", details: required }],
                    identity: `required-provider-missing:${specifier}:${required.specifierPrefix}:${required.providerId ?? ""}:${required.target ?? ""}`,
                });
                this.#diagnostics.append(diagnostic);
                return this.#cacheDeclarationLoadOutcome(requestKey, { kind: "rejected", diagnostic });
            }
            return this.#cacheDeclarationLoadOutcome(requestKey, { kind: "unowned" });
        }
        if (owner.kind === "rejected") {
            return this.#cacheDeclarationLoadOutcome(requestKey, owner);
        }
        if (owner.kind === "conflict") {
            return this.#cacheDeclarationLoadOutcome(requestKey, owner);
        }
        const cacheKey = getProviderResolveCacheKey(owner.provider.identity, specifier, exactContext);
        const planningKey = planningCandidates === undefined ? undefined : cacheKey;
        const plannedCandidate = planningKey === undefined ? undefined : planningCandidates?.get(planningKey);
        if (plannedCandidate !== undefined) {
            return { kind: "candidate", candidate: plannedCandidate };
        }
        const cached = this.#virtualModules.get(cacheKey);
        if (cached !== undefined) {
            return { kind: "resolved", module: cached };
        }
        const resolutionCall = callProvider(this.#diagnostics, owner.provider.identity, "resolveModule", specifier, () => owner.provider.resolveModule(specifier, exactContext));
        if (resolutionCall.kind === "threw") {
            return this.#cacheDeclarationLoadOutcome(requestKey, { kind: "rejected", diagnostic: resolutionCall.diagnostic });
        }
        const providedResolution = resolutionCall.value;
        const resolutionDiagnostic = snapshotReturnedExtensionDiagnostic(providedResolution);
        if (resolutionDiagnostic.kind === "valid") {
            this.#diagnostics.append(resolutionDiagnostic.diagnostic);
            return this.#cacheDeclarationLoadOutcome(requestKey, { kind: "rejected", diagnostic: resolutionDiagnostic.diagnostic });
        }
        if (resolutionDiagnostic.kind === "invalid") {
            const diagnostic = createInvalidProviderCallbackDiagnostic(owner.provider.identity, specifier, "resolveModule", resolutionDiagnostic.reason);
            this.#diagnostics.append(diagnostic);
            return this.#cacheDeclarationLoadOutcome(requestKey, { kind: "rejected", diagnostic });
        }
        const resolutionSnapshot = snapshotProviderModuleResolution(providedResolution, specifier);
        if (resolutionSnapshot.kind === "invalid") {
            const diagnostic = createHostDiagnostic({
                extensionCode: "INVALID_PROVIDER_MODULE_RESOLUTION",
                numericCode: ExtensionHostDiagnosticCode.providerResolutionFailed,
                message: `Provider '${owner.provider.identity.id}' returned an invalid virtual module resolution for '${specifier}'.`,
                evidence: [{ message: "Resolution rejection", details: resolutionSnapshot.reason }],
                identity: `invalid-provider-resolution:${owner.provider.identity.id}:${specifier}:${resolutionSnapshot.reason}`,
            });
            this.#diagnostics.append(diagnostic);
            return this.#cacheDeclarationLoadOutcome(requestKey, { kind: "rejected", diagnostic });
        }
        const resolution = resolutionSnapshot.resolution;
        const declarationCall = callProvider(this.#diagnostics, owner.provider.identity, "getDeclarationModel", specifier, () => owner.provider.getDeclarationModel(resolution));
        if (declarationCall.kind === "threw") {
            return this.#cacheDeclarationLoadOutcome(requestKey, { kind: "rejected", diagnostic: declarationCall.diagnostic });
        }
        const providedDeclarationModel = declarationCall.value;
        const declarationDiagnostic = snapshotReturnedExtensionDiagnostic(providedDeclarationModel);
        if (declarationDiagnostic.kind === "valid") {
            this.#diagnostics.append(declarationDiagnostic.diagnostic);
            return this.#cacheDeclarationLoadOutcome(requestKey, { kind: "rejected", diagnostic: declarationDiagnostic.diagnostic });
        }
        if (declarationDiagnostic.kind === "invalid") {
            const diagnostic = createInvalidProviderCallbackDiagnostic(owner.provider.identity, specifier, "getDeclarationModel", declarationDiagnostic.reason);
            this.#diagnostics.append(diagnostic);
            return this.#cacheDeclarationLoadOutcome(requestKey, { kind: "rejected", diagnostic });
        }
        const graphValidation = validateProviderDeclarationModelGraph(providedDeclarationModel);
        if (graphValidation.kind === "invalid") {
            const diagnostic = createHostDiagnostic({
                extensionCode: "INVALID_PROVIDER_DECLARATION_MODEL",
                numericCode: ExtensionHostDiagnosticCode.invalidProviderDeclaration,
                message: `Provider '${owner.provider.identity.id}' returned an unsafe declaration graph for '${specifier}'.`,
                evidence: [{
                        message: "Declaration graph rejection",
                        details: {
                            reason: graphValidation.reason,
                            path: graphValidation.path,
                            ...(graphValidation.firstPath === undefined ? {} : { firstPath: graphValidation.firstPath }),
                            depth: graphValidation.depth,
                            ...(graphValidation.limit === undefined ? {} : { limit: graphValidation.limit }),
                        },
                    }],
                identity: `invalid-provider-declaration-graph:${owner.provider.identity.id}:${specifier}:${graphValidation.reason}:${graphValidation.path}`,
            });
            this.#diagnostics.append(diagnostic);
            return this.#cacheDeclarationLoadOutcome(requestKey, { kind: "rejected", diagnostic });
        }
        const declarationModel = freezeProviderDeclarationModel(graphValidation.model);
        if (!isValidProviderDeclarationModel(declarationModel, resolution)) {
            const diagnostic = createHostDiagnostic({
                extensionCode: "INVALID_PROVIDER_DECLARATION_MODEL",
                numericCode: ExtensionHostDiagnosticCode.invalidProviderDeclaration,
                message: `Provider '${owner.provider.identity.id}' returned an invalid declaration model for '${specifier}'.`,
                evidence: [{ message: "Declaration model", details: declarationModel }],
                identity: `invalid-provider-declaration:${owner.provider.identity.id}:${specifier}`,
            });
            this.#diagnostics.append(diagnostic);
            return this.#cacheDeclarationLoadOutcome(requestKey, { kind: "rejected", diagnostic });
        }
        const virtualModuleIdentity = getProviderVirtualModuleIdentity(owner.provider.identity, resolution, declarationModel);
        const virtualFileDiagnostic = this.#validateVirtualFileIdentity(resolution.virtualFileName, virtualModuleIdentity);
        if (virtualFileDiagnostic !== undefined) {
            this.#diagnostics.append(virtualFileDiagnostic);
            return this.#cacheDeclarationLoadOutcome(requestKey, { kind: "rejected", diagnostic: virtualFileDiagnostic });
        }
        const canonicalExportDiagnostic = this.#validateCanonicalExportContracts(owner.provider.identity, virtualModuleIdentity, declarationModel);
        if (canonicalExportDiagnostic !== undefined) {
            this.#diagnostics.append(canonicalExportDiagnostic);
            return this.#cacheDeclarationLoadOutcome(requestKey, { kind: "rejected", diagnostic: canonicalExportDiagnostic });
        }
        const candidate = Object.freeze({
            providerIdentity: owner.provider.identity,
            resolution,
            declarationModel,
            artifactDeclarationModel: freezeProviderDeclarationModel(canonicalizeProviderAbiModel(declarationModel)),
            graphMetrics: graphValidation.metrics,
            context: exactContext,
            cacheKey,
            moduleIdentity: virtualModuleIdentity,
            publicModuleEnvironmentKey: getProviderPublicModuleEnvironmentKey(owner.provider.identity, specifier, exactContext),
            canonicalDeclarationModelsBySourceExportName: createProviderCanonicalExportDeclarationModelMap(declarationModel),
        });
        if (planningKey !== undefined) {
            planningCandidates.set(planningKey, candidate);
        }
        return this.#cacheDeclarationLoadOutcome(requestKey, { kind: "candidate", candidate });
    }
    #cacheDeclarationLoadOutcome(requestKey, outcome) {
        const cached = this.#declarationLoadOutcomesByRequestKey.get(requestKey);
        if (cached !== undefined) {
            return cached;
        }
        const immutableOutcome = Object.freeze(outcome);
        this.#declarationLoadOutcomesByRequestKey.set(requestKey, immutableOutcome);
        return immutableOutcome;
    }
    #prepareCanonicalProviderExports(rootCandidate) {
        const state = createProviderCanonicalExportPlanningState();
        const rootRegistration = this.#registerProviderPlanningCandidate(rootCandidate, state);
        if (rootRegistration.kind === "rejected") {
            return rootRegistration;
        }
        let ownerVisitIndex = 0;
        while (ownerVisitIndex < state.ownerVisitQueue.length) {
            const reentrantDiagnostic = this.#activeResolutionTransaction?.reentrantDiagnostic;
            if (reentrantDiagnostic !== undefined) {
                return { kind: "rejected", diagnostic: reentrantDiagnostic };
            }
            const visitKey = state.ownerVisitQueue[ownerVisitIndex++];
            const visit = state.ownerVisitsByKey.get(visitKey);
            const processed = this.#processCanonicalExportOwnerVisit(visit, state);
            if (processed.kind === "rejected") {
                return processed;
            }
        }
        const cycle = findProviderClassHeritageCycle(state.classEdges);
        if (cycle !== undefined) {
            const missingLabel = cycle.find((nodeKey) => !state.classNodeLabels.has(nodeKey));
            if (missingLabel !== undefined) {
                const diagnostic = createInvalidProviderDeclarationDiagnostic(rootCandidate.providerIdentity, rootCandidate.declarationModel, "Provider value-heritage planning produced a class graph node without declaration identity evidence.", `provider-value-heritage-label-missing:${rootCandidate.providerIdentity.id}:${getStableProviderVirtualSliceSuffix(missingLabel)}`, [{ message: "Missing class graph node", details: missingLabel }]);
                this.#diagnostics.append(diagnostic);
                return { kind: "rejected", diagnostic };
            }
            const labels = cycle.map((nodeKey) => state.classNodeLabels.get(nodeKey));
            const diagnostic = createInvalidProviderDeclarationDiagnostic(rootCandidate.providerIdentity, rootCandidate.declarationModel, `Provider value heritage contains a semantic class cycle: ${labels.join(" -> ")}.`, `provider-value-heritage-cycle:${rootCandidate.providerIdentity.id}:${getStableProviderVirtualSliceSuffix(cycle.join("\0"))}`, [{ message: "Class heritage cycle", details: labels }]);
            this.#diagnostics.append(diagnostic);
            return { kind: "rejected", diagnostic };
        }
        const reentrantDiagnostic = this.#activeResolutionTransaction?.reentrantDiagnostic;
        if (reentrantDiagnostic !== undefined) {
            return { kind: "rejected", diagnostic: reentrantDiagnostic };
        }
        return { kind: "prepared", state };
    }
    #registerProviderPlanningCandidate(candidate, state, parentVisitKey) {
        const candidateRequestKey = candidate.cacheKey;
        if (state.registeredCandidateRequestKeys.has(candidateRequestKey)) {
            return { kind: "registered", candidateRequestKey };
        }
        if (state.candidateCount >= providerPlanningMaxCandidates) {
            return this.#rejectProviderPlanningBudget(candidate, "candidate modules", state.candidateCount + 1, providerPlanningMaxCandidates);
        }
        const nextExportCount = state.exportCount + candidate.canonicalDeclarationModelsBySourceExportName.size;
        if (!Number.isSafeInteger(nextExportCount) || nextExportCount > providerPlanningMaxExports) {
            return this.#rejectProviderPlanningBudget(candidate, "canonical exports", nextExportCount, providerPlanningMaxExports);
        }
        const nextExpandedSemanticNodeCount = state.expandedSemanticNodeCount
            + candidate.graphMetrics.expandedSemanticNodeAndArrayEntryCount;
        if (!Number.isSafeInteger(nextExpandedSemanticNodeCount)
            || nextExpandedSemanticNodeCount > providerPlanningMaxExpandedSemanticNodes) {
            return this.#rejectProviderPlanningBudget(candidate, "expanded semantic declaration nodes", nextExpandedSemanticNodeCount, providerPlanningMaxExpandedSemanticNodes);
        }
        const nextScalarCodeUnitCount = state.scalarCodeUnitCount + candidate.graphMetrics.totalScalarCodeUnitCount;
        if (!Number.isSafeInteger(nextScalarCodeUnitCount)
            || nextScalarCodeUnitCount > providerPlanningMaxScalarCodeUnits) {
            return this.#rejectProviderPlanningBudget(candidate, "provider declaration scalar code units", nextScalarCodeUnitCount, providerPlanningMaxScalarCodeUnits);
        }
        const existingPublicModuleIdentity = state.publicModuleIdentitiesByEnvironmentKey.get(candidate.publicModuleEnvironmentKey)
            ?? this.#publicModuleIdentitiesByEnvironmentKey.get(candidate.publicModuleEnvironmentKey);
        if (existingPublicModuleIdentity !== undefined && existingPublicModuleIdentity !== candidate.moduleIdentity) {
            const [firstIdentity, secondIdentity] = orderStablePair(existingPublicModuleIdentity, candidate.moduleIdentity);
            const diagnostic = createInvalidProviderDeclarationDiagnostic(candidate.providerIdentity, candidate.declarationModel, `Provider returned multiple identities for public module '${candidate.declarationModel.moduleSpecifier}' in one resolution environment.`, `provider-public-module-identity-conflict:${candidate.providerIdentity.id}:${getStableProviderVirtualSliceSuffix(`${candidate.publicModuleEnvironmentKey}\0${firstIdentity}\0${secondIdentity}`)}`, [
                { message: "Public module identity A", details: firstIdentity },
                { message: "Public module identity B", details: secondIdentity },
            ]);
            this.#diagnostics.append(diagnostic);
            return { kind: "rejected", diagnostic };
        }
        state.publicModuleIdentitiesByEnvironmentKey.set(candidate.publicModuleEnvironmentKey, candidate.moduleIdentity);
        const existingFileIdentity = state.virtualFileIdentities.get(candidate.resolution.virtualFileName);
        if (existingFileIdentity !== undefined && existingFileIdentity !== candidate.moduleIdentity) {
            const [firstIdentity, secondIdentity] = orderStablePair(existingFileIdentity, candidate.moduleIdentity);
            const diagnostic = createInvalidProviderDeclarationDiagnostic(candidate.providerIdentity, candidate.declarationModel, `Provider virtual file '${candidate.resolution.virtualFileName}' is used for multiple public provider module identities during value-heritage planning.`, `provider-value-heritage-file-conflict:${candidate.resolution.virtualFileName}:${firstIdentity}:${secondIdentity}`, [
                { message: "Virtual file identity A", details: firstIdentity },
                { message: "Virtual file identity B", details: secondIdentity },
            ]);
            this.#diagnostics.append(diagnostic);
            return { kind: "rejected", diagnostic };
        }
        for (const [exportName, contractKey] of getProviderExportContractKeyMap(candidate.declarationModel.moduleSpecifier, candidate.declarationModel.exports)) {
            const exportIdentity = getProviderPlanningExportIdentity(candidate.moduleIdentity, exportName);
            const existingContract = state.exportContracts.get(exportIdentity);
            if (existingContract !== undefined && existingContract !== contractKey) {
                const [firstContract, secondContract] = orderStablePair(existingContract, contractKey);
                const diagnostic = createInvalidProviderDeclarationDiagnostic(candidate.providerIdentity, candidate.declarationModel, `Provider returned conflicting declarations for public export '${candidate.declarationModel.moduleSpecifier}#${exportName}' while planning value heritage.`, `provider-value-heritage-contract-conflict:${candidate.providerIdentity.id}:${getStableProviderVirtualSliceSuffix(`${firstContract}\0${secondContract}`)}`, [
                    { message: "Export contract A", details: firstContract },
                    { message: "Export contract B", details: secondContract },
                ]);
                this.#diagnostics.append(diagnostic);
                return { kind: "rejected", diagnostic };
            }
            state.exportContracts.set(exportIdentity, contractKey);
        }
        state.virtualFileIdentities.set(candidate.resolution.virtualFileName, candidate.moduleIdentity);
        state.planningCandidatesByRequestKey.set(candidateRequestKey, candidate);
        state.registeredCandidateRequestKeys.add(candidateRequestKey);
        state.candidateCount += 1;
        state.exportCount = nextExportCount;
        state.expandedSemanticNodeCount = nextExpandedSemanticNodeCount;
        state.scalarCodeUnitCount = nextScalarCodeUnitCount;
        for (const exportName of candidate.canonicalDeclarationModelsBySourceExportName.keys()) {
            const owner = this.#getOrPlanCanonicalExportOwner(candidate, exportName, state);
            if (owner.kind === "rejected") {
                return owner;
            }
            const plan = state.ownersByExportIdentity.get(getProviderPlanningExportIdentity(candidate.moduleIdentity, exportName));
            if (plan === undefined) {
                const diagnostic = createInvalidProviderDeclarationDiagnostic(candidate.providerIdentity, candidate.declarationModel, `Canonical provider export '${candidate.declarationModel.moduleSpecifier}#${exportName}' was planned without an owner record.`, `provider-export-owner-plan-missing:${candidate.providerIdentity.id}:${candidate.moduleIdentity}:${exportName}`);
                this.#diagnostics.append(diagnostic);
                return { kind: "rejected", diagnostic };
            }
            const scheduled = this.#scheduleCanonicalExportOwnerVisit(candidate, plan, state, parentVisitKey);
            if (scheduled.kind === "rejected") {
                return scheduled;
            }
        }
        return { kind: "registered", candidateRequestKey };
    }
    #resolveProviderReferenceTarget(sourceCandidate, reference, valueHeritage, sourceArtifactFileName, state) {
        let targetCandidate = sourceCandidate;
        if (reference.moduleSpecifier !== sourceCandidate.declarationModel.moduleSpecifier) {
            const dependencyContext = getProviderReferenceDependencyContext(sourceCandidate, reference, valueHeritage, sourceArtifactFileName);
            const loaded = this.#loadProviderDeclarationCandidate(reference.moduleSpecifier, dependencyContext, state.planningCandidatesByRequestKey);
            if (loaded.kind === "unowned") {
                return loaded;
            }
            if (loaded.kind === "rejected") {
                return loaded;
            }
            if (loaded.kind === "conflict") {
                return { kind: "rejected", diagnostic: this.#diagnostics.all().at(-1) };
            }
            if (loaded.kind === "resolved") {
                const cachedCandidate = this.#declarationCandidatesByCacheKey.get(loaded.module.cacheKey);
                if (cachedCandidate === undefined) {
                    const diagnostic = createInvalidProviderDeclarationDiagnostic(sourceCandidate.providerIdentity, sourceCandidate.declarationModel, `Resolved provider dependency '${reference.moduleSpecifier}' has no exact provider declaration candidate.`, `provider-declaration-candidate-missing:${sourceCandidate.providerIdentity.id}:${loaded.module.cacheKey}`);
                    this.#diagnostics.append(diagnostic);
                    return { kind: "rejected", diagnostic };
                }
                targetCandidate = cachedCandidate;
            }
            else {
                targetCandidate = loaded.candidate;
            }
        }
        const selected = selectProviderDeclarationForReference(targetCandidate, reference);
        if (selected.kind === "selected" && (!valueHeritage || selected.declaration.kind === "class")) {
            return { kind: "resolved", candidate: targetCandidate, declaration: selected.declaration };
        }
        const typeArgumentCount = reference.typeArguments?.length ?? 0;
        const message = selected.kind === "missing-arity"
            ? `Provider reference selects unavailable type-family arity ${typeArgumentCount} for '${reference.moduleSpecifier}#${reference.exportName}'.`
            : selected.kind === "wrong-declaration-arity"
                ? `Provider reference supplies ${typeArgumentCount} source type argument(s) for '${reference.moduleSpecifier}#${reference.exportName}', which accepts ${formatProviderClassArityRange(selected.requiredTypeArgumentCount, selected.maximumTypeArgumentCount)}.`
                : selected.kind === "non-type"
                    ? `Provider type reference requires a type-capable declaration for '${reference.moduleSpecifier}#${reference.exportName}' with ${typeArgumentCount} source type argument(s).`
                    : selected.kind === "selected" || selected.kind === "nonclass"
                        ? `Provider value heritage requires a class declaration for '${reference.moduleSpecifier}#${reference.exportName}' with ${typeArgumentCount} source type argument(s).`
                        : `Provider reference selects missing provider export '${reference.moduleSpecifier}#${reference.exportName}'.`;
        const diagnostic = createInvalidProviderDeclarationDiagnostic(sourceCandidate.providerIdentity, sourceCandidate.declarationModel, message, `provider-reference-target:${sourceCandidate.providerIdentity.id}:${getStableProviderVirtualSliceSuffix(`${reference.moduleSpecifier}\0${reference.exportName}\0${typeArgumentCount}\0${selected.kind}`)}`, selected.kind === "missing-arity"
            ? [{ message: "Provider family variants", details: selected.availableArities }]
            : []);
        this.#diagnostics.append(diagnostic);
        return { kind: "rejected", diagnostic };
    }
    #getOrPlanCanonicalExportOwner(candidate, sourceExportName, state) {
        const declarationModel = candidate.canonicalDeclarationModelsBySourceExportName.get(sourceExportName);
        if (declarationModel === undefined) {
            const diagnostic = createInvalidProviderDeclarationDiagnostic(candidate.providerIdentity, candidate.declarationModel, `Provider export '${candidate.declarationModel.moduleSpecifier}#${sourceExportName}' has no exact declaration contract.`, `provider-export-owner-missing:${candidate.providerIdentity.id}:${candidate.declarationModel.moduleSpecifier}:${sourceExportName}`);
            this.#diagnostics.append(diagnostic);
            return { kind: "rejected", diagnostic };
        }
        const exportIdentity = getProviderPlanningExportIdentity(candidate.moduleIdentity, sourceExportName);
        const contractKey = getProviderCanonicalExportOwnerContractKey(candidate.moduleIdentity, declarationModel);
        const existingOwner = this.#canonicalExportOwnersByExportIdentity.get(exportIdentity);
        if (existingOwner !== undefined && existingOwner.contractKey !== contractKey) {
            return this.#rejectConflictingCanonicalExportOwner(candidate, sourceExportName, existingOwner.contractKey, contractKey);
        }
        let plan = state.ownersByExportIdentity.get(exportIdentity);
        if (plan !== undefined && plan.contractKey !== contractKey) {
            return this.#rejectConflictingCanonicalExportOwner(candidate, sourceExportName, plan.contractKey, contractKey);
        }
        const fileName = getProviderCanonicalExportOwnerFileName(candidate.moduleIdentity, sourceExportName);
        if (existingOwner !== undefined && existingOwner.artifact.fileName !== fileName) {
            const diagnostic = createInvalidProviderDeclarationDiagnostic(candidate.providerIdentity, candidate.declarationModel, `Canonical provider export '${candidate.declarationModel.moduleSpecifier}#${sourceExportName}' has an unstable host-owned file identity.`, `provider-export-owner-file-unstable:${candidate.providerIdentity.id}:${exportIdentity}`);
            this.#diagnostics.append(diagnostic);
            return { kind: "rejected", diagnostic };
        }
        if (plan === undefined) {
            if (existingOwner === undefined && (this.#virtualFileIdentities.has(fileName)
                || this.#virtualArtifactsByFileName.has(fileName)
                || this.#virtualDocumentsByUri.has(fileName)
                || state.ownerFileNames.has(fileName))) {
                const diagnostic = createInvalidProviderDeclarationDiagnostic(candidate.providerIdentity, candidate.declarationModel, `Canonical provider export owner file '${fileName}' conflicts with an existing virtual module.`, `provider-export-owner-file-conflict:${candidate.providerIdentity.id}:${fileName}`);
                this.#diagnostics.append(diagnostic);
                return { kind: "rejected", diagnostic };
            }
            plan = {
                candidate,
                declarationModel,
                exportIdentity,
                sourceExportName,
                contractKey,
                fileName,
                existingOwner,
            };
            state.ownersByExportIdentity.set(exportIdentity, plan);
            state.ownerFileNames.add(fileName);
        }
        return { kind: "planned", fileName };
    }
    #scheduleCanonicalExportOwnerVisit(candidate, owner, state, parentVisitKey) {
        if (parentVisitKey !== undefined) {
            const ancestor = findProviderCanonicalExportOwnerAncestor(parentVisitKey, owner.exportIdentity, state);
            if (ancestor.kind === "invalid") {
                const diagnostic = createInvalidProviderDeclarationDiagnostic(candidate.providerIdentity, candidate.declarationModel, "Canonical provider export planning encountered an invalid owner ancestry chain.", `provider-export-owner-ancestry-invalid:${candidate.providerIdentity.id}:${getStableProviderVirtualSliceSuffix(`${parentVisitKey}\0${owner.exportIdentity}`)}`, [{ message: "Missing owner visit", details: ancestor.missingVisitKey }]);
                this.#diagnostics.append(diagnostic);
                return { kind: "rejected", diagnostic };
            }
            if (ancestor.kind === "found") {
                const environmentDiagnostic = this.#validateRecursiveProviderDependencyEnvironment(candidate, owner.sourceExportName, candidate, ancestor.visit.candidate);
                return environmentDiagnostic === undefined
                    ? { kind: "resolved" }
                    : { kind: "rejected", diagnostic: environmentDiagnostic };
            }
        }
        const visitKey = `${owner.exportIdentity}\0${candidate.cacheKey}`;
        if (!state.ownerVisitsByKey.has(visitKey)) {
            if (state.ownerVisitsByKey.size >= providerPlanningMaxOwnerVisits) {
                return this.#rejectProviderPlanningBudget(candidate, "canonical owner visits", state.ownerVisitsByKey.size + 1, providerPlanningMaxOwnerVisits);
            }
            state.ownerVisitsByKey.set(visitKey, { key: visitKey, candidate, owner, parentKey: parentVisitKey });
            state.ownerVisitQueue.push(visitKey);
        }
        return { kind: "resolved" };
    }
    #processCanonicalExportOwnerVisit(visit, state) {
        const exactImports = new Map();
        const dependencyContracts = new Map();
        const usedLocalNames = collectProviderRenderedLocalNames(visit.owner.declarationModel);
        const uses = collectProviderDeclarationReferenceUses(visit.owner.declarationModel.exports)
            .sort(compareProviderDeclarationReferenceUses);
        const nextReferenceCount = state.referenceCount + uses.length;
        if (!Number.isSafeInteger(nextReferenceCount) || nextReferenceCount > providerPlanningMaxReferences) {
            return this.#rejectProviderPlanningBudget(visit.candidate, "provider references", nextReferenceCount, providerPlanningMaxReferences);
        }
        state.referenceCount = nextReferenceCount;
        for (const use of uses) {
            const reference = use.reference;
            const referenceKey = getProviderRefKey(reference.moduleSpecifier, reference.exportName, reference.typeArguments?.length ?? 0);
            const target = this.#resolveProviderReferenceTarget(visit.candidate, reference, use.valueHeritage, visit.owner.fileName, state);
            if (target.kind === "rejected") {
                return target;
            }
            let fileName;
            let exportedName;
            let dependencyContract;
            if (target.kind === "unowned") {
                const diagnostic = createInvalidProviderDeclarationDiagnostic(visit.candidate.providerIdentity, visit.candidate.declarationModel, `Provider export '${visit.candidate.declarationModel.moduleSpecifier}#${visit.owner.sourceExportName}' references '${reference.moduleSpecifier}#${reference.exportName}' without a provider-owned canonical target.`, `provider-export-owner-reference-unowned:${visit.candidate.providerIdentity.id}:${getStableProviderVirtualSliceSuffix(`${visit.owner.exportIdentity}\0${reference.moduleSpecifier}\0${reference.exportName}`)}`, [{
                        message: "Provider references must resolve through a provider-owned public module identity before canonical export rendering.",
                        details: {
                            sourceExportName: visit.owner.sourceExportName,
                            moduleSpecifier: reference.moduleSpecifier,
                            exportName: reference.exportName,
                        },
                    }]);
                this.#diagnostics.append(diagnostic);
                return { kind: "rejected", diagnostic };
            }
            else {
                const targetSourceExportName = getProviderSourceExportName(target.declaration);
                const targetExportIdentity = getProviderPlanningExportIdentity(target.candidate.moduleIdentity, targetSourceExportName);
                const registration = this.#registerProviderPlanningCandidate(target.candidate, state, visit.key);
                if (registration.kind === "rejected") {
                    return registration;
                }
                const owner = this.#getOrPlanCanonicalExportOwner(target.candidate, targetSourceExportName, state);
                if (owner.kind === "rejected") {
                    return owner;
                }
                if (use.valueHeritage) {
                    const sourceNodeKey = getProviderClassNodeKey(visit.candidate.moduleIdentity, use.declaration);
                    const targetNodeKey = getProviderClassNodeKey(target.candidate.moduleIdentity, target.declaration);
                    state.classNodeLabels.set(sourceNodeKey, getProviderClassNodeLabel(visit.candidate.declarationModel, use.declaration));
                    state.classNodeLabels.set(targetNodeKey, getProviderClassNodeLabel(target.candidate.declarationModel, target.declaration));
                    addProviderClassHeritageEdge(state.classEdges, sourceNodeKey, targetNodeKey);
                }
                if (targetExportIdentity === visit.owner.exportIdentity) {
                    continue;
                }
                fileName = owner.fileName;
                exportedName = target.declaration.sourceTypeFamily === undefined
                    ? getProviderExportName(target.declaration)
                    : getProviderTypeFamilyVariantLocalName(target.declaration);
                const targetContract = state.ownersByExportIdentity.get(targetExportIdentity)?.contractKey
                    ?? this.#canonicalExportOwnersByExportIdentity.get(targetExportIdentity)?.contractKey;
                if (targetContract === undefined) {
                    const diagnostic = createInvalidProviderDeclarationDiagnostic(visit.candidate.providerIdentity, visit.candidate.declarationModel, `Canonical provider export planning lost the target contract for '${reference.moduleSpecifier}#${reference.exportName}'.`, `provider-export-owner-target-contract-missing:${visit.candidate.providerIdentity.id}:${targetExportIdentity}`);
                    this.#diagnostics.append(diagnostic);
                    return { kind: "rejected", diagnostic };
                }
                dependencyContract = JSON.stringify(["owned", targetExportIdentity, targetContract, exportedName]);
            }
            const incomingTypeOnly = !use.valueHeritage;
            const existingImport = exactImports.get(referenceKey);
            if (existingImport !== undefined) {
                if (existingImport.fileName !== fileName || existingImport.exportedName !== exportedName) {
                    const [firstImport, secondImport] = orderStablePair(JSON.stringify([existingImport.fileName, existingImport.exportedName]), JSON.stringify([fileName, exportedName]));
                    const diagnostic = createInvalidProviderDeclarationDiagnostic(visit.candidate.providerIdentity, visit.candidate.declarationModel, `Provider reference '${reference.moduleSpecifier}#${reference.exportName}' resolves to conflicting canonical exports.`, `provider-export-owner-reference-conflict:${visit.candidate.providerIdentity.id}:${getStableProviderVirtualSliceSuffix(`${firstImport}\0${secondImport}`)}`, [
                        { message: "Canonical import A", details: firstImport },
                        { message: "Canonical import B", details: secondImport },
                    ]);
                    this.#diagnostics.append(diagnostic);
                    return { kind: "rejected", diagnostic };
                }
                if (existingImport.typeOnly && !incomingTypeOnly) {
                    exactImports.set(referenceKey, { ...existingImport, typeOnly: false });
                }
            }
            else {
                exactImports.set(referenceKey, {
                    fileName,
                    exportedName,
                    localName: allocateProviderExactImportLocalName(reference, usedLocalNames),
                    typeOnly: incomingTypeOnly,
                });
            }
            const existingDependency = dependencyContracts.get(referenceKey);
            if (existingDependency !== undefined && existingDependency !== dependencyContract) {
                const [firstDependency, secondDependency] = orderStablePair(existingDependency, dependencyContract);
                const diagnostic = createInvalidProviderDeclarationDiagnostic(visit.candidate.providerIdentity, visit.candidate.declarationModel, `Provider reference '${reference.moduleSpecifier}#${reference.exportName}' has conflicting dependency contracts.`, `provider-export-owner-dependency-conflict:${visit.candidate.providerIdentity.id}:${getStableProviderVirtualSliceSuffix(`${firstDependency}\0${secondDependency}`)}`, [
                    { message: "Dependency contract A", details: getStableProviderVirtualSliceSuffix(firstDependency) },
                    { message: "Dependency contract B", details: getStableProviderVirtualSliceSuffix(secondDependency) },
                ]);
                this.#diagnostics.append(diagnostic);
                return { kind: "rejected", diagnostic };
            }
            dependencyContracts.set(referenceKey, dependencyContract);
        }
        const dependencyContractKey = JSON.stringify([...dependencyContracts].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0));
        const expectedDependencyContract = visit.owner.existingOwner?.dependencyContractKey
            ?? visit.owner.dependencyContractKey;
        if (expectedDependencyContract !== undefined && expectedDependencyContract !== dependencyContractKey) {
            return this.#rejectConflictingCanonicalExportDependency(visit.candidate, visit.owner.sourceExportName, expectedDependencyContract, dependencyContractKey);
        }
        if (visit.owner.dependencyContractKey === undefined) {
            visit.owner.dependencyContractKey = dependencyContractKey;
            visit.owner.exactImports = exactImports;
        }
        return { kind: "resolved" };
    }
    #rejectProviderPlanningBudget(candidate, dimension, actual, limit) {
        const diagnostic = createInvalidProviderDeclarationDiagnostic(candidate.providerIdentity, candidate.declarationModel, `Provider declaration closure exceeds the transaction limit for ${dimension}.`, `provider-declaration-closure-budget:${candidate.providerIdentity.id}:${dimension}:${limit}`, [{ message: "Provider declaration closure budget", details: { dimension, actual, limit } }]);
        this.#diagnostics.append(diagnostic);
        return { kind: "rejected", diagnostic };
    }
    #validateRecursiveProviderDependencyEnvironment(sourceCandidate, targetSourceExportName, incomingCandidate, ancestorCandidate) {
        const incomingEnvironment = getProviderCanonicalDependencyEnvironmentKey(incomingCandidate);
        const ancestorEnvironment = getProviderCanonicalDependencyEnvironmentKey(ancestorCandidate);
        if (incomingEnvironment === ancestorEnvironment) {
            return undefined;
        }
        const [firstEnvironment, secondEnvironment] = orderStablePair(ancestorEnvironment, incomingEnvironment);
        const diagnostic = createInvalidProviderDeclarationDiagnostic(sourceCandidate.providerIdentity, sourceCandidate.declarationModel, `Recursive provider dependency '${incomingCandidate.declarationModel.moduleSpecifier}#${targetSourceExportName}' changes its canonical resolution environment while closing a declaration graph.`, `provider-recursive-dependency-context-drift:${sourceCandidate.providerIdentity.id}:${getStableProviderVirtualSliceSuffix(`${incomingCandidate.moduleIdentity}\0${targetSourceExportName}\0${firstEnvironment}\0${secondEnvironment}`)}`, [
            { message: "Canonical resolution environment A", details: firstEnvironment },
            { message: "Canonical resolution environment B", details: secondEnvironment },
        ]);
        this.#diagnostics.append(diagnostic);
        return diagnostic;
    }
    #rejectConflictingCanonicalExportOwner(candidate, sourceExportName, existingContract, incomingContract) {
        const [firstContract, secondContract] = orderStablePair(existingContract, incomingContract);
        const diagnostic = createInvalidProviderDeclarationDiagnostic(candidate.providerIdentity, candidate.declarationModel, `Provider returned a declaration for '${candidate.declarationModel.moduleSpecifier}#${sourceExportName}' that conflicts with its canonical export owner.`, `provider-export-owner-contract-conflict:${candidate.providerIdentity.id}:${getStableProviderVirtualSliceSuffix(`${firstContract}\0${secondContract}`)}`, [
            { message: "Export contract A", details: getStableProviderVirtualSliceSuffix(firstContract) },
            { message: "Export contract B", details: getStableProviderVirtualSliceSuffix(secondContract) },
        ]);
        this.#diagnostics.append(diagnostic);
        return { kind: "rejected", diagnostic };
    }
    #rejectConflictingCanonicalExportDependency(candidate, sourceExportName, existingContract, incomingContract) {
        const [firstContract, secondContract] = orderStablePair(existingContract, incomingContract);
        const diagnostic = createInvalidProviderDeclarationDiagnostic(candidate.providerIdentity, candidate.declarationModel, `Provider dependencies for '${candidate.declarationModel.moduleSpecifier}#${sourceExportName}' conflict with its canonical export owner.`, `provider-export-owner-dependency-contract-conflict:${candidate.providerIdentity.id}:${getStableProviderVirtualSliceSuffix(`${firstContract}\0${secondContract}`)}`, [
            { message: "Dependency contract A", details: getStableProviderVirtualSliceSuffix(firstContract) },
            { message: "Dependency contract B", details: getStableProviderVirtualSliceSuffix(secondContract) },
        ]);
        this.#diagnostics.append(diagnostic);
        return { kind: "rejected", diagnostic };
    }
    #preparePlannedCanonicalExportOwners(state) {
        const plans = [...state.ownersByExportIdentity.values()]
            .filter((plan) => plan.existingOwner === undefined)
            .sort((left, right) => left.fileName < right.fileName ? -1 : left.fileName > right.fileName ? 1 : 0);
        const prepared = [];
        for (const plan of plans) {
            if (plan.dependencyContractKey === undefined || plan.exactImports === undefined) {
                const diagnostic = createInvalidProviderDeclarationDiagnostic(plan.candidate.providerIdentity, plan.candidate.declarationModel, `Canonical provider export '${plan.candidate.declarationModel.moduleSpecifier}#${plan.sourceExportName}' was not fully planned.`, `provider-export-owner-incomplete:${plan.candidate.providerIdentity.id}:${plan.exportIdentity}`);
                this.#diagnostics.append(diagnostic);
                return { kind: "rejected", diagnostic };
            }
            const sourceText = renderProviderDeclarationModel(plan.declarationModel, {
                exactImports: plan.exactImports,
                exactImportsInTypePositions: true,
                mode: "canonical-export",
            });
            const ownerResolution = getCanonicalProviderExportOwnerResolution(plan);
            const artifactId = getProviderCanonicalExportOwnerArtifactId(plan.exportIdentity);
            const document = Object.freeze({
                uri: plan.fileName,
                fileName: plan.fileName,
                artifactId,
                artifactKind: "canonical-export-owner",
                moduleSpecifier: ownerResolution.moduleSpecifier,
                providerModuleId: ownerResolution.providerModuleId,
                provider: plan.candidate.providerIdentity,
                declarationModel: plan.declarationModel,
                sourceText,
                readOnly: true,
            });
            const artifact = Object.freeze({
                kind: "canonical-export-owner",
                id: artifactId,
                provider: document.provider,
                moduleSpecifier: ownerResolution.moduleSpecifier,
                providerModuleId: ownerResolution.providerModuleId,
                ...(ownerResolution.packageName === undefined ? {} : { packageName: ownerResolution.packageName }),
                ...(ownerResolution.packageVersion === undefined ? {} : { packageVersion: ownerResolution.packageVersion }),
                fileName: plan.fileName,
                declarationModel: plan.declarationModel,
                sourceText,
                document,
            });
            const typeOnly = getProviderExportTypeOnlyMap(plan.declarationModel.exports).get(plan.sourceExportName);
            if (typeOnly === undefined) {
                const diagnostic = createInvalidProviderDeclarationDiagnostic(plan.candidate.providerIdentity, plan.candidate.declarationModel, `Canonical provider export '${plan.candidate.declarationModel.moduleSpecifier}#${plan.sourceExportName}' has no export-kind contract.`, `provider-export-owner-kind-missing:${plan.candidate.providerIdentity.id}:${plan.exportIdentity}`);
                this.#diagnostics.append(diagnostic);
                return { kind: "rejected", diagnostic };
            }
            const publicContractKey = getProviderExportContractKeyMap(plan.declarationModel.moduleSpecifier, plan.declarationModel.exports).get(plan.sourceExportName);
            if (publicContractKey === undefined) {
                const diagnostic = createInvalidProviderDeclarationDiagnostic(plan.candidate.providerIdentity, plan.candidate.declarationModel, `Canonical provider export '${plan.candidate.declarationModel.moduleSpecifier}#${plan.sourceExportName}' has no public contract.`, `provider-export-owner-contract-missing:${plan.candidate.providerIdentity.id}:${plan.exportIdentity}`);
                this.#diagnostics.append(diagnostic);
                return { kind: "rejected", diagnostic };
            }
            prepared.push({ plan, artifact, typeOnly, publicContractKey });
        }
        return { kind: "prepared", owners: prepared };
    }
    #commitPreparedCanonicalExportOwners(owners) {
        for (const { plan, artifact, typeOnly, publicContractKey } of owners) {
            this.#recordVirtualFileIdentity(plan.fileName, plan.candidate.moduleIdentity);
            this.#commitVirtualArtifact(artifact, false);
            this.#canonicalExportOwnersByExportIdentity.set(plan.exportIdentity, {
                artifact,
                contractKey: plan.contractKey,
                dependencyContractKey: plan.dependencyContractKey,
            });
            let canonicalExports = this.#canonicalExportsByModuleIdentity.get(plan.candidate.moduleIdentity);
            if (canonicalExports === undefined) {
                canonicalExports = new Map();
                this.#canonicalExportsByModuleIdentity.set(plan.candidate.moduleIdentity, canonicalExports);
            }
            canonicalExports.set(plan.sourceExportName, {
                fileName: plan.fileName,
                typeOnly,
                contractKey: publicContractKey,
            });
        }
    }
    #commitProviderPublicModuleIdentities(state) {
        for (const [environmentKey, moduleIdentity] of state.publicModuleIdentitiesByEnvironmentKey) {
            this.#publicModuleIdentitiesByEnvironmentKey.set(environmentKey, moduleIdentity);
        }
    }
    #planEffectiveVirtualFileName(candidate, sourceText) {
        const moduleIdentity = candidate.moduleIdentity;
        const variants = this.#virtualSourceVariantsByModuleIdentity.get(moduleIdentity) ?? [];
        const existing = variants.find((variant) => variant.sourceText === sourceText);
        if (existing !== undefined) {
            return { kind: "planned", fileName: existing.fileName };
        }
        const fileName = getProviderPublicVirtualSliceFileName(moduleIdentity, sourceText);
        const collidingVariant = variants.find((variant) => variant.fileName === fileName);
        const existingIdentity = this.#virtualFileIdentities.get(fileName);
        if (collidingVariant !== undefined
            || existingIdentity !== undefined && existingIdentity !== moduleIdentity
            || this.#virtualArtifactsByFileName.has(fileName)
            || this.#virtualDocumentsByUri.has(fileName)) {
            const diagnostic = createInvalidProviderDeclarationDiagnostic(candidate.providerIdentity, candidate.declarationModel, `Host-owned provider virtual source identity '${fileName}' conflicts with a different declaration source.`, `provider-virtual-source-identity-conflict:${candidate.providerIdentity.id}:${fileName}`, [{
                    message: "Provider virtual source identities are deterministic and hash collisions fail closed.",
                    details: { moduleSpecifier: candidate.declarationModel.moduleSpecifier },
                }]);
            this.#diagnostics.append(diagnostic);
            return { kind: "rejected", diagnostic };
        }
        return { kind: "planned", fileName };
    }
    #preparePublicVirtualArtifact(candidate, declarationModel, sourceText, fileName) {
        const id = getProviderPublicVirtualArtifactId(candidate.moduleIdentity, sourceText);
        const existing = this.#virtualArtifactsByFileName.get(fileName);
        if (existing !== undefined) {
            if (existing.kind === "public"
                && existing.id === id
                && providerIdentityEquals(existing.provider, candidate.providerIdentity)
                && existing.moduleSpecifier === candidate.resolution.moduleSpecifier
                && existing.providerModuleId === candidate.resolution.providerModuleId
                && existing.packageName === candidate.resolution.packageName
                && existing.packageVersion === candidate.resolution.packageVersion
                && existing.sourceText === sourceText
                && JSON.stringify(existing.declarationModel) === JSON.stringify(declarationModel)) {
                return { kind: "prepared", artifact: existing };
            }
            const diagnostic = createInvalidProviderDeclarationDiagnostic(candidate.providerIdentity, candidate.declarationModel, `Host-owned provider artifact '${fileName}' conflicts with an existing immutable artifact.`, `provider-virtual-artifact-conflict:${candidate.providerIdentity.id}:${fileName}`);
            this.#diagnostics.append(diagnostic);
            return { kind: "rejected", diagnostic };
        }
        const document = Object.freeze({
            uri: fileName,
            fileName,
            artifactId: id,
            artifactKind: "public",
            moduleSpecifier: candidate.resolution.moduleSpecifier,
            providerModuleId: candidate.resolution.providerModuleId,
            provider: candidate.providerIdentity,
            declarationModel,
            sourceText,
            readOnly: true,
        });
        return {
            kind: "prepared",
            artifact: Object.freeze({
                kind: "public",
                id,
                provider: document.provider,
                moduleSpecifier: candidate.resolution.moduleSpecifier,
                providerModuleId: candidate.resolution.providerModuleId,
                ...(candidate.resolution.packageName === undefined ? {} : { packageName: candidate.resolution.packageName }),
                ...(candidate.resolution.packageVersion === undefined ? {} : { packageVersion: candidate.resolution.packageVersion }),
                fileName,
                declarationModel,
                sourceText,
                document,
            }),
        };
    }
    #commitVirtualArtifact(artifact, publiclyVisible) {
        const existing = this.#virtualArtifactsByFileName.get(artifact.fileName);
        if (existing !== undefined) {
            if (existing !== artifact) {
                throw new Error(`Provider virtual artifact '${artifact.fileName}' was committed more than once.`);
            }
            return;
        }
        this.#virtualArtifactsByFileName.set(artifact.fileName, artifact);
        this.#virtualDocumentsByUri.set(artifact.fileName, artifact.document);
        if (publiclyVisible) {
            this.#publicVirtualDocumentsByUri.set(artifact.fileName, artifact.document);
        }
    }
    #recordVirtualSourceVariant(moduleIdentity, sourceText, fileName) {
        const variants = this.#virtualSourceVariantsByModuleIdentity.get(moduleIdentity) ?? [];
        if (!variants.some((variant) => variant.sourceText === sourceText)) {
            variants.push({ sourceText, fileName });
        }
        this.#virtualSourceVariantsByModuleIdentity.set(moduleIdentity, variants);
    }
    #getCanonicalExportsForRender(moduleIdentity, declarationModel, planningState) {
        const canonicalExports = new Map(this.#canonicalExportsByModuleIdentity.get(moduleIdentity) ?? []);
        for (const plan of planningState?.ownersByExportIdentity.values() ?? []) {
            if (plan.candidate.moduleIdentity !== moduleIdentity) {
                continue;
            }
            const typeOnly = getProviderExportTypeOnlyMap(plan.declarationModel.exports).get(plan.sourceExportName);
            if (typeOnly !== undefined) {
                canonicalExports.set(plan.sourceExportName, {
                    fileName: plan.fileName,
                    typeOnly,
                    contractKey: plan.contractKey,
                });
            }
        }
        if (canonicalExports.size === 0) {
            return new Map();
        }
        const exportNames = getProviderDeclarationModelExportNames(declarationModel);
        const exportNameSet = new Set(exportNames);
        return new Map([...canonicalExports]
            .filter(([exportName]) => exportNameSet.has(exportName))
            .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0));
    }
    #validateCanonicalExportContracts(provider, moduleIdentity, declarationModel) {
        const canonicalExports = this.#canonicalExportsByModuleIdentity.get(moduleIdentity);
        if (canonicalExports === undefined || canonicalExports.size === 0) {
            return undefined;
        }
        const incomingContracts = getProviderExportContractKeyMap(declarationModel.moduleSpecifier, declarationModel.exports);
        for (const [exportName, incomingContract] of incomingContracts) {
            const canonicalExport = canonicalExports.get(exportName);
            if (canonicalExport === undefined || canonicalExport.contractKey === incomingContract) {
                continue;
            }
            const [firstContract, secondContract] = orderStablePair(canonicalExport.contractKey, incomingContract);
            return createHostDiagnostic({
                extensionCode: "INVALID_PROVIDER_DECLARATION_MODEL",
                numericCode: ExtensionHostDiagnosticCode.invalidProviderDeclaration,
                message: `Provider '${provider.id}' returned conflicting declarations for public export '${declarationModel.moduleSpecifier}#${exportName}'.`,
                evidence: [
                    { message: "Export contract A", details: firstContract },
                    { message: "Export contract B", details: secondContract },
                ],
                identity: `provider-export-contract-conflict:${provider.id}:${declarationModel.moduleSpecifier}:${exportName}:${getStableProviderVirtualSliceSuffix(`${firstContract}\0${secondContract}`)}`,
            });
        }
        return undefined;
    }
    #validateVirtualFileIdentity(fileName, moduleIdentity) {
        const existing = this.#virtualFileIdentities.get(fileName);
        if (existing === undefined || existing === moduleIdentity) {
            return undefined;
        }
        const [firstIdentity, secondIdentity] = orderStablePair(existing, moduleIdentity);
        return createHostDiagnostic({
            extensionCode: "INVALID_PROVIDER_MODULE_RESOLUTION",
            numericCode: ExtensionHostDiagnosticCode.providerResolutionFailed,
            message: `Provider virtual file '${fileName}' is used for multiple public provider module identities.`,
            evidence: [
                { message: "Virtual file identity A", details: firstIdentity },
                { message: "Virtual file identity B", details: secondIdentity },
            ],
            identity: `provider-virtual-file-conflict:${fileName}:${firstIdentity}:${secondIdentity}`,
        });
    }
    #recordVirtualFileIdentity(fileName, moduleIdentity) {
        if (!this.#virtualFileIdentities.has(fileName)) {
            this.#virtualFileIdentities.set(fileName, moduleIdentity);
        }
    }
    getVirtualArtifactByFileName(fileName) {
        const artifact = this.#virtualArtifactsByFileName.get(fileName);
        return artifact?.kind === "public" ? artifact : undefined;
    }
    [providerVirtualCompilerArtifactLookup](fileName) {
        return this.#virtualArtifactsByFileName.get(fileName);
    }
    getVirtualDeclarationDocument(uriOrFileName) {
        return this.#publicVirtualDocumentsByUri.get(uriOrFileName);
    }
    getVirtualDeclarationDocuments() {
        return [...this.#publicVirtualDocumentsByUri.values()]
            .sort((left, right) => left.fileName < right.fileName ? -1 : left.fileName > right.fileName ? 1 : 0);
    }
    #collectModuleOwners(specifier, context) {
        const owners = [];
        for (const provider of this.#bindingProviders.values()) {
            const ownershipCall = callProvider(this.#diagnostics, provider.identity, "ownsModule", specifier, () => provider.ownsModule(specifier, context));
            if (ownershipCall.kind === "threw") {
                return { kind: "rejected", diagnostic: ownershipCall.diagnostic };
            }
            const ownershipSnapshot = snapshotProviderOwnership(ownershipCall.value);
            if (ownershipSnapshot.kind === "invalid") {
                const diagnostic = createInvalidProviderCallbackDiagnostic(provider.identity, specifier, "ownsModule", ownershipSnapshot.reason);
                this.#diagnostics.append(diagnostic);
                return { kind: "rejected", diagnostic };
            }
            const ownership = ownershipSnapshot.ownership;
            if (ownership.kind === "reject") {
                this.#diagnostics.append(ownership.diagnostic);
                return { kind: "rejected", diagnostic: ownership.diagnostic };
            }
            if (ownership.kind === "owned") {
                owners.push(provider);
            }
        }
        if (owners.length === 0) {
            return { kind: "unowned" };
        }
        if (owners.length === 1) {
            return { kind: "owned", provider: owners[0] };
        }
        owners.sort((left, right) => left.identity.id < right.identity.id ? -1 : left.identity.id > right.identity.id ? 1 : 0);
        this.#diagnostics.append(createHostDiagnostic({
            extensionCode: "PROVIDER_OWNERSHIP_CONFLICT",
            numericCode: ExtensionHostDiagnosticCode.providerOwnershipConflict,
            message: `Multiple target binding providers claim module '${specifier}': ${owners.map((provider) => provider.identity.id).join(", ")}.`,
            evidence: owners.map((provider) => ({ message: "Claiming provider", details: provider.identity })),
            identity: `provider-ownership-conflict:${specifier}:${owners.map((provider) => provider.identity.id).sort().join(",")}`,
        }));
        return { kind: "conflict", providers: Object.freeze(owners.map((provider) => provider.identity)) };
    }
}
export class ExtensionHost {
    diagnostics;
    facts;
    factResolver;
    providers;
    extensions;
    activeTarget;
    activeSurface;
    #extensionsById = new Map();
    #observationOwners = new Map();
    #observationHooks = new Map();
    #lifecycleHooks = new Map();
    #consumerSubjectIds = new WeakMap();
    #program;
    #compilerContext;
    #nextConsumerSubjectId = 1;
    #finalized = false;
    #hookRegistrationsSealed = false;
    constructor(program, options = {}) {
        this.#program = program;
        this.diagnostics = new ExtensionDiagnosticStore();
        this.facts = new ExtensionFactStore(this.diagnostics);
        this.factResolver = new ExtensionFactResolver(this.facts, this.diagnostics);
        this.providers = new ProviderRegistry(this.diagnostics, options.requiredProviderModules ?? []);
        this.activeTarget = options.activeTarget;
        this.activeSurface = options.activeSurface;
        const orderedExtensions = orderExtensions(options.extensions ?? [], this.diagnostics);
        const validExtensions = [];
        for (const extension of orderedExtensions) {
            if (!this.diagnostics.registerDiagnosticRange(extension.identity.id, extension.identity.diagnosticRange)) {
                continue;
            }
            this.#extensionsById.set(extension.identity.id, extension);
            validExtensions.push(extension);
            for (const observation of extension.observationOwners ?? []) {
                this.registerObservationOwner(observation, extension.identity.id);
            }
        }
        this.extensions = validExtensions;
        this.#validateComposition(options);
        this.#initializeExtensions();
    }
    get program() {
        return this.#program;
    }
    bindCompilerProgram(program) {
        if (this.#program === program) {
            return;
        }
        this.#program = program;
        this.#compilerContext = undefined;
    }
    registerObservationOwner(observation, extensionId) {
        if (this.#hookRegistrationsSealed) {
            this.diagnostics.append(createRegistrationClosedDiagnostic("observation owner"));
            return;
        }
        if (!this.#extensionsById.has(extensionId)) {
            this.diagnostics.append(createHostDiagnostic({
                extensionCode: "UNKNOWN_OBSERVATION_OWNER",
                numericCode: ExtensionHostDiagnosticCode.unknownObservationOwner,
                message: `Semantic observation point '${observation}' was assigned to unknown extension '${extensionId}'.`,
                identity: `unknown-observation-owner:${observation}:${extensionId}`,
            }));
            return;
        }
        const existingOwner = this.#observationOwners.get(observation);
        if (existingOwner === undefined) {
            this.#observationOwners.set(observation, extensionId);
            return;
        }
        if (existingOwner === extensionId) {
            return;
        }
        this.diagnostics.append(createHostDiagnostic({
            extensionCode: "OBSERVATION_OWNER_CONFLICT",
            numericCode: ExtensionHostDiagnosticCode.observationOwnerConflict,
            message: `Semantic observation point '${observation}' is owned by both '${existingOwner}' and '${extensionId}'.`,
            identity: `observation-owner-conflict:${observation}:${existingOwner}:${extensionId}`,
        }));
    }
    getObservationOwner(observation) {
        const ownerId = this.#observationOwners.get(observation);
        return ownerId === undefined ? undefined : this.#extensionsById.get(ownerId);
    }
    requireObservationOwner(observation) {
        const owner = this.getObservationOwner(observation);
        if (owner !== undefined) {
            return owner;
        }
        this.diagnostics.append(createHostDiagnostic({
            extensionCode: "OBSERVATION_OWNER_MISSING",
            numericCode: ExtensionHostDiagnosticCode.observationOwnerMissing,
            message: `No extension owns semantic observation point '${observation}'.`,
            identity: `observation-owner-missing:${observation}`,
        }));
        return undefined;
    }
    registerObservation(observation, extensionId, hook) {
        if (this.#hookRegistrationsSealed) {
            this.diagnostics.append(createRegistrationClosedDiagnostic("observation hook"));
            return;
        }
        const hooks = this.#observationHooks.get(observation);
        const registered = {
            extensionId,
            hook: hook,
        };
        if (hooks === undefined) {
            this.#observationHooks.set(observation, [registered]);
            return;
        }
        hooks.push(registered);
    }
    registerLifecycleHook(event, extensionId, hook) {
        if (this.#hookRegistrationsSealed) {
            this.diagnostics.append(createRegistrationClosedDiagnostic("lifecycle hook"));
            return;
        }
        const hooks = this.#lifecycleHooks.get(event);
        const registered = {
            extensionId,
            hook: hook,
        };
        if (hooks === undefined) {
            this.#lifecycleHooks.set(event, [registered]);
            return;
        }
        hooks.push(registered);
    }
    registerTargetSemanticProvider(extensionId, provider) {
        if (this.#hookRegistrationsSealed) {
            this.diagnostics.append(createRegistrationClosedDiagnostic("target semantic provider"));
            return false;
        }
        const registration = snapshotTargetSemanticProviderRegistration(provider);
        if (registration.kind === "invalid") {
            this.diagnostics.append(createHostDiagnostic({
                extensionCode: "INVALID_TARGET_SEMANTIC_PROVIDER",
                numericCode: ExtensionHostDiagnosticCode.invalidProvider,
                message: "Invalid target semantic provider registration.",
                evidence: [{ message: "Registration rejection", details: registration.reason }],
                identity: `invalid-semantic-provider-registration:${extensionId}:${registration.reason}`,
            }));
            return false;
        }
        const registered = this.providers.registerTargetSemanticProvider(registration.provider);
        if (!registered) {
            return false;
        }
        this.#registerTargetSemanticProviderObservations(extensionId, registration.provider);
        return true;
    }
    runObservation(observation, request, core, options = {}) {
        this.#hookRegistrationsSealed = true;
        this.providers[sealProviderRegistrations]();
        const owner = this.getObservationOwner(observation);
        if (owner === undefined && options.requireOwner === true) {
            this.requireObservationOwner(observation);
            return { kind: "missing-owner", observation };
        }
        const hooks = Object.freeze([...(this.#observationHooks.get(observation) ?? [])]);
        const selectedHooks = Object.freeze(owner === undefined ? [...hooks] : hooks.filter((hook) => hook.extensionId === owner.identity.id));
        if (selectedHooks.length === 0) {
            if (owner !== undefined && options.requireOwner === true) {
                this.diagnostics.append(createHostDiagnostic({
                    extensionCode: "OBSERVATION_OWNER_DEFERRED",
                    numericCode: ExtensionHostDiagnosticCode.observationOwnerDeferred,
                    message: `Extension '${owner.identity.id}' owns semantic observation point '${observation}' but registered no observation hook.`,
                    identity: `observation-owner-no-hook:${observation}:${owner.identity.id}`,
                }));
                return { kind: "owner-deferred", observation, extensionId: owner.identity.id };
            }
            return { kind: "core", value: core() };
        }
        const nonDeferred = [];
        for (const registered of selectedHooks) {
            let observationResult;
            try {
                const returned = registered.hook(request, {
                    observation,
                    extensionId: registered.extensionId,
                    compiler: this.getCompilerQueryContext(),
                    host: this,
                    facts: this.facts,
                    factResolver: this.factResolver,
                    diagnostics: this.diagnostics,
                });
                const snapshot = snapshotExtensionObservationEnvelope(returned);
                if (snapshot.kind === "invalid") {
                    throw new Error(`Invalid observation result: ${snapshot.reason}`);
                }
                observationResult = snapshot.observation;
            }
            catch (error) {
                const diagnostic = createHostDiagnostic({
                    extensionCode: "OBSERVATION_HOOK_FAILED",
                    numericCode: ExtensionHostDiagnosticCode.observationHookFailed,
                    message: `Extension '${registered.extensionId}' failed while observing semantic point '${observation}'.`,
                    evidence: [{ message: "Thrown value", details: error }],
                    identity: `observation-hook-failed:${observation}:${registered.extensionId}`,
                });
                this.diagnostics.append(diagnostic);
                nonDeferred.push({ kind: "reject", diagnostic, extensionId: registered.extensionId });
                continue;
            }
            if (observationResult.kind === "defer") {
                continue;
            }
            if (observationResult.kind === "reject") {
                this.diagnostics.append(observationResult.diagnostic);
                nonDeferred.push({ kind: "reject", diagnostic: observationResult.diagnostic, extensionId: registered.extensionId });
                continue;
            }
            nonDeferred.push({
                kind: "accept",
                value: observationResult.value,
                extensionId: registered.extensionId,
                ...(observationResult.evidence !== undefined ? { evidence: observationResult.evidence } : {}),
            });
        }
        if (nonDeferred.length === 0) {
            if (owner !== undefined && options.requireOwner === true) {
                this.diagnostics.append(createHostDiagnostic({
                    extensionCode: "OBSERVATION_OWNER_DEFERRED",
                    numericCode: ExtensionHostDiagnosticCode.observationOwnerDeferred,
                    message: `Extension '${owner.identity.id}' owns semantic observation point '${observation}' but deferred observation.`,
                    identity: `observation-owner-deferred:${observation}:${owner.identity.id}`,
                }));
                return { kind: "owner-deferred", observation, extensionId: owner.identity.id };
            }
            return { kind: "core", value: core() };
        }
        if (nonDeferred.length > 1) {
            this.diagnostics.append(createHostDiagnostic({
                extensionCode: "OBSERVATION_CONFLICT",
                numericCode: ExtensionHostDiagnosticCode.observationConflict,
                message: owner === undefined
                    ? `Multiple extensions observed semantic point '${observation}' without a registered owner.`
                    : `Extension '${owner.identity.id}' returned multiple non-deferred observations for semantic point '${observation}'.`,
                evidence: nonDeferred.map((result) => ({ message: `Observation result kind: ${result.kind}`, details: result })),
                identity: `observation-conflict:${observation}:${owner?.identity.id ?? "unowned"}`,
            }));
            return { kind: "conflict", observation };
        }
        return nonDeferred[0];
    }
    runLifecycle(event, request) {
        this.#hookRegistrationsSealed = true;
        this.providers[sealProviderRegistrations]();
        const registeredHooks = this.#lifecycleHooks.get(event);
        const hooks = registeredHooks === undefined ? undefined : Object.freeze([...registeredHooks]);
        if (hooks === undefined) {
            return;
        }
        const immutableRequest = Object.freeze({ ...request });
        for (const registered of hooks) {
            try {
                registered.hook(immutableRequest, {
                    event,
                    extensionId: registered.extensionId,
                    compiler: this.getCompilerQueryContext(),
                    host: this,
                });
            }
            catch (error) {
                this.diagnostics.append(createHostDiagnostic({
                    extensionCode: "LIFECYCLE_HOOK_FAILED",
                    numericCode: ExtensionHostDiagnosticCode.lifecycleHookFailed,
                    message: `Extension '${registered.extensionId}' failed during lifecycle event '${event}'.`,
                    evidence: [{ message: "Thrown value", details: error }],
                    identity: `lifecycle-hook-failed:${event}:${registered.extensionId}`,
                }));
            }
        }
    }
    finalizeSemantics() {
        if (this.#finalized) {
            return;
        }
        this.runLifecycle(ExtensionLifecycleEvent.beforeSemanticsFinalized, { host: this });
        this.facts.seal();
        this.#finalized = true;
    }
    get finalized() {
        return this.#finalized;
    }
    getCompilerQueryContext() {
        if (this.#compilerContext === undefined) {
            const program = this.program;
            this.#compilerContext = {
                program: this.program,
                ast: createAstReader(),
                checker: createTypeCheckerQueries(program),
                typeShape: createTypeShapeQueries(program),
                getSourceFiles: () => (Program_GetSourceFiles(program) ?? [])
                    .filter((file) => getProviderVirtualArtifactForCompiler(this.providers, SourceFile_FileName(file))?.kind !== "canonical-export-owner"),
                getSourceFile: (fileName) => {
                    const file = Program_GetSourceFile(program, fileName);
                    return file !== undefined
                        && getProviderVirtualArtifactForCompiler(this.providers, SourceFile_FileName(file))?.kind === "canonical-export-owner"
                        ? undefined
                        : file;
                },
            };
        }
        return this.#compilerContext;
    }
    assertFinalizedForConsumer(consumer) {
        if (this.#finalized) {
            return true;
        }
        this.diagnostics.append(createHostDiagnostic({
            extensionCode: "CONSUMER_BEFORE_FINALIZATION",
            numericCode: ExtensionHostDiagnosticCode.consumerBeforeFinalization,
            message: `Consumer '${consumer}' attempted to read extension facts before semantic finalization.`,
            identity: `consumer-before-finalization:${consumer}`,
        }));
        return false;
    }
    getFactForConsumer(consumer, subject, key) {
        if (!this.assertFinalizedForConsumer(consumer)) {
            return undefined;
        }
        if (subject === undefined) {
            return undefined;
        }
        return this.factResolver.resolve(subject, key);
    }
    requireFactForConsumer(consumer, subject, key, purpose) {
        if (!this.assertFinalizedForConsumer(consumer)) {
            return undefined;
        }
        const value = subject === undefined ? undefined : this.factResolver.resolve(subject, key);
        if (value !== undefined) {
            return value;
        }
        this.diagnostics.append(createHostDiagnostic({
            extensionCode: "REQUIRED_FACT_MISSING",
            numericCode: ExtensionHostDiagnosticCode.requiredFactMissing,
            message: purpose === undefined
                ? `Consumer '${consumer}' requires extension fact '${key.id}', but no finalized fact exists for the subject.`
                : `Consumer '${consumer}' requires extension fact '${key.id}' for ${purpose}, but no finalized fact exists for the subject.`,
            evidence: [
                { message: "Consumer", details: consumer },
                { message: "Fact key", details: key.id },
                { message: "Subject", details: this.#getConsumerSubjectIdentity(subject) },
            ],
            identity: `required-fact-missing:${consumer}:${key.id}:${this.#getConsumerSubjectIdentity(subject)}:${purpose ?? ""}`,
        }));
        return undefined;
    }
    mustFactForConsumer(consumer, subject, key, purpose) {
        const value = this.requireFactForConsumer(consumer, subject, key, purpose);
        if (value !== undefined) {
            return value;
        }
        throw new Error(purpose === undefined
            ? `Consumer '${consumer}' requires extension fact '${key.id}'.`
            : `Consumer '${consumer}' requires extension fact '${key.id}' for ${purpose}.`);
    }
    getFactsForConsumer(consumer, subject) {
        if (!this.assertFinalizedForConsumer(consumer)) {
            return [];
        }
        return this.facts.entries(subject);
    }
    getVirtualDeclarationDocumentForConsumer(consumer, uriOrFileName) {
        if (!this.assertFinalizedForConsumer(consumer)) {
            return undefined;
        }
        return this.providers.getVirtualDeclarationDocument(uriOrFileName);
    }
    #getConsumerSubjectIdentity(subject) {
        if (subject === undefined) {
            return "undefined";
        }
        const existing = this.#consumerSubjectIds.get(subject);
        if (existing !== undefined) {
            return `object:${existing}`;
        }
        const created = this.#nextConsumerSubjectId;
        this.#nextConsumerSubjectId += 1;
        this.#consumerSubjectIds.set(subject, created);
        return `object:${created}`;
    }
    #initializeExtensions() {
        for (const extension of this.extensions) {
            try {
                extension.initialize?.({
                    host: this,
                    facts: this.facts,
                    factResolver: this.factResolver,
                    diagnostics: this.diagnostics,
                    providers: this.providers,
                    registerObservationOwner: (observation, extensionId) => this.registerObservationOwner(observation, extensionId),
                    registerObservation: (observation, hook) => this.registerObservation(observation, extension.identity.id, hook),
                    registerLifecycleHook: (event, hook) => this.registerLifecycleHook(event, extension.identity.id, hook),
                    registerTargetBindingProvider: (provider) => this.providers.registerTargetBindingProvider(provider),
                    registerTargetSemanticProvider: (provider) => this.registerTargetSemanticProvider(extension.identity.id, provider),
                });
            }
            catch (error) {
                this.diagnostics.append(createHostDiagnostic({
                    extensionCode: "EXTENSION_INITIALIZE_FAILED",
                    numericCode: ExtensionHostDiagnosticCode.initializationFailed,
                    message: `Extension '${extension.identity.id}' failed during initialization.`,
                    evidence: [{ message: "Thrown value", details: error }],
                    identity: `extension-initialize-failed:${extension.identity.id}`,
                }));
            }
        }
    }
    #validateComposition(options) {
        const targetExtensions = this.extensions.filter((extension) => extension.composition?.kind === "target");
        if (options.allowMultipleTargets !== true && targetExtensions.length > 1) {
            this.diagnostics.append(createHostDiagnostic({
                extensionCode: "MULTIPLE_TARGET_EXTENSIONS",
                numericCode: ExtensionHostDiagnosticCode.multipleTargetExtensions,
                message: `Multiple target extensions are loaded without explicit multi-target mode: ${targetExtensions.map((extension) => extension.identity.id).join(", ")}.`,
                identity: `multiple-target-extensions:${targetExtensions.map((extension) => extension.identity.id).sort().join(",")}`,
            }));
        }
    }
    #registerTargetSemanticProviderObservations(extensionId, provider) {
        registerProviderObservation(this, extensionId, ExtensionObservationPoint.validateTargetConstraint, provider.validateTargetConstraint);
        registerProviderObservation(this, extensionId, ExtensionObservationPoint.observePostCheckAssignability, provider.observePostCheckAssignability);
        registerProviderObservation(this, extensionId, ExtensionObservationPoint.mapCheckedCall, provider.mapCheckedCall);
        registerProviderObservation(this, extensionId, ExtensionObservationPoint.mapInferredSourceTypeArgumentsToTarget, provider.mapInferredSourceTypeArgumentsToTarget);
        registerProviderObservation(this, extensionId, ExtensionObservationPoint.mapCheckedPropertyAccess, provider.mapCheckedPropertyAccess);
        registerProviderObservation(this, extensionId, ExtensionObservationPoint.mapCheckedElementAccess, provider.mapCheckedElementAccess);
        registerProviderObservation(this, extensionId, ExtensionObservationPoint.mapCheckedOperator, provider.mapCheckedOperator);
        registerProviderObservation(this, extensionId, ExtensionObservationPoint.mapCheckedIteration, provider.mapCheckedIteration);
        registerProviderObservation(this, extensionId, ExtensionObservationPoint.recordContextualTargetType, provider.recordContextualTargetType);
        registerProviderObservation(this, extensionId, ExtensionObservationPoint.mapCheckedConversion, provider.mapCheckedConversion);
        registerProviderObservation(this, extensionId, ExtensionObservationPoint.resolveParameterPassing, provider.resolveParameterPassing);
        registerProviderObservation(this, extensionId, ExtensionObservationPoint.resolveRuntimeCarrier, provider.resolveRuntimeCarrier);
        registerProviderObservation(this, extensionId, ExtensionObservationPoint.validateExtensionFlowUse, provider.validateExtensionFlowUse);
    }
}
function registerProviderObservation(host, extensionId, observation, handler) {
    if (handler === undefined) {
        return;
    }
    host.registerObservationOwner(observation, extensionId);
    host.registerObservation(observation, extensionId, (request, context) => handler(request, context));
}
const attachedExtensionHosts = new WeakMap();
export function attachExtensionHost(program, options = {}) {
    const host = new ExtensionHost(program, options);
    attachedExtensionHosts.set(program, host);
    return Object.freeze({ program, extensionHost: host });
}
export function attachExtensionHostToProgram(hostOwner, program, options = {}) {
    const host = attachedExtensionHosts.get(hostOwner);
    if (host === undefined) {
        return undefined;
    }
    const existing = attachedExtensionHosts.get(program);
    if (existing !== undefined && existing !== host) {
        throw new Error("Program already has a different ExtensionHost.");
    }
    if (options.bindCompilerProgram !== false) {
        host.bindCompilerProgram(program);
    }
    attachedExtensionHosts.set(program, host);
    return Object.freeze({ program, extensionHost: host });
}
export function getExtensionHost(program) {
    return attachedExtensionHosts.get(program);
}
export function hasExtensionHost(program) {
    return attachedExtensionHosts.has(program);
}
function orderExtensions(extensions, diagnostics) {
    const extensionsById = new Map();
    const invalidExtensionIds = new Set();
    for (const extension of extensions) {
        const id = extension.identity.id;
        if (extensionsById.has(id)) {
            diagnostics.append(createHostDiagnostic({
                extensionCode: "DUPLICATE_EXTENSION_ID",
                numericCode: ExtensionHostDiagnosticCode.duplicateExtension,
                message: `Duplicate extension id '${id}'.`,
                identity: `duplicate-extension:${id}`,
            }));
            continue;
        }
        extensionsById.set(id, extension);
    }
    const outgoingEdges = new Map();
    const incomingCounts = new Map();
    for (const id of extensionsById.keys()) {
        outgoingEdges.set(id, new Set());
        incomingCounts.set(id, 0);
    }
    for (const extension of extensionsById.values()) {
        const extensionId = extension.identity.id;
        for (const dependencyId of extension.dependencies?.dependsOn ?? []) {
            if (!extensionsById.has(dependencyId)) {
                diagnostics.append(createHostDiagnostic({
                    extensionCode: "MISSING_EXTENSION_DEPENDENCY",
                    numericCode: ExtensionHostDiagnosticCode.missingDependency,
                    message: `Extension '${extensionId}' requires missing dependency '${dependencyId}'.`,
                    identity: `missing-dependency:${extensionId}:${dependencyId}`,
                }));
                invalidExtensionIds.add(extensionId);
                continue;
            }
            addOrderingEdge(outgoingEdges, incomingCounts, dependencyId, extensionId);
        }
        for (const predecessorId of extension.dependencies?.runsAfter ?? []) {
            if (extensionsById.has(predecessorId)) {
                addOrderingEdge(outgoingEdges, incomingCounts, predecessorId, extensionId);
            }
        }
    }
    const ready = Array.from(incomingCounts.entries())
        .filter((entry) => entry[1] === 0)
        .map((entry) => entry[0])
        .sort();
    const ordered = [];
    while (ready.length > 0) {
        const id = ready.shift();
        const extension = extensionsById.get(id);
        if (extension !== undefined) {
            ordered.push(extension);
        }
        for (const dependentId of Array.from(outgoingEdges.get(id) ?? []).sort()) {
            const nextCount = (incomingCounts.get(dependentId) ?? 0) - 1;
            incomingCounts.set(dependentId, nextCount);
            if (nextCount === 0) {
                ready.push(dependentId);
                ready.sort();
            }
        }
    }
    if (ordered.length !== extensionsById.size) {
        const cycleIds = Array.from(extensionsById.keys())
            .filter((id) => !ordered.some((extension) => extension.identity.id === id))
            .sort();
        for (const id of cycleIds) {
            invalidExtensionIds.add(id);
        }
        diagnostics.append(createHostDiagnostic({
            extensionCode: "EXTENSION_DEPENDENCY_CYCLE",
            numericCode: ExtensionHostDiagnosticCode.dependencyCycle,
            message: `Extension dependency cycle detected: ${cycleIds.join(", ")}.`,
            identity: `dependency-cycle:${cycleIds.join(",")}`,
        }));
    }
    propagateInvalidDependencies(extensionsById, invalidExtensionIds);
    return ordered.filter((extension) => !invalidExtensionIds.has(extension.identity.id));
}
function addOrderingEdge(outgoingEdges, incomingCounts, from, to) {
    const dependents = outgoingEdges.get(from);
    if (dependents === undefined || dependents.has(to)) {
        return;
    }
    dependents.add(to);
    incomingCounts.set(to, (incomingCounts.get(to) ?? 0) + 1);
}
function propagateInvalidDependencies(extensionsById, invalidExtensionIds) {
    let changed = true;
    while (changed) {
        changed = false;
        for (const extension of extensionsById.values()) {
            if (invalidExtensionIds.has(extension.identity.id)) {
                continue;
            }
            if ((extension.dependencies?.dependsOn ?? []).some((dependencyId) => invalidExtensionIds.has(dependencyId))) {
                invalidExtensionIds.add(extension.identity.id);
                changed = true;
            }
        }
    }
}
function callProvider(diagnostics, identity, operation, specifier, callback) {
    try {
        return { kind: "returned", value: callback() };
    }
    catch (error) {
        const numericCode = operation === "ownsModule"
            ? ExtensionHostDiagnosticCode.providerOwnershipFailed
            : operation === "resolveModule"
                ? ExtensionHostDiagnosticCode.providerResolveFailed
                : ExtensionHostDiagnosticCode.providerDeclarationFailed;
        const diagnostic = createHostDiagnostic({
            extensionCode: operation === "ownsModule"
                ? "PROVIDER_OWNERSHIP_FAILED"
                : operation === "resolveModule"
                    ? "PROVIDER_RESOLVE_FAILED"
                    : "PROVIDER_DECLARATION_FAILED",
            numericCode,
            message: `Provider '${identity.id}' failed during ${operation} for '${specifier}'.`,
            evidence: [
                { message: "Provider identity", details: identity },
                { message: "Thrown value", details: error },
            ],
            identity: `provider-call-failed:${operation}:${identity.id}:${specifier}`,
        });
        diagnostics.append(diagnostic);
        return { kind: "threw", diagnostic };
    }
}
function createHostDiagnostic(input) {
    return {
        extensionId: "tsts.extension-host",
        extensionCode: input.extensionCode,
        numericCode: input.numericCode,
        publicCode: `TSEXT${input.numericCode}`,
        category: "error",
        message: input.message,
        evidence: input.evidence ?? [],
        ...(input.identity !== undefined ? { identity: input.identity } : {}),
    };
}
function createRegistrationClosedDiagnostic(registrationKind) {
    return createHostDiagnostic({
        extensionCode: "EXTENSION_REGISTRATION_CLOSED",
        numericCode: ExtensionHostDiagnosticCode.registrationClosed,
        message: `Cannot register ${registrationKind} after extension execution has begun.`,
        evidence: [{ message: "Extension registrations become immutable before provider resolution or hook dispatch." }],
        identity: `extension-registration-closed:${registrationKind}`,
    });
}
function createProviderRegistrationLimitDiagnostic(registrationKind) {
    return createHostDiagnostic({
        extensionCode: "PROVIDER_REGISTRATION_LIMIT",
        numericCode: ExtensionHostDiagnosticCode.invalidProvider,
        message: `Cannot register ${registrationKind}: the provider registration limit is ${providerMaxRegisteredProviders}.`,
        evidence: [{ message: "Provider registration is bounded before compiler execution." }],
        identity: `provider-registration-limit:${registrationKind}:${providerMaxRegisteredProviders}`,
    });
}
function getDiagnosticIdentity(diagnostic) {
    return diagnostic.identity ?? [
        diagnostic.extensionId,
        diagnostic.extensionCode,
        diagnostic.numericCode,
        diagnostic.category,
        diagnostic.message,
    ].join(":");
}
function isValidDiagnosticRange(range) {
    return Number.isSafeInteger(range.start)
        && Number.isSafeInteger(range.end)
        && range.start > 0
        && range.start <= range.end;
}
function isDiagnosticCodeInRange(code, range) {
    return Number.isSafeInteger(code) && code >= range.start && code <= range.end;
}
function isExtensionFactSubject(subject) {
    return (typeof subject === "object" && subject !== null) || typeof subject === "function";
}
function diagnosticRangesOverlap(left, right) {
    return left.start <= right.end && right.start <= left.end;
}
function getProviderResolveCacheKey(identity, specifier, context) {
    return JSON.stringify([
        [identity.id, identity.version, identity.target, identity.extensionContractVersion, identity.providerKind ?? null, identity.configHash ?? null],
        getProviderRequestCacheKey(specifier, context),
    ]);
}
function getProviderPublicModuleEnvironmentKey(identity, specifier, context) {
    return JSON.stringify([
        [identity.id, identity.version, identity.target, identity.extensionContractVersion, identity.providerKind ?? null, identity.configHash ?? null],
        specifier,
        getExactOptionalPropertyTuple(context, "resolutionMode", context.resolutionMode),
        getExactOptionalPropertyTuple(context, "activeTarget", context.activeTarget),
        getExactOptionalPropertyTuple(context, "activeSurface", context.activeSurface),
    ]);
}
function getProviderRequestCacheKey(specifier, context) {
    const importSlice = context.importSlice;
    return JSON.stringify([
        specifier,
        getExactOptionalPropertyTuple(context, "containingFile", context.containingFile),
        getExactOptionalPropertyTuple(context, "resolutionMode", context.resolutionMode),
        getExactOptionalPropertyTuple(context, "activeTarget", context.activeTarget),
        getExactOptionalPropertyTuple(context, "activeSurface", context.activeSurface),
        getExactOptionalPropertyTuple(context, "importSlice", importSlice === undefined
            ? undefined
            : [
                importSlice.moduleSpecifier,
                importSlice.kind,
                getExactOptionalPropertyTuple(importSlice, "typeOnly", importSlice.typeOnly),
                getExactOptionalPropertyTuple(importSlice, "broadImport", importSlice.broadImport),
                getExactOptionalPropertyTuple(importSlice, "requestedExports", importSlice.requestedExports?.map((request) => [
                    request.exportedName,
                    getExactOptionalPropertyTuple(request, "localName", request.localName),
                    getExactOptionalPropertyTuple(request, "kind", request.kind),
                ])),
            ]),
    ]);
}
function snapshotProviderModuleContext(context) {
    let scalarCodeUnits = 0;
    const countString = (value, path) => {
        scalarCodeUnits += value.length;
        if (!Number.isSafeInteger(scalarCodeUnits) || scalarCodeUnits > providerBoundaryMaxTotalStringCodeUnits) {
            throw new Error(`${path} exceeds the total provider string limit of ${providerBoundaryMaxTotalStringCodeUnits} UTF-16 code units`);
        }
    };
    const hasContainingFile = Object.prototype.hasOwnProperty.call(context, "containingFile");
    const hasResolutionMode = Object.prototype.hasOwnProperty.call(context, "resolutionMode");
    const hasActiveTarget = Object.prototype.hasOwnProperty.call(context, "activeTarget");
    const hasActiveSurface = Object.prototype.hasOwnProperty.call(context, "activeSurface");
    const hasImportSlice = Object.prototype.hasOwnProperty.call(context, "importSlice");
    const importSlice = context.importSlice;
    const containingFile = context.containingFile;
    const resolutionMode = context.resolutionMode;
    const activeTarget = context.activeTarget;
    const activeSurface = context.activeSurface;
    const moduleSpecifier = importSlice?.moduleSpecifier;
    const kind = importSlice?.kind;
    const requestedExports = importSlice?.requestedExports;
    const broadImport = importSlice?.broadImport;
    const typeOnly = importSlice?.typeOnly;
    const hasRequestedExports = importSlice === undefined ? false : Object.prototype.hasOwnProperty.call(importSlice, "requestedExports");
    const hasBroadImport = importSlice === undefined ? false : Object.prototype.hasOwnProperty.call(importSlice, "broadImport");
    const hasTypeOnly = importSlice === undefined ? false : Object.prototype.hasOwnProperty.call(importSlice, "typeOnly");
    if (containingFile !== undefined) {
        assertProviderBoundaryString(containingFile, "context.containingFile", true);
        countString(containingFile, "context.containingFile");
    }
    if (resolutionMode !== undefined
        && resolutionMode !== "none"
        && resolutionMode !== "require"
        && resolutionMode !== "import") {
        throw new Error("resolutionMode must be 'none', 'require', or 'import' when present");
    }
    if (activeTarget !== undefined) {
        assertProviderBoundaryString(activeTarget, "context.activeTarget", false);
        countString(activeTarget, "context.activeTarget");
    }
    if (activeSurface !== undefined) {
        assertProviderBoundaryString(activeSurface, "context.activeSurface", false);
        countString(activeSurface, "context.activeSurface");
    }
    if (importSlice !== undefined
        && (typeof importSlice !== "object"
            || importSlice === null
            || typeof moduleSpecifier !== "string"
            || !isProviderImportSliceKind(kind)
            || (broadImport !== undefined && typeof broadImport !== "boolean")
            || (typeOnly !== undefined && typeof typeOnly !== "boolean")
            || (requestedExports !== undefined && !Array.isArray(requestedExports)))) {
        throw new Error("importSlice does not match the provider import-slice contract");
    }
    if (moduleSpecifier !== undefined) {
        assertProviderBoundaryString(moduleSpecifier, "context.importSlice.moduleSpecifier", false);
        countString(moduleSpecifier, "context.importSlice.moduleSpecifier");
    }
    let snapshotRequestedExports;
    if (requestedExports !== undefined) {
        if (requestedExports.length > providerBoundaryMaxArrayEntries) {
            throw new Error(`context.importSlice.requestedExports exceeds the provider array limit of ${providerBoundaryMaxArrayEntries}`);
        }
        const entries = [];
        for (let index = 0; index < requestedExports.length; index++) {
            const request = requestedExports[index];
            if (typeof request !== "object" || request === null) {
                throw new Error("requestedExports entries must be objects");
            }
            const hasLocalName = Object.prototype.hasOwnProperty.call(request, "localName");
            const hasKind = Object.prototype.hasOwnProperty.call(request, "kind");
            const exportedName = request.exportedName;
            const localName = request.localName;
            const requestKind = request.kind;
            assertProviderBoundaryString(exportedName, "context.importSlice.requestedExports[].exportedName", false);
            countString(exportedName, "context.importSlice.requestedExports[].exportedName");
            if (localName !== undefined) {
                assertProviderBoundaryString(localName, "context.importSlice.requestedExports[].localName", false);
                countString(localName, "context.importSlice.requestedExports[].localName");
            }
            if (requestKind !== undefined
                && requestKind !== "type"
                && requestKind !== "value"
                && requestKind !== "unknown") {
                throw new Error("requestedExports entry does not match the provider export-request contract");
            }
            entries.push(Object.freeze({
                exportedName,
                ...(hasLocalName ? { localName } : {}),
                ...(hasKind ? { kind: requestKind } : {}),
            }));
        }
        snapshotRequestedExports = Object.freeze(entries);
    }
    const snapshotImportSlice = importSlice === undefined
        ? undefined
        : Object.freeze({
            moduleSpecifier: moduleSpecifier,
            kind: kind,
            ...(hasRequestedExports
                ? {
                    requestedExports: snapshotRequestedExports,
                }
                : {}),
            ...(hasBroadImport ? { broadImport } : {}),
            ...(hasTypeOnly ? { typeOnly } : {}),
        });
    return Object.freeze({
        ...(hasContainingFile ? { containingFile } : {}),
        ...(hasResolutionMode ? { resolutionMode } : {}),
        ...(hasActiveTarget ? { activeTarget } : {}),
        ...(hasActiveSurface ? { activeSurface } : {}),
        ...(hasImportSlice ? { importSlice: snapshotImportSlice } : {}),
    });
}
function isProviderImportSliceKind(value) {
    return value === "bare"
        || value === "default"
        || value === "named"
        || value === "namespace"
        || value === "mixed"
        || value === "reexport"
        || value === "dynamic"
        || value === "synthetic"
        || value === "unknown";
}
function getExactOptionalPropertyTuple(owner, property, value) {
    return [
        Object.prototype.hasOwnProperty.call(owner, property),
        value === undefined ? ["undefined"] : ["value", value],
    ];
}
function getProviderVirtualModuleIdentity(provider, resolution, declarationModel) {
    return JSON.stringify([
        provider.id,
        provider.version,
        provider.target,
        provider.extensionContractVersion,
        provider.providerKind ?? "binding",
        provider.configHash ?? "",
        resolution.moduleSpecifier,
        declarationModel.moduleSpecifier,
        resolution.providerModuleId,
        declarationModel.providerModuleId,
        getExactOptionalPropertyTuple(resolution, "packageName", resolution.packageName),
        getExactOptionalPropertyTuple(resolution, "packageVersion", resolution.packageVersion),
    ]);
}
function freezeProviderDeclarationModel(model) {
    const frozen = new WeakSet();
    freezeProviderDeclarationModelNode(model, frozen);
    return model;
}
function freezeProviderDeclarationModelNode(model, frozen) {
    if (frozen.has(model)) {
        return;
    }
    frozen.add(model);
    for (const declaration of model.imports ?? []) {
        freezeProviderImportDeclaration(declaration, frozen);
    }
    for (const declaration of model.exports) {
        freezeProviderExportDeclaration(declaration, frozen);
    }
    for (const evidence of model.evidence ?? []) {
        Object.freeze(evidence);
    }
    freezeProviderArray(model.imports);
    freezeProviderArray(model.exports);
    freezeProviderArray(model.evidence);
    Object.freeze(model);
}
function freezeProviderImportDeclaration(declaration, frozen) {
    if (frozen.has(declaration)) {
        return;
    }
    frozen.add(declaration);
    for (const request of declaration.namedImports ?? []) {
        Object.freeze(request);
    }
    freezeProviderArray(declaration.namedImports);
    Object.freeze(declaration);
}
function freezeProviderExportDeclaration(declaration, frozen) {
    if (frozen.has(declaration)) {
        return;
    }
    frozen.add(declaration);
    if (declaration.sourceTypeFamily !== undefined) {
        Object.freeze(declaration.sourceTypeFamily);
    }
    if (declaration.targetIdentity !== undefined) {
        Object.freeze(declaration.targetIdentity);
    }
    if (declaration.type !== undefined) {
        freezeProviderTypeExpression(declaration.type, frozen);
    }
    for (const parameter of declaration.typeParameters ?? []) {
        freezeProviderTypeParameterDeclaration(parameter, frozen);
    }
    for (const heritage of declaration.heritage ?? []) {
        freezeProviderTypeExpression(heritage.type, frozen);
        Object.freeze(heritage);
    }
    for (const member of declaration.members ?? []) {
        freezeProviderMemberDeclaration(member, frozen);
    }
    for (const signature of declaration.signatures ?? []) {
        freezeProviderSignatureDeclaration(signature, frozen);
    }
    freezeProviderArray(declaration.typeParameters);
    freezeProviderArray(declaration.heritage);
    freezeProviderArray(declaration.members);
    freezeProviderArray(declaration.signatures);
    Object.freeze(declaration);
}
function freezeProviderMemberDeclaration(member, frozen) {
    if (frozen.has(member)) {
        return;
    }
    frozen.add(member);
    if (typeof member.name !== "string") {
        Object.freeze(member.name);
    }
    if (member.type !== undefined) {
        freezeProviderTypeExpression(member.type, frozen);
    }
    for (const signature of member.signatures ?? []) {
        freezeProviderSignatureDeclaration(signature, frozen);
    }
    freezeProviderArray(member.signatures);
    Object.freeze(member);
}
function freezeProviderSignatureDeclaration(signature, frozen) {
    if (frozen.has(signature)) {
        return;
    }
    frozen.add(signature);
    for (const parameter of signature.parameters) {
        freezeProviderParameterDeclaration(parameter, frozen);
    }
    if (signature.returnType !== undefined) {
        freezeProviderTypeExpression(signature.returnType, frozen);
    }
    for (const parameter of signature.typeParameters ?? []) {
        freezeProviderTypeParameterDeclaration(parameter, frozen);
    }
    freezeProviderArray(signature.parameters);
    freezeProviderArray(signature.typeParameters);
    Object.freeze(signature);
}
function freezeProviderParameterDeclaration(parameter, frozen) {
    if (frozen.has(parameter)) {
        return;
    }
    frozen.add(parameter);
    freezeProviderTypeExpression(parameter.type, frozen);
    if (parameter.defaultType !== undefined) {
        freezeProviderTypeExpression(parameter.defaultType, frozen);
    }
    Object.freeze(parameter);
}
function freezeProviderTypeParameterDeclaration(parameter, frozen) {
    if (frozen.has(parameter)) {
        return;
    }
    frozen.add(parameter);
    for (const constraint of parameter.constraints ?? []) {
        freezeProviderTypeExpression(constraint, frozen);
    }
    if (parameter.defaultType !== undefined) {
        freezeProviderTypeExpression(parameter.defaultType, frozen);
    }
    freezeProviderArray(parameter.constraints);
    Object.freeze(parameter);
}
function freezeProviderTypeExpression(type, frozen) {
    if (frozen.has(type)) {
        return;
    }
    frozen.add(type);
    switch (type.kind) {
        case "target-named":
            for (const argument of type.typeArguments ?? []) {
                freezeProviderTypeExpression(argument, frozen);
            }
            if (type.sourceShape !== undefined) {
                freezeProviderTypeExpression(type.sourceShape, frozen);
            }
            freezeProviderArray(type.typeArguments);
            break;
        case "array":
            freezeProviderTypeExpression(type.elementType, frozen);
            break;
        case "tuple":
            for (const element of type.elementTypes) {
                freezeProviderTypeExpression(element, frozen);
            }
            freezeProviderArray(type.elementTypes);
            break;
        case "union":
        case "intersection":
            for (const member of type.types) {
                freezeProviderTypeExpression(member, frozen);
            }
            freezeProviderArray(type.types);
            break;
        case "function":
            for (const parameter of type.parameters) {
                freezeProviderParameterDeclaration(parameter, frozen);
            }
            freezeProviderTypeExpression(type.returnType, frozen);
            for (const parameter of type.typeParameters ?? []) {
                freezeProviderTypeParameterDeclaration(parameter, frozen);
            }
            freezeProviderArray(type.parameters);
            freezeProviderArray(type.typeParameters);
            break;
        case "provider-ref":
            for (const argument of type.typeArguments ?? []) {
                freezeProviderTypeExpression(argument, frozen);
            }
            freezeProviderArray(type.typeArguments);
            break;
        case "opaque":
            if (type.sourceShape !== undefined) {
                freezeProviderTypeExpression(type.sourceShape, frozen);
            }
            break;
        default:
            break;
    }
    Object.freeze(type);
}
function freezeProviderArray(values) {
    if (values !== undefined) {
        Object.freeze(values);
    }
}
function snapshotProviderIdentity(identity) {
    if (typeof identity !== "object" || identity === null) {
        throw new Error("provider identity must be an object");
    }
    const id = identity.id;
    const version = identity.version;
    const target = identity.target;
    const extensionContractVersion = identity.extensionContractVersion;
    const providerKind = identity.providerKind;
    const diagnosticRange = identity.diagnosticRange;
    const configHash = identity.configHash;
    const displayName = identity.displayName;
    assertProviderBoundaryString(id, "identity.id", false);
    assertProviderBoundaryString(version, "identity.version", false);
    assertProviderBoundaryString(target, "identity.target", false);
    assertProviderBoundaryString(extensionContractVersion, "identity.extensionContractVersion", false);
    if (providerKind !== undefined && providerKind !== "binding" && providerKind !== "semantic" && providerKind !== "combined") {
        throw new Error("identity.providerKind must be 'binding', 'semantic', or 'combined' when present");
    }
    if (configHash !== undefined) {
        assertProviderBoundaryString(configHash, "identity.configHash", true);
    }
    if (displayName !== undefined) {
        assertProviderBoundaryString(displayName, "identity.displayName", false);
    }
    const identityScalarCodeUnits = id.length
        + version.length
        + target.length
        + extensionContractVersion.length
        + (configHash?.length ?? 0)
        + (displayName?.length ?? 0);
    if (!Number.isSafeInteger(identityScalarCodeUnits)
        || identityScalarCodeUnits > providerBoundaryMaxTotalStringCodeUnits) {
        throw new Error(`provider identity exceeds the total string limit of ${providerBoundaryMaxTotalStringCodeUnits} UTF-16 code units`);
    }
    if (diagnosticRange !== undefined && (typeof diagnosticRange !== "object" || diagnosticRange === null)) {
        throw new Error("identity.diagnosticRange must be an object when present");
    }
    const diagnosticStart = diagnosticRange?.start;
    const diagnosticEnd = diagnosticRange?.end;
    if (diagnosticRange !== undefined
        && (!Number.isSafeInteger(diagnosticStart)
            || !Number.isSafeInteger(diagnosticEnd)
            || diagnosticStart <= 0
            || diagnosticStart > diagnosticEnd)) {
        throw new Error("identity.diagnosticRange must contain a valid positive integer range");
    }
    return Object.freeze({
        id,
        version,
        target,
        extensionContractVersion,
        ...(providerKind === undefined ? {} : { providerKind }),
        ...(diagnosticRange === undefined
            ? {}
            : { diagnosticRange: Object.freeze({ start: diagnosticStart, end: diagnosticEnd }) }),
        ...(configHash === undefined ? {} : { configHash }),
        ...(displayName === undefined ? {} : { displayName }),
    });
}
function snapshotTargetBindingProviderRegistration(provider) {
    try {
        const identity = snapshotProviderIdentity(provider.identity);
        const ownsModule = provider.ownsModule;
        const resolveModule = provider.resolveModule;
        const getDeclarationModel = provider.getDeclarationModel;
        if (typeof ownsModule !== "function") {
            return { kind: "invalid", reason: "ownsModule must be a function" };
        }
        if (typeof resolveModule !== "function") {
            return { kind: "invalid", reason: "resolveModule must be a function" };
        }
        if (typeof getDeclarationModel !== "function") {
            return { kind: "invalid", reason: "getDeclarationModel must be a function" };
        }
        return {
            kind: "valid",
            provider: Object.freeze({
                identity,
                ownsModule: (specifier, context) => ownsModule.call(provider, specifier, context),
                resolveModule: (specifier, context) => resolveModule.call(provider, specifier, context),
                getDeclarationModel: (module) => getDeclarationModel.call(provider, module),
            }),
        };
    }
    catch (error) {
        return {
            kind: "invalid",
            reason: error instanceof Error ? error.message : String(error),
        };
    }
}
function snapshotTargetSemanticProviderRegistration(provider) {
    try {
        const identity = snapshotProviderIdentity(provider.identity);
        const validateTargetConstraint = provider.validateTargetConstraint;
        const observePostCheckAssignability = provider.observePostCheckAssignability;
        const mapCheckedCall = provider.mapCheckedCall;
        const mapInferredSourceTypeArgumentsToTarget = provider.mapInferredSourceTypeArgumentsToTarget;
        const mapCheckedPropertyAccess = provider.mapCheckedPropertyAccess;
        const mapCheckedElementAccess = provider.mapCheckedElementAccess;
        const mapCheckedOperator = provider.mapCheckedOperator;
        const mapCheckedIteration = provider.mapCheckedIteration;
        const recordContextualTargetType = provider.recordContextualTargetType;
        const mapCheckedConversion = provider.mapCheckedConversion;
        const resolveParameterPassing = provider.resolveParameterPassing;
        const resolveRuntimeCarrier = provider.resolveRuntimeCarrier;
        const validateExtensionFlowUse = provider.validateExtensionFlowUse;
        const handlers = {
            validateTargetConstraint,
            observePostCheckAssignability,
            mapCheckedCall,
            mapInferredSourceTypeArgumentsToTarget,
            mapCheckedPropertyAccess,
            mapCheckedElementAccess,
            mapCheckedOperator,
            mapCheckedIteration,
            recordContextualTargetType,
            mapCheckedConversion,
            resolveParameterPassing,
            resolveRuntimeCarrier,
            validateExtensionFlowUse,
        };
        for (const [name, handler] of Object.entries(handlers)) {
            if (handler !== undefined && typeof handler !== "function") {
                return { kind: "invalid", reason: `${name} must be a function when present` };
            }
        }
        const bind = (handler) => (handler === undefined
            ? undefined
            : ((request, context) => handler.call(provider, request, context)));
        return {
            kind: "valid",
            provider: Object.freeze({
                identity,
                ...(validateTargetConstraint === undefined ? {} : { validateTargetConstraint: bind(validateTargetConstraint) }),
                ...(observePostCheckAssignability === undefined ? {} : { observePostCheckAssignability: bind(observePostCheckAssignability) }),
                ...(mapCheckedCall === undefined ? {} : { mapCheckedCall: bind(mapCheckedCall) }),
                ...(mapInferredSourceTypeArgumentsToTarget === undefined ? {} : { mapInferredSourceTypeArgumentsToTarget: bind(mapInferredSourceTypeArgumentsToTarget) }),
                ...(mapCheckedPropertyAccess === undefined ? {} : { mapCheckedPropertyAccess: bind(mapCheckedPropertyAccess) }),
                ...(mapCheckedElementAccess === undefined ? {} : { mapCheckedElementAccess: bind(mapCheckedElementAccess) }),
                ...(mapCheckedOperator === undefined ? {} : { mapCheckedOperator: bind(mapCheckedOperator) }),
                ...(mapCheckedIteration === undefined ? {} : { mapCheckedIteration: bind(mapCheckedIteration) }),
                ...(recordContextualTargetType === undefined ? {} : { recordContextualTargetType: bind(recordContextualTargetType) }),
                ...(mapCheckedConversion === undefined ? {} : { mapCheckedConversion: bind(mapCheckedConversion) }),
                ...(resolveParameterPassing === undefined ? {} : { resolveParameterPassing: bind(resolveParameterPassing) }),
                ...(resolveRuntimeCarrier === undefined ? {} : { resolveRuntimeCarrier: bind(resolveRuntimeCarrier) }),
                ...(validateExtensionFlowUse === undefined ? {} : { validateExtensionFlowUse: bind(validateExtensionFlowUse) }),
            }),
        };
    }
    catch (error) {
        return { kind: "invalid", reason: error instanceof Error ? error.message : String(error) };
    }
}
function providerIdentityEquals(left, right) {
    return JSON.stringify(snapshotProviderIdentity(left)) === JSON.stringify(snapshotProviderIdentity(right));
}
function getProviderDeclarationModelExportNames(model) {
    return [...new Set(model.exports.map(getProviderSourceExportName))].sort();
}
function getProviderPublicVirtualSliceFileName(moduleIdentity, sourceText) {
    return `${providerVirtualPublicRoot}${getStableProviderVirtualSliceSuffix(moduleIdentity)}${providerPublicVirtualSliceMarker}${getStableProviderVirtualSliceSuffix(`${moduleIdentity}\0${sourceText}`)}.d.ts`;
}
function getProviderPublicVirtualArtifactId(moduleIdentity, sourceText) {
    return `provider-public:${getStableProviderVirtualSliceSuffix(moduleIdentity)}:${getStableProviderVirtualSliceSuffix(`${moduleIdentity}\0${sourceText}`)}`;
}
function getStableProviderVirtualSliceSuffix(value) {
    const hashes = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35];
    for (let index = 0; index < value.length; index++) {
        const code = value.charCodeAt(index);
        for (let hashIndex = 0; hashIndex < hashes.length; hashIndex++) {
            hashes[hashIndex] = Math.imul((hashes[hashIndex] ^ code ^ hashIndex), 0x01000193);
        }
    }
    return hashes.map((hash) => (hash >>> 0).toString(36).padStart(7, "0")).join("");
}
function orderStablePair(left, right) {
    return left <= right ? [left, right] : [right, left];
}
function createProviderCanonicalExportPlanningState() {
    return {
        registeredCandidateRequestKeys: new Set(),
        planningCandidatesByRequestKey: new Map(),
        virtualFileIdentities: new Map(),
        exportContracts: new Map(),
        ownersByExportIdentity: new Map(),
        ownerFileNames: new Set(),
        ownerVisitQueue: [],
        ownerVisitsByKey: new Map(),
        classEdges: new Map(),
        classNodeLabels: new Map(),
        publicModuleIdentitiesByEnvironmentKey: new Map(),
        candidateCount: 0,
        exportCount: 0,
        referenceCount: 0,
        expandedSemanticNodeCount: 0,
        scalarCodeUnitCount: 0,
    };
}
const providerPlanningMaxCandidates = 4_096;
const providerPlanningMaxExports = 65_536;
const providerPlanningMaxOwnerVisits = 65_536;
const providerPlanningMaxReferences = 65_536;
const providerPlanningMaxExpandedSemanticNodes = providerBoundaryMaxArrayEntries;
const providerPlanningMaxScalarCodeUnits = providerBoundaryMaxTotalStringCodeUnits;
function getProviderPlanningExportIdentity(moduleIdentity, exportName) {
    return `${moduleIdentity}\0${exportName}`;
}
function findProviderCanonicalExportOwnerAncestor(startVisitKey, targetExportIdentity, state) {
    let visitKey = startVisitKey;
    const visited = new Set();
    while (visitKey !== undefined) {
        if (visited.has(visitKey)) {
            return { kind: "invalid", missingVisitKey: visitKey };
        }
        visited.add(visitKey);
        const visit = state.ownerVisitsByKey.get(visitKey);
        if (visit === undefined) {
            return { kind: "invalid", missingVisitKey: visitKey };
        }
        if (visit.owner.exportIdentity === targetExportIdentity) {
            return { kind: "found", visit };
        }
        visitKey = visit.parentKey;
    }
    return { kind: "none" };
}
function getProviderCanonicalDependencyEnvironmentKey(candidate) {
    return JSON.stringify([candidate.publicModuleEnvironmentKey, candidate.moduleIdentity]);
}
function getProviderCanonicalExportOwnerContractKey(moduleIdentity, model) {
    const contracts = [...getProviderExportContractKeyMap(model.moduleSpecifier, model.exports)];
    return JSON.stringify([moduleIdentity, contracts]);
}
function getProviderReferenceDependencyContext(candidate, reference, valueRequired, sourceArtifactFileName) {
    return {
        ...(candidate.context.activeTarget !== undefined ? { activeTarget: candidate.context.activeTarget } : {}),
        ...(candidate.context.activeSurface !== undefined ? { activeSurface: candidate.context.activeSurface } : {}),
        ...(candidate.context.resolutionMode !== undefined ? { resolutionMode: candidate.context.resolutionMode } : {}),
        containingFile: sourceArtifactFileName,
        importSlice: {
            moduleSpecifier: reference.moduleSpecifier,
            kind: "synthetic",
            requestedExports: [{ exportedName: reference.exportName, kind: valueRequired ? "value" : "type" }],
            typeOnly: !valueRequired,
        },
    };
}
function createProviderCanonicalExportDeclarationModelMap(model) {
    const declarationsBySourceExportName = new Map();
    for (const declaration of model.exports) {
        const sourceExportName = getProviderSourceExportName(declaration);
        const declarations = declarationsBySourceExportName.get(sourceExportName);
        if (declarations === undefined) {
            declarationsBySourceExportName.set(sourceExportName, [declaration]);
        }
        else {
            declarations.push(declaration);
        }
    }
    return new Map([...declarationsBySourceExportName]
        .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
        .map(([sourceExportName, declarations]) => [sourceExportName, freezeProviderDeclarationModel(canonicalizeProviderAbiModel({
            moduleSpecifier: model.moduleSpecifier,
            providerModuleId: model.providerModuleId,
            exports: declarations.every((declaration) => declaration.sourceTypeFamily !== undefined)
                ? [...declarations].sort((left, right) => left.sourceTypeFamily.typeArgumentCount - right.sourceTypeFamily.typeArgumentCount)
                : declarations,
        }))]));
}
function collectProviderDeclarationReferenceUses(declarations) {
    const uses = [];
    for (const declaration of declarations) {
        const visitTypeParameters = (parameters) => {
            for (const parameter of parameters) {
                for (const constraint of parameter.constraints ?? []) {
                    visitType(constraint, false);
                }
                if (parameter.defaultType !== undefined) {
                    visitType(parameter.defaultType, false);
                }
            }
        };
        const visitParameters = (parameters) => {
            for (const parameter of parameters) {
                visitType(parameter.type, false);
                if (parameter.defaultType !== undefined) {
                    visitType(parameter.defaultType, false);
                }
            }
        };
        const visitSignatures = (signatures) => {
            for (const signature of signatures) {
                visitTypeParameters(signature.typeParameters ?? []);
                visitParameters(signature.parameters);
                if (signature.returnType !== undefined) {
                    visitType(signature.returnType, false);
                }
            }
        };
        const visitType = (type, valueHeritage) => {
            switch (type.kind) {
                case "any":
                case "unknown":
                case "void":
                case "never":
                case "undefined":
                case "boolean":
                case "string":
                case "number":
                case "bigint":
                case "object":
                case "source-primitive":
                case "type-parameter":
                case "literal":
                    return;
                case "target-named":
                    for (const typeArgument of type.typeArguments ?? []) {
                        visitType(typeArgument, false);
                    }
                    if (type.sourceShape !== undefined) {
                        visitType(type.sourceShape, valueHeritage);
                    }
                    return;
                case "opaque":
                    if (type.sourceShape !== undefined) {
                        visitType(type.sourceShape, valueHeritage);
                    }
                    return;
                case "array":
                    visitType(type.elementType, false);
                    return;
                case "tuple":
                    for (const elementType of type.elementTypes) {
                        visitType(elementType, false);
                    }
                    return;
                case "union":
                case "intersection":
                    for (const memberType of type.types) {
                        visitType(memberType, false);
                    }
                    return;
                case "function":
                    visitTypeParameters(type.typeParameters ?? []);
                    visitParameters(type.parameters);
                    visitType(type.returnType, false);
                    return;
                case "provider-ref":
                    uses.push({ declaration, reference: type, valueHeritage });
                    for (const typeArgument of type.typeArguments ?? []) {
                        visitType(typeArgument, false);
                    }
                    return;
            }
        };
        visitTypeParameters(declaration.typeParameters ?? []);
        if (declaration.type !== undefined) {
            visitType(declaration.type, false);
        }
        for (const heritage of declaration.heritage ?? []) {
            visitType(heritage.type, declaration.kind === "class" && heritage.kind === "extends");
        }
        for (const member of declaration.members ?? []) {
            if (member.type !== undefined) {
                visitType(member.type, false);
            }
            visitSignatures(member.signatures ?? []);
        }
        visitSignatures(declaration.signatures ?? []);
    }
    return uses;
}
function compareProviderDeclarationReferenceUses(left, right) {
    const key = (use) => JSON.stringify([
        getProviderSourceExportName(use.declaration),
        use.declaration.sourceTypeFamily?.typeArgumentCount ?? null,
        use.valueHeritage,
        use.reference.moduleSpecifier,
        use.reference.exportName,
        use.reference.typeArguments?.length ?? 0,
        use.reference.localName ?? "",
        use.reference.namespaceImport ?? "",
    ]);
    const leftKey = key(left);
    const rightKey = key(right);
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
}
function selectProviderDeclarationForReference(candidate, reference) {
    const groups = collectProviderTypeFamilyRenderGroups(candidate.declarationModel.exports);
    const typeArgumentCount = reference.typeArguments?.length ?? 0;
    const variant = getProviderTypeFamilyVariantExportMap(candidate.declarationModel.moduleSpecifier, groups).get(getProviderRefKey(candidate.declarationModel.moduleSpecifier, reference.exportName, typeArgumentCount));
    if (variant !== undefined) {
        return isProviderDeclarationTypeCapable(variant)
            ? { kind: "selected", declaration: variant }
            : { kind: "non-type" };
    }
    const family = getProviderTypeFamilyForReference(groups, reference.exportName);
    if (family !== undefined) {
        return {
            kind: "missing-arity",
            availableArities: family.variants.map((candidateVariant) => candidateVariant.sourceTypeFamily.typeArgumentCount),
        };
    }
    const declaration = candidate.declarationModel.exports.find((candidateDeclaration) => candidateDeclaration.sourceTypeFamily === undefined
        && (getProviderSourceExportName(candidateDeclaration) === reference.exportName
            || getProviderExportName(candidateDeclaration) === reference.exportName));
    if (declaration === undefined) {
        return { kind: "missing" };
    }
    if (!isProviderDeclarationTypeCapable(declaration)) {
        return { kind: "non-type" };
    }
    const arity = getProviderClassArity(declaration);
    return typeArgumentCount >= arity.required && typeArgumentCount <= arity.maximum
        ? { kind: "selected", declaration }
        : {
            kind: "wrong-declaration-arity",
            requiredTypeArgumentCount: arity.required,
            maximumTypeArgumentCount: arity.maximum,
        };
}
function isProviderDeclarationTypeCapable(declaration) {
    return declaration.kind === "class"
        || declaration.kind === "interface"
        || declaration.kind === "type"
        || declaration.kind === "enum";
}
function getProviderClassArity(declaration) {
    const typeParameters = declaration.typeParameters ?? [];
    const firstDefault = typeParameters.findIndex((parameter) => parameter.defaultType !== undefined);
    return {
        required: firstDefault < 0 ? typeParameters.length : firstDefault,
        maximum: typeParameters.length,
    };
}
function formatProviderClassArityRange(required, maximum) {
    return required === maximum
        ? `${required} source type argument(s)`
        : `${required} to ${maximum} source type argument(s)`;
}
function getProviderClassNodeKey(moduleIdentity, declaration) {
    return JSON.stringify([
        moduleIdentity,
        getProviderSourceExportName(declaration),
        declaration.sourceTypeFamily?.typeArgumentCount ?? null,
    ]);
}
function getProviderClassNodeLabel(model, declaration) {
    const family = declaration.sourceTypeFamily;
    return family === undefined
        ? `${model.moduleSpecifier}#${getProviderSourceExportName(declaration)}`
        : `${model.moduleSpecifier}#${family.exportName}/${family.typeArgumentCount}`;
}
function addProviderClassHeritageEdge(graph, source, target) {
    const targets = graph.get(source);
    if (targets === undefined) {
        graph.set(source, new Set([target]));
    }
    else {
        targets.add(target);
    }
    if (!graph.has(target)) {
        graph.set(target, new Set());
    }
}
function findProviderClassHeritageCycle(graph) {
    const complete = new Set();
    const activeIndexes = new Map();
    const nodes = [...graph.keys()].sort();
    for (const start of nodes) {
        if (complete.has(start)) {
            continue;
        }
        const stack = [{
                node: start,
                targets: [...(graph.get(start) ?? [])].sort(),
                nextTarget: 0,
            }];
        activeIndexes.set(start, 0);
        while (stack.length > 0) {
            const frame = stack[stack.length - 1];
            if (frame.nextTarget >= frame.targets.length) {
                complete.add(frame.node);
                activeIndexes.delete(frame.node);
                stack.pop();
                continue;
            }
            const target = frame.targets[frame.nextTarget++];
            const activeIndex = activeIndexes.get(target);
            if (activeIndex !== undefined) {
                return [...stack.slice(activeIndex).map((entry) => entry.node), target];
            }
            if (complete.has(target)) {
                continue;
            }
            activeIndexes.set(target, stack.length);
            stack.push({
                node: target,
                targets: [...(graph.get(target) ?? [])].sort(),
                nextTarget: 0,
            });
        }
    }
    return undefined;
}
function getProviderValueHeritageReference(type) {
    if (type.kind === "target-named" || type.kind === "opaque") {
        return type.sourceShape === undefined ? undefined : getProviderValueHeritageReference(type.sourceShape);
    }
    return type.kind === "provider-ref" ? type : undefined;
}
function collectProviderRenderedLocalNames(model) {
    const names = new Set([
        providerTypeFamilyDefaultValueName,
        providerTypeFamilyDefaultTypeName,
        providerTypeFamilyIsAnyTypeName,
        providerTypeFamilyIsDefaultTypeName,
    ]);
    for (const declaration of model.imports ?? []) {
        if (declaration.defaultImport !== undefined) {
            names.add(declaration.defaultImport);
        }
        if (declaration.namespaceImport !== undefined) {
            names.add(declaration.namespaceImport);
        }
        for (const namedImport of declaration.namedImports ?? []) {
            names.add(namedImport.localName ?? namedImport.exportedName);
        }
    }
    for (const declaration of model.exports) {
        names.add(declaration.name);
        names.add(getProviderExportName(declaration));
        names.add(getProviderSourceExportName(declaration));
        names.add(getProviderCanonicalExportLocalName(getProviderSourceExportName(declaration)));
        if (declaration.sourceTypeFamily !== undefined) {
            names.add(getProviderTypeFamilyVariantLocalName(declaration));
        }
    }
    return names;
}
function allocateProviderExactImportLocalName(reference, usedNames) {
    const typeArgumentCount = reference.typeArguments?.length ?? 0;
    const identifier = reference.exportName.replace(/[^A-Za-z0-9_$]/g, "_");
    const stem = `__TstsProviderExact_${identifier === "" || /^[0-9]/.test(identifier) ? `_${identifier}` : identifier}_${typeArgumentCount}_${getStableProviderVirtualSliceSuffix(reference.moduleSpecifier)}`;
    let candidate = stem;
    let disambiguator = 1;
    while (usedNames.has(candidate)) {
        disambiguator += 1;
        candidate = `${stem}_${disambiguator}`;
    }
    usedNames.add(candidate);
    return candidate;
}
function getProviderTypeFamilyForReference(groups, exportName) {
    const direct = groups.get(exportName);
    if (direct !== undefined) {
        return direct;
    }
    const matches = [...groups.values()].filter((group) => group.variants.some((variant) => getProviderExportName(variant) === exportName));
    return matches.length === 1 ? matches[0] : undefined;
}
function getProviderCanonicalExportOwnerFileName(moduleIdentity, sourceExportName) {
    const moduleSuffix = getStableProviderVirtualSliceSuffix(moduleIdentity);
    const exportSuffix = getStableProviderVirtualSliceSuffix(`${moduleIdentity}\0${sourceExportName}`);
    return `${providerVirtualInternalRoot}${moduleSuffix}${providerCanonicalExportOwnerMarker}${exportSuffix}.d.ts`;
}
function getProviderCanonicalExportOwnerArtifactId(exportIdentity) {
    return `provider-owner:${encodeURIComponent(exportIdentity)}`;
}
function getCanonicalProviderExportOwnerResolution(plan) {
    const resolution = plan.candidate.resolution;
    return {
        kind: "virtual",
        moduleSpecifier: resolution.moduleSpecifier,
        virtualFileName: plan.fileName,
        providerModuleId: resolution.providerModuleId,
        ...(resolution.packageName === undefined ? {} : { packageName: resolution.packageName }),
        ...(resolution.packageVersion === undefined ? {} : { packageVersion: resolution.packageVersion }),
    };
}
function createInvalidProviderDeclarationDiagnostic(provider, model, message, identity, evidence = []) {
    return createHostDiagnostic({
        extensionCode: "INVALID_PROVIDER_DECLARATION_MODEL",
        numericCode: ExtensionHostDiagnosticCode.invalidProviderDeclaration,
        message,
        evidence: [
            { message: "Provider", details: provider },
            { message: "Provider declaration module", details: { moduleSpecifier: model.moduleSpecifier, providerModuleId: model.providerModuleId } },
            ...evidence,
        ],
        identity,
    });
}
function renderProviderDeclarationModel(model, options = {}) {
    const lines = [
        `// @tsts-provider-module ${model.providerModuleId}`,
        `// @tsts-provider-specifier ${JSON.stringify(model.moduleSpecifier)}`,
    ];
    const typeFamilyGroups = collectProviderTypeFamilyRenderGroups(model.exports);
    const canonicalLocalNameByExportName = getProviderCanonicalExportLocalNameMap(options.canonicalExports ?? new Map());
    const renderContext = {
        moduleSpecifier: model.moduleSpecifier,
        canonicalLocalNameByExportName,
        localDeclarationNameByExportName: options.mode === "canonical-export"
            ? getProviderCanonicalDeclarationLocalNameMap(model.exports)
            : getProviderLocalDeclarationNameByExportName(model.exports),
        typeFamilyVariantByProviderRefKey: getProviderTypeFamilyVariantExportMap(model.moduleSpecifier, typeFamilyGroups),
        exactImportLocalNameByProviderRefKey: new Map([...(options.exactImports ?? new Map())].map(([key, binding]) => [key, binding.localName])),
        exactImportsInTypePositions: options.exactImportsInTypePositions === true,
    };
    const hasDirectDeclarations = model.exports.some((declaration) => !canonicalLocalNameByExportName.has(getProviderSourceExportName(declaration)));
    if (options.mode === "canonical-export" || hasDirectDeclarations) {
        for (const importDeclaration of model.imports ?? []) {
            lines.push(renderProviderImportDeclaration(importDeclaration));
        }
    }
    for (const binding of [...(options.exactImports?.values() ?? [])]
        .sort((left, right) => left.localName < right.localName ? -1 : left.localName > right.localName ? 1 : 0)) {
        lines.push(`import ${binding.typeOnly ? "type " : ""}{ ${binding.exportedName} as ${binding.localName} } from ${JSON.stringify(binding.fileName)};`);
    }
    for (const [exportName, localName] of canonicalLocalNameByExportName) {
        const canonicalExport = options.canonicalExports?.get(exportName);
        if (canonicalExport !== undefined) {
            lines.push(`import ${canonicalExport.typeOnly ? "type " : ""}{ ${exportName} as ${localName} } from ${JSON.stringify(canonicalExport.fileName)};`);
        }
    }
    if (typeFamilyGroups.size > 0 && (options.mode === "canonical-export"
        || [...typeFamilyGroups.keys()].some((exportName) => !canonicalLocalNameByExportName.has(exportName)))) {
        lines.push(`declare const ${providerTypeFamilyDefaultValueName}: unique symbol;`);
        lines.push(`type ${providerTypeFamilyDefaultTypeName} = typeof ${providerTypeFamilyDefaultValueName};`);
        lines.push(`type ${providerTypeFamilyIsAnyTypeName}<T> = 0 extends (1 & T) ? true : false;`);
        lines.push(`type ${providerTypeFamilyIsDefaultTypeName}<T> = ${providerTypeFamilyIsAnyTypeName}<T> extends true ? false : [T] extends [${providerTypeFamilyDefaultTypeName}] ? [${providerTypeFamilyDefaultTypeName}] extends [T] ? true : false : false;`);
    }
    if (options.mode !== "canonical-export" && !hasDirectDeclarations) {
        for (const [exportName, localName] of canonicalLocalNameByExportName) {
            const canonicalExport = options.canonicalExports.get(exportName);
            lines.push(`export ${canonicalExport.typeOnly ? "type " : ""}{ ${localName} as ${exportName} };`);
        }
        return `${lines.join("\n")}\n`;
    }
    const renderedFamilies = new Set();
    const renderedCanonicalExports = new Set();
    for (const exportDeclaration of model.exports) {
        const exportName = getProviderSourceExportName(exportDeclaration);
        if (options.mode === "canonical-export") {
            if (exportDeclaration.sourceTypeFamily !== undefined) {
                const familyName = exportDeclaration.sourceTypeFamily.exportName;
                if (!renderedFamilies.has(familyName)) {
                    const family = typeFamilyGroups.get(familyName);
                    if (family !== undefined) {
                        lines.push(renderProviderTypeFamilyDeclaration(family, renderContext));
                        renderedFamilies.add(familyName);
                    }
                }
            }
            else {
                lines.push(renderProviderExportDeclaration(exportDeclaration, renderContext, {
                    localName: renderContext.localDeclarationNameByExportName.get(exportName),
                }));
            }
            continue;
        }
        const canonicalLocalName = canonicalLocalNameByExportName.get(exportName);
        if (canonicalLocalName !== undefined) {
            if (exportDeclaration.sourceTypeFamily !== undefined) {
                const familyName = exportDeclaration.sourceTypeFamily.exportName;
                renderedFamilies.add(familyName);
            }
            if (!renderedCanonicalExports.has(exportName)) {
                const canonicalExport = options.canonicalExports?.get(exportName);
                lines.push(`export ${canonicalExport?.typeOnly === true ? "type " : ""}{ ${canonicalLocalName} as ${exportName} };`);
                renderedCanonicalExports.add(exportName);
            }
            continue;
        }
        if (exportDeclaration.sourceTypeFamily !== undefined) {
            const familyName = exportDeclaration.sourceTypeFamily.exportName;
            if (!renderedFamilies.has(familyName)) {
                const family = typeFamilyGroups.get(familyName);
                if (family !== undefined) {
                    lines.push(renderProviderTypeFamilyDeclaration(family, renderContext));
                    renderedFamilies.add(familyName);
                }
            }
            continue;
        }
        lines.push(renderProviderExportDeclaration(exportDeclaration, renderContext));
    }
    if (options.mode === "canonical-export") {
        lines.push(renderProviderTypeFamilyVariantExports(typeFamilyGroups));
    }
    return `${lines.join("\n")}\n`;
}
function renderProviderImportDeclaration(declaration) {
    const typePrefix = declaration.typeOnly === true ? "type " : "";
    const defaultImport = declaration.defaultImport;
    if (declaration.namespaceImport !== undefined) {
        const defaultPrefix = defaultImport === undefined ? "" : `${defaultImport}, `;
        return `import ${typePrefix}${defaultPrefix}* as ${declaration.namespaceImport} from ${JSON.stringify(declaration.moduleSpecifier)};`;
    }
    const namedImports = declaration.namedImports ?? [];
    if (namedImports.length === 0 && defaultImport !== undefined) {
        return `import ${typePrefix}${defaultImport} from ${JSON.stringify(declaration.moduleSpecifier)};`;
    }
    const names = namedImports.map((request) => request.localName !== undefined && request.localName !== request.exportedName
        ? `${request.exportedName} as ${request.localName}`
        : request.exportedName).join(", ");
    const defaultPrefix = defaultImport === undefined ? "" : `${defaultImport}, `;
    return `import ${typePrefix}${defaultPrefix}{ ${names} } from ${JSON.stringify(declaration.moduleSpecifier)};`;
}
const providerTypeFamilyDefaultValueName = "__tstsProviderTypeFamilyDefault";
const providerTypeFamilyDefaultTypeName = "__TstsProviderTypeFamilyDefault";
const providerTypeFamilyIsAnyTypeName = "__TstsProviderTypeFamilyIsAny";
const providerTypeFamilyIsDefaultTypeName = "__TstsProviderTypeFamilyIsDefault";
function getProviderCanonicalExportLocalNameMap(canonicalExports) {
    return new Map([...canonicalExports.keys()]
        .sort()
        .map((exportName) => [exportName, getProviderCanonicalExportLocalName(exportName)]));
}
function getProviderExportTypeOnlyMap(exports) {
    const result = new Map();
    const typeFamilies = collectProviderTypeFamilyRenderGroups(exports);
    for (const declaration of exports) {
        const exportName = getProviderSourceExportName(declaration);
        if (result.has(exportName)) {
            continue;
        }
        const typeOnly = declaration.sourceTypeFamily === undefined
            ? declaration.kind === "interface" || declaration.kind === "type"
            : typeFamilies.get(exportName)?.variants.every((variant) => variant.kind === "class") !== true;
        result.set(exportName, typeOnly);
    }
    return result;
}
function getProviderCanonicalExportLocalName(exportName) {
    const identifier = exportName.replace(/[^A-Za-z0-9_$]/g, "_");
    return `__TstsProviderCanonical_${identifier === "" || /^[0-9]/.test(identifier) ? `_${identifier}` : identifier}`;
}
function renderProviderExportDeclaration(declaration, context, options = {}) {
    const declarationName = options.localName ?? declaration.name;
    const typeParameters = renderProviderTypeParameters(declaration.typeParameters ?? [], context);
    const exportName = getProviderExportName(declaration);
    const isDefault = exportName === "default" || declaration.exportKind === "default";
    const canInlineDefault = isDefault && canRenderInlineDefaultProviderExport(declaration.kind);
    const directNamedExport = options.localOnly !== true && !isDefault && exportName === declarationName;
    const declarationPrefix = directNamedExport
        ? "export declare "
        : options.localOnly === true
            ? "declare "
            : canInlineDefault
                ? "export default "
                : "declare ";
    const typePrefix = directNamedExport ? "export " : options.localOnly === true ? "" : "";
    const localTypePrefix = directNamedExport ? "export " : options.localOnly === true ? "" : "";
    let rendered;
    switch (declaration.kind) {
        case "class":
            rendered = `${declarationPrefix}class ${declarationName}${typeParameters}${renderProviderHeritage(declaration.heritage ?? [], "class", context)} {\n${renderProviderMembers(declaration.members ?? [], context)}\n}`;
            break;
        case "interface":
            rendered = `${canInlineDefault && options.localOnly !== true ? "export default " : localTypePrefix}interface ${declarationName}${typeParameters}${renderProviderHeritage(declaration.heritage ?? [], "interface", context)} {\n${renderProviderMembers(declaration.members ?? [], context)}\n}`;
            break;
        case "function":
            rendered = renderProviderSignatures(declarationName, declaration.signatures ?? [], context)
                .map((signature) => `${canInlineDefault ? "export default " : declarationPrefix}function ${signature}`)
                .join("\n");
            break;
        case "type":
            rendered = `${typePrefix}type ${declarationName}${typeParameters} = ${renderProviderTypeExpression(declaration.type, context)};`;
            break;
        case "value":
            rendered = `${declarationPrefix}const ${declarationName}: ${renderProviderTypeExpression(declaration.type, context)};`;
            break;
        case "namespace":
            rendered = `${declarationPrefix}namespace ${declarationName} {\n${renderProviderNamespaceMembers(declaration.members ?? [], context)}\n}`;
            break;
        case "enum":
            rendered = `${declarationPrefix}enum ${declarationName} {\n${(declaration.members ?? []).map((member) => `  ${renderProviderPropertyName(member.name)},`).join("\n")}\n}`;
            break;
        case "opaque":
            rendered = `${declarationPrefix}const ${declarationName}: unique symbol;`;
            break;
    }
    if (options.localOnly === true || directNamedExport || canInlineDefault) {
        return rendered;
    }
    return isDefault
        ? `${rendered}\nexport default ${declarationName};`
        : `${rendered}\nexport { ${declarationName} as ${exportName} };`;
}
function renderProviderTypeFamilyDeclaration(group, context, publicExport = true) {
    const variants = [...group.variants].sort((left, right) => left.sourceTypeFamily.typeArgumentCount - right.sourceTypeFamily.typeArgumentCount);
    const maxVariant = variants[variants.length - 1];
    const minArity = variants[0].sourceTypeFamily.typeArgumentCount;
    const maxArity = maxVariant.sourceTypeFamily.typeArgumentCount;
    const maxTypeParameters = maxVariant.typeParameters ?? [];
    const variantDeclarations = renderProviderTypeFamilyLocalVariants({ ...group, variants }, context);
    const familyTypeParameters = maxArity === 0
        ? ""
        : `<${maxTypeParameters.map((parameter, index) => {
            const constraints = parameter.constraints ?? [];
            const constraintText = constraints.length === 0 ? "" : ` extends ${constraints.map((constraint) => renderProviderTypeExpression(constraint, context)).join(" & ")}`;
            const defaultText = index >= minArity ? ` = ${providerTypeFamilyDefaultTypeName}` : "";
            return `${parameter.name}${constraintText}${defaultText}`;
        }).join(", ")}>`;
    const aliasType = renderProviderTypeFamilyAliasType(variants, maxTypeParameters);
    const valueExport = publicExport ? renderProviderTypeFamilyValueExport(group.exportName, variants) : "";
    return `${variantDeclarations}\n${publicExport ? "export " : ""}type ${group.exportName}${familyTypeParameters} = ${aliasType};${valueExport}`;
}
function renderProviderTypeFamilyLocalVariants(group, context) {
    return group.variants.map((variant) => renderProviderExportDeclaration(variant, context, {
        localName: getProviderTypeFamilyVariantLocalName(variant),
        localOnly: true,
    })).join("\n");
}
function renderProviderTypeFamilyValueExport(exportName, variants) {
    if (!variants.every((variant) => variant.kind === "class")) {
        return "";
    }
    const valueType = variants
        .map((variant) => `typeof ${getProviderTypeFamilyVariantLocalName(variant)}`)
        .join(" & ");
    return `\nexport declare const ${exportName}: ${valueType};`;
}
function renderProviderTypeFamilyVariantExports(groups) {
    return [...groups.values()]
        .flatMap((group) => group.variants.map((variant) => getProviderTypeFamilyVariantLocalName(variant)))
        .map((name) => `export { ${name} };`)
        .join("\n");
}
function renderProviderTypeFamilyAliasType(variants, maxTypeParameters) {
    const variantByArity = new Map(variants.map((variant) => [variant.sourceTypeFamily.typeArgumentCount, variant]));
    const arities = [...variantByArity.keys()].sort((left, right) => left - right);
    let rendered = renderProviderTypeFamilyVariantReference(variantByArity.get(arities[arities.length - 1]), maxTypeParameters);
    for (let index = arities.length - 2; index >= 0; index--) {
        const arity = arities[index];
        const nextParameter = maxTypeParameters[arity];
        if (nextParameter === undefined) {
            rendered = renderProviderTypeFamilyVariantReference(variantByArity.get(arity), maxTypeParameters);
            continue;
        }
        rendered = `${providerTypeFamilyIsDefaultTypeName}<${nextParameter.name}> extends true ? ${renderProviderTypeFamilyVariantReference(variantByArity.get(arity), maxTypeParameters)} : ${rendered}`;
    }
    return rendered;
}
function renderProviderTypeFamilyVariantReference(variant, maxTypeParameters) {
    const arity = variant.sourceTypeFamily.typeArgumentCount;
    const name = getProviderTypeFamilyVariantLocalName(variant);
    if (arity === 0) {
        return name;
    }
    return `${name}<${maxTypeParameters.slice(0, arity).map((parameter) => parameter.name).join(", ")}>`;
}
function renderProviderHeritage(heritage, declarationKind, context) {
    const extendsTypes = heritage.filter((clause) => clause.kind === "extends").map((clause) => renderProviderTypeExpression(clause.type, context, declarationKind === "class" ? providerTypeExpressionRenderValueHeritage : providerTypeExpressionRenderType));
    const implementsTypes = declarationKind === "class"
        ? heritage.filter((clause) => clause.kind === "implements").map((clause) => renderProviderTypeExpression(clause.type, context))
        : [];
    return [
        extendsTypes.length > 0 ? ` extends ${extendsTypes.join(", ")}` : "",
        implementsTypes.length > 0 ? ` implements ${implementsTypes.join(", ")}` : "",
    ].join("");
}
function renderProviderMembers(members, context) {
    return members.map((member) => `  ${renderProviderMember(member, context)}`).join("\n");
}
function renderProviderNamespaceMembers(members, context) {
    return members.map((member) => `  ${renderProviderNamespaceMember(member, context)}`).join("\n");
}
function renderProviderMember(member, context) {
    const staticPrefix = member.static === true ? "static " : "";
    const readonlyPrefix = member.readonly === true ? "readonly " : "";
    const optionalSuffix = member.optional === true ? "?" : "";
    const name = renderProviderPropertyName(member.name);
    switch (member.kind) {
        case "constructor":
            return renderProviderSignatures("constructor", member.signatures ?? [{ id: member.id, parameters: [] }], context).join("\n  ");
        case "method":
            return renderProviderSignatures(name, member.signatures ?? [], context).map((signature) => `${staticPrefix}${signature}`).join("\n  ");
        case "property":
        case "field":
            return `${staticPrefix}${readonlyPrefix}${name}${optionalSuffix}: ${renderProviderTypeExpression(member.type, context)};`;
        case "indexer": {
            const signature = member.signatures[0];
            const parameter = signature.parameters[0];
            return `[${renderProviderParameter(parameter, context)}]: ${renderProviderTypeExpression(signature.returnType, context)};`;
        }
    }
}
function renderProviderNamespaceMember(member, context) {
    const name = renderProviderPropertyName(member.name);
    switch (member.kind) {
        case "method":
            return renderProviderSignatures(name, member.signatures ?? [], context).map((signature) => `export function ${signature}`).join("\n  ");
        case "property":
        case "field":
            return `export const ${name}: ${renderProviderTypeExpression(member.type, context)};`;
        case "constructor":
        case "indexer":
            return failUnsupportedProviderNamespaceMember(member);
    }
}
function failUnsupportedProviderNamespaceMember(member) {
    throw new Error(`Unsupported provider namespace member kind '${member.kind}'.`);
}
function canRenderInlineDefaultProviderExport(kind) {
    return kind === "class" || kind === "interface" || kind === "function" || kind === "enum";
}
function getProviderExportName(declaration) {
    return declaration.exportKind === "default" ? "default" : declaration.exportName ?? declaration.name;
}
function getProviderSourceExportName(declaration) {
    return declaration.sourceTypeFamily?.exportName ?? getProviderExportName(declaration);
}
function renderProviderPropertyName(name) {
    if (typeof name !== "string" && name.kind === "well-known-symbol") {
        return `[Symbol.${name.name}]`;
    }
    const text = typeof name === "string"
        ? name
        : name.kind === "number-literal"
            ? String(name.value)
            : name.text;
    return isIdentifierText(text) ? text : JSON.stringify(text);
}
function getProviderPropertyNameText(name) {
    if (typeof name === "string") {
        return name;
    }
    switch (name.kind) {
        case "identifier":
        case "string-literal":
            return name.text;
        case "number-literal":
            return String(name.value);
        case "well-known-symbol":
            return `Symbol.${name.name}`;
    }
}
function renderProviderSignatures(name, signatures, context) {
    return signatures.map((signature) => {
        const typeParameters = renderProviderTypeParameters(signature.typeParameters ?? [], context);
        const parameters = signature.parameters.map((parameter) => renderProviderParameter(parameter, context)).join(", ");
        const returnType = name === "constructor" ? "" : `: ${renderProviderTypeExpression(signature.returnType ?? { kind: "void" }, context)}`;
        return `${name}${typeParameters}(${parameters})${returnType};`;
    });
}
function renderProviderTypeParameters(typeParameters, context) {
    if (typeParameters.length === 0) {
        return "";
    }
    return `<${typeParameters.map((parameter) => {
        const constraints = parameter.constraints ?? [];
        const constraintText = constraints.length === 0 ? "" : ` extends ${constraints.map((constraint) => renderProviderTypeExpression(constraint, context)).join(" & ")}`;
        const defaultText = parameter.defaultType === undefined ? "" : ` = ${renderProviderTypeExpression(parameter.defaultType, context)}`;
        return `${parameter.name}${constraintText}${defaultText}`;
    }).join(", ")}>`;
}
function renderProviderParameter(parameter, context) {
    const restPrefix = parameter.rest === true ? "..." : "";
    const optionalSuffix = parameter.optional === true && parameter.rest !== true ? "?" : "";
    return `${restPrefix}${parameter.name}${optionalSuffix}: ${renderProviderTypeExpression(parameter.type, context)}`;
}
const providerTypeExpressionRenderType = {
    providerRefPosition: "type",
};
const providerTypeExpressionRenderValueHeritage = {
    providerRefPosition: "value-heritage",
};
function renderProviderTypeExpression(type, context, options = providerTypeExpressionRenderType) {
    return renderProviderTypeExpressionWorker(type, providerTypePrecedenceNone, context, options);
}
const providerTypePrecedenceNone = 0;
const providerTypePrecedenceUnion = 1;
const providerTypePrecedenceIntersection = 2;
const providerTypePrecedencePostfix = 3;
function renderProviderTypeExpressionWorker(type, parentPrecedence, context, options) {
    switch (type.kind) {
        case "any":
        case "unknown":
        case "void":
        case "never":
        case "undefined":
        case "boolean":
        case "string":
        case "number":
        case "bigint":
        case "object":
            return type.kind;
        case "source-primitive":
            return renderSourcePrimitiveType(type.name);
        case "type-parameter":
            return type.name;
        case "target-named":
        case "opaque":
            return renderProviderTypeExpressionWorker(type.sourceShape, parentPrecedence, context, options);
        case "array":
            return `${renderProviderTypeExpressionWorker(type.elementType, providerTypePrecedencePostfix, context, options)}[]`;
        case "tuple":
            return `[${type.elementTypes.map((elementType) => renderProviderTypeExpression(elementType, context)).join(", ")}]`;
        case "union": {
            const text = type.types.map((unionType) => renderProviderTypeExpressionWorker(unionType, providerTypePrecedenceUnion, context, options)).join(" | ");
            return parentPrecedence > providerTypePrecedenceUnion ? `(${text})` : text;
        }
        case "intersection": {
            const text = type.types.map((intersectionType) => renderProviderTypeExpressionWorker(intersectionType, providerTypePrecedenceIntersection, context, options)).join(" & ");
            return parentPrecedence > providerTypePrecedenceIntersection ? `(${text})` : text;
        }
        case "function": {
            const text = `${renderProviderTypeParameters(type.typeParameters ?? [], context)}(${type.parameters.map((parameter) => renderProviderParameter(parameter, context)).join(", ")}) => ${renderProviderTypeExpression(type.returnType, context)}`;
            return parentPrecedence > providerTypePrecedenceNone ? `(${text})` : text;
        }
        case "literal":
            return type.value === null ? "null" : JSON.stringify(type.value);
        case "provider-ref":
            const typeArgumentCount = type.typeArguments?.length ?? 0;
            const providerRefKey = getProviderRefKey(type.moduleSpecifier, type.exportName, typeArgumentCount);
            const familyVariant = context.typeFamilyVariantByProviderRefKey.get(providerRefKey);
            const family = familyVariant?.sourceTypeFamily;
            const sameModule = type.moduleSpecifier === context.moduleSpecifier;
            const exactImportLocalName = context.exactImportLocalNameByProviderRefKey.get(providerRefKey);
            const canonicalLocalName = sameModule
                ? context.canonicalLocalNameByExportName.get(family?.exportName ?? type.exportName)
                : undefined;
            const providerRefName = exactImportLocalName !== undefined
                && (options.providerRefPosition === "value-heritage" || context.exactImportsInTypePositions)
                ? exactImportLocalName
                : sameModule
                    ? options.providerRefPosition === "value-heritage" && familyVariant !== undefined
                        ? getProviderTypeFamilyVariantLocalName(familyVariant)
                        : canonicalLocalName
                            ?? (familyVariant === undefined
                                ? context.localDeclarationNameByExportName.get(type.exportName) ?? type.exportName
                                : renderProviderRefIdentifier(type.exportName, familyVariant, typeArgumentCount, options))
                    : type.namespaceImport === undefined
                        ? type.localName ?? type.exportName
                        : `${type.namespaceImport}.${type.exportName}`;
            return type.typeArguments === undefined || type.typeArguments.length === 0
                ? providerRefName
                : `${providerRefName}<${type.typeArguments.map((typeArgument) => renderProviderTypeExpression(typeArgument, context)).join(", ")}>`;
    }
}
function renderProviderRefIdentifier(exportName, familyVariant, typeArgumentCount, options) {
    if (familyVariant === undefined) {
        return exportName;
    }
    const family = familyVariant?.sourceTypeFamily;
    if (family === undefined || family.typeArgumentCount !== typeArgumentCount) {
        return exportName;
    }
    return options.providerRefPosition === "value-heritage"
        ? getProviderTypeFamilyVariantLocalName(familyVariant)
        : family.exportName;
}
function renderSourcePrimitiveType(name) {
    switch (name) {
        case "bool":
            return "boolean";
        case "char":
            return "string";
        default:
            return "number";
    }
}
function collectProviderTypeFamilyRenderGroups(exports) {
    const groups = new Map();
    for (const declaration of exports) {
        const family = declaration.sourceTypeFamily;
        if (family === undefined) {
            continue;
        }
        const variants = groups.get(family.exportName) ?? [];
        variants.push(declaration);
        groups.set(family.exportName, variants);
    }
    return new Map([...groups].map(([exportName, variants]) => [
        exportName,
        {
            exportName,
            variants: variants.sort((left, right) => left.sourceTypeFamily.typeArgumentCount - right.sourceTypeFamily.typeArgumentCount),
        },
    ]));
}
function getProviderTypeFamilyVariantExportMap(moduleSpecifier, groups) {
    const variants = new Map();
    const ambiguousKeys = new Set();
    const recordVariant = (key, variant) => {
        if (ambiguousKeys.has(key)) {
            return;
        }
        const existing = variants.get(key);
        if (existing === undefined || existing === variant) {
            variants.set(key, variant);
            return;
        }
        variants.delete(key);
        ambiguousKeys.add(key);
    };
    for (const group of groups.values()) {
        for (const variant of group.variants) {
            const typeArgumentCount = variant.sourceTypeFamily.typeArgumentCount;
            recordVariant(getProviderRefKey(moduleSpecifier, getProviderExportName(variant), typeArgumentCount), variant);
            recordVariant(getProviderRefKey(moduleSpecifier, group.exportName, typeArgumentCount), variant);
        }
    }
    return variants;
}
function getProviderLocalDeclarationNameByExportName(exports) {
    return new Map(exports
        .filter((declaration) => declaration.sourceTypeFamily === undefined)
        .map((declaration) => [getProviderExportName(declaration), declaration.name]));
}
function getProviderCanonicalDeclarationLocalNameMap(exports) {
    return new Map(exports
        .filter((declaration) => declaration.sourceTypeFamily === undefined)
        .map((declaration) => {
        const exportName = getProviderExportName(declaration);
        return [exportName, exportName === "default" ? "__TstsProviderDefaultExport" : exportName];
    }));
}
function getProviderRefKey(moduleSpecifier, exportName, typeArgumentCount) {
    return `${moduleSpecifier}\0${exportName}\0${typeArgumentCount}`;
}
function getProviderTypeFamilyVariantLocalName(declaration) {
    return `__TstsProvider_${declaration.sourceTypeFamily.exportName}_${declaration.sourceTypeFamily.typeArgumentCount}`;
}
function validateProviderIdentity(identity, expectedKind) {
    const invalidFields = [];
    if (typeof identity.id !== "string" || identity.id.length === 0) {
        invalidFields.push("id");
    }
    if (typeof identity.version !== "string" || identity.version.length === 0) {
        invalidFields.push("version");
    }
    if (typeof identity.target !== "string" || identity.target.length === 0) {
        invalidFields.push("target");
    }
    if (typeof identity.extensionContractVersion !== "string" || identity.extensionContractVersion.length === 0) {
        invalidFields.push("extensionContractVersion");
    }
    if (identity.providerKind !== undefined && identity.providerKind !== expectedKind && identity.providerKind !== "combined") {
        invalidFields.push("providerKind");
    }
    if (invalidFields.length === 0) {
        if (identity.extensionContractVersion === TstsProviderContractVersion) {
            return undefined;
        }
        return createHostDiagnostic({
            extensionCode: "PROVIDER_CONTRACT_MISMATCH",
            numericCode: ExtensionHostDiagnosticCode.providerContractMismatch,
            message: `Provider '${identity.id}' uses unsupported extension contract '${identity.extensionContractVersion}'. Expected '${TstsProviderContractVersion}'.`,
            evidence: [{ message: "Provider identity", details: identity }],
            identity: `provider-contract-mismatch:${expectedKind}:${identity.id}:${identity.extensionContractVersion}`,
        });
    }
    return createHostDiagnostic({
        extensionCode: "INVALID_PROVIDER_IDENTITY",
        numericCode: ExtensionHostDiagnosticCode.invalidProvider,
        message: `Invalid ${expectedKind} provider identity. Invalid fields: ${invalidFields.join(", ")}.`,
        evidence: [{ message: "Provider identity", details: identity }],
        identity: `invalid-provider-identity:${expectedKind}:${identity.id}:${invalidFields.join(",")}`,
    });
}
function snapshotExtensionObservationEnvelope(value) {
    try {
        if (typeof value !== "object" || value === null) {
            return { kind: "invalid", reason: "observation result must be an object" };
        }
        const observation = value;
        const kind = observation.kind;
        if (kind === "defer") {
            return { kind: "valid", observation: Object.freeze({ kind: "defer" }) };
        }
        if (kind === "accept") {
            const resultValue = observation.value;
            const hasEvidence = Object.prototype.hasOwnProperty.call(observation, "evidence");
            const evidenceValue = observation.evidence;
            const evidenceSnapshot = snapshotProviderEvidenceArray(evidenceValue, "observation.evidence");
            if (hasEvidence && evidenceSnapshot.kind === "invalid") {
                return { kind: "invalid", reason: formatProviderBoundarySnapshotFailure(evidenceSnapshot) };
            }
            if (hasEvidence && evidenceSnapshot.kind === "valid" && evidenceSnapshot.value === undefined) {
                return { kind: "invalid", reason: "observation.evidence must be an array when present" };
            }
            return {
                kind: "valid",
                observation: Object.freeze({
                    kind: "accept",
                    value: resultValue,
                    ...(hasEvidence && evidenceSnapshot.kind === "valid" ? { evidence: evidenceSnapshot.value } : {}),
                }),
            };
        }
        if (kind === "reject") {
            const diagnosticSnapshot = snapshotExtensionDiagnostic(observation.diagnostic);
            return diagnosticSnapshot.kind === "valid"
                ? { kind: "valid", observation: Object.freeze({ kind: "reject", diagnostic: diagnosticSnapshot.diagnostic }) }
                : { kind: "invalid", reason: `observation.diagnostic: ${diagnosticSnapshot.reason}` };
        }
        return { kind: "invalid", reason: "observation.kind must be 'defer', 'accept', or 'reject'" };
    }
    catch (error) {
        return { kind: "invalid", reason: error instanceof Error ? error.message : String(error) };
    }
}
function snapshotProviderOwnership(value) {
    try {
        if (typeof value !== "object" || value === null) {
            return { kind: "invalid", reason: "ownership result must be an object" };
        }
        const ownership = value;
        const kind = ownership.kind;
        if (kind === "unowned") {
            return { kind: "valid", ownership: Object.freeze({ kind: "unowned" }) };
        }
        if (kind === "owned") {
            const hasEvidence = Object.prototype.hasOwnProperty.call(ownership, "evidence");
            const evidenceValue = ownership.evidence;
            const evidenceSnapshot = snapshotProviderEvidenceArray(evidenceValue, "ownership.evidence");
            if (hasEvidence && evidenceSnapshot.kind === "invalid") {
                return { kind: "invalid", reason: formatProviderBoundarySnapshotFailure(evidenceSnapshot) };
            }
            if (hasEvidence && evidenceSnapshot.kind === "valid" && evidenceSnapshot.value === undefined) {
                return { kind: "invalid", reason: "ownership.evidence must be an array when present" };
            }
            return {
                kind: "valid",
                ownership: Object.freeze({
                    kind: "owned",
                    ...(hasEvidence && evidenceSnapshot.kind === "valid" ? { evidence: evidenceSnapshot.value } : {}),
                }),
            };
        }
        if (kind === "reject") {
            const diagnosticSnapshot = snapshotExtensionDiagnostic(ownership.diagnostic);
            return diagnosticSnapshot.kind === "valid"
                ? { kind: "valid", ownership: Object.freeze({ kind: "reject", diagnostic: diagnosticSnapshot.diagnostic }) }
                : { kind: "invalid", reason: `ownership.diagnostic: ${diagnosticSnapshot.reason}` };
        }
        return { kind: "invalid", reason: "ownership.kind must be 'unowned', 'owned', or 'reject'" };
    }
    catch (error) {
        return { kind: "invalid", reason: error instanceof Error ? error.message : String(error) };
    }
}
function snapshotReturnedExtensionDiagnostic(value) {
    try {
        if ((typeof value !== "object" && typeof value !== "function")
            || value === null
            || !Object.prototype.hasOwnProperty.call(value, "extensionId")) {
            return { kind: "absent" };
        }
    }
    catch (error) {
        return { kind: "invalid", reason: error instanceof Error ? error.message : String(error) };
    }
    const snapshot = snapshotExtensionDiagnostic(value);
    return snapshot.kind === "valid"
        ? { kind: "valid", diagnostic: snapshot.diagnostic }
        : snapshot;
}
function createInvalidProviderCallbackDiagnostic(provider, specifier, operation, reason) {
    return createHostDiagnostic({
        extensionCode: "INVALID_PROVIDER_CALLBACK_RESULT",
        numericCode: ExtensionHostDiagnosticCode.providerResolutionFailed,
        message: `Provider '${provider.id}' returned an invalid result from ${operation} for '${specifier}'.`,
        evidence: [{ message: "Callback result rejection", details: reason }],
        identity: `invalid-provider-callback-result:${provider.id}:${operation}:${specifier}:${reason}`,
    });
}
function snapshotExtensionDiagnostic(value) {
    try {
        if (typeof value !== "object" || value === null) {
            return { kind: "invalid", reason: "diagnostic must be an object" };
        }
        const diagnosticValue = value;
        const extensionId = diagnosticValue.extensionId;
        const extensionCode = diagnosticValue.extensionCode;
        const numericCode = diagnosticValue.numericCode;
        const hasPublicCode = Object.prototype.hasOwnProperty.call(value, "publicCode");
        const publicCode = diagnosticValue.publicCode;
        const category = diagnosticValue.category;
        const message = diagnosticValue.message;
        const hasNodeOrSpan = Object.prototype.hasOwnProperty.call(value, "nodeOrSpan");
        const nodeOrSpan = diagnosticValue.nodeOrSpan;
        const hasEvidence = Object.prototype.hasOwnProperty.call(value, "evidence");
        const evidenceValue = diagnosticValue.evidence;
        const hasIdentity = Object.prototype.hasOwnProperty.call(value, "identity");
        const identity = diagnosticValue.identity;
        assertProviderBoundaryString(extensionId, "diagnostic.extensionId", false);
        assertProviderBoundaryString(extensionCode, "diagnostic.extensionCode", false);
        if (!Number.isSafeInteger(numericCode) || numericCode <= 0) {
            return { kind: "invalid", reason: "diagnostic.numericCode must be a positive safe integer" };
        }
        if (publicCode !== undefined) {
            assertProviderBoundaryString(publicCode, "diagnostic.publicCode", false);
        }
        else if (hasPublicCode) {
            return { kind: "invalid", reason: "diagnostic.publicCode must be a string when present" };
        }
        if (category !== "error" && category !== "warning" && category !== "suggestion") {
            return { kind: "invalid", reason: "diagnostic.category is invalid" };
        }
        assertProviderBoundaryString(message, "diagnostic.message", false);
        if (identity !== undefined) {
            assertProviderBoundaryString(identity, "diagnostic.identity", false);
        }
        else if (hasIdentity) {
            return { kind: "invalid", reason: "diagnostic.identity must be a string when present" };
        }
        const evidenceSnapshot = snapshotProviderEvidenceArray(evidenceValue, "diagnostic.evidence");
        if (hasEvidence && evidenceSnapshot.kind === "invalid") {
            return { kind: "invalid", reason: formatProviderBoundarySnapshotFailure(evidenceSnapshot) };
        }
        if (hasEvidence && evidenceSnapshot.kind === "valid" && evidenceSnapshot.value === undefined) {
            return { kind: "invalid", reason: "diagnostic.evidence must be an array when present" };
        }
        return {
            kind: "valid",
            diagnostic: Object.freeze({
                extensionId,
                extensionCode,
                numericCode,
                ...(hasPublicCode ? { publicCode } : {}),
                category,
                message,
                ...(hasNodeOrSpan ? { nodeOrSpan } : {}),
                ...(hasEvidence && evidenceSnapshot.kind === "valid" ? { evidence: evidenceSnapshot.value } : {}),
                ...(hasIdentity ? { identity } : {}),
            }),
        };
    }
    catch (error) {
        return { kind: "invalid", reason: error instanceof Error ? error.message : String(error) };
    }
}
function snapshotProviderModuleResolution(value, specifier) {
    try {
        if (typeof value !== "object" || value === null) {
            return { kind: "invalid", reason: "provider resolution must be an object" };
        }
        const resolutionValue = value;
        const kind = resolutionValue.kind;
        const moduleSpecifier = resolutionValue.moduleSpecifier;
        const virtualFileName = resolutionValue.virtualFileName;
        const providerModuleId = resolutionValue.providerModuleId;
        const hasPackageName = Object.prototype.hasOwnProperty.call(value, "packageName");
        const packageName = resolutionValue.packageName;
        const hasPackageVersion = Object.prototype.hasOwnProperty.call(value, "packageVersion");
        const packageVersion = resolutionValue.packageVersion;
        const hasEvidence = Object.prototype.hasOwnProperty.call(value, "evidence");
        const providedEvidence = resolutionValue.evidence;
        if (kind !== "virtual"
            || moduleSpecifier !== specifier
            || typeof virtualFileName !== "string"
            || virtualFileName.length === 0
            || isHostOwnedProviderVirtualFileName(virtualFileName)
            || typeof providerModuleId !== "string"
            || providerModuleId.length === 0) {
            return { kind: "invalid", reason: "required virtual-module identity fields are invalid" };
        }
        if (hasPackageName && (typeof packageName !== "string" || packageName.length === 0)) {
            return { kind: "invalid", reason: "packageName must be omitted or a non-empty string" };
        }
        if (hasPackageVersion && (typeof packageVersion !== "string" || packageVersion.length === 0)) {
            return { kind: "invalid", reason: "packageVersion must be omitted or a non-empty string" };
        }
        if (hasPackageVersion && !hasPackageName) {
            return { kind: "invalid", reason: "packageVersion requires packageName" };
        }
        let evidence;
        if (hasEvidence) {
            const evidenceSnapshot = snapshotProviderEvidenceArray(providedEvidence, "resolution.evidence");
            if (evidenceSnapshot.kind === "invalid") {
                return { kind: "invalid", reason: formatProviderBoundarySnapshotFailure(evidenceSnapshot) };
            }
            if (evidenceSnapshot.value === undefined) {
                return { kind: "invalid", reason: "resolution.evidence must be an array when present" };
            }
            evidence = evidenceSnapshot.value;
        }
        return {
            kind: "valid",
            resolution: Object.freeze({
                kind: "virtual",
                moduleSpecifier,
                virtualFileName,
                providerModuleId,
                ...(hasPackageName ? { packageName } : {}),
                ...(hasPackageVersion ? { packageVersion } : {}),
                ...(evidence === undefined ? {} : { evidence }),
            }),
        };
    }
    catch (error) {
        return {
            kind: "invalid",
            reason: `reading the provider resolution threw: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}
function isValidProviderDeclarationModel(value, resolution) {
    const context = createProviderDeclarationValidationContext(value);
    return value.moduleSpecifier === resolution.moduleSpecifier
        && value.providerModuleId === resolution.providerModuleId
        && (value.imports ?? []).every(isValidProviderImportDeclaration)
        && Array.isArray(value.exports)
        && value.exports.every(isValidProviderExportDeclaration)
        && value.exports.every(hasValidProviderExportTypeParameterScope)
        && value.exports.every((declaration) => hasValidProviderReferenceBindingsForExport(declaration, context))
        && value.exports.every((declaration) => hasValidProviderValueHeritageReferences(declaration, context))
        && isValidProviderTypeFamilyDeclarations(value.exports, value.imports ?? []);
}
function createProviderDeclarationValidationContext(model) {
    const sameModuleProviderRefNames = new Set();
    const exportsByName = new Map();
    const ambiguousNames = new Set();
    const recordExportName = (name, declaration) => {
        if (ambiguousNames.has(name)) {
            return;
        }
        const existing = exportsByName.get(name);
        if (existing === undefined || existing === declaration) {
            exportsByName.set(name, declaration);
            sameModuleProviderRefNames.add(name);
            return;
        }
        const sameFamily = existing.sourceTypeFamily !== undefined
            && declaration.sourceTypeFamily !== undefined
            && existing.sourceTypeFamily.exportName === declaration.sourceTypeFamily.exportName;
        if (sameFamily) {
            return;
        }
        exportsByName.delete(name);
        sameModuleProviderRefNames.delete(name);
        ambiguousNames.add(name);
    };
    for (const declaration of model.exports) {
        const exportName = getProviderExportName(declaration);
        const sourceExportName = getProviderSourceExportName(declaration);
        recordExportName(exportName, declaration);
        recordExportName(sourceExportName, declaration);
    }
    return {
        moduleSpecifier: model.moduleSpecifier,
        sameModuleProviderRefNames,
        exportsByName,
        typeFamilyVariantByProviderRefKey: getProviderTypeFamilyVariantExportMap(model.moduleSpecifier, collectProviderTypeFamilyRenderGroups(model.exports)),
        importBindings: model.imports ?? [],
    };
}
function isValidProviderImportDeclaration(value) {
    const hasNamespace = value.namespaceImport !== undefined;
    const hasDefault = value.defaultImport !== undefined;
    const namedImports = value.namedImports ?? [];
    return value.moduleSpecifier.length > 0
        && !isHostOwnedProviderVirtualFileName(value.moduleSpecifier)
        && (value.defaultImport === undefined || isIdentifierText(value.defaultImport))
        && (value.namespaceImport === undefined || isIdentifierText(value.namespaceImport))
        && namedImports.every(isValidProviderRequestedExport)
        && (hasDefault || hasNamespace || namedImports.length > 0)
        && !(hasNamespace && namedImports.length > 0);
}
function isValidProviderRequestedExport(value) {
    return isIdentifierText(value.exportedName)
        && (value.localName === undefined || isIdentifierText(value.localName))
        && (value.kind === undefined || value.kind === "type" || value.kind === "value" || value.kind === "unknown");
}
function isValidProviderExportDeclaration(value) {
    return value.id.length > 0
        && isIdentifierText(value.name)
        && isValidProviderExportName(value)
        && isValidProviderTypeFamilyDeclaration(value)
        && isValidProviderTargetIdentity(value.targetIdentity)
        && hasRequiredProviderExportShape(value)
        && hasValidProviderHeritageShape(value)
        && (value.type === undefined || isValidProviderTypeExpression(value.type))
        && (value.typeParameters ?? []).every(isValidProviderTypeParameterDeclaration)
        && (value.heritage ?? []).every(isValidProviderHeritageDeclaration)
        && (value.signatures ?? []).every(isValidProviderSignatureDeclaration)
        && (value.kind === "enum"
            ? (value.members ?? []).every(isValidProviderEnumMemberDeclaration)
            : value.kind === "namespace"
                ? (value.members ?? []).every(isValidProviderNamespaceMemberDeclaration)
                : (value.members ?? []).every(isValidProviderMemberDeclaration));
}
function isValidProviderTargetIdentity(value) {
    return value === undefined
        || value.target.length > 0
            && value.id.length > 0
            && (value.displayName === undefined || value.displayName.length > 0)
            && (value.packageName === undefined || value.packageName.length > 0)
            && (value.packageVersion === undefined || value.packageVersion.length > 0);
}
function hasValidProviderHeritageShape(value) {
    const heritage = value.heritage ?? [];
    if (value.kind === "class") {
        return heritage.filter((clause) => clause.kind === "extends").length <= 1;
    }
    if (value.kind === "interface") {
        return heritage.every((clause) => clause.kind === "extends");
    }
    return heritage.length === 0;
}
function isValidProviderTypeFamilyDeclaration(value) {
    if (value.sourceTypeFamily === undefined) {
        return true;
    }
    return value.exportKind !== "default"
        && isIdentifierText(value.sourceTypeFamily.exportName)
        && Number.isSafeInteger(value.sourceTypeFamily.typeArgumentCount)
        && value.sourceTypeFamily.typeArgumentCount >= 0
        && value.sourceTypeFamily.typeArgumentCount === (value.typeParameters ?? []).length
        && (value.typeParameters ?? []).every((parameter) => parameter.defaultType === undefined)
        && (value.kind === "class" || value.kind === "interface" || value.kind === "type");
}
function isValidProviderTypeFamilyDeclarations(exports, imports) {
    const reservedLocalNames = new Set([
        providerTypeFamilyDefaultValueName,
        providerTypeFamilyDefaultTypeName,
        providerTypeFamilyIsAnyTypeName,
        providerTypeFamilyIsDefaultTypeName,
    ]);
    const importLocalNames = new Set();
    const collectImportLocalName = (name) => {
        if (name !== undefined) {
            importLocalNames.add(name);
        }
    };
    for (const importDeclaration of imports) {
        collectImportLocalName(importDeclaration.defaultImport);
        collectImportLocalName(importDeclaration.namespaceImport);
        for (const namedImport of importDeclaration.namedImports ?? []) {
            importLocalNames.add(namedImport.localName ?? namedImport.exportedName);
        }
    }
    const publicExports = new Set();
    const familyGroups = new Map();
    const familyLocalReferenceOwners = new Map();
    const localNames = new Set(exports.filter((declaration) => declaration.sourceTypeFamily === undefined).map((declaration) => declaration.name));
    const generatedCanonicalLocalNames = new Set(exports.map((declaration) => getProviderCanonicalExportLocalName(getProviderSourceExportName(declaration))));
    for (const declaration of exports) {
        if (declaration.sourceTypeFamily === undefined) {
            const exportName = getProviderExportName(declaration);
            if (publicExports.has(exportName)) {
                return false;
            }
            publicExports.add(exportName);
            continue;
        }
        const familyName = declaration.sourceTypeFamily.exportName;
        if (reservedLocalNames.has(familyName)) {
            return false;
        }
        const group = familyGroups.get(familyName) ?? [];
        const localReferenceKey = `${getProviderExportName(declaration)}\0${declaration.sourceTypeFamily.typeArgumentCount}`;
        const existingLocalReferenceOwner = familyLocalReferenceOwners.get(localReferenceKey);
        if (existingLocalReferenceOwner !== undefined && existingLocalReferenceOwner !== familyName) {
            return false;
        }
        familyLocalReferenceOwners.set(localReferenceKey, familyName);
        group.push(declaration);
        familyGroups.set(familyName, group);
    }
    if (familyGroups.size > 0 && [...reservedLocalNames].some((name) => localNames.has(name) || importLocalNames.has(name) || publicExports.has(name))) {
        return false;
    }
    if ([...generatedCanonicalLocalNames].some((name) => localNames.has(name) || importLocalNames.has(name) || publicExports.has(name) || reservedLocalNames.has(name))) {
        return false;
    }
    for (const [familyName, variants] of familyGroups) {
        if (publicExports.has(familyName) || importLocalNames.has(familyName) || localNames.has(familyName)) {
            return false;
        }
        publicExports.add(familyName);
        if (variants.some((variant) => variant.kind === "class") && !variants.every((variant) => variant.kind === "class")) {
            return false;
        }
        const arities = variants.map((variant) => variant.sourceTypeFamily.typeArgumentCount).sort((left, right) => left - right);
        const generatedLocalNames = variants.map(getProviderTypeFamilyVariantLocalName);
        if (generatedLocalNames.some((name) => localNames.has(name) || importLocalNames.has(name) || reservedLocalNames.has(name))) {
            return false;
        }
        for (const name of generatedLocalNames) {
            localNames.add(name);
        }
        for (let index = 1; index < arities.length; index++) {
            if (arities[index] === arities[index - 1]) {
                return false;
            }
        }
        const minArity = arities[0];
        const maxArity = arities[arities.length - 1];
        for (let arity = minArity; arity <= maxArity; arity++) {
            if (!arities.includes(arity)) {
                return false;
            }
        }
        const orderedVariants = [...variants].sort((left, right) => left.sourceTypeFamily.typeArgumentCount - right.sourceTypeFamily.typeArgumentCount);
        const maxTypeParameters = orderedVariants[orderedVariants.length - 1].typeParameters ?? [];
        for (const variant of orderedVariants) {
            const typeParameters = variant.typeParameters ?? [];
            for (let index = 0; index < typeParameters.length; index++) {
                if (getProviderTypeParameterContractKey(typeParameters[index]) !== getProviderTypeParameterContractKey(maxTypeParameters[index])) {
                    return false;
                }
            }
        }
        for (let index = minArity; index < maxArity; index++) {
            if ((maxTypeParameters[index]?.constraints?.length ?? 0) > 0) {
                return false;
            }
        }
    }
    return true;
}
function isValidProviderExportName(value) {
    const exportName = getProviderExportName(value);
    if (value.exportKind !== undefined && value.exportKind !== "named" && value.exportKind !== "default") {
        return false;
    }
    if (value.exportKind === "default" && value.exportName !== undefined && value.exportName !== "default") {
        return false;
    }
    if (exportName !== "default" && !isIdentifierText(exportName)) {
        return false;
    }
    return exportName !== "default" || value.kind !== "type" && value.kind !== "namespace";
}
function isValidProviderHeritageDeclaration(value) {
    return (value.kind === "extends" || value.kind === "implements")
        && isValidProviderTypeExpression(value.type);
}
function hasRequiredProviderExportShape(value) {
    switch (value.kind) {
        case "function":
            return value.signatures !== undefined
                && value.signatures.length > 0
                && value.signatures.every((signature) => signature.returnType !== undefined);
        case "type":
        case "value":
            return value.type !== undefined;
        case "class":
        case "interface":
        case "namespace":
        case "enum":
        case "opaque":
            return true;
    }
}
function isValidProviderMemberDeclaration(value) {
    return value.id.length > 0
        && (value.kind === "constructor" || isValidProviderPropertyName(value.name))
        && hasRequiredProviderMemberShape(value)
        && (value.type === undefined || isValidProviderTypeExpression(value.type))
        && (value.signatures ?? []).every(isValidProviderSignatureDeclaration);
}
function isValidProviderEnumMemberDeclaration(value) {
    return value.id.length > 0 && isValidProviderPropertyName(value.name);
}
function isValidProviderNamespaceMemberDeclaration(value) {
    return value.id.length > 0
        && isValidProviderNamespaceMemberName(value.name)
        && (value.kind === "method" || value.kind === "property" || value.kind === "field")
        && hasRequiredProviderMemberShape(value)
        && (value.type === undefined || isValidProviderTypeExpression(value.type))
        && (value.signatures ?? []).every(isValidProviderSignatureDeclaration);
}
function hasRequiredProviderMemberShape(value) {
    switch (value.kind) {
        case "method":
            return value.signatures !== undefined
                && value.signatures.length > 0
                && value.signatures.every((signature) => signature.returnType !== undefined);
        case "property":
        case "field":
            return value.type !== undefined;
        case "indexer":
            return value.signatures !== undefined
                && value.signatures.length > 0
                && value.signatures.every((signature) => signature.parameters.length === 1 && signature.returnType !== undefined);
        case "constructor":
            return value.signatures !== undefined && value.signatures.length > 0;
    }
}
function isValidProviderSignatureDeclaration(value) {
    return value.id.length > 0
        && (value.name === undefined || isIdentifierText(value.name))
        && value.parameters.every(isValidProviderParameterDeclaration)
        && (value.returnType === undefined || isValidProviderTypeExpression(value.returnType))
        && (value.typeParameters ?? []).every(isValidProviderTypeParameterDeclaration);
}
function isValidProviderParameterDeclaration(value) {
    return isIdentifierText(value.name)
        && isValidProviderTypeExpression(value.type)
        && (value.passingMode === undefined || isArgumentPassingMode(value.passingMode))
        && (value.defaultType === undefined || isValidProviderTypeExpression(value.defaultType));
}
function isValidProviderTypeParameterDeclaration(value) {
    return isIdentifierText(value.name)
        && (value.constraints ?? []).every(isValidProviderTypeExpression)
        && (value.defaultType === undefined || isValidProviderTypeExpression(value.defaultType));
}
function isValidProviderTypeExpression(value) {
    switch (value.kind) {
        case "any":
        case "unknown":
        case "void":
        case "never":
        case "undefined":
        case "boolean":
        case "string":
        case "number":
        case "bigint":
        case "object":
            return true;
        case "source-primitive":
            return isKnownSourcePrimitive(value.name);
        case "type-parameter":
            return isIdentifierText(value.name);
        case "target-named":
            return value.target.length > 0
                && value.id.length > 0
                && (value.typeArguments ?? []).every(isValidProviderTypeExpression)
                && value.sourceShape !== undefined
                && isValidProviderTypeExpression(value.sourceShape);
        case "array":
            return isValidProviderTypeExpression(value.elementType);
        case "tuple":
            return value.elementTypes.every(isValidProviderTypeExpression);
        case "union":
        case "intersection":
            return value.types.length > 0 && value.types.every(isValidProviderTypeExpression);
        case "function":
            return value.parameters.every(isValidProviderParameterDeclaration)
                && isValidProviderTypeExpression(value.returnType)
                && (value.typeParameters ?? []).every(isValidProviderTypeParameterDeclaration);
        case "literal":
            return typeof value.value !== "number" || Number.isFinite(value.value);
        case "provider-ref":
            return value.moduleSpecifier.length > 0
                && !isHostOwnedProviderVirtualFileName(value.moduleSpecifier)
                && (isIdentifierText(value.exportName) || value.exportName === "default")
                && (value.localName === undefined || isIdentifierText(value.localName))
                && (value.namespaceImport === undefined || isIdentifierText(value.namespaceImport))
                && !(value.localName !== undefined && value.namespaceImport !== undefined)
                && (value.exportName !== "default" || value.localName !== undefined || value.namespaceImport !== undefined)
                && (value.typeArguments ?? []).every(isValidProviderTypeExpression);
        case "opaque":
            return value.id.length > 0
                && value.sourceShape !== undefined
                && isValidProviderTypeExpression(value.sourceShape);
    }
}
function hasValidProviderExportTypeParameterScope(value) {
    const exportTypeParameters = value.typeParameters ?? [];
    if (!hasValidProviderTypeParameterDeclarations(exportTypeParameters, new Set())) {
        return false;
    }
    const exportTypeParameterScope = getProviderTypeParameterScope(new Set(), exportTypeParameters);
    if (value.type !== undefined && !hasValidProviderTypeExpressionScope(value.type, exportTypeParameterScope)) {
        return false;
    }
    if ((value.heritage ?? []).some((heritage) => !hasValidProviderTypeExpressionScope(heritage.type, exportTypeParameterScope))) {
        return false;
    }
    if ((value.signatures ?? []).some((signature) => !hasValidProviderSignatureTypeParameterScope(signature, new Set()))) {
        return false;
    }
    if (value.kind === "namespace") {
        return (value.members ?? []).every((member) => hasValidProviderNamespaceMemberTypeParameterScope(member));
    }
    if (value.kind === "enum") {
        return true;
    }
    return (value.members ?? []).every((member) => hasValidProviderMemberTypeParameterScope(member, exportTypeParameterScope));
}
function hasValidProviderMemberTypeParameterScope(member, parentScope) {
    const memberParentScope = member.static === true ? new Set() : parentScope;
    if (member.type !== undefined && !hasValidProviderTypeExpressionScope(member.type, memberParentScope)) {
        return false;
    }
    return (member.signatures ?? []).every((signature) => hasValidProviderSignatureTypeParameterScope(signature, memberParentScope));
}
function hasValidProviderNamespaceMemberTypeParameterScope(member) {
    if (member.type !== undefined && !hasValidProviderTypeExpressionScope(member.type, new Set())) {
        return false;
    }
    return (member.signatures ?? []).every((signature) => hasValidProviderSignatureTypeParameterScope(signature, new Set()));
}
function hasValidProviderSignatureTypeParameterScope(signature, parentScope) {
    const typeParameters = signature.typeParameters ?? [];
    if (!hasValidProviderTypeParameterDeclarations(typeParameters, parentScope)) {
        return false;
    }
    const scope = getProviderTypeParameterScope(parentScope, typeParameters);
    return signature.parameters.every((parameter) => hasValidProviderParameterTypeParameterScope(parameter, scope))
        && (signature.returnType === undefined || hasValidProviderTypeExpressionScope(signature.returnType, scope));
}
function hasValidProviderParameterTypeParameterScope(parameter, scope) {
    return hasValidProviderTypeExpressionScope(parameter.type, scope)
        && (parameter.defaultType === undefined || hasValidProviderTypeExpressionScope(parameter.defaultType, scope));
}
function hasValidProviderTypeParameterDeclarations(typeParameters, parentScope) {
    const names = new Set();
    let hasDefault = false;
    for (const parameter of typeParameters) {
        if (names.has(parameter.name) || parentScope.has(parameter.name)) {
            return false;
        }
        if (hasDefault && parameter.defaultType === undefined) {
            return false;
        }
        if (parameter.defaultType !== undefined) {
            hasDefault = true;
        }
        names.add(parameter.name);
    }
    const scope = new Set(parentScope);
    for (const parameter of typeParameters) {
        const constraintScope = new Set(scope);
        constraintScope.add(parameter.name);
        if ((parameter.constraints ?? []).some((constraint) => !hasValidProviderTypeExpressionScope(constraint, constraintScope))) {
            return false;
        }
        if (parameter.defaultType !== undefined && !hasValidProviderTypeExpressionScope(parameter.defaultType, scope)) {
            return false;
        }
        scope.add(parameter.name);
    }
    return true;
}
function hasValidProviderReferenceBindingsForExport(declaration, context) {
    if (declaration.type !== undefined && !hasValidProviderReferenceBindings(declaration.type, context)) {
        return false;
    }
    if ((declaration.typeParameters ?? []).some((parameter) => !hasValidProviderTypeParameterReferenceBindings(parameter, context))) {
        return false;
    }
    if ((declaration.heritage ?? []).some((heritage) => !hasValidProviderReferenceBindings(heritage.type, context))) {
        return false;
    }
    if ((declaration.signatures ?? []).some((signature) => !hasValidProviderSignatureReferenceBindings(signature, context))) {
        return false;
    }
    return (declaration.members ?? []).every((member) => hasValidProviderMemberReferenceBindings(member, context));
}
function hasValidProviderTypeParameterReferenceBindings(parameter, context) {
    return (parameter.constraints ?? []).every((constraint) => hasValidProviderReferenceBindings(constraint, context))
        && (parameter.defaultType === undefined || hasValidProviderReferenceBindings(parameter.defaultType, context));
}
function hasValidProviderSignatureReferenceBindings(signature, context) {
    return (signature.typeParameters ?? []).every((parameter) => hasValidProviderTypeParameterReferenceBindings(parameter, context))
        && signature.parameters.every((parameter) => hasValidProviderParameterReferenceBindings(parameter, context))
        && (signature.returnType === undefined || hasValidProviderReferenceBindings(signature.returnType, context));
}
function hasValidProviderParameterReferenceBindings(parameter, context) {
    return hasValidProviderReferenceBindings(parameter.type, context)
        && (parameter.defaultType === undefined || hasValidProviderReferenceBindings(parameter.defaultType, context));
}
function hasValidProviderMemberReferenceBindings(member, context) {
    return (member.type === undefined || hasValidProviderReferenceBindings(member.type, context))
        && (member.signatures ?? []).every((signature) => hasValidProviderSignatureReferenceBindings(signature, context));
}
function hasValidProviderReferenceBindings(type, context) {
    switch (type.kind) {
        case "any":
        case "unknown":
        case "void":
        case "never":
        case "undefined":
        case "boolean":
        case "string":
        case "number":
        case "bigint":
        case "object":
        case "source-primitive":
        case "type-parameter":
        case "literal":
            return true;
        case "target-named":
            return (type.typeArguments ?? []).every((typeArgument) => hasValidProviderReferenceBindings(typeArgument, context))
                && type.sourceShape !== undefined
                && hasValidProviderReferenceBindings(type.sourceShape, context);
        case "array":
            return hasValidProviderReferenceBindings(type.elementType, context);
        case "tuple":
            return type.elementTypes.every((elementType) => hasValidProviderReferenceBindings(elementType, context));
        case "union":
        case "intersection":
            return type.types.every((memberType) => hasValidProviderReferenceBindings(memberType, context));
        case "function":
            return (type.typeParameters ?? []).every((parameter) => hasValidProviderTypeParameterReferenceBindings(parameter, context))
                && type.parameters.every((parameter) => hasValidProviderParameterReferenceBindings(parameter, context))
                && hasValidProviderReferenceBindings(type.returnType, context);
        case "provider-ref":
            return hasValidProviderRefBinding(type, context)
                && (type.typeArguments ?? []).every((typeArgument) => hasValidProviderReferenceBindings(typeArgument, context));
        case "opaque":
            return type.sourceShape !== undefined && hasValidProviderReferenceBindings(type.sourceShape, context);
    }
}
function hasValidProviderRefBinding(type, context) {
    if (type.moduleSpecifier === context.moduleSpecifier) {
        const declaration = context.exportsByName.get(type.exportName);
        if (declaration === undefined || !context.sameModuleProviderRefNames.has(type.exportName)) {
            return false;
        }
        if (declaration.sourceTypeFamily === undefined) {
            return isProviderDeclarationTypeCapable(declaration);
        }
        const variant = context.typeFamilyVariantByProviderRefKey.get(getProviderRefKey(type.moduleSpecifier, type.exportName, type.typeArguments?.length ?? 0));
        return variant !== undefined && isProviderDeclarationTypeCapable(variant);
    }
    if (type.namespaceImport !== undefined) {
        return context.importBindings.some((importDeclaration) => importDeclaration.moduleSpecifier === type.moduleSpecifier
            && importDeclaration.namespaceImport === type.namespaceImport);
    }
    if (type.exportName === "default") {
        return type.localName !== undefined
            && context.importBindings.some((importDeclaration) => importDeclaration.moduleSpecifier === type.moduleSpecifier
                && importDeclaration.defaultImport === type.localName);
    }
    const renderedLocalName = type.localName ?? type.exportName;
    return context.importBindings.some((importDeclaration) => importDeclaration.moduleSpecifier === type.moduleSpecifier
        && (importDeclaration.namedImports ?? []).some((namedImport) => namedImport.exportedName === type.exportName
            && (namedImport.localName ?? namedImport.exportedName) === renderedLocalName));
}
function hasValidProviderValueHeritageReferences(declaration, context) {
    if (declaration.kind !== "class") {
        return true;
    }
    return (declaration.heritage ?? []).every((heritage) => heritage.kind !== "extends" || hasValidProviderValueHeritageReference(heritage.type, context));
}
function hasValidProviderValueHeritageReference(type, context) {
    if (type.kind === "target-named" || type.kind === "opaque") {
        return type.sourceShape !== undefined && hasValidProviderValueHeritageReference(type.sourceShape, context);
    }
    if (type.kind !== "provider-ref") {
        return false;
    }
    if (type.moduleSpecifier !== context.moduleSpecifier) {
        return hasValueCapableProviderImportBinding(type, context.importBindings);
    }
    const declaration = context.exportsByName.get(type.exportName);
    if (declaration === undefined) {
        return false;
    }
    if (declaration.sourceTypeFamily === undefined) {
        if (declaration.kind !== "class") {
            return false;
        }
        const typeArgumentCount = type.typeArguments?.length ?? 0;
        const arity = getProviderClassArity(declaration);
        return typeArgumentCount >= arity.required && typeArgumentCount <= arity.maximum;
    }
    const sourceTypeArgumentCount = type.typeArguments?.length ?? 0;
    const selectedVariant = [...context.exportsByName.values()].find((candidate) => candidate.sourceTypeFamily?.exportName === declaration.sourceTypeFamily?.exportName
        && candidate.sourceTypeFamily?.typeArgumentCount === sourceTypeArgumentCount);
    return selectedVariant?.kind === "class";
}
function hasValueCapableProviderImportBinding(type, imports) {
    return imports.some((importDeclaration) => {
        if (importDeclaration.moduleSpecifier !== type.moduleSpecifier || importDeclaration.typeOnly === true) {
            return false;
        }
        if (type.namespaceImport !== undefined) {
            return importDeclaration.namespaceImport === type.namespaceImport;
        }
        if (type.exportName === "default") {
            return type.localName !== undefined && importDeclaration.defaultImport === type.localName;
        }
        const localName = type.localName ?? type.exportName;
        return (importDeclaration.namedImports ?? []).some((namedImport) => namedImport.exportedName === type.exportName
            && (namedImport.localName ?? namedImport.exportedName) === localName
            && namedImport.kind !== "type");
    });
}
function getProviderTypeParameterScope(parentScope, typeParameters) {
    const scope = new Set(parentScope);
    for (const parameter of typeParameters) {
        scope.add(parameter.name);
    }
    return scope;
}
function hasValidProviderTypeExpressionScope(type, scope) {
    switch (type.kind) {
        case "any":
        case "unknown":
        case "void":
        case "never":
        case "undefined":
        case "boolean":
        case "string":
        case "number":
        case "bigint":
        case "object":
        case "source-primitive":
        case "literal":
            return true;
        case "type-parameter":
            return scope.has(type.name);
        case "target-named":
            return (type.typeArguments ?? []).every((typeArgument) => hasValidProviderTypeExpressionScope(typeArgument, scope))
                && type.sourceShape !== undefined
                && hasValidProviderTypeExpressionScope(type.sourceShape, scope);
        case "array":
            return hasValidProviderTypeExpressionScope(type.elementType, scope);
        case "tuple":
            return type.elementTypes.every((elementType) => hasValidProviderTypeExpressionScope(elementType, scope));
        case "union":
        case "intersection":
            return type.types.every((memberType) => hasValidProviderTypeExpressionScope(memberType, scope));
        case "function": {
            const typeParameters = type.typeParameters ?? [];
            if (!hasValidProviderTypeParameterDeclarations(typeParameters, scope)) {
                return false;
            }
            const functionScope = getProviderTypeParameterScope(scope, typeParameters);
            return type.parameters.every((parameter) => hasValidProviderParameterTypeParameterScope(parameter, functionScope))
                && hasValidProviderTypeExpressionScope(type.returnType, functionScope);
        }
        case "provider-ref":
            return (type.typeArguments ?? []).every((typeArgument) => hasValidProviderTypeExpressionScope(typeArgument, scope));
        case "opaque":
            return type.sourceShape !== undefined && hasValidProviderTypeExpressionScope(type.sourceShape, scope);
    }
}
function isIdentifierText(text) {
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(text);
}
function isValidProviderPropertyName(name) {
    if (typeof name === "string") {
        return isIdentifierText(name);
    }
    switch (name.kind) {
        case "identifier":
            return isIdentifierText(name.text);
        case "string-literal":
            return name.text.length > 0;
        case "number-literal":
            return Number.isFinite(name.value);
        case "well-known-symbol":
            return isProviderWellKnownSymbolName(name.name);
    }
}
function isValidProviderNamespaceMemberName(name) {
    if (typeof name === "string") {
        return isIdentifierText(name);
    }
    return name.kind === "identifier" && isIdentifierText(name.text);
}
function isProviderWellKnownSymbolName(name) {
    switch (name) {
        case "asyncIterator":
        case "hasInstance":
        case "isConcatSpreadable":
        case "iterator":
        case "match":
        case "matchAll":
        case "replace":
        case "search":
        case "species":
        case "split":
        case "toPrimitive":
        case "toStringTag":
        case "unscopables":
            return true;
        default:
            return false;
    }
}
function isKnownSourcePrimitive(name) {
    switch (name) {
        case "bool":
        case "int8":
        case "uint8":
        case "int16":
        case "uint16":
        case "int32":
        case "uint32":
        case "int64":
        case "uint64":
        case "native-int":
        case "native-uint":
        case "int128":
        case "uint128":
        case "float16":
        case "float32":
        case "float64":
        case "decimal":
        case "char":
            return true;
        default:
            return false;
    }
}
//# sourceMappingURL=host.js.map