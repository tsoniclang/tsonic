export type ExtensionDiagnosticCategory = "error" | "warning" | "suggestion";
export type ExtensionFactSubject = object;
import type { ExtensionCompilerQueryContext, ExtensionObservationHook, ExtensionObservationPointName, ExtensionObservationRequest, ExtensionObservationResponse, ExtensionObservationResult, ExtensionObservationRunOptions } from "./observations.js";
import { ExtensionObservationPoint } from "./observations.js";
import type { ArgumentPassingMode } from "./argument-passing.js";
import type { SourcePrimitiveKind } from "./facts.js";
export interface ExtensionEvidence {
    readonly message: string;
    readonly details?: unknown;
}
export interface ExtensionDiagnostic {
    readonly extensionId: string;
    readonly extensionCode: string;
    readonly numericCode: number;
    readonly publicCode?: string;
    readonly category: ExtensionDiagnosticCategory;
    readonly message: string;
    readonly nodeOrSpan?: unknown;
    readonly evidence?: readonly ExtensionEvidence[];
    readonly identity?: string;
}
export interface ExtensionDiagnosticSourceSpan {
    readonly sourceFile: object;
    readonly pos: number;
    readonly end: number;
}
export interface ExtensionDiagnosticRange {
    readonly start: number;
    readonly end: number;
}
export declare const ExtensionHostDiagnosticCode: {
    readonly factConflict: 9000001;
    readonly duplicateExtension: 9000002;
    readonly missingDependency: 9000003;
    readonly dependencyCycle: 9000004;
    readonly observationOwnerConflict: 9000005;
    readonly observationOwnerMissing: 9000006;
    readonly initializationFailed: 9000007;
    readonly factStoreSealed: 9000008;
    readonly consumerBeforeFinalization: 9000009;
    readonly invalidProvider: 9000010;
    readonly observationOwnerDeferred: 9000011;
    readonly observationConflict: 9000012;
    readonly unknownObservationOwner: 9000013;
    readonly multipleTargetExtensions: 9000014;
    readonly duplicateProvider: 9000015;
    readonly providerOwnershipConflict: 9000016;
    readonly providerResolutionFailed: 9000017;
    readonly invalidProviderDeclaration: 9000018;
    readonly lifecycleHookFailed: 9000019;
    readonly requiredFactMissing: 9000020;
    readonly providerContractMismatch: 9000021;
    readonly providerMissing: 9000022;
    readonly providerOwnershipFailed: 9000023;
    readonly providerResolveFailed: 9000024;
    readonly providerDeclarationFailed: 9000025;
    readonly observationHookFailed: 9000026;
    readonly diagnosticRangeInvalid: 9000027;
    readonly diagnosticCodeOutOfRange: 9000028;
    readonly invalidFactSubject: 9000029;
};
export declare const TstsProviderContractVersion = "tsts.provider.1";
export interface CompilerExtensionIdentity {
    readonly id: string;
    readonly version: string;
    readonly capabilityNamespace: string;
    readonly diagnosticRange?: ExtensionDiagnosticRange;
}
export interface ExtensionDependencySpec {
    readonly dependsOn?: readonly string[];
    readonly runsAfter?: readonly string[];
}
export interface ExtensionCapabilitySpec {
    readonly provides?: readonly string[];
    readonly requires?: readonly string[];
}
export type CompilerExtensionKind = "source" | "target" | "surface" | "consumer" | "tooling";
export interface ExtensionCompositionSpec {
    readonly kind: CompilerExtensionKind;
    readonly target?: string;
    readonly surface?: string;
}
export interface CompilerExtension {
    readonly identity: CompilerExtensionIdentity;
    readonly dependencies?: ExtensionDependencySpec;
    readonly capabilities?: ExtensionCapabilitySpec;
    readonly composition?: ExtensionCompositionSpec;
    readonly observationOwners?: readonly ExtensionObservationPointName[];
    readonly initialize?: (context: ExtensionInitializeContext) => void;
}
export interface ExtensionInitializeContext {
    readonly host: ExtensionHost;
    readonly facts: ExtensionFactStore;
    readonly factResolver: ExtensionFactResolver;
    readonly diagnostics: ExtensionDiagnosticStore;
    readonly providers: ProviderRegistry;
    readonly registerObservationOwner: (observation: ExtensionObservationPointName, extensionId: string) => void;
    readonly registerObservation: <TObservation extends ExtensionObservationPointName>(observation: TObservation, hook: ExtensionObservationHook<TObservation>) => void;
    readonly registerLifecycleHook: <TRequest>(event: string, hook: ExtensionLifecycleHook<TRequest>) => void;
    readonly registerTargetBindingProvider: (provider: TargetBindingProvider) => boolean;
    readonly registerTargetSemanticProvider: (provider: TargetSemanticProvider) => boolean;
}
export interface ExtensionFactKey<T> {
    readonly extensionId: string;
    readonly name: string;
    readonly id: string;
    readonly equals: (left: T, right: T) => boolean;
}
export interface ExtensionFactKeyOptions<T> {
    readonly extensionId: string;
    readonly name: string;
    readonly equals?: (left: T, right: T) => boolean;
}
export interface ExtensionFactEntry<T> {
    readonly key: ExtensionFactKey<T>;
    readonly value: T;
    readonly evidence: readonly ExtensionEvidence[];
}
export type ExtensionFactWriteResult = "inserted" | "idempotent" | "conflict" | "sealed" | "invalid-subject";
export interface ExtensionFactResolution<T> {
    readonly value: T;
    readonly evidence?: readonly ExtensionEvidence[];
}
export type ExtensionFactResolverCallback<T> = (subject: ExtensionFactSubject, context: ExtensionFactResolverContext) => ExtensionFactResolution<T> | undefined;
export interface ExtensionFactResolverContext {
    readonly facts: ExtensionFactStore;
    readonly diagnostics: ExtensionDiagnosticStore;
}
export interface ProviderIdentity {
    readonly id: string;
    readonly version: string;
    readonly target: string;
    readonly extensionContractVersion: string;
    readonly providerKind?: "binding" | "semantic" | "combined";
    readonly diagnosticRange?: ExtensionDiagnosticRange;
    readonly configHash?: string;
    readonly displayName?: string;
}
export interface ExtensionHostOptions {
    readonly extensions?: readonly CompilerExtension[];
    readonly activeTarget?: string;
    readonly activeSurface?: string;
    readonly allowMultipleTargets?: boolean;
    readonly requiredProviderModules?: readonly RequiredProviderModuleSpec[];
}
export interface RequiredProviderModuleSpec {
    readonly specifierPrefix: string;
    readonly providerId?: string;
    readonly target?: string;
    readonly message?: string;
}
export interface ProviderModuleContext {
    readonly containingFile?: string;
    readonly resolutionMode?: unknown;
    readonly activeTarget?: string;
    readonly activeSurface?: string;
    readonly importSlice?: ProviderImportSlice;
}
export type ProviderImportSliceKind = "bare" | "default" | "named" | "namespace" | "mixed" | "reexport" | "dynamic" | "synthetic" | "unknown";
export type ProviderImportRequestKind = "type" | "value" | "unknown";
export interface ProviderRequestedExport {
    readonly exportedName: string;
    readonly localName?: string;
    readonly kind?: ProviderImportRequestKind;
}
export interface ProviderImportSlice {
    readonly moduleSpecifier: string;
    readonly kind: ProviderImportSliceKind;
    readonly requestedExports?: readonly ProviderRequestedExport[];
    readonly broadImport?: boolean;
    readonly typeOnly?: boolean;
}
export type ProviderOwnership = {
    readonly kind: "unowned";
} | {
    readonly kind: "owned";
    readonly evidence?: readonly ExtensionEvidence[];
} | {
    readonly kind: "reject";
    readonly diagnostic: ExtensionDiagnostic;
};
export interface ProviderModuleResolution {
    readonly kind: "virtual";
    readonly moduleSpecifier: string;
    readonly virtualFileName: string;
    readonly providerModuleId: string;
    readonly packageName?: string;
    readonly packageVersion?: string;
    readonly evidence?: readonly ExtensionEvidence[];
}
export type ProviderDeclarationKind = "type" | "value" | "namespace" | "function" | "class" | "interface" | "enum" | "opaque";
export type ProviderExportKind = "named" | "default";
export type ProviderPropertyName = string | {
    readonly kind: "identifier";
    readonly text: string;
} | {
    readonly kind: "string-literal";
    readonly text: string;
} | {
    readonly kind: "number-literal";
    readonly value: number;
} | {
    readonly kind: "well-known-symbol";
    readonly name: ProviderWellKnownSymbolName;
};
export type ProviderWellKnownSymbolName = "asyncIterator" | "hasInstance" | "isConcatSpreadable" | "iterator" | "match" | "matchAll" | "replace" | "search" | "species" | "split" | "toPrimitive" | "toStringTag" | "unscopables";
export interface ProviderTypeParameterDeclaration {
    readonly name: string;
    readonly constraints?: readonly ProviderTypeExpression[];
    readonly defaultType?: ProviderTypeExpression;
    readonly variance?: "in" | "out" | "invariant" | "target-defined";
}
export type ProviderTypeExpression = {
    readonly kind: "any";
} | {
    readonly kind: "unknown";
} | {
    readonly kind: "void";
} | {
    readonly kind: "never";
} | {
    readonly kind: "boolean";
} | {
    readonly kind: "string";
} | {
    readonly kind: "number";
} | {
    readonly kind: "bigint";
} | {
    readonly kind: "object";
} | {
    readonly kind: "source-primitive";
    readonly name: SourcePrimitiveKind;
} | {
    readonly kind: "type-parameter";
    readonly name: string;
} | {
    readonly kind: "target-named";
    readonly target: string;
    readonly id: string;
    readonly displayName?: string;
    readonly typeArguments?: readonly ProviderTypeExpression[];
    readonly sourceShape?: ProviderTypeExpression;
} | {
    readonly kind: "array";
    readonly elementType: ProviderTypeExpression;
} | {
    readonly kind: "tuple";
    readonly elementTypes: readonly ProviderTypeExpression[];
} | {
    readonly kind: "union";
    readonly types: readonly ProviderTypeExpression[];
} | {
    readonly kind: "intersection";
    readonly types: readonly ProviderTypeExpression[];
} | {
    readonly kind: "function";
    readonly parameters: readonly ProviderParameterDeclaration[];
    readonly returnType: ProviderTypeExpression;
    readonly typeParameters?: readonly ProviderTypeParameterDeclaration[];
} | {
    readonly kind: "literal";
    readonly value: string | number | boolean | null;
} | {
    readonly kind: "provider-ref";
    readonly moduleSpecifier: string;
    readonly exportName: string;
    readonly localName?: string;
    readonly namespaceImport?: string;
    readonly typeArguments?: readonly ProviderTypeExpression[];
} | {
    readonly kind: "opaque";
    readonly id: string;
    readonly displayName?: string;
    readonly sourceShape?: ProviderTypeExpression;
};
export interface ProviderParameterDeclaration {
    readonly name: string;
    readonly type: ProviderTypeExpression;
    readonly passingMode?: ArgumentPassingMode;
    readonly optional?: boolean;
    readonly rest?: boolean;
    readonly defaultType?: ProviderTypeExpression;
}
export interface ProviderSignatureDeclaration {
    readonly id: string;
    readonly name?: string;
    readonly parameters: readonly ProviderParameterDeclaration[];
    readonly returnType?: ProviderTypeExpression;
    readonly typeParameters?: readonly ProviderTypeParameterDeclaration[];
    readonly documentation?: string;
}
export interface ProviderMemberDeclaration {
    readonly id: string;
    readonly name: ProviderPropertyName;
    readonly kind: "method" | "constructor" | "property" | "field" | "indexer";
    readonly static?: boolean;
    readonly readonly?: boolean;
    readonly optional?: boolean;
    readonly type?: ProviderTypeExpression;
    readonly signatures?: readonly ProviderSignatureDeclaration[];
    readonly documentation?: string;
}
export interface ProviderExportDeclaration {
    readonly id: string;
    readonly name: string;
    readonly exportName?: string;
    readonly exportKind?: ProviderExportKind;
    readonly kind: ProviderDeclarationKind;
    readonly targetIdentity?: TargetIdentity;
    readonly type?: ProviderTypeExpression;
    readonly typeParameters?: readonly ProviderTypeParameterDeclaration[];
    readonly heritage?: readonly ProviderHeritageDeclaration[];
    readonly members?: readonly ProviderMemberDeclaration[];
    readonly signatures?: readonly ProviderSignatureDeclaration[];
    readonly documentation?: string;
}
export interface ProviderImportDeclaration {
    readonly moduleSpecifier: string;
    readonly defaultImport?: string;
    readonly namedImports?: readonly ProviderRequestedExport[];
    readonly namespaceImport?: string;
    readonly typeOnly?: boolean;
}
export interface ProviderHeritageDeclaration {
    readonly kind: "extends" | "implements";
    readonly type: ProviderTypeExpression;
}
export interface ProviderDeclarationModel {
    readonly moduleSpecifier: string;
    readonly providerModuleId: string;
    readonly imports?: readonly ProviderImportDeclaration[];
    readonly exports: readonly ProviderExportDeclaration[];
    readonly evidence?: readonly ExtensionEvidence[];
}
export interface ProviderSymbolIdentity {
    readonly moduleSpecifier: string;
    readonly exportName?: string;
    readonly memberName?: string;
    readonly signatureId?: string;
}
export interface TargetIdentity {
    readonly target: string;
    readonly id: string;
    readonly displayName?: string;
    readonly packageName?: string;
    readonly packageVersion?: string;
}
export interface ProviderResolvedModule {
    readonly provider: TargetBindingProvider;
    readonly resolution: ProviderModuleResolution;
    readonly declarationModel: ProviderDeclarationModel;
    readonly context: ProviderModuleContext;
    readonly virtualSourceText: string;
    readonly virtualDocument: ProviderVirtualDeclarationDocument;
    readonly cacheKey: string;
}
export interface ProviderVirtualDeclarationDocument {
    readonly uri: string;
    readonly fileName: string;
    readonly moduleSpecifier: string;
    readonly providerModuleId: string;
    readonly provider: ProviderIdentity;
    readonly context: ProviderModuleContext;
    readonly declarationModel: ProviderDeclarationModel;
    readonly sourceText: string;
    readonly readOnly: true;
    readonly evidence?: readonly ExtensionEvidence[];
}
export declare const ExtensionLifecycleEvent: {
    readonly afterSourceFileBound: "binder.afterSourceFileBound";
    readonly beforeSemanticsFinalized: "semantics.beforeFinalized";
};
export interface ExtensionLifecycleContext {
    readonly event: string;
    readonly extensionId: string;
    readonly compiler: ExtensionCompilerQueryContext;
    readonly host: ExtensionHost;
}
export type ExtensionLifecycleHook<TRequest> = (request: TRequest, context: ExtensionLifecycleContext) => void;
export interface SourceFileBoundLifecycleRequest {
    readonly sourceFile: ExtensionFactSubject;
    readonly fileName: string;
    readonly providerVirtualModule?: ProviderResolvedModule;
}
export interface BeforeSemanticsFinalizedLifecycleRequest {
    readonly host: ExtensionHost;
}
export type ProviderModuleResolveResult = {
    readonly kind: "unowned";
} | {
    readonly kind: "resolved";
    readonly module: ProviderResolvedModule;
} | {
    readonly kind: "rejected";
    readonly diagnostic: ExtensionDiagnostic;
} | {
    readonly kind: "conflict";
    readonly providers: readonly TargetBindingProvider[];
};
export interface TargetBindingProvider {
    readonly identity: ProviderIdentity;
    ownsModule(specifier: string, context: ProviderModuleContext): ProviderOwnership;
    resolveModule(specifier: string, context: ProviderModuleContext): ProviderModuleResolution | ExtensionDiagnostic;
    getDeclarationModel(module: ProviderModuleResolution): ProviderDeclarationModel | ExtensionDiagnostic;
    getTargetIdentity(symbol: ProviderSymbolIdentity): TargetIdentity | undefined;
}
export interface TargetSemanticProvider {
    readonly identity: ProviderIdentity;
    validateTargetConstraint?: ExtensionObservationHook<typeof ExtensionObservationPoint.validateTargetConstraint>;
    observePostCheckAssignability?: ExtensionObservationHook<typeof ExtensionObservationPoint.observePostCheckAssignability>;
    mapCheckedCall?: ExtensionObservationHook<typeof ExtensionObservationPoint.mapCheckedCall>;
    mapInferredSourceTypeArgumentsToTarget?: ExtensionObservationHook<typeof ExtensionObservationPoint.mapInferredSourceTypeArgumentsToTarget>;
    mapCheckedPropertyAccess?: ExtensionObservationHook<typeof ExtensionObservationPoint.mapCheckedPropertyAccess>;
    mapCheckedElementAccess?: ExtensionObservationHook<typeof ExtensionObservationPoint.mapCheckedElementAccess>;
    mapCheckedOperator?: ExtensionObservationHook<typeof ExtensionObservationPoint.mapCheckedOperator>;
    mapCheckedIteration?: ExtensionObservationHook<typeof ExtensionObservationPoint.mapCheckedIteration>;
    recordContextualTargetType?: ExtensionObservationHook<typeof ExtensionObservationPoint.recordContextualTargetType>;
    mapCheckedConversion?: ExtensionObservationHook<typeof ExtensionObservationPoint.mapCheckedConversion>;
    resolveParameterPassing?: ExtensionObservationHook<typeof ExtensionObservationPoint.resolveParameterPassing>;
    resolveRuntimeCarrier?: ExtensionObservationHook<typeof ExtensionObservationPoint.resolveRuntimeCarrier>;
    validateExtensionFlowUse?: ExtensionObservationHook<typeof ExtensionObservationPoint.validateExtensionFlowUse>;
}
export interface ExtendedProgram<TProgram extends object = object> {
    readonly program: TProgram;
    readonly extensionHost: ExtensionHost;
}
export interface AttachExtensionHostToProgramOptions {
    readonly bindCompilerProgram?: boolean;
}
export declare function defineExtensionFactKey<T>(options: ExtensionFactKeyOptions<T>): ExtensionFactKey<T>;
export declare class ExtensionDiagnosticStore {
    #private;
    registerDiagnosticRange(extensionId: string, range: ExtensionDiagnosticRange | undefined): boolean;
    append(diagnostic: ExtensionDiagnostic): boolean;
    all(): readonly ExtensionDiagnostic[];
    hasErrors(): boolean;
}
export declare class ExtensionFactStore {
    #private;
    constructor(diagnostics: ExtensionDiagnosticStore);
    set<T>(subject: ExtensionFactSubject, key: ExtensionFactKey<T>, value: T, evidence?: readonly ExtensionEvidence[]): ExtensionFactWriteResult;
    setResolved<T>(subject: ExtensionFactSubject, key: ExtensionFactKey<T>, value: T, evidence?: readonly ExtensionEvidence[]): ExtensionFactWriteResult;
    get<T>(subject: ExtensionFactSubject | undefined, key: ExtensionFactKey<T>): T | undefined;
    getEntry<T>(subject: ExtensionFactSubject | undefined, key: ExtensionFactKey<T>): ExtensionFactEntry<T> | undefined;
    has<T>(subject: ExtensionFactSubject | undefined, key: ExtensionFactKey<T>): boolean;
    entries(subject: ExtensionFactSubject | undefined): readonly ExtensionFactEntry<unknown>[];
    seal(): void;
    get sealed(): boolean;
}
export declare class ExtensionFactResolver {
    #private;
    constructor(facts: ExtensionFactStore, diagnostics: ExtensionDiagnosticStore);
    register<T>(key: ExtensionFactKey<T>, resolver: ExtensionFactResolverCallback<T>): void;
    resolve<T>(subject: ExtensionFactSubject, key: ExtensionFactKey<T>): T | undefined;
}
export declare class ProviderRegistry {
    #private;
    constructor(diagnostics: ExtensionDiagnosticStore, requiredProviderModules?: readonly RequiredProviderModuleSpec[]);
    registerTargetBindingProvider(provider: TargetBindingProvider): boolean;
    registerTargetSemanticProvider(provider: TargetSemanticProvider): boolean;
    get bindingProviders(): readonly TargetBindingProvider[];
    get semanticProviders(): readonly TargetSemanticProvider[];
    requiresProviderForModule(specifier: string, context?: ProviderModuleContext): RequiredProviderModuleSpec | undefined;
    getTargetBindingProvider(id: string): TargetBindingProvider | undefined;
    getTargetSemanticProvider(id: string): TargetSemanticProvider | undefined;
    getModuleOwner(specifier: string, context?: ProviderModuleContext): TargetBindingProvider | undefined;
    resolveVirtualModule(specifier: string, context?: ProviderModuleContext): ProviderModuleResolveResult;
    getVirtualModuleByFileName(fileName: string): ProviderResolvedModule | undefined;
    getVirtualDeclarationDocument(uriOrFileName: string): ProviderVirtualDeclarationDocument | undefined;
    getVirtualDeclarationDocuments(): readonly ProviderVirtualDeclarationDocument[];
}
export declare class ExtensionHost {
    #private;
    readonly diagnostics: ExtensionDiagnosticStore;
    readonly facts: ExtensionFactStore;
    readonly factResolver: ExtensionFactResolver;
    readonly providers: ProviderRegistry;
    readonly extensions: readonly CompilerExtension[];
    readonly activeTarget: string | undefined;
    readonly activeSurface: string | undefined;
    constructor(program: object, options?: ExtensionHostOptions);
    get program(): object;
    bindCompilerProgram(program: object): void;
    registerObservationOwner(observation: ExtensionObservationPointName, extensionId: string): void;
    getObservationOwner(observation: ExtensionObservationPointName): CompilerExtension | undefined;
    requireObservationOwner(observation: ExtensionObservationPointName): CompilerExtension | undefined;
    registerObservation<TObservation extends ExtensionObservationPointName>(observation: TObservation, extensionId: string, hook: ExtensionObservationHook<TObservation>): void;
    registerLifecycleHook<TRequest>(event: string, extensionId: string, hook: ExtensionLifecycleHook<TRequest>): void;
    registerTargetSemanticProvider(extensionId: string, provider: TargetSemanticProvider): boolean;
    runObservation<TObservation extends ExtensionObservationPointName>(observation: TObservation, request: ExtensionObservationRequest<TObservation>, core: () => ExtensionObservationResponse<TObservation>, options?: ExtensionObservationRunOptions): ExtensionObservationResult<ExtensionObservationResponse<TObservation>>;
    runLifecycle<TRequest>(event: string, request: TRequest): void;
    finalizeSemantics(): void;
    get finalized(): boolean;
    getCompilerQueryContext(): ExtensionCompilerQueryContext;
    assertFinalizedForConsumer(consumer: string): boolean;
    getFactForConsumer<T>(consumer: string, subject: ExtensionFactSubject | undefined, key: ExtensionFactKey<T>): T | undefined;
    requireFactForConsumer<T>(consumer: string, subject: ExtensionFactSubject | undefined, key: ExtensionFactKey<T>, purpose?: string): T | undefined;
    mustFactForConsumer<T>(consumer: string, subject: ExtensionFactSubject | undefined, key: ExtensionFactKey<T>, purpose?: string): T;
    getFactsForConsumer(consumer: string, subject: ExtensionFactSubject | undefined): readonly ExtensionFactEntry<unknown>[];
    getVirtualDeclarationDocumentForConsumer(consumer: string, uriOrFileName: string): ProviderVirtualDeclarationDocument | undefined;
}
export declare function attachExtensionHost<TProgram extends object>(program: TProgram, options?: ExtensionHostOptions): ExtendedProgram<TProgram>;
export declare function attachExtensionHostToProgram<TProgram extends object>(hostOwner: object, program: TProgram, options?: AttachExtensionHostToProgramOptions): ExtendedProgram<TProgram> | undefined;
export declare function getExtensionHost(program: object): ExtensionHost | undefined;
export declare function hasExtensionHost(program: object): boolean;
//# sourceMappingURL=host.d.ts.map