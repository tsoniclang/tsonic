import { Program_GetSourceFile, Program_GetSourceFiles } from "../internal/compiler/program.js";
import { createAstReader } from "../services/ast-reader.js";
import { createTypeCheckerQueries } from "../services/type-checker.js";
import { createTypeShapeQueries } from "../services/type-shape.js";
import { ExtensionObservationPoint } from "./observations.js";
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
};
export const TstsProviderContractVersion = "tsts.provider.1";
export const ExtensionLifecycleEvent = {
    afterSourceFileBound: "binder.afterSourceFileBound",
    beforeSemanticsFinalized: "semantics.beforeFinalized",
};
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
    #semanticProviders = new Map();
    #virtualModules = new Map();
    #virtualModulesByFileName = new Map();
    #virtualDocumentsByUri = new Map();
    constructor(diagnostics, requiredProviderModules = []) {
        this.#diagnostics = diagnostics;
        this.#requiredProviderModules = requiredProviderModules;
    }
    registerTargetBindingProvider(provider) {
        const diagnostic = validateProviderIdentity(provider.identity, "binding");
        if (diagnostic !== undefined) {
            this.#diagnostics.append(diagnostic);
            return false;
        }
        if (!this.#diagnostics.registerDiagnosticRange(provider.identity.id, provider.identity.diagnosticRange)) {
            return false;
        }
        const existing = this.#bindingProviders.get(provider.identity.id);
        if (existing !== undefined && existing !== provider) {
            this.#diagnostics.append(createHostDiagnostic({
                extensionCode: "DUPLICATE_TARGET_BINDING_PROVIDER",
                numericCode: ExtensionHostDiagnosticCode.duplicateProvider,
                message: `Duplicate target binding provider id '${provider.identity.id}'.`,
                identity: `duplicate-binding-provider:${provider.identity.id}`,
            }));
            return false;
        }
        this.#bindingProviders.set(provider.identity.id, provider);
        return true;
    }
    registerTargetSemanticProvider(provider) {
        const diagnostic = validateProviderIdentity(provider.identity, "semantic");
        if (diagnostic !== undefined) {
            this.#diagnostics.append(diagnostic);
            return false;
        }
        if (!this.#diagnostics.registerDiagnosticRange(provider.identity.id, provider.identity.diagnosticRange)) {
            return false;
        }
        const existing = this.#semanticProviders.get(provider.identity.id);
        if (existing !== undefined && existing !== provider) {
            this.#diagnostics.append(createHostDiagnostic({
                extensionCode: "DUPLICATE_TARGET_SEMANTIC_PROVIDER",
                numericCode: ExtensionHostDiagnosticCode.duplicateProvider,
                message: `Duplicate target semantic provider id '${provider.identity.id}'.`,
                identity: `duplicate-semantic-provider:${provider.identity.id}`,
            }));
            return false;
        }
        this.#semanticProviders.set(provider.identity.id, provider);
        return true;
    }
    get bindingProviders() {
        return Array.from(this.#bindingProviders.values());
    }
    get semanticProviders() {
        return Array.from(this.#semanticProviders.values());
    }
    requiresProviderForModule(specifier, context = {}) {
        return this.#requiredProviderModules.find((required) => specifier.startsWith(required.specifierPrefix)
            && (required.target === undefined || context.activeTarget === undefined || required.target === context.activeTarget));
    }
    getTargetBindingProvider(id) {
        return this.#bindingProviders.get(id);
    }
    getTargetSemanticProvider(id) {
        return this.#semanticProviders.get(id);
    }
    getModuleOwner(specifier, context = {}) {
        const owners = this.#collectModuleOwners(specifier, context);
        if (owners.kind !== "owned") {
            return undefined;
        }
        return owners.provider;
    }
    resolveVirtualModule(specifier, context = {}) {
        const owner = this.#collectModuleOwners(specifier, context);
        if (owner.kind === "unowned") {
            const required = this.requiresProviderForModule(specifier, context);
            if (required !== undefined) {
                const diagnostic = createHostDiagnostic({
                    extensionCode: "REQUIRED_PROVIDER_MISSING",
                    numericCode: ExtensionHostDiagnosticCode.providerMissing,
                    message: required.message ?? `No target binding provider is installed for provider-owned module '${specifier}'.`,
                    evidence: [{ message: "Required provider module pattern", details: required }],
                    identity: `required-provider-missing:${specifier}:${required.specifierPrefix}:${required.providerId ?? ""}:${required.target ?? ""}`,
                });
                this.#diagnostics.append(diagnostic);
                return { kind: "rejected", diagnostic };
            }
            return { kind: "unowned" };
        }
        if (owner.kind === "rejected") {
            return owner;
        }
        if (owner.kind === "conflict") {
            return owner;
        }
        const cacheKey = getProviderResolveCacheKey(owner.provider.identity, specifier, context);
        const cached = this.#virtualModules.get(cacheKey);
        if (cached !== undefined) {
            return { kind: "resolved", module: cached };
        }
        const resolution = callProvider(this.#diagnostics, owner.provider.identity, "resolveModule", specifier, () => owner.provider.resolveModule(specifier, context));
        if (resolution === undefined) {
            return { kind: "rejected", diagnostic: this.#diagnostics.all().at(-1) };
        }
        if (isExtensionDiagnostic(resolution)) {
            this.#diagnostics.append(resolution);
            return { kind: "rejected", diagnostic: resolution };
        }
        if (!isValidProviderModuleResolution(resolution, specifier)) {
            const diagnostic = createHostDiagnostic({
                extensionCode: "INVALID_PROVIDER_MODULE_RESOLUTION",
                numericCode: ExtensionHostDiagnosticCode.providerResolutionFailed,
                message: `Provider '${owner.provider.identity.id}' returned an invalid virtual module resolution for '${specifier}'.`,
                evidence: [{ message: "Resolution", details: resolution }],
                identity: `invalid-provider-resolution:${owner.provider.identity.id}:${specifier}`,
            });
            this.#diagnostics.append(diagnostic);
            return { kind: "rejected", diagnostic };
        }
        const declarationModel = callProvider(this.#diagnostics, owner.provider.identity, "getDeclarationModel", specifier, () => owner.provider.getDeclarationModel(resolution));
        if (declarationModel === undefined) {
            return { kind: "rejected", diagnostic: this.#diagnostics.all().at(-1) };
        }
        if (isExtensionDiagnostic(declarationModel)) {
            this.#diagnostics.append(declarationModel);
            return { kind: "rejected", diagnostic: declarationModel };
        }
        if (!isValidProviderDeclarationModel(declarationModel, resolution)) {
            const diagnostic = createHostDiagnostic({
                extensionCode: "INVALID_PROVIDER_DECLARATION_MODEL",
                numericCode: ExtensionHostDiagnosticCode.invalidProviderDeclaration,
                message: `Provider '${owner.provider.identity.id}' returned an invalid declaration model for '${specifier}'.`,
                evidence: [{ message: "Declaration model", details: declarationModel }],
                identity: `invalid-provider-declaration:${owner.provider.identity.id}:${specifier}`,
            });
            this.#diagnostics.append(diagnostic);
            return { kind: "rejected", diagnostic };
        }
        const virtualSourceText = renderProviderDeclarationModel(declarationModel);
        const virtualDocument = {
            uri: resolution.virtualFileName,
            fileName: resolution.virtualFileName,
            moduleSpecifier: resolution.moduleSpecifier,
            providerModuleId: resolution.providerModuleId,
            provider: owner.provider.identity,
            context,
            declarationModel,
            sourceText: virtualSourceText,
            readOnly: true,
            ...(resolution.evidence !== undefined || declarationModel.evidence !== undefined
                ? { evidence: [...(resolution.evidence ?? []), ...(declarationModel.evidence ?? [])] }
                : {}),
        };
        const module = {
            provider: owner.provider,
            resolution,
            declarationModel,
            context,
            virtualSourceText,
            virtualDocument,
            cacheKey,
        };
        this.#virtualModules.set(cacheKey, module);
        this.#virtualModulesByFileName.set(resolution.virtualFileName, module);
        this.#virtualDocumentsByUri.set(virtualDocument.uri, virtualDocument);
        return { kind: "resolved", module };
    }
    getVirtualModuleByFileName(fileName) {
        return this.#virtualModulesByFileName.get(fileName);
    }
    getVirtualDeclarationDocument(uriOrFileName) {
        return this.#virtualDocumentsByUri.get(uriOrFileName);
    }
    getVirtualDeclarationDocuments() {
        return Array.from(this.#virtualDocumentsByUri.values());
    }
    #collectModuleOwners(specifier, context) {
        const owners = [];
        for (const provider of this.#bindingProviders.values()) {
            const ownership = callProvider(this.#diagnostics, provider.identity, "ownsModule", specifier, () => provider.ownsModule(specifier, context));
            if (ownership === undefined) {
                return { kind: "rejected", diagnostic: this.#diagnostics.all().at(-1) };
            }
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
        this.#diagnostics.append(createHostDiagnostic({
            extensionCode: "PROVIDER_OWNERSHIP_CONFLICT",
            numericCode: ExtensionHostDiagnosticCode.providerOwnershipConflict,
            message: `Multiple target binding providers claim module '${specifier}': ${owners.map((provider) => provider.identity.id).join(", ")}.`,
            evidence: owners.map((provider) => ({ message: "Claiming provider", details: provider.identity })),
            identity: `provider-ownership-conflict:${specifier}:${owners.map((provider) => provider.identity.id).sort().join(",")}`,
        }));
        return { kind: "conflict", providers: owners };
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
        const registered = this.providers.registerTargetSemanticProvider(provider);
        if (!registered) {
            return false;
        }
        this.#registerTargetSemanticProviderObservations(extensionId, provider);
        return true;
    }
    runObservation(observation, request, core, options = {}) {
        const owner = this.getObservationOwner(observation);
        if (owner === undefined && options.requireOwner === true) {
            this.requireObservationOwner(observation);
            return { kind: "missing-owner", observation };
        }
        const hooks = this.#observationHooks.get(observation) ?? [];
        const selectedHooks = owner === undefined ? hooks : hooks.filter((hook) => hook.extensionId === owner.identity.id);
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
                observationResult = registered.hook(request, {
                    observation,
                    extensionId: registered.extensionId,
                    compiler: this.getCompilerQueryContext(),
                    host: this,
                    facts: this.facts,
                    factResolver: this.factResolver,
                    diagnostics: this.diagnostics,
                });
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
        const hooks = this.#lifecycleHooks.get(event);
        if (hooks === undefined) {
            return;
        }
        for (const registered of hooks) {
            try {
                registered.hook(request, {
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
                getSourceFiles: () => Program_GetSourceFiles(program) ?? [],
                getSourceFile: (fileName) => Program_GetSourceFile(program, fileName),
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
        return callback();
    }
    catch (error) {
        const numericCode = operation === "ownsModule"
            ? ExtensionHostDiagnosticCode.providerOwnershipFailed
            : operation === "resolveModule"
                ? ExtensionHostDiagnosticCode.providerResolveFailed
                : ExtensionHostDiagnosticCode.providerDeclarationFailed;
        diagnostics.append(createHostDiagnostic({
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
        }));
        return undefined;
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
    const importSlice = context.importSlice;
    return [
        identity.id,
        identity.version,
        identity.target,
        identity.extensionContractVersion,
        identity.configHash ?? "",
        specifier,
        context.containingFile ?? "",
        String(context.resolutionMode ?? ""),
        context.activeTarget ?? "",
        context.activeSurface ?? "",
        importSlice?.kind ?? "",
        importSlice?.typeOnly === true ? "type" : "",
        importSlice?.broadImport === true ? "broad" : "",
        ...(importSlice?.requestedExports ?? []).map((request) => `${request.exportedName}:${request.localName ?? ""}:${request.kind ?? ""}`).sort(),
    ].join("\0");
}
function renderProviderDeclarationModel(model) {
    const lines = [
        `// @tsts-provider-module ${model.providerModuleId}`,
        `// @tsts-provider-specifier ${JSON.stringify(model.moduleSpecifier)}`,
    ];
    for (const importDeclaration of model.imports ?? []) {
        lines.push(renderProviderImportDeclaration(importDeclaration));
    }
    for (const exportDeclaration of model.exports) {
        lines.push(renderProviderExportDeclaration(exportDeclaration));
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
function renderProviderExportDeclaration(declaration) {
    const typeParameters = renderProviderTypeParameters(declaration.typeParameters ?? []);
    const exportName = getProviderExportName(declaration);
    const isDefault = exportName === "default" || declaration.exportKind === "default";
    const canInlineDefault = isDefault && canRenderInlineDefaultProviderExport(declaration.kind);
    const directNamedExport = !isDefault && exportName === declaration.name;
    const declarationPrefix = directNamedExport
        ? "export declare "
        : canInlineDefault
            ? "export default "
            : "declare ";
    const typePrefix = directNamedExport ? "export " : "";
    const localTypePrefix = directNamedExport ? "export " : "";
    let rendered;
    switch (declaration.kind) {
        case "class":
            rendered = `${declarationPrefix}class ${declaration.name}${typeParameters}${renderProviderHeritage(declaration.heritage ?? [], "class")} {\n${renderProviderMembers(declaration.members ?? [])}\n}`;
            break;
        case "interface":
            rendered = `${canInlineDefault ? "export default " : localTypePrefix}interface ${declaration.name}${typeParameters}${renderProviderHeritage(declaration.heritage ?? [], "interface")} {\n${renderProviderMembers(declaration.members ?? [])}\n}`;
            break;
        case "function":
            rendered = renderProviderSignatures(declaration.name, declaration.signatures ?? [])
                .map((signature) => `${canInlineDefault ? "export default " : declarationPrefix}function ${signature}`)
                .join("\n");
            break;
        case "type":
            rendered = `${typePrefix}type ${declaration.name}${typeParameters} = ${renderProviderTypeExpression(declaration.type)};`;
            break;
        case "value":
            rendered = `${declarationPrefix}const ${declaration.name}: ${renderProviderTypeExpression(declaration.type)};`;
            break;
        case "namespace":
            rendered = `${declarationPrefix}namespace ${declaration.name} {\n${renderProviderNamespaceMembers(declaration.members ?? [])}\n}`;
            break;
        case "enum":
            rendered = `${declarationPrefix}enum ${declaration.name} {\n${(declaration.members ?? []).map((member) => `  ${renderProviderPropertyName(member.name)},`).join("\n")}\n}`;
            break;
        case "opaque":
            rendered = `${declarationPrefix}const ${declaration.name}: unique symbol;`;
            break;
    }
    if (directNamedExport || canInlineDefault) {
        return rendered;
    }
    return isDefault
        ? `${rendered}\nexport default ${declaration.name};`
        : `${rendered}\nexport { ${declaration.name} as ${exportName} };`;
}
function renderProviderHeritage(heritage, declarationKind) {
    const extendsTypes = heritage.filter((clause) => clause.kind === "extends").map((clause) => renderProviderTypeExpression(clause.type));
    const implementsTypes = declarationKind === "class"
        ? heritage.filter((clause) => clause.kind === "implements").map((clause) => renderProviderTypeExpression(clause.type))
        : [];
    return [
        extendsTypes.length > 0 ? ` extends ${extendsTypes.join(", ")}` : "",
        implementsTypes.length > 0 ? ` implements ${implementsTypes.join(", ")}` : "",
    ].join("");
}
function renderProviderMembers(members) {
    return members.map((member) => `  ${renderProviderMember(member)}`).join("\n");
}
function renderProviderNamespaceMembers(members) {
    return members.map((member) => `  ${renderProviderNamespaceMember(member)}`).join("\n");
}
function renderProviderMember(member) {
    const staticPrefix = member.static === true ? "static " : "";
    const readonlyPrefix = member.readonly === true ? "readonly " : "";
    const optionalSuffix = member.optional === true ? "?" : "";
    const name = renderProviderPropertyName(member.name);
    switch (member.kind) {
        case "constructor":
            return renderProviderSignatures("constructor", member.signatures ?? [{ id: member.id, parameters: [] }]).join("\n  ");
        case "method":
            return renderProviderSignatures(name, member.signatures ?? []).map((signature) => `${staticPrefix}${signature}`).join("\n  ");
        case "property":
        case "field":
            return `${staticPrefix}${readonlyPrefix}${name}${optionalSuffix}: ${renderProviderTypeExpression(member.type)};`;
        case "indexer": {
            const signature = member.signatures[0];
            const parameter = signature.parameters[0];
            return `[${renderProviderParameter(parameter)}]: ${renderProviderTypeExpression(signature.returnType)};`;
        }
    }
}
function renderProviderNamespaceMember(member) {
    const name = renderProviderPropertyName(member.name);
    switch (member.kind) {
        case "method":
            return renderProviderSignatures(name, member.signatures ?? []).map((signature) => `export function ${signature}`).join("\n  ");
        case "property":
        case "field":
            return `export const ${name}: ${renderProviderTypeExpression(member.type)};`;
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
function renderProviderPropertyName(name) {
    if (typeof name === "string") {
        return name;
    }
    switch (name.kind) {
        case "identifier":
            return name.text;
        case "string-literal":
            return JSON.stringify(name.text);
        case "number-literal":
            return JSON.stringify(name.value);
        case "well-known-symbol":
            return `[Symbol.${name.name}]`;
    }
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
function renderProviderSignatures(name, signatures) {
    return signatures.map((signature) => {
        const typeParameters = renderProviderTypeParameters(signature.typeParameters ?? []);
        const parameters = signature.parameters.map(renderProviderParameter).join(", ");
        const returnType = name === "constructor" ? "" : `: ${renderProviderTypeExpression(signature.returnType ?? { kind: "void" })}`;
        return `${name}${typeParameters}(${parameters})${returnType};`;
    });
}
function renderProviderTypeParameters(typeParameters) {
    if (typeParameters.length === 0) {
        return "";
    }
    return `<${typeParameters.map((parameter) => {
        const constraints = parameter.constraints ?? [];
        const constraintText = constraints.length === 0 ? "" : ` extends ${constraints.map(renderProviderTypeExpression).join(" & ")}`;
        const defaultText = parameter.defaultType === undefined ? "" : ` = ${renderProviderTypeExpression(parameter.defaultType)}`;
        return `${parameter.name}${constraintText}${defaultText}`;
    }).join(", ")}>`;
}
function renderProviderParameter(parameter) {
    const restPrefix = parameter.rest === true ? "..." : "";
    const optionalSuffix = parameter.optional === true && parameter.rest !== true ? "?" : "";
    return `${restPrefix}${parameter.name}${optionalSuffix}: ${renderProviderTypeExpression(parameter.type)}`;
}
function renderProviderTypeExpression(type) {
    switch (type.kind) {
        case "any":
        case "unknown":
        case "void":
        case "never":
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
            return renderProviderTypeExpression(type.sourceShape);
        case "array":
            return `${renderProviderTypeExpression(type.elementType)}[]`;
        case "tuple":
            return `[${type.elementTypes.map(renderProviderTypeExpression).join(", ")}]`;
        case "union":
            return type.types.map(renderProviderTypeExpression).join(" | ");
        case "intersection":
            return type.types.map(renderProviderTypeExpression).join(" & ");
        case "function":
            return `${renderProviderTypeParameters(type.typeParameters ?? [])}(${type.parameters.map(renderProviderParameter).join(", ")}) => ${renderProviderTypeExpression(type.returnType)}`;
        case "literal":
            return type.value === null ? "null" : JSON.stringify(type.value);
        case "provider-ref":
            const providerRefName = type.namespaceImport === undefined
                ? type.localName ?? type.exportName
                : `${type.namespaceImport}.${type.exportName}`;
            return type.typeArguments === undefined || type.typeArguments.length === 0
                ? providerRefName
                : `${providerRefName}<${type.typeArguments.map(renderProviderTypeExpression).join(", ")}>`;
    }
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
function validateProviderIdentity(identity, expectedKind) {
    const invalidFields = [];
    if (identity.id.length === 0) {
        invalidFields.push("id");
    }
    if (identity.version.length === 0) {
        invalidFields.push("version");
    }
    if (identity.target.length === 0) {
        invalidFields.push("target");
    }
    if (identity.extensionContractVersion.length === 0) {
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
function isExtensionDiagnostic(value) {
    return "extensionId" in value
        && typeof value.extensionId === "string"
        && typeof value.extensionCode === "string"
        && typeof value.numericCode === "number"
        && typeof value.category === "string"
        && typeof value.message === "string";
}
function isValidProviderModuleResolution(value, specifier) {
    return value.kind === "virtual"
        && value.moduleSpecifier === specifier
        && value.virtualFileName.length > 0
        && value.providerModuleId.length > 0;
}
function isValidProviderDeclarationModel(value, resolution) {
    return value.moduleSpecifier === resolution.moduleSpecifier
        && value.providerModuleId === resolution.providerModuleId
        && (value.imports ?? []).every(isValidProviderImportDeclaration)
        && Array.isArray(value.exports)
        && value.exports.every(isValidProviderExportDeclaration);
}
function isValidProviderImportDeclaration(value) {
    const hasNamespace = value.namespaceImport !== undefined;
    const hasDefault = value.defaultImport !== undefined;
    const namedImports = value.namedImports ?? [];
    return value.moduleSpecifier.length > 0
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
        && hasRequiredProviderExportShape(value)
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
            return true;
        case "provider-ref":
            return value.moduleSpecifier.length > 0
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