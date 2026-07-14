import { Program_GetSourceFile, Program_GetSourceFiles } from "../internal/compiler/program.js";
import { createAstReader } from "../services/ast-reader.js";
import { createTypeCheckerQueries } from "../services/type-checker.js";
import { createTypeShapeQueries } from "../services/type-shape.js";
import { ExtensionObservationPoint } from "./observations.js";
import { isArgumentPassingMode } from "./argument-passing.js";
import { getProviderExportContractKeyMap } from "./provider-export-contract.js";
import { providerFamilyVariantCompanionMarker } from "./provider-virtual-internal.js";
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
    #virtualSourceVariantsByModuleIdentity = new Map();
    #virtualFileIdentities = new Map();
    #canonicalExportsByModuleIdentity = new Map();
    #exactValueHeritageImportsByFileName = new Map();
    #familyVariantCompanionsByCanonicalFileName = new Map();
    #exactValueHeritageResolutionStack = new Set();
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
        const virtualModuleIdentity = getProviderVirtualModuleIdentity(owner.provider.identity, resolution, declarationModel);
        const virtualFileDiagnostic = this.#validateVirtualFileIdentity(resolution.virtualFileName, virtualModuleIdentity);
        if (virtualFileDiagnostic !== undefined) {
            this.#diagnostics.append(virtualFileDiagnostic);
            return { kind: "rejected", diagnostic: virtualFileDiagnostic };
        }
        const canonicalExportDiagnostic = this.#validateCanonicalExportContracts(owner.provider.identity, virtualModuleIdentity, declarationModel);
        if (canonicalExportDiagnostic !== undefined) {
            this.#diagnostics.append(canonicalExportDiagnostic);
            return { kind: "rejected", diagnostic: canonicalExportDiagnostic };
        }
        const exactValueHeritage = this.#prepareExactValueHeritageImports(owner.provider.identity, declarationModel, resolution, context);
        if (exactValueHeritage.kind === "rejected") {
            return exactValueHeritage;
        }
        const renderOptions = { exactValueHeritageImports: exactValueHeritage.imports };
        const directVirtualSourceText = renderProviderDeclarationModel(declarationModel, renderOptions);
        const canonicalExports = this.#getCanonicalExportsForRender(virtualModuleIdentity, declarationModel, directVirtualSourceText);
        const virtualSourceText = canonicalExports.size === 0
            ? directVirtualSourceText
            : renderProviderDeclarationModel(declarationModel, { ...renderOptions, canonicalExports });
        const effectiveVirtualFileName = this.#getEffectiveVirtualFileName(virtualModuleIdentity, resolution.virtualFileName, virtualSourceText, cacheKey);
        this.#recordVirtualFileIdentity(resolution.virtualFileName, virtualModuleIdentity);
        this.#recordVirtualFileIdentity(effectiveVirtualFileName, virtualModuleIdentity);
        this.#recordCanonicalExports(virtualModuleIdentity, declarationModel, effectiveVirtualFileName, canonicalExports);
        const effectiveResolution = effectiveVirtualFileName === resolution.virtualFileName
            ? resolution
            : { ...resolution, virtualFileName: effectiveVirtualFileName };
        const virtualDocument = {
            uri: effectiveResolution.virtualFileName,
            fileName: effectiveResolution.virtualFileName,
            moduleSpecifier: effectiveResolution.moduleSpecifier,
            providerModuleId: effectiveResolution.providerModuleId,
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
            resolution: effectiveResolution,
            declarationModel,
            context,
            virtualSourceText,
            virtualDocument,
            cacheKey,
        };
        this.#virtualModules.set(cacheKey, module);
        this.#virtualModulesByFileName.set(effectiveResolution.virtualFileName, module);
        this.#virtualDocumentsByUri.set(virtualDocument.uri, virtualDocument);
        this.#exactValueHeritageImportsByFileName.set(effectiveResolution.virtualFileName, exactValueHeritage.imports);
        return { kind: "resolved", module };
    }
    #prepareExactValueHeritageImports(provider, declarationModel, resolution, context) {
        const imports = new Map();
        const usedLocalNames = collectProviderRenderedLocalNames(declarationModel);
        for (const reference of collectProviderValueHeritageReferences(declarationModel)) {
            if (reference.moduleSpecifier === declarationModel.moduleSpecifier) {
                continue;
            }
            const typeArgumentCount = reference.typeArguments?.length ?? 0;
            const referenceKey = getProviderRefKey(reference.moduleSpecifier, reference.exportName, typeArgumentCount);
            if (imports.has(referenceKey)) {
                continue;
            }
            const resolutionKey = JSON.stringify([
                context.activeTarget ?? "",
                context.activeSurface ?? "",
                String(context.resolutionMode ?? ""),
                reference.moduleSpecifier,
                reference.exportName,
                typeArgumentCount,
            ]);
            if (this.#exactValueHeritageResolutionStack.has(resolutionKey)) {
                const diagnostic = createInvalidProviderDeclarationDiagnostic(provider, declarationModel, `Provider value heritage contains a recursive type-family dependency through '${reference.moduleSpecifier}#${reference.exportName}' with ${typeArgumentCount} source type argument(s).`, `provider-family-value-heritage-cycle:${provider.id}:${declarationModel.moduleSpecifier}:${getStableProviderVirtualSliceSuffix(resolutionKey)}`, [{ message: "Recursive provider family reference", details: { reference, resolution } }]);
                this.#diagnostics.append(diagnostic);
                return { kind: "rejected", diagnostic };
            }
            this.#exactValueHeritageResolutionStack.add(resolutionKey);
            try {
                const dependency = this.resolveVirtualModule(reference.moduleSpecifier, {
                    ...(context.activeTarget !== undefined ? { activeTarget: context.activeTarget } : {}),
                    ...(context.activeSurface !== undefined ? { activeSurface: context.activeSurface } : {}),
                    ...(context.resolutionMode !== undefined ? { resolutionMode: context.resolutionMode } : {}),
                    containingFile: resolution.virtualFileName,
                    importSlice: {
                        moduleSpecifier: reference.moduleSpecifier,
                        kind: "synthetic",
                        requestedExports: [{ exportedName: reference.exportName, kind: "value" }],
                        typeOnly: false,
                    },
                });
                if (dependency.kind === "unowned") {
                    continue;
                }
                if (dependency.kind === "rejected") {
                    return dependency;
                }
                if (dependency.kind === "conflict") {
                    return { kind: "rejected", diagnostic: this.#diagnostics.all().at(-1) };
                }
                const dependencyFamilies = collectProviderTypeFamilyRenderGroups(dependency.module.declarationModel.exports);
                const dependencyVariant = getProviderTypeFamilyVariantExportMap(dependency.module.declarationModel.moduleSpecifier, dependencyFamilies).get(referenceKey);
                const referencedFamily = getProviderTypeFamilyForReference(dependencyFamilies, reference.exportName);
                if (dependencyVariant === undefined) {
                    if (referencedFamily !== undefined) {
                        const diagnostic = createInvalidProviderDeclarationDiagnostic(provider, declarationModel, `Provider value heritage references unavailable type-family arity ${typeArgumentCount} for '${reference.moduleSpecifier}#${reference.exportName}'.`, `provider-family-value-heritage-arity:${provider.id}:${declarationModel.moduleSpecifier}:${getStableProviderVirtualSliceSuffix(referenceKey)}`, [{ message: "Provider family variants", details: referencedFamily.variants.map((variant) => variant.sourceTypeFamily?.typeArgumentCount) }]);
                        this.#diagnostics.append(diagnostic);
                        return { kind: "rejected", diagnostic };
                    }
                    continue;
                }
                if (dependencyVariant.kind !== "class") {
                    const diagnostic = createInvalidProviderDeclarationDiagnostic(provider, declarationModel, `Provider value heritage requires a class variant for '${reference.moduleSpecifier}#${reference.exportName}' with ${typeArgumentCount} source type argument(s).`, `provider-family-value-heritage-nonclass:${provider.id}:${declarationModel.moduleSpecifier}:${getStableProviderVirtualSliceSuffix(referenceKey)}`);
                    this.#diagnostics.append(diagnostic);
                    return { kind: "rejected", diagnostic };
                }
                const companion = this.#getOrCreateFamilyVariantCompanion(dependency.module, dependencyVariant.sourceTypeFamily.exportName);
                if (companion.kind === "rejected") {
                    return companion;
                }
                const localName = allocateProviderExactValueHeritageLocalName(reference, usedLocalNames);
                imports.set(referenceKey, {
                    fileName: companion.module.resolution.virtualFileName,
                    exportedName: getProviderTypeFamilyVariantLocalName(dependencyVariant),
                    localName,
                });
            }
            finally {
                this.#exactValueHeritageResolutionStack.delete(resolutionKey);
            }
        }
        return { kind: "resolved", imports };
    }
    #getOrCreateFamilyVariantCompanion(resolvedModule, familyExportName) {
        const moduleIdentity = getProviderVirtualModuleIdentity(resolvedModule.provider.identity, resolvedModule.resolution, resolvedModule.declarationModel);
        const canonicalExport = this.#canonicalExportsByModuleIdentity.get(moduleIdentity)?.get(familyExportName);
        const canonicalModule = canonicalExport === undefined
            ? resolvedModule
            : this.#virtualModulesByFileName.get(canonicalExport.fileName);
        if (canonicalModule === undefined) {
            const diagnostic = createInvalidProviderDeclarationDiagnostic(resolvedModule.provider.identity, resolvedModule.declarationModel, `Canonical provider family '${resolvedModule.declarationModel.moduleSpecifier}#${familyExportName}' has no registered owner module.`, `provider-family-canonical-owner-missing:${resolvedModule.provider.identity.id}:${resolvedModule.declarationModel.moduleSpecifier}:${familyExportName}`);
            this.#diagnostics.append(diagnostic);
            return { kind: "rejected", diagnostic };
        }
        const existing = this.#familyVariantCompanionsByCanonicalFileName.get(canonicalModule.resolution.virtualFileName);
        if (existing !== undefined) {
            return { kind: "resolved", module: existing };
        }
        const companionFileName = getProviderFamilyVariantCompanionFileName(canonicalModule.resolution.virtualFileName, canonicalModule.cacheKey);
        if (this.#virtualFileIdentities.has(companionFileName)
            || this.#virtualModulesByFileName.has(companionFileName)
            || this.#virtualDocumentsByUri.has(companionFileName)) {
            const diagnostic = createInvalidProviderDeclarationDiagnostic(canonicalModule.provider.identity, canonicalModule.declarationModel, `Provider family companion file '${companionFileName}' conflicts with an existing virtual module.`, `provider-family-companion-file-conflict:${canonicalModule.provider.identity.id}:${companionFileName}`);
            this.#diagnostics.append(diagnostic);
            return { kind: "rejected", diagnostic };
        }
        const exactValueHeritageImports = this.#exactValueHeritageImportsByFileName.get(canonicalModule.resolution.virtualFileName) ?? new Map();
        const sourceText = renderProviderDeclarationModel(canonicalModule.declarationModel, {
            exactValueHeritageImports,
            mode: "family-variants",
        });
        const companionResolution = {
            ...canonicalModule.resolution,
            virtualFileName: companionFileName,
        };
        const virtualDocument = {
            ...canonicalModule.virtualDocument,
            uri: companionFileName,
            fileName: companionFileName,
            sourceText,
            evidence: [
                ...(canonicalModule.virtualDocument.evidence ?? []),
                { message: "internal exact provider type-family variants", details: { canonicalFileName: canonicalModule.resolution.virtualFileName } },
            ],
        };
        const companion = {
            provider: canonicalModule.provider,
            resolution: companionResolution,
            declarationModel: canonicalModule.declarationModel,
            context: canonicalModule.context,
            virtualSourceText: sourceText,
            virtualDocument,
            cacheKey: `${canonicalModule.cacheKey}\0tsts-family-variants`,
        };
        this.#recordVirtualFileIdentity(companionFileName, moduleIdentity);
        this.#virtualModulesByFileName.set(companionFileName, companion);
        this.#virtualDocumentsByUri.set(companionFileName, virtualDocument);
        this.#exactValueHeritageImportsByFileName.set(companionFileName, exactValueHeritageImports);
        this.#familyVariantCompanionsByCanonicalFileName.set(canonicalModule.resolution.virtualFileName, companion);
        return { kind: "resolved", module: companion };
    }
    #getEffectiveVirtualFileName(moduleIdentity, baseFileName, sourceText, cacheKey) {
        const variants = this.#virtualSourceVariantsByModuleIdentity.get(moduleIdentity) ?? [];
        const existing = variants.find((variant) => variant.sourceText === sourceText);
        if (existing !== undefined) {
            return existing.fileName;
        }
        const fileName = variants.length === 0
            ? baseFileName
            : getProviderVirtualSliceFileName(baseFileName, cacheKey, (candidate) => variants.some((variant) => variant.fileName === candidate)
                || this.#virtualFileIdentities.has(candidate)
                || this.#virtualModulesByFileName.has(candidate)
                || this.#virtualDocumentsByUri.has(candidate));
        variants.push({ sourceText, fileName });
        this.#virtualSourceVariantsByModuleIdentity.set(moduleIdentity, variants);
        return fileName;
    }
    #getCanonicalExportsForRender(moduleIdentity, declarationModel, directSourceText) {
        if (this.#virtualSourceVariantsByModuleIdentity.get(moduleIdentity)?.some((variant) => variant.sourceText === directSourceText) === true) {
            return new Map();
        }
        const canonicalExports = this.#canonicalExportsByModuleIdentity.get(moduleIdentity);
        if (canonicalExports === undefined || canonicalExports.size === 0) {
            return new Map();
        }
        const exportNames = getProviderDeclarationModelExportNames(declarationModel);
        const exportNameSet = new Set(exportNames);
        return new Map([...canonicalExports].filter(([exportName]) => exportNameSet.has(exportName)));
    }
    #recordCanonicalExports(moduleIdentity, declarationModel, effectiveVirtualFileName, canonicalizedExports) {
        let canonicalExports = this.#canonicalExportsByModuleIdentity.get(moduleIdentity);
        if (canonicalExports === undefined) {
            canonicalExports = new Map();
            this.#canonicalExportsByModuleIdentity.set(moduleIdentity, canonicalExports);
        }
        const contractKeys = getProviderExportContractKeyMap(declarationModel.exports);
        for (const [exportName, typeOnly] of getProviderExportTypeOnlyMap(declarationModel.exports)) {
            if (!canonicalizedExports.has(exportName) && !canonicalExports.has(exportName)) {
                canonicalExports.set(exportName, { fileName: effectiveVirtualFileName, typeOnly, contractKey: contractKeys.get(exportName) });
            }
        }
    }
    #validateCanonicalExportContracts(provider, moduleIdentity, declarationModel) {
        const canonicalExports = this.#canonicalExportsByModuleIdentity.get(moduleIdentity);
        if (canonicalExports === undefined || canonicalExports.size === 0) {
            return undefined;
        }
        const incomingContracts = getProviderExportContractKeyMap(declarationModel.exports);
        for (const [exportName, incomingContract] of incomingContracts) {
            const canonicalExport = canonicalExports.get(exportName);
            if (canonicalExport === undefined || canonicalExport.contractKey === incomingContract) {
                continue;
            }
            return createHostDiagnostic({
                extensionCode: "INVALID_PROVIDER_DECLARATION_MODEL",
                numericCode: ExtensionHostDiagnosticCode.invalidProviderDeclaration,
                message: `Provider '${provider.id}' returned conflicting declarations for public export '${declarationModel.moduleSpecifier}#${exportName}'.`,
                evidence: [
                    { message: "Canonical export contract", details: canonicalExport.contractKey },
                    { message: "Incoming export contract", details: incomingContract },
                ],
                identity: `provider-export-contract-conflict:${provider.id}:${declarationModel.moduleSpecifier}:${exportName}:${getStableProviderVirtualSliceSuffix(`${canonicalExport.contractKey}\0${incomingContract}`)}`,
            });
        }
        return undefined;
    }
    #validateVirtualFileIdentity(fileName, moduleIdentity) {
        const existing = this.#virtualFileIdentities.get(fileName);
        if (existing === undefined || existing === moduleIdentity) {
            return undefined;
        }
        return createHostDiagnostic({
            extensionCode: "INVALID_PROVIDER_MODULE_RESOLUTION",
            numericCode: ExtensionHostDiagnosticCode.providerResolutionFailed,
            message: `Provider virtual file '${fileName}' is used for multiple public provider module identities.`,
            evidence: [
                { message: "Existing virtual file identity", details: existing },
                { message: "Incoming virtual file identity", details: moduleIdentity },
            ],
            identity: `provider-virtual-file-conflict:${fileName}:${existing}:${moduleIdentity}`,
        });
    }
    #recordVirtualFileIdentity(fileName, moduleIdentity) {
        if (!this.#virtualFileIdentities.has(fileName)) {
            this.#virtualFileIdentities.set(fileName, moduleIdentity);
        }
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
        resolution.packageName ?? "",
        resolution.packageVersion ?? "",
    ]);
}
function getProviderDeclarationModelExportNames(model) {
    return [...new Set(model.exports.map(getProviderSourceExportName))].sort();
}
function getProviderVirtualSliceFileName(baseFileName, cacheKey, isUnavailable) {
    const suffix = getStableProviderVirtualSliceSuffix(cacheKey);
    let candidate = `${baseFileName}#tsts-slice-${suffix}`;
    let disambiguator = 1;
    while (isUnavailable(candidate)) {
        disambiguator += 1;
        candidate = `${baseFileName}#tsts-slice-${suffix}-${disambiguator}`;
    }
    return candidate;
}
function getStableProviderVirtualSliceSuffix(value) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index++) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(36);
}
function collectProviderValueHeritageReferences(model) {
    return model.exports.flatMap((declaration) => declaration.kind === "class"
        ? (declaration.heritage ?? []).flatMap((heritage) => {
            if (heritage.kind !== "extends") {
                return [];
            }
            const reference = getProviderValueHeritageReference(heritage.type);
            return reference === undefined ? [] : [reference];
        })
        : []);
}
function getProviderValueHeritageReference(type) {
    if (type.kind === "target-named" || type.kind === "opaque") {
        return type.sourceShape === undefined ? undefined : getProviderValueHeritageReference(type.sourceShape);
    }
    return type.kind === "provider-ref" ? type : undefined;
}
function collectProviderRenderedLocalNames(model) {
    const names = new Set([providerTypeFamilyDefaultValueName, providerTypeFamilyDefaultTypeName]);
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
function allocateProviderExactValueHeritageLocalName(reference, usedNames) {
    const typeArgumentCount = reference.typeArguments?.length ?? 0;
    const identifier = reference.exportName.replace(/[^A-Za-z0-9_$]/g, "_");
    const stem = `__TstsProviderHeritage_${identifier === "" || /^[0-9]/.test(identifier) ? `_${identifier}` : identifier}_${typeArgumentCount}_${getStableProviderVirtualSliceSuffix(reference.moduleSpecifier)}`;
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
    return [...groups.values()].find((group) => group.variants.some((variant) => getProviderExportName(variant) === exportName));
}
function getProviderFamilyVariantCompanionFileName(canonicalFileName, cacheKey) {
    return `${canonicalFileName}${providerFamilyVariantCompanionMarker}${getStableProviderVirtualSliceSuffix(cacheKey)}.d.ts`;
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
        localDeclarationNameByExportName: getProviderLocalDeclarationNameByExportName(model.exports),
        typeFamilyVariantByProviderRefKey: getProviderTypeFamilyVariantExportMap(model.moduleSpecifier, typeFamilyGroups),
        exactValueHeritageLocalNameByProviderRefKey: new Map([...(options.exactValueHeritageImports ?? new Map())].map(([key, binding]) => [key, binding.localName])),
    };
    const locallyRequiredValueHeritageFamilies = new Set(collectProviderValueHeritageReferences(model)
        .filter((reference) => reference.moduleSpecifier === model.moduleSpecifier)
        .flatMap((reference) => {
        const variant = renderContext.typeFamilyVariantByProviderRefKey.get(getProviderRefKey(reference.moduleSpecifier, reference.exportName, reference.typeArguments?.length ?? 0));
        return variant?.sourceTypeFamily === undefined ? [] : [variant.sourceTypeFamily.exportName];
    }));
    for (const importDeclaration of model.imports ?? []) {
        lines.push(renderProviderImportDeclaration(importDeclaration));
    }
    for (const binding of [...(options.exactValueHeritageImports?.values() ?? [])]
        .sort((left, right) => left.localName < right.localName ? -1 : left.localName > right.localName ? 1 : 0)) {
        lines.push(`import { ${binding.exportedName} as ${binding.localName} } from ${JSON.stringify(binding.fileName)};`);
    }
    for (const [exportName, localName] of canonicalLocalNameByExportName) {
        const canonicalExport = options.canonicalExports?.get(exportName);
        if (canonicalExport !== undefined) {
            lines.push(`import ${canonicalExport.typeOnly ? "type " : ""}{ ${exportName} as ${localName} } from ${JSON.stringify(canonicalExport.fileName)};`);
        }
    }
    if (typeFamilyGroups.size > 0) {
        lines.push(`declare const ${providerTypeFamilyDefaultValueName}: unique symbol;`);
        lines.push(`type ${providerTypeFamilyDefaultTypeName} = typeof ${providerTypeFamilyDefaultValueName};`);
    }
    const renderedFamilies = new Set();
    const renderedCanonicalExports = new Set();
    for (const exportDeclaration of model.exports) {
        const exportName = getProviderSourceExportName(exportDeclaration);
        if (options.mode === "family-variants") {
            if (exportDeclaration.sourceTypeFamily !== undefined) {
                const familyName = exportDeclaration.sourceTypeFamily.exportName;
                if (!renderedFamilies.has(familyName)) {
                    const family = typeFamilyGroups.get(familyName);
                    if (family !== undefined) {
                        lines.push(renderProviderTypeFamilyDeclaration(family, renderContext, false));
                        renderedFamilies.add(familyName);
                    }
                }
            }
            else {
                lines.push(renderProviderExportDeclaration(exportDeclaration, renderContext));
            }
            continue;
        }
        const canonicalLocalName = canonicalLocalNameByExportName.get(exportName);
        if (canonicalLocalName !== undefined) {
            if (exportDeclaration.sourceTypeFamily !== undefined) {
                const familyName = exportDeclaration.sourceTypeFamily.exportName;
                if (!renderedFamilies.has(familyName) && locallyRequiredValueHeritageFamilies.has(familyName)) {
                    const family = typeFamilyGroups.get(familyName);
                    if (family !== undefined) {
                        lines.push(renderProviderTypeFamilyLocalVariants(family, renderContext));
                    }
                }
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
    if (options.mode === "family-variants") {
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
function getProviderCanonicalExportLocalNameMap(canonicalExports) {
    return new Map([...canonicalExports.keys()].map((exportName) => [exportName, getProviderCanonicalExportLocalName(exportName)]));
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
    const directNamedExport = options.localOnly !== true && !isDefault && exportName === declaration.name;
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
        rendered = `[${nextParameter.name}] extends [${providerTypeFamilyDefaultTypeName}] ? ${renderProviderTypeFamilyVariantReference(variantByArity.get(arity), maxTypeParameters)} : ${rendered}`;
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
            const canonicalLocalName = sameModule
                ? context.canonicalLocalNameByExportName.get(family?.exportName ?? type.exportName)
                : undefined;
            const providerRefName = sameModule
                ? options.providerRefPosition === "value-heritage" && familyVariant !== undefined
                    ? getProviderTypeFamilyVariantLocalName(familyVariant)
                    : canonicalLocalName
                        ?? (familyVariant === undefined
                            ? context.localDeclarationNameByExportName.get(type.exportName) ?? type.exportName
                            : renderProviderRefIdentifier(type.exportName, familyVariant, typeArgumentCount, options))
                : options.providerRefPosition === "value-heritage" && context.exactValueHeritageLocalNameByProviderRefKey.has(providerRefKey)
                    ? context.exactValueHeritageLocalNameByProviderRefKey.get(providerRefKey)
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
    for (const group of groups.values()) {
        for (const variant of group.variants) {
            const typeArgumentCount = variant.sourceTypeFamily.typeArgumentCount;
            variants.set(getProviderRefKey(moduleSpecifier, getProviderExportName(variant), typeArgumentCount), variant);
            variants.set(getProviderRefKey(moduleSpecifier, group.exportName, typeArgumentCount), variant);
        }
    }
    return variants;
}
function getProviderLocalDeclarationNameByExportName(exports) {
    return new Map(exports
        .filter((declaration) => declaration.sourceTypeFamily === undefined)
        .map((declaration) => [getProviderExportName(declaration), declaration.name]));
}
function getProviderRefKey(moduleSpecifier, exportName, typeArgumentCount) {
    return `${moduleSpecifier}\0${exportName}\0${typeArgumentCount}`;
}
function getProviderTypeFamilyVariantLocalName(declaration) {
    return `__TstsProvider_${declaration.sourceTypeFamily.exportName}_${declaration.sourceTypeFamily.typeArgumentCount}`;
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
        && !value.virtualFileName.includes(providerFamilyVariantCompanionMarker)
        && value.providerModuleId.length > 0;
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
    for (const declaration of model.exports) {
        const exportName = getProviderExportName(declaration);
        const sourceExportName = getProviderSourceExportName(declaration);
        sameModuleProviderRefNames.add(exportName);
        sameModuleProviderRefNames.add(sourceExportName);
        exportsByName.set(exportName, declaration);
        if (!exportsByName.has(sourceExportName)) {
            exportsByName.set(sourceExportName, declaration);
        }
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
    const reservedLocalNames = new Set([providerTypeFamilyDefaultValueName, providerTypeFamilyDefaultTypeName]);
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
            return true;
        }
        return context.typeFamilyVariantByProviderRefKey.has(getProviderRefKey(type.moduleSpecifier, type.exportName, type.typeArguments?.length ?? 0));
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
        return declaration.kind === "class";
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