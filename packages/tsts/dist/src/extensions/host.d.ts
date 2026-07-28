export type ExtensionDiagnosticCategory = "error" | "warning" | "suggestion";
export type ExtensionFactSubject = object;
import { type SourceProgramQueries } from "./source-program.js";
import type { ArgumentPassingMode } from "./argument-passing.js";
import type { SourcePrimitiveKind } from "./facts.js";
import { type ExtensionFactKey } from "./fact-key.js";
export { defineExtensionFactKey, type ExtensionFactKey, type ExtensionFactKeyOptions, } from "./fact-key.js";
import { providerVirtualCompilerArtifactLookup, providerVirtualCompilerMetadataLookup, type ProviderVirtualCompilerArtifact, type ProviderVirtualCompilerMetadata } from "./provider-virtual-internal.js";
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
    readonly initializationFailed: 9000007;
    readonly factStoreSealed: 9000008;
    readonly consumerBeforeFinalization: 9000009;
    readonly invalidProvider: 9000010;
    readonly duplicateProvider: 9000015;
    readonly providerOwnershipConflict: 9000016;
    readonly providerResolutionFailed: 9000017;
    readonly invalidProviderDeclaration: 9000018;
    readonly requiredFactMissing: 9000020;
    readonly providerContractMismatch: 9000021;
    readonly providerMissing: 9000022;
    readonly providerOwnershipFailed: 9000023;
    readonly providerResolveFailed: 9000024;
    readonly providerDeclarationFailed: 9000025;
    readonly diagnosticRangeInvalid: 9000027;
    readonly diagnosticCodeOutOfRange: 9000028;
    readonly invalidFactSubject: 9000029;
    readonly registrationClosed: 9000030;
    readonly diagnosticOwnershipViolation: 9000031;
    readonly invalidDiagnosticSnapshot: 9000032;
    readonly factOwnershipViolation: 9000033;
    readonly invalidFactSnapshot: 9000034;
    readonly invalidDependencyDirection: 9000037;
    readonly sourceAnalysisFailed: 9000038;
};
export declare const TstsSourceProviderContractVersion = "tsts.source-provider.1";
declare const factStoreBeginTransaction: unique symbol;
declare const factStoreAssertCanCommitTransaction: unique symbol;
declare const factStoreCommitTransaction: unique symbol;
declare const factStoreRollbackTransaction: unique symbol;
declare const factStoreCreateSavepoint: unique symbol;
declare const factStoreAssertCanCommitSavepoint: unique symbol;
declare const factStoreCommitSavepoint: unique symbol;
declare const factStoreRollbackToSavepoint: unique symbol;
declare const factStoreCaptureSavepoint: unique symbol;
declare const factStoreCaptureTransaction: unique symbol;
declare const factStoreApplyDelta: unique symbol;
declare const factStoreTransactionActive: unique symbol;
declare const factStoreInvalidate: unique symbol;
declare const factStoreForOwner: unique symbol;
declare const factStoreSetForHost: unique symbol;
declare const factStoreSetSourceAnalyzerAccessGuard: unique symbol;
declare const diagnosticStoreCreateSavepoint: unique symbol;
declare const diagnosticStoreAssertCanCommitSavepoint: unique symbol;
declare const diagnosticStoreCommitSavepoint: unique symbol;
declare const diagnosticStoreRollbackToSavepoint: unique symbol;
declare const diagnosticStoreCaptureSavepoint: unique symbol;
declare const diagnosticStoreApplyDelta: unique symbol;
declare const diagnosticStoreSavepointActive: unique symbol;
declare const diagnosticStoreForOwner: unique symbol;
declare const diagnosticStoreSealRanges: unique symbol;
declare const diagnosticStoreRegisterRangeForHost: unique symbol;
declare const diagnosticStoreAppendForOwner: unique symbol;
declare const factResolverCreateSavepoint: unique symbol;
declare const factResolverAssertCanCommitSavepoint: unique symbol;
declare const factResolverCommitSavepoint: unique symbol;
declare const factResolverRollbackToSavepoint: unique symbol;
declare const factResolverForOwner: unique symbol;
declare const factResolverSealRegistrations: unique symbol;
declare const factResolverSavepointActive: unique symbol;
declare const providerRegistryCreateRegistrationSavepoint: unique symbol;
declare const providerRegistryAssertCanCommitRegistrationSavepoint: unique symbol;
declare const providerRegistryCommitRegistrationSavepoint: unique symbol;
declare const providerRegistryRollbackRegistrationSavepoint: unique symbol;
declare const providerRegistryRegistrationSavepointActive: unique symbol;
declare const extensionFactTransactionIdentity: unique symbol;
declare const extensionFactSavepointIdentity: unique symbol;
declare const extensionDiagnosticSavepointIdentity: unique symbol;
declare const extensionFactResolverSavepointIdentity: unique symbol;
declare const providerRegistrationSavepointIdentity: unique symbol;
interface ExtensionOwnerAuthority {
    readonly stack: string[];
}
interface ExtensionFactMutation {
    readonly subject: ExtensionFactSubject;
    readonly key: ExtensionFactKey<unknown>;
    readonly previous: ExtensionFactEntry<unknown> | undefined;
    readonly next: ExtensionFactEntry<unknown>;
}
interface ExtensionFactTransaction {
    readonly [extensionFactTransactionIdentity]: object;
}
interface ExtensionFactTransactionState {
    readonly mutations: ExtensionFactMutation[];
    readonly savepoints: ExtensionFactSavepoint[];
    active: boolean;
    failed: boolean;
}
interface ExtensionFactSavepoint {
    readonly [extensionFactSavepointIdentity]: object;
}
interface ExtensionFactSavepointState {
    readonly transaction: ExtensionFactTransaction;
    readonly mutationIndex: number;
    active: boolean;
    failed: boolean;
}
interface ExtensionFactDelta {
    readonly mutations: readonly ExtensionFactMutation[];
}
interface ExtensionDiagnosticSavepoint {
    readonly [extensionDiagnosticSavepointIdentity]: object;
}
interface ExtensionDiagnosticSavepointState {
    readonly diagnosticIndex: number;
    readonly diagnosticRanges: ReadonlyMap<string, ExtensionDiagnosticRange>;
    active: boolean;
    failed: boolean;
}
interface ExtensionFactResolverSavepoint {
    readonly [extensionFactResolverSavepointIdentity]: object;
}
interface ExtensionFactResolverSavepointState {
    readonly registrationIndex: number;
    active: boolean;
}
interface ProviderRegistrationSavepoint {
    readonly [providerRegistrationSavepointIdentity]: object;
}
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
export type CompilerExtensionKind = "source" | "tooling";
export interface ExtensionCompositionSpec {
    readonly kind: CompilerExtensionKind;
}
export interface CompilerExtension {
    readonly identity: CompilerExtensionIdentity;
    readonly dependencies?: ExtensionDependencySpec;
    readonly capabilities?: ExtensionCapabilitySpec;
    readonly composition?: ExtensionCompositionSpec;
    readonly initialize?: (context: ExtensionInitializeContext) => void;
    readonly analyzeSource?: (context: SourceAnalysisContext) => void;
}
export interface SourceAnalysisContext {
    readonly source: SourceProgramQueries;
    readonly facts: ExtensionFactStore;
    readonly factResolver: ExtensionFactResolver;
    readonly diagnostics: ExtensionDiagnosticStore;
}
export interface ExtensionInitializeContext {
    readonly diagnostics: ExtensionDiagnosticStore;
    readonly registerFactResolver: <T>(key: ExtensionFactKey<T>, resolver: ExtensionFactResolverCallback<T>) => void;
    readonly registerSourceDeclarationProvider: (provider: SourceDeclarationProvider) => boolean;
}
export interface ExtensionProviderRegistrationWriter {
    readonly registerSourceDeclarationProvider: (provider: SourceDeclarationProvider) => boolean;
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
    readonly extensionContractVersion: string;
    readonly diagnosticRange?: ExtensionDiagnosticRange;
    readonly configHash?: string;
    readonly displayName?: string;
}
export interface ExtensionHostOptions {
    readonly extensions?: readonly CompilerExtension[];
    readonly requiredProviderModules?: readonly RequiredProviderModuleSpec[];
}
export interface RequiredProviderModuleSpec {
    readonly specifierPrefix: string;
    readonly providerId?: string;
    readonly message?: string;
}
export interface ProviderModuleContext {
    readonly containingFile?: string | undefined;
    readonly resolutionMode?: ProviderResolutionMode | undefined;
    readonly importSlice?: ProviderImportSlice | undefined;
}
export type ProviderResolutionMode = "none" | "require" | "import";
export type ProviderImportSliceKind = "bare" | "default" | "named" | "namespace" | "mixed" | "reexport" | "dynamic" | "synthetic" | "unknown";
export type ProviderImportRequestKind = "type" | "value" | "unknown";
export interface ProviderRequestedExport {
    readonly exportedName: string;
    readonly localName?: string | undefined;
    readonly kind?: ProviderImportRequestKind | undefined;
}
export interface ProviderImportSlice {
    readonly moduleSpecifier: string;
    readonly kind: ProviderImportSliceKind;
    readonly requestedExports?: readonly ProviderRequestedExport[] | undefined;
    readonly broadImport?: boolean | undefined;
    readonly typeOnly?: boolean | undefined;
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
export type ProviderDeclarationKind = "type" | "value" | "namespace" | "function" | "class" | "interface" | "enum";
export type ProviderExportKind = "named" | "default";
export interface ProviderTypeFamilyDeclaration {
    readonly exportName: string;
    readonly typeArgumentCount: number;
}
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
    readonly kind: "undefined";
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
    readonly kind: "source-global";
    readonly name: string;
    readonly typeArguments?: readonly ProviderTypeExpression[];
} | {
    readonly kind: "type-parameter";
    readonly name: string;
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
    readonly id: string;
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
    readonly sourceTypeFamily?: ProviderTypeFamilyDeclaration;
    readonly kind: ProviderDeclarationKind;
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
export interface ProviderResolvedModule {
    readonly resolution: ProviderModuleResolution;
    readonly declarationModel: ProviderDeclarationModel;
    readonly context: ProviderModuleContext;
    readonly artifact: ProviderVirtualModuleArtifact;
    readonly cacheKey: string;
}
export interface ProviderVirtualModuleArtifact {
    readonly kind: "public" | "canonical-export-owner";
    readonly id: string;
    readonly provider: ProviderIdentity;
    readonly moduleSpecifier: string;
    readonly providerModuleId: string;
    readonly packageName?: string;
    readonly packageVersion?: string;
    readonly fileName: string;
    readonly declarationModel: ProviderDeclarationModel;
    readonly sourceText: string;
    readonly document: ProviderVirtualDeclarationDocument;
}
export interface ProviderVirtualDeclarationDocument {
    readonly uri: string;
    readonly fileName: string;
    readonly artifactId: string;
    readonly artifactKind: ProviderVirtualModuleArtifact["kind"];
    readonly moduleSpecifier: string;
    readonly providerModuleId: string;
    readonly provider: ProviderIdentity;
    readonly declarationModel: ProviderDeclarationModel;
    readonly sourceText: string;
    readonly readOnly: true;
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
    readonly providers: readonly ProviderIdentity[];
};
export interface SourceDeclarationProvider {
    readonly identity: ProviderIdentity;
    ownsModule(specifier: string, context: ProviderModuleContext): ProviderOwnership;
    resolveModule(specifier: string, context: ProviderModuleContext): ProviderModuleResolution | ExtensionDiagnostic;
    getDeclarationModel(module: ProviderModuleResolution): ProviderDeclarationModel | ExtensionDiagnostic;
}
declare const sealProviderRegistrations: unique symbol;
export interface ExtendedProgram<TProgram extends object = object> {
    readonly program: TProgram;
    readonly extensionHost: ExtensionHost;
}
export declare const extensionHostSetFact: unique symbol;
export declare const extensionHostRunSourceAnalysis: unique symbol;
export interface AttachExtensionHostToProgramOptions {
    readonly bindCompilerProgram?: boolean;
}
interface ExtensionDiagnosticRecord {
    readonly diagnostic: ExtensionDiagnostic;
    readonly identity: string;
    readonly hostOwned: boolean;
}
interface ExtensionDiagnosticStoreState {
    readonly records: ExtensionDiagnosticRecord[];
    readonly recordsByIdentity: Map<string, ExtensionDiagnosticRecord>;
    readonly diagnosticRanges: Map<string, ExtensionDiagnosticRange>;
    readonly savepoints: ExtensionDiagnosticSavepoint[];
    readonly savepointStates: WeakMap<ExtensionDiagnosticSavepoint, ExtensionDiagnosticSavepointState>;
    readonly ownerAuthority: ExtensionOwnerAuthority;
    rangesSealed: boolean;
}
interface ExtensionStoreViewOptions<TState> {
    readonly state: TState;
    readonly ownerId: string;
    readonly token: object;
}
export declare class ExtensionDiagnosticStore {
    #private;
    constructor(options?: ExtensionStoreViewOptions<ExtensionDiagnosticStoreState>);
    [diagnosticStoreForOwner](extensionId: string): ExtensionDiagnosticStore;
    registerDiagnosticRange(extensionId: string, range: ExtensionDiagnosticRange | undefined): boolean;
    [diagnosticStoreRegisterRangeForHost](extensionId: string, range: ExtensionDiagnosticRange | undefined): boolean;
    append(diagnostic: ExtensionDiagnostic): boolean;
    [diagnosticStoreAppendForOwner](ownerId: string, diagnostic: ExtensionDiagnostic): boolean;
    all(): readonly ExtensionDiagnostic[];
    hasErrors(): boolean;
    [diagnosticStoreCreateSavepoint](): ExtensionDiagnosticSavepoint;
    [diagnosticStoreCommitSavepoint](savepoint: ExtensionDiagnosticSavepoint): void;
    [diagnosticStoreAssertCanCommitSavepoint](savepoint: ExtensionDiagnosticSavepoint): void;
    [diagnosticStoreRollbackToSavepoint](savepoint: ExtensionDiagnosticSavepoint): void;
    [diagnosticStoreCaptureSavepoint](savepoint: ExtensionDiagnosticSavepoint): readonly ExtensionDiagnostic[];
    [diagnosticStoreApplyDelta](diagnostics: readonly ExtensionDiagnostic[]): void;
    [diagnosticStoreSavepointActive](savepoint: ExtensionDiagnosticSavepoint): boolean;
    [diagnosticStoreSealRanges](): void;
}
interface ExtensionFactStoreState {
    objectFacts: WeakMap<object, Map<object, ExtensionFactEntry<unknown>>>;
    readonly objectSubjectIds: WeakMap<object, number>;
    readonly transactionStates: WeakMap<ExtensionFactTransaction, ExtensionFactTransactionState>;
    readonly savepointStates: WeakMap<ExtensionFactSavepoint, ExtensionFactSavepointState>;
    readonly ownerAuthority: ExtensionOwnerAuthority;
    sourceAnalyzerAccessGuard: ((subject: ExtensionFactSubject | undefined, key: ExtensionFactKey<unknown>, access: "read" | "write") => void) | undefined;
    sourceAnalyzerEnumerationGuard: (() => void) | undefined;
    activeTransaction: ExtensionFactTransaction | undefined;
    nextObjectSubjectId: number;
    sealed: boolean;
    invalidated: boolean;
    hostWriteDepth: number;
}
export declare class ExtensionFactStore {
    #private;
    constructor(diagnostics: ExtensionDiagnosticStore, options?: ExtensionStoreViewOptions<ExtensionFactStoreState>);
    [factStoreForOwner](extensionId: string, diagnostics: ExtensionDiagnosticStore): ExtensionFactStore;
    [factStoreSetSourceAnalyzerAccessGuard](accessGuard: ((subject: ExtensionFactSubject | undefined, key: ExtensionFactKey<unknown>, access: "read" | "write") => void) | undefined, enumerationGuard: (() => void) | undefined): void;
    set<T>(subject: ExtensionFactSubject, key: ExtensionFactKey<T>, value: T, evidence?: readonly ExtensionEvidence[]): ExtensionFactWriteResult;
    [factStoreSetForHost]<T>(subject: ExtensionFactSubject, key: ExtensionFactKey<T>, value: T, evidence?: readonly ExtensionEvidence[]): ExtensionFactWriteResult;
    get<T>(subject: ExtensionFactSubject | undefined, key: ExtensionFactKey<T>): T | undefined;
    getEntry<T>(subject: ExtensionFactSubject | undefined, key: ExtensionFactKey<T>): ExtensionFactEntry<T> | undefined;
    has<T>(subject: ExtensionFactSubject | undefined, key: ExtensionFactKey<T>): boolean;
    entries(subject: ExtensionFactSubject | undefined): readonly ExtensionFactEntry<unknown>[];
    seal(): void;
    get sealed(): boolean;
    [factStoreBeginTransaction](): ExtensionFactTransaction;
    [factStoreCommitTransaction](transaction: ExtensionFactTransaction): void;
    [factStoreAssertCanCommitTransaction](transaction: ExtensionFactTransaction): void;
    [factStoreRollbackTransaction](transaction: ExtensionFactTransaction): void;
    [factStoreCreateSavepoint](): ExtensionFactSavepoint;
    [factStoreCommitSavepoint](savepoint: ExtensionFactSavepoint): void;
    [factStoreAssertCanCommitSavepoint](savepoint: ExtensionFactSavepoint): void;
    [factStoreRollbackToSavepoint](savepoint: ExtensionFactSavepoint): void;
    [factStoreCaptureSavepoint](savepoint: ExtensionFactSavepoint): ExtensionFactDelta;
    [factStoreCaptureTransaction](transaction: ExtensionFactTransaction): ExtensionFactDelta;
    [factStoreApplyDelta](delta: ExtensionFactDelta): void;
    [factStoreTransactionActive](): boolean;
    [factStoreInvalidate](): void;
}
interface RegisteredExtensionFactResolver {
    readonly ownerId: string;
    readonly key: ExtensionFactKey<unknown>;
    readonly callback: ExtensionFactResolverCallback<unknown>;
}
interface ExtensionFactResolverState {
    readonly resolvers: Map<object, RegisteredExtensionFactResolver[]>;
    readonly registrations: RegisteredExtensionFactResolver[];
    readonly savepoints: ExtensionFactResolverSavepoint[];
    readonly savepointStates: WeakMap<ExtensionFactResolverSavepoint, ExtensionFactResolverSavepointState>;
    readonly ownerAuthority: ExtensionOwnerAuthority;
    registrationsSealed: boolean;
}
export declare class ExtensionFactResolver {
    #private;
    constructor(facts: ExtensionFactStore, diagnostics: ExtensionDiagnosticStore, options?: ExtensionStoreViewOptions<ExtensionFactResolverState>);
    [factResolverForOwner](extensionId: string, facts: ExtensionFactStore, diagnostics: ExtensionDiagnosticStore): ExtensionFactResolver;
    register<T>(key: ExtensionFactKey<T>, resolver: ExtensionFactResolverCallback<T>): void;
    resolve<T>(subject: ExtensionFactSubject, key: ExtensionFactKey<T>): T | undefined;
    [factResolverCreateSavepoint](): ExtensionFactResolverSavepoint;
    [factResolverAssertCanCommitSavepoint](savepoint: ExtensionFactResolverSavepoint): void;
    [factResolverCommitSavepoint](savepoint: ExtensionFactResolverSavepoint): void;
    [factResolverRollbackToSavepoint](savepoint: ExtensionFactResolverSavepoint): void;
    [factResolverSavepointActive](savepoint: ExtensionFactResolverSavepoint): boolean;
    [factResolverSealRegistrations](): void;
}
export declare class ProviderRegistry {
    #private;
    constructor(diagnostics: ExtensionDiagnosticStore, requiredProviderModules?: readonly RequiredProviderModuleSpec[]);
    registerSourceDeclarationProvider(provider: SourceDeclarationProvider): boolean;
    get hasSourceDeclarationProviders(): boolean;
    requiresProviderForModule(specifier: string): RequiredProviderModuleSpec | undefined;
    [sealProviderRegistrations](): void;
    [providerRegistryCreateRegistrationSavepoint](): ProviderRegistrationSavepoint;
    [providerRegistryAssertCanCommitRegistrationSavepoint](savepoint: ProviderRegistrationSavepoint): void;
    [providerRegistryCommitRegistrationSavepoint](savepoint: ProviderRegistrationSavepoint): void;
    [providerRegistryRollbackRegistrationSavepoint](savepoint: ProviderRegistrationSavepoint): void;
    [providerRegistryRegistrationSavepointActive](savepoint: ProviderRegistrationSavepoint): boolean;
    resolveVirtualModule(specifier: string, context?: ProviderModuleContext): ProviderModuleResolveResult;
    getVirtualArtifactByFileName(fileName: string): ProviderVirtualModuleArtifact | undefined;
    [providerVirtualCompilerArtifactLookup](fileName: string): ProviderVirtualCompilerArtifact | undefined;
    [providerVirtualCompilerMetadataLookup](fileName: string): ProviderVirtualCompilerMetadata | undefined;
    getVirtualDeclarationDocument(uriOrFileName: string): ProviderVirtualDeclarationDocument | undefined;
    getVirtualDeclarationDocuments(): readonly ProviderVirtualDeclarationDocument[];
}
export declare class ExtensionHost {
    #private;
    readonly diagnostics: ExtensionDiagnosticStore;
    readonly facts: ExtensionFactStore;
    readonly factResolver: ExtensionFactResolver;
    readonly providers: ProviderRegistry;
    [extensionHostSetFact]<T>(subject: ExtensionFactSubject, key: ExtensionFactKey<T>, value: T, evidence?: readonly ExtensionEvidence[]): ExtensionFactWriteResult;
    constructor(program: object, options?: ExtensionHostOptions);
    get extensions(): readonly CompilerExtension[];
    get program(): object;
    bindCompilerProgram(program: object): void;
    [extensionHostRunSourceAnalysis](): void;
    finalizeSemantics(): void;
    get finalized(): boolean;
    getCompilerQueryContext(): SourceProgramQueries;
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