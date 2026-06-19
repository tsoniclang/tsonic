export type ExtensionDiagnosticCategory = "error" | "warning" | "suggestion";

export type ExtensionFactSubject = object;

import type {
  ExtensionDecision,
  ExtensionDecisionContext,
  ExtensionDecisionHook,
  ExtensionDecisionQuestionName,
  ExtensionDecisionRequest,
  ExtensionDecisionResponse,
  ExtensionDecisionResult,
  ExtensionDecisionRunOptions,
} from "./decisions.js";
import { ExtensionDecisionQuestion } from "./decisions.js";
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

export const ExtensionHostDiagnosticCode = {
  factConflict: 9000001,
  duplicateExtension: 9000002,
  missingDependency: 9000003,
  dependencyCycle: 9000004,
  decisionOwnerConflict: 9000005,
  decisionOwnerMissing: 9000006,
  initializationFailed: 9000007,
  factStoreSealed: 9000008,
  consumerBeforeFinalization: 9000009,
  invalidProvider: 9000010,
  decisionOwnerDeferred: 9000011,
  decisionConflict: 9000012,
  unknownDecisionOwner: 9000013,
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
  decisionHookFailed: 9000026,
  diagnosticRangeInvalid: 9000027,
  diagnosticCodeOutOfRange: 9000028,
  invalidFactSubject: 9000029,
} as const;

export const TstsProviderContractVersion = "tsts.provider.1";

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
  readonly decisionOwners?: readonly ExtensionDecisionQuestionName[];
  readonly initialize?: (context: ExtensionInitializeContext) => void;
}

export interface ExtensionInitializeContext {
  readonly host: ExtensionHost;
  readonly facts: ExtensionFactStore;
  readonly factResolver: ExtensionFactResolver;
  readonly diagnostics: ExtensionDiagnosticStore;
  readonly providers: ProviderRegistry;
  readonly registerDecisionOwner: (question: ExtensionDecisionQuestionName, extensionId: string) => void;
  readonly registerDecisionHook: <TQuestion extends ExtensionDecisionQuestionName>(question: TQuestion, hook: ExtensionDecisionHook<TQuestion>) => void;
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
}

export type ProviderOwnership =
  | { readonly kind: "unowned" }
  | { readonly kind: "owned"; readonly evidence?: readonly ExtensionEvidence[] }
  | { readonly kind: "reject"; readonly diagnostic: ExtensionDiagnostic };

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

export interface ProviderTypeParameterDeclaration {
  readonly name: string;
  readonly constraints?: readonly ProviderTypeExpression[];
  readonly variance?: "in" | "out" | "invariant" | "target-defined";
}

export type ProviderTypeExpression =
  | { readonly kind: "any" }
  | { readonly kind: "unknown" }
  | { readonly kind: "void" }
  | { readonly kind: "never" }
  | { readonly kind: "boolean" }
  | { readonly kind: "string" }
  | { readonly kind: "number" }
  | { readonly kind: "bigint" }
  | { readonly kind: "object" }
  | { readonly kind: "source-primitive"; readonly name: SourcePrimitiveKind }
  | { readonly kind: "type-parameter"; readonly name: string }
  | { readonly kind: "target-named"; readonly target: string; readonly id: string; readonly displayName?: string; readonly typeArguments?: readonly ProviderTypeExpression[]; readonly sourceShape?: ProviderTypeExpression }
  | { readonly kind: "array"; readonly elementType: ProviderTypeExpression }
  | { readonly kind: "tuple"; readonly elementTypes: readonly ProviderTypeExpression[] }
  | { readonly kind: "union"; readonly types: readonly ProviderTypeExpression[] }
  | { readonly kind: "intersection"; readonly types: readonly ProviderTypeExpression[] }
  | { readonly kind: "function"; readonly parameters: readonly ProviderParameterDeclaration[]; readonly returnType: ProviderTypeExpression; readonly typeParameters?: readonly ProviderTypeParameterDeclaration[] }
  | { readonly kind: "literal"; readonly value: string | number | boolean | null }
  | { readonly kind: "opaque"; readonly id: string; readonly displayName?: string; readonly sourceShape?: ProviderTypeExpression };

export interface ProviderParameterDeclaration {
  readonly name: string;
  readonly type: ProviderTypeExpression;
  readonly optional?: boolean;
  readonly rest?: boolean;
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
  readonly name: string;
  readonly kind: "method" | "constructor" | "property" | "field" | "indexer";
  readonly static?: boolean;
  readonly type?: ProviderTypeExpression;
  readonly signatures?: readonly ProviderSignatureDeclaration[];
  readonly documentation?: string;
}

export interface ProviderExportDeclaration {
  readonly id: string;
  readonly name: string;
  readonly kind: ProviderDeclarationKind;
  readonly targetIdentity?: TargetIdentity;
  readonly type?: ProviderTypeExpression;
  readonly typeParameters?: readonly ProviderTypeParameterDeclaration[];
  readonly members?: readonly ProviderMemberDeclaration[];
  readonly signatures?: readonly ProviderSignatureDeclaration[];
  readonly documentation?: string;
}

export interface ProviderDeclarationModel {
  readonly moduleSpecifier: string;
  readonly providerModuleId: string;
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
  readonly declarationModel: ProviderDeclarationModel;
  readonly sourceText: string;
  readonly readOnly: true;
  readonly evidence?: readonly ExtensionEvidence[];
}

export const ExtensionLifecycleEvent = {
  afterSourceFileBound: "binder.afterSourceFileBound",
  beforeSemanticsFinalized: "semantics.beforeFinalized",
} as const;

export interface ExtensionLifecycleContext {
  readonly event: string;
  readonly extensionId: string;
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

export type ProviderModuleResolveResult =
  | { readonly kind: "unowned" }
  | { readonly kind: "resolved"; readonly module: ProviderResolvedModule }
  | { readonly kind: "rejected"; readonly diagnostic: ExtensionDiagnostic }
  | { readonly kind: "conflict"; readonly providers: readonly TargetBindingProvider[] };

export interface TargetBindingProvider {
  readonly identity: ProviderIdentity;
  ownsModule(specifier: string, context: ProviderModuleContext): ProviderOwnership;
  resolveModule(specifier: string, context: ProviderModuleContext): ProviderModuleResolution | ExtensionDiagnostic;
  getDeclarationModel(module: ProviderModuleResolution): ProviderDeclarationModel | ExtensionDiagnostic;
  getTargetIdentity(symbol: ProviderSymbolIdentity): TargetIdentity | undefined;
}

export interface TargetSemanticProvider {
  readonly identity: ProviderIdentity;
  satisfiesConstraint?: ExtensionDecisionHook<typeof ExtensionDecisionQuestion.satisfiesConstraint>;
  isAssignableTo?: ExtensionDecisionHook<typeof ExtensionDecisionQuestion.isAssignableTo>;
  resolveCall?: ExtensionDecisionHook<typeof ExtensionDecisionQuestion.resolveCall>;
  inferTypeArguments?: ExtensionDecisionHook<typeof ExtensionDecisionQuestion.inferTypeArguments>;
  resolvePropertyAccess?: ExtensionDecisionHook<typeof ExtensionDecisionQuestion.resolvePropertyAccess>;
  resolveElementAccess?: ExtensionDecisionHook<typeof ExtensionDecisionQuestion.resolveElementAccess>;
  resolveOperator?: ExtensionDecisionHook<typeof ExtensionDecisionQuestion.resolveOperator>;
  getContextualType?: ExtensionDecisionHook<typeof ExtensionDecisionQuestion.getContextualType>;
  resolveConversion?: ExtensionDecisionHook<typeof ExtensionDecisionQuestion.resolveConversion>;
  getParameterMode?: ExtensionDecisionHook<typeof ExtensionDecisionQuestion.getParameterMode>;
  getRuntimeCarrier?: ExtensionDecisionHook<typeof ExtensionDecisionQuestion.getRuntimeCarrier>;
  validateFlowUse?: ExtensionDecisionHook<typeof ExtensionDecisionQuestion.validateFlowUse>;
}

interface RegisteredDecisionHook {
  readonly extensionId: string;
  readonly hook: (request: unknown, context: ExtensionDecisionContext) => ExtensionDecision<unknown>;
}

interface RegisteredLifecycleHook {
  readonly extensionId: string;
  readonly hook: ExtensionLifecycleHook<unknown>;
}

export interface ExtendedProgram<TProgram extends object = object> {
  readonly program: TProgram;
  readonly extensionHost: ExtensionHost;
}

export function defineExtensionFactKey<T>(options: ExtensionFactKeyOptions<T>): ExtensionFactKey<T> {
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
  readonly #diagnostics: ExtensionDiagnostic[] = [];
  readonly #identities = new Set<string>();
  readonly #diagnosticRanges = new Map<string, ExtensionDiagnosticRange>();

  registerDiagnosticRange(extensionId: string, range: ExtensionDiagnosticRange | undefined): boolean {
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

  append(diagnostic: ExtensionDiagnostic): boolean {
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

  #appendUnchecked(diagnostic: ExtensionDiagnostic): boolean {
    const identity = getDiagnosticIdentity(diagnostic);
    if (this.#identities.has(identity)) {
      return false;
    }
    this.#identities.add(identity);
    this.#diagnostics.push(diagnostic);
    return true;
  }

  all(): readonly ExtensionDiagnostic[] {
    return this.#diagnostics;
  }

  hasErrors(): boolean {
    return this.#diagnostics.some((diagnostic) => diagnostic.category === "error");
  }
}

export class ExtensionFactStore {
  readonly #objectFacts = new WeakMap<object, Map<string, ExtensionFactEntry<unknown>>>();
  readonly #objectSubjectIds = new WeakMap<object, number>();
  readonly #diagnostics: ExtensionDiagnosticStore;
  #nextObjectSubjectId = 1;
  #sealed = false;

  constructor(diagnostics: ExtensionDiagnosticStore) {
    this.#diagnostics = diagnostics;
  }

  set<T>(subject: ExtensionFactSubject, key: ExtensionFactKey<T>, value: T, evidence: readonly ExtensionEvidence[] = []): ExtensionFactWriteResult {
    return this.#set(subject, key, value, evidence, false);
  }

  setResolved<T>(subject: ExtensionFactSubject, key: ExtensionFactKey<T>, value: T, evidence: readonly ExtensionEvidence[] = []): ExtensionFactWriteResult {
    return this.#set(subject, key, value, evidence, true);
  }

  #set<T>(subject: ExtensionFactSubject, key: ExtensionFactKey<T>, value: T, evidence: readonly ExtensionEvidence[], allowSealedResolverCacheWrite: boolean): ExtensionFactWriteResult {
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
    const existing = subjectFacts.get(key.id) as ExtensionFactEntry<T> | undefined;
    if (existing === undefined) {
      subjectFacts.set(key.id, { key: key as ExtensionFactKey<unknown>, value, evidence });
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

  get<T>(subject: ExtensionFactSubject | undefined, key: ExtensionFactKey<T>): T | undefined {
    return this.getEntry(subject, key)?.value;
  }

  getEntry<T>(subject: ExtensionFactSubject | undefined, key: ExtensionFactKey<T>): ExtensionFactEntry<T> | undefined {
    if (subject === undefined) {
      return undefined;
    }
    const subjectFacts = this.#getSubjectFacts(subject);
    return subjectFacts?.get(key.id) as ExtensionFactEntry<T> | undefined;
  }

  has<T>(subject: ExtensionFactSubject | undefined, key: ExtensionFactKey<T>): boolean {
    return this.getEntry(subject, key) !== undefined;
  }

  entries(subject: ExtensionFactSubject | undefined): readonly ExtensionFactEntry<unknown>[] {
    if (subject === undefined) {
      return [];
    }
    return Array.from(this.#getSubjectFacts(subject)?.values() ?? []);
  }

  seal(): void {
    this.#sealed = true;
  }

  get sealed(): boolean {
    return this.#sealed;
  }

  #getSubjectFacts(subject: ExtensionFactSubject): Map<string, ExtensionFactEntry<unknown>> | undefined {
    return this.#objectFacts.get(subject);
  }

  #getOrCreateSubjectFacts(subject: ExtensionFactSubject): Map<string, ExtensionFactEntry<unknown>> {
    const existing = this.#getSubjectFacts(subject);
    if (existing !== undefined) {
      return existing;
    }

    const created = new Map<string, ExtensionFactEntry<unknown>>();
    this.#objectFacts.set(subject, created);
    return created;
  }

  #getSubjectIdentity(subject: ExtensionFactSubject): string {
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
  readonly #facts: ExtensionFactStore;
  readonly #diagnostics: ExtensionDiagnosticStore;
  readonly #resolvers = new Map<string, ExtensionFactResolverCallback<unknown>[]>();

  constructor(facts: ExtensionFactStore, diagnostics: ExtensionDiagnosticStore) {
    this.#facts = facts;
    this.#diagnostics = diagnostics;
  }

  register<T>(key: ExtensionFactKey<T>, resolver: ExtensionFactResolverCallback<T>): void {
    const resolvers = this.#resolvers.get(key.id);
    if (resolvers === undefined) {
      this.#resolvers.set(key.id, [resolver as ExtensionFactResolverCallback<unknown>]);
      return;
    }
    resolvers.push(resolver as ExtensionFactResolverCallback<unknown>);
  }

  resolve<T>(subject: ExtensionFactSubject, key: ExtensionFactKey<T>): T | undefined {
    const explicit = this.#facts.getEntry(subject, key);
    if (explicit !== undefined) {
      return explicit.value;
    }

    const resolvers = this.#resolvers.get(key.id);
    if (resolvers === undefined) {
      return undefined;
    }

    for (const resolver of resolvers) {
      const resolved = resolver(subject, { facts: this.#facts, diagnostics: this.#diagnostics }) as ExtensionFactResolution<T> | undefined;
      if (resolved !== undefined) {
        this.#facts.setResolved(subject, key, resolved.value, resolved.evidence ?? []);
        return resolved.value;
      }
    }
    return undefined;
  }
}

export class ProviderRegistry {
  readonly #diagnostics: ExtensionDiagnosticStore;
  readonly #requiredProviderModules: readonly RequiredProviderModuleSpec[];
  readonly #bindingProviders = new Map<string, TargetBindingProvider>();
  readonly #semanticProviders = new Map<string, TargetSemanticProvider>();
  readonly #virtualModules = new Map<string, ProviderResolvedModule>();
  readonly #virtualModulesByFileName = new Map<string, ProviderResolvedModule>();
  readonly #virtualDocumentsByUri = new Map<string, ProviderVirtualDeclarationDocument>();

  constructor(diagnostics: ExtensionDiagnosticStore, requiredProviderModules: readonly RequiredProviderModuleSpec[] = []) {
    this.#diagnostics = diagnostics;
    this.#requiredProviderModules = requiredProviderModules;
  }

  registerTargetBindingProvider(provider: TargetBindingProvider): boolean {
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

  registerTargetSemanticProvider(provider: TargetSemanticProvider): boolean {
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

  get bindingProviders(): readonly TargetBindingProvider[] {
    return Array.from(this.#bindingProviders.values());
  }

  get semanticProviders(): readonly TargetSemanticProvider[] {
    return Array.from(this.#semanticProviders.values());
  }

  requiresProviderForModule(specifier: string, context: ProviderModuleContext = {}): RequiredProviderModuleSpec | undefined {
    return this.#requiredProviderModules.find((required) =>
      specifier.startsWith(required.specifierPrefix)
      && (required.target === undefined || context.activeTarget === undefined || required.target === context.activeTarget));
  }

  getTargetBindingProvider(id: string): TargetBindingProvider | undefined {
    return this.#bindingProviders.get(id);
  }

  getTargetSemanticProvider(id: string): TargetSemanticProvider | undefined {
    return this.#semanticProviders.get(id);
  }

  getModuleOwner(specifier: string, context: ProviderModuleContext = {}): TargetBindingProvider | undefined {
    const owners = this.#collectModuleOwners(specifier, context);
    if (owners.kind !== "owned") {
      return undefined;
    }
    return owners.provider;
  }

  resolveVirtualModule(specifier: string, context: ProviderModuleContext = {}): ProviderModuleResolveResult {
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

    const resolution = callProvider<ProviderModuleResolution | ExtensionDiagnostic>(
      this.#diagnostics,
      owner.provider.identity,
      "resolveModule",
      specifier,
      () => owner.provider.resolveModule(specifier, context),
    );
    if (resolution === undefined) {
      return { kind: "rejected", diagnostic: this.#diagnostics.all().at(-1)! };
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

    const declarationModel = callProvider<ProviderDeclarationModel | ExtensionDiagnostic>(
      this.#diagnostics,
      owner.provider.identity,
      "getDeclarationModel",
      specifier,
      () => owner.provider.getDeclarationModel(resolution),
    );
    if (declarationModel === undefined) {
      return { kind: "rejected", diagnostic: this.#diagnostics.all().at(-1)! };
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
    const virtualDocument: ProviderVirtualDeclarationDocument = {
      uri: resolution.virtualFileName,
      fileName: resolution.virtualFileName,
      moduleSpecifier: resolution.moduleSpecifier,
      providerModuleId: resolution.providerModuleId,
      provider: owner.provider.identity,
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
      virtualSourceText,
      virtualDocument,
      cacheKey,
    };
    this.#virtualModules.set(cacheKey, module);
    this.#virtualModulesByFileName.set(resolution.virtualFileName, module);
    this.#virtualDocumentsByUri.set(virtualDocument.uri, virtualDocument);
    return { kind: "resolved", module };
  }

  getVirtualModuleByFileName(fileName: string): ProviderResolvedModule | undefined {
    return this.#virtualModulesByFileName.get(fileName);
  }

  getVirtualDeclarationDocument(uriOrFileName: string): ProviderVirtualDeclarationDocument | undefined {
    return this.#virtualDocumentsByUri.get(uriOrFileName);
  }

  getVirtualDeclarationDocuments(): readonly ProviderVirtualDeclarationDocument[] {
    return Array.from(this.#virtualDocumentsByUri.values());
  }

  #collectModuleOwners(specifier: string, context: ProviderModuleContext): { readonly kind: "unowned" } | { readonly kind: "owned"; readonly provider: TargetBindingProvider } | { readonly kind: "rejected"; readonly diagnostic: ExtensionDiagnostic } | { readonly kind: "conflict"; readonly providers: readonly TargetBindingProvider[] } {
    const owners: TargetBindingProvider[] = [];
    for (const provider of this.#bindingProviders.values()) {
      const ownership = callProvider<ProviderOwnership>(
        this.#diagnostics,
        provider.identity,
        "ownsModule",
        specifier,
        () => provider.ownsModule(specifier, context),
      );
      if (ownership === undefined) {
        return { kind: "rejected", diagnostic: this.#diagnostics.all().at(-1)! };
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
      return { kind: "owned", provider: owners[0]! };
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
  readonly program: object;
  readonly diagnostics: ExtensionDiagnosticStore;
  readonly facts: ExtensionFactStore;
  readonly factResolver: ExtensionFactResolver;
  readonly providers: ProviderRegistry;
  readonly extensions: readonly CompilerExtension[];
  readonly activeTarget: string | undefined;
  readonly activeSurface: string | undefined;
  readonly #extensionsById = new Map<string, CompilerExtension>();
  readonly #decisionOwners = new Map<ExtensionDecisionQuestionName, string>();
  readonly #decisionHooks = new Map<ExtensionDecisionQuestionName, RegisteredDecisionHook[]>();
  readonly #lifecycleHooks = new Map<string, RegisteredLifecycleHook[]>();
  readonly #consumerSubjectIds = new WeakMap<object, number>();
  #nextConsumerSubjectId = 1;
  #finalized = false;

  constructor(program: object, options: ExtensionHostOptions = {}) {
    this.program = program;
    this.diagnostics = new ExtensionDiagnosticStore();
    this.facts = new ExtensionFactStore(this.diagnostics);
    this.factResolver = new ExtensionFactResolver(this.facts, this.diagnostics);
    this.providers = new ProviderRegistry(this.diagnostics, options.requiredProviderModules ?? []);
    this.activeTarget = options.activeTarget;
    this.activeSurface = options.activeSurface;
    const orderedExtensions = orderExtensions(options.extensions ?? [], this.diagnostics);
    const validExtensions: CompilerExtension[] = [];
    for (const extension of orderedExtensions) {
      if (!this.diagnostics.registerDiagnosticRange(extension.identity.id, extension.identity.diagnosticRange)) {
        continue;
      }
      this.#extensionsById.set(extension.identity.id, extension);
      validExtensions.push(extension);
      for (const question of extension.decisionOwners ?? []) {
        this.registerDecisionOwner(question, extension.identity.id);
      }
    }
    this.extensions = validExtensions;
    this.#validateComposition(options);
    this.#initializeExtensions();
  }

  registerDecisionOwner(question: ExtensionDecisionQuestionName, extensionId: string): void {
    if (!this.#extensionsById.has(extensionId)) {
      this.diagnostics.append(createHostDiagnostic({
        extensionCode: "UNKNOWN_DECISION_OWNER",
        numericCode: ExtensionHostDiagnosticCode.unknownDecisionOwner,
        message: `Semantic question '${question}' was assigned to unknown extension '${extensionId}'.`,
        identity: `unknown-decision-owner:${question}:${extensionId}`,
      }));
      return;
    }
    const existingOwner = this.#decisionOwners.get(question);
    if (existingOwner === undefined) {
      this.#decisionOwners.set(question, extensionId);
      return;
    }
    if (existingOwner === extensionId) {
      return;
    }
    this.diagnostics.append(createHostDiagnostic({
      extensionCode: "DECISION_OWNER_CONFLICT",
      numericCode: ExtensionHostDiagnosticCode.decisionOwnerConflict,
      message: `Semantic question '${question}' is owned by both '${existingOwner}' and '${extensionId}'.`,
      identity: `decision-owner-conflict:${question}:${existingOwner}:${extensionId}`,
    }));
  }

  getDecisionOwner(question: ExtensionDecisionQuestionName): CompilerExtension | undefined {
    const ownerId = this.#decisionOwners.get(question);
    return ownerId === undefined ? undefined : this.#extensionsById.get(ownerId);
  }

  requireDecisionOwner(question: ExtensionDecisionQuestionName): CompilerExtension | undefined {
    const owner = this.getDecisionOwner(question);
    if (owner !== undefined) {
      return owner;
    }
    this.diagnostics.append(createHostDiagnostic({
      extensionCode: "DECISION_OWNER_MISSING",
      numericCode: ExtensionHostDiagnosticCode.decisionOwnerMissing,
      message: `No extension owns semantic question '${question}'.`,
      identity: `decision-owner-missing:${question}`,
    }));
    return undefined;
  }

  registerDecisionHook<TQuestion extends ExtensionDecisionQuestionName>(question: TQuestion, extensionId: string, hook: ExtensionDecisionHook<TQuestion>): void {
    const hooks = this.#decisionHooks.get(question);
    const registered: RegisteredDecisionHook = {
      extensionId,
      hook: hook as (request: unknown, context: ExtensionDecisionContext) => ExtensionDecision<unknown>,
    };
    if (hooks === undefined) {
      this.#decisionHooks.set(question, [registered]);
      return;
    }
    hooks.push(registered);
  }

  registerLifecycleHook<TRequest>(event: string, extensionId: string, hook: ExtensionLifecycleHook<TRequest>): void {
    const hooks = this.#lifecycleHooks.get(event);
    const registered: RegisteredLifecycleHook = {
      extensionId,
      hook: hook as ExtensionLifecycleHook<unknown>,
    };
    if (hooks === undefined) {
      this.#lifecycleHooks.set(event, [registered]);
      return;
    }
    hooks.push(registered);
  }

  registerTargetSemanticProvider(extensionId: string, provider: TargetSemanticProvider): boolean {
    const registered = this.providers.registerTargetSemanticProvider(provider);
    if (!registered) {
      return false;
    }
    this.#registerTargetSemanticProviderDecisionHooks(extensionId, provider);
    return true;
  }

  runDecision<TQuestion extends ExtensionDecisionQuestionName>(
    question: TQuestion,
    request: ExtensionDecisionRequest<TQuestion>,
    core: () => ExtensionDecisionResponse<TQuestion>,
    options: ExtensionDecisionRunOptions = {},
  ): ExtensionDecisionResult<ExtensionDecisionResponse<TQuestion>> {
    const owner = this.getDecisionOwner(question);
    if (owner === undefined && options.requireOwner === true) {
      this.requireDecisionOwner(question);
      return { kind: "missing-owner", question };
    }

    const hooks = this.#decisionHooks.get(question) ?? [];
    const selectedHooks = owner === undefined ? hooks : hooks.filter((hook) => hook.extensionId === owner.identity.id);

    if (selectedHooks.length === 0) {
      if (owner !== undefined && options.requireOwner === true) {
        this.diagnostics.append(createHostDiagnostic({
          extensionCode: "DECISION_OWNER_DEFERRED",
          numericCode: ExtensionHostDiagnosticCode.decisionOwnerDeferred,
          message: `Extension '${owner.identity.id}' owns semantic question '${question}' but registered no decision hook.`,
          identity: `decision-owner-no-hook:${question}:${owner.identity.id}`,
        }));
        return { kind: "owner-deferred", question, extensionId: owner.identity.id };
      }
      return { kind: "core", value: core() };
    }

    const nonDeferred: Array<ExtensionDecisionResult<ExtensionDecisionResponse<TQuestion>>> = [];
    for (const registered of selectedHooks) {
      let decision: ExtensionDecision<ExtensionDecisionResponse<TQuestion>>;
      try {
        decision = registered.hook(request, {
          question,
          extensionId: registered.extensionId,
          host: this,
          facts: this.facts,
          factResolver: this.factResolver,
          diagnostics: this.diagnostics,
        }) as ExtensionDecision<ExtensionDecisionResponse<TQuestion>>;
      } catch (error) {
        const diagnostic = createHostDiagnostic({
          extensionCode: "DECISION_HOOK_FAILED",
          numericCode: ExtensionHostDiagnosticCode.decisionHookFailed,
          message: `Extension '${registered.extensionId}' failed while answering semantic question '${question}'.`,
          evidence: [{ message: "Thrown value", details: error }],
          identity: `decision-hook-failed:${question}:${registered.extensionId}`,
        });
        this.diagnostics.append(diagnostic);
        nonDeferred.push({ kind: "reject", diagnostic, extensionId: registered.extensionId });
        continue;
      }
      if (decision.kind === "defer") {
        continue;
      }
      if (decision.kind === "reject") {
        this.diagnostics.append(decision.diagnostic);
        nonDeferred.push({ kind: "reject", diagnostic: decision.diagnostic, extensionId: registered.extensionId });
        continue;
      }
      nonDeferred.push({
        kind: "accept",
        value: decision.value,
        extensionId: registered.extensionId,
        ...(decision.evidence !== undefined ? { evidence: decision.evidence } : {}),
      });
    }

    if (nonDeferred.length === 0) {
      if (owner !== undefined && options.requireOwner === true) {
        this.diagnostics.append(createHostDiagnostic({
          extensionCode: "DECISION_OWNER_DEFERRED",
          numericCode: ExtensionHostDiagnosticCode.decisionOwnerDeferred,
          message: `Extension '${owner.identity.id}' owns semantic question '${question}' but deferred the decision.`,
          identity: `decision-owner-deferred:${question}:${owner.identity.id}`,
        }));
        return { kind: "owner-deferred", question, extensionId: owner.identity.id };
      }
      return { kind: "core", value: core() };
    }

    if (nonDeferred.length > 1) {
      this.diagnostics.append(createHostDiagnostic({
        extensionCode: "DECISION_CONFLICT",
        numericCode: ExtensionHostDiagnosticCode.decisionConflict,
        message: owner === undefined
          ? `Multiple extensions answered semantic question '${question}' without a registered owner.`
          : `Extension '${owner.identity.id}' returned multiple non-deferred answers for semantic question '${question}'.`,
        evidence: nonDeferred.map((decision) => ({ message: `Decision kind: ${decision.kind}`, details: decision })),
        identity: `decision-conflict:${question}:${owner?.identity.id ?? "unowned"}`,
      }));
      return { kind: "conflict", question };
    }

    return nonDeferred[0]!;
  }

  runLifecycle<TRequest>(event: string, request: TRequest): void {
    const hooks = this.#lifecycleHooks.get(event);
    if (hooks === undefined) {
      return;
    }
    for (const registered of hooks) {
      try {
        registered.hook(request, {
          event,
          extensionId: registered.extensionId,
          host: this,
        });
      } catch (error) {
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

  finalizeSemantics(): void {
    if (this.#finalized) {
      return;
    }
    this.runLifecycle<BeforeSemanticsFinalizedLifecycleRequest>(ExtensionLifecycleEvent.beforeSemanticsFinalized, { host: this });
    this.facts.seal();
    this.#finalized = true;
  }

  get finalized(): boolean {
    return this.#finalized;
  }

  assertFinalizedForConsumer(consumer: string): boolean {
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

  getFactForConsumer<T>(consumer: string, subject: ExtensionFactSubject | undefined, key: ExtensionFactKey<T>): T | undefined {
    if (!this.assertFinalizedForConsumer(consumer)) {
      return undefined;
    }
    if (subject === undefined) {
      return undefined;
    }
    return this.factResolver.resolve(subject, key);
  }

  requireFactForConsumer<T>(consumer: string, subject: ExtensionFactSubject | undefined, key: ExtensionFactKey<T>, purpose?: string): T | undefined {
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

  mustFactForConsumer<T>(consumer: string, subject: ExtensionFactSubject | undefined, key: ExtensionFactKey<T>, purpose?: string): T {
    const value = this.requireFactForConsumer(consumer, subject, key, purpose);
    if (value !== undefined) {
      return value;
    }
    throw new Error(purpose === undefined
      ? `Consumer '${consumer}' requires extension fact '${key.id}'.`
      : `Consumer '${consumer}' requires extension fact '${key.id}' for ${purpose}.`);
  }

  getFactsForConsumer(consumer: string, subject: ExtensionFactSubject | undefined): readonly ExtensionFactEntry<unknown>[] {
    if (!this.assertFinalizedForConsumer(consumer)) {
      return [];
    }
    return this.facts.entries(subject);
  }

  getVirtualDeclarationDocumentForConsumer(consumer: string, uriOrFileName: string): ProviderVirtualDeclarationDocument | undefined {
    if (!this.assertFinalizedForConsumer(consumer)) {
      return undefined;
    }
    return this.providers.getVirtualDeclarationDocument(uriOrFileName);
  }

  #getConsumerSubjectIdentity(subject: ExtensionFactSubject | undefined): string {
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

  #initializeExtensions(): void {
    for (const extension of this.extensions) {
      try {
        extension.initialize?.({
          host: this,
          facts: this.facts,
          factResolver: this.factResolver,
          diagnostics: this.diagnostics,
          providers: this.providers,
          registerDecisionOwner: (question, extensionId) => this.registerDecisionOwner(question, extensionId),
          registerDecisionHook: (question, hook) => this.registerDecisionHook(question, extension.identity.id, hook),
          registerLifecycleHook: (event, hook) => this.registerLifecycleHook(event, extension.identity.id, hook),
          registerTargetBindingProvider: (provider) => this.providers.registerTargetBindingProvider(provider),
          registerTargetSemanticProvider: (provider) => this.registerTargetSemanticProvider(extension.identity.id, provider),
        });
      } catch (error) {
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

  #validateComposition(options: ExtensionHostOptions): void {
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

  #registerTargetSemanticProviderDecisionHooks(extensionId: string, provider: TargetSemanticProvider): void {
    registerProviderDecisionHook(this, extensionId, ExtensionDecisionQuestion.satisfiesConstraint, provider.satisfiesConstraint);
    registerProviderDecisionHook(this, extensionId, ExtensionDecisionQuestion.isAssignableTo, provider.isAssignableTo);
    registerProviderDecisionHook(this, extensionId, ExtensionDecisionQuestion.resolveCall, provider.resolveCall);
    registerProviderDecisionHook(this, extensionId, ExtensionDecisionQuestion.inferTypeArguments, provider.inferTypeArguments);
    registerProviderDecisionHook(this, extensionId, ExtensionDecisionQuestion.resolvePropertyAccess, provider.resolvePropertyAccess);
    registerProviderDecisionHook(this, extensionId, ExtensionDecisionQuestion.resolveElementAccess, provider.resolveElementAccess);
    registerProviderDecisionHook(this, extensionId, ExtensionDecisionQuestion.resolveOperator, provider.resolveOperator);
    registerProviderDecisionHook(this, extensionId, ExtensionDecisionQuestion.getContextualType, provider.getContextualType);
    registerProviderDecisionHook(this, extensionId, ExtensionDecisionQuestion.resolveConversion, provider.resolveConversion);
    registerProviderDecisionHook(this, extensionId, ExtensionDecisionQuestion.getParameterMode, provider.getParameterMode);
    registerProviderDecisionHook(this, extensionId, ExtensionDecisionQuestion.getRuntimeCarrier, provider.getRuntimeCarrier);
    registerProviderDecisionHook(this, extensionId, ExtensionDecisionQuestion.validateFlowUse, provider.validateFlowUse);
  }
}

function registerProviderDecisionHook<TQuestion extends ExtensionDecisionQuestionName>(
  host: ExtensionHost,
  extensionId: string,
  question: TQuestion,
  handler: ((request: ExtensionDecisionRequest<TQuestion>, context: ExtensionDecisionContext<TQuestion>) => ExtensionDecision<ExtensionDecisionResponse<TQuestion>>) | undefined,
): void {
  if (handler === undefined) {
    return;
  }
  host.registerDecisionOwner(question, extensionId);
  host.registerDecisionHook(question, extensionId, (request, context) => handler(request, context));
}

const attachedExtensionHosts = new WeakMap<object, ExtensionHost>();

export function attachExtensionHost<TProgram extends object>(program: TProgram, options: ExtensionHostOptions = {}): ExtendedProgram<TProgram> {
  const host = new ExtensionHost(program, options);
  attachedExtensionHosts.set(program, host);
  return Object.freeze({ program, extensionHost: host });
}

export function attachExtensionHostToProgram<TProgram extends object>(hostOwner: object, program: TProgram): ExtendedProgram<TProgram> | undefined {
  const host = attachedExtensionHosts.get(hostOwner);
  if (host === undefined) {
    return undefined;
  }
  const existing = attachedExtensionHosts.get(program);
  if (existing !== undefined && existing !== host) {
    throw new Error("Program already has a different ExtensionHost.");
  }
  attachedExtensionHosts.set(program, host);
  return Object.freeze({ program, extensionHost: host });
}

export function getExtensionHost(program: object): ExtensionHost | undefined {
  return attachedExtensionHosts.get(program);
}

export function hasExtensionHost(program: object): boolean {
  return attachedExtensionHosts.has(program);
}

function orderExtensions(extensions: readonly CompilerExtension[], diagnostics: ExtensionDiagnosticStore): readonly CompilerExtension[] {
  const extensionsById = new Map<string, CompilerExtension>();
  const invalidExtensionIds = new Set<string>();
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

  const outgoingEdges = new Map<string, Set<string>>();
  const incomingCounts = new Map<string, number>();
  for (const id of extensionsById.keys()) {
    outgoingEdges.set(id, new Set<string>());
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
  const ordered: CompilerExtension[] = [];

  while (ready.length > 0) {
    const id = ready.shift()!;
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

function addOrderingEdge(outgoingEdges: Map<string, Set<string>>, incomingCounts: Map<string, number>, from: string, to: string): void {
  const dependents = outgoingEdges.get(from);
  if (dependents === undefined || dependents.has(to)) {
    return;
  }
  dependents.add(to);
  incomingCounts.set(to, (incomingCounts.get(to) ?? 0) + 1);
}

function propagateInvalidDependencies(extensionsById: ReadonlyMap<string, CompilerExtension>, invalidExtensionIds: Set<string>): void {
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

function callProvider<T>(
  diagnostics: ExtensionDiagnosticStore,
  identity: ProviderIdentity,
  operation: "ownsModule" | "resolveModule" | "getDeclarationModel",
  specifier: string,
  callback: () => T,
): T | undefined {
  try {
    return callback();
  } catch (error) {
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

function createHostDiagnostic(input: {
  readonly extensionCode: string;
  readonly numericCode: number;
  readonly message: string;
  readonly evidence?: readonly ExtensionEvidence[];
  readonly identity?: string;
}): ExtensionDiagnostic {
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

function getDiagnosticIdentity(diagnostic: ExtensionDiagnostic): string {
  return diagnostic.identity ?? [
    diagnostic.extensionId,
    diagnostic.extensionCode,
    diagnostic.numericCode,
    diagnostic.category,
    diagnostic.message,
  ].join(":");
}

function isValidDiagnosticRange(range: ExtensionDiagnosticRange): boolean {
  return Number.isSafeInteger(range.start)
    && Number.isSafeInteger(range.end)
    && range.start > 0
    && range.start <= range.end;
}

function isDiagnosticCodeInRange(code: number, range: ExtensionDiagnosticRange): boolean {
  return Number.isSafeInteger(code) && code >= range.start && code <= range.end;
}

function isExtensionFactSubject(subject: unknown): subject is ExtensionFactSubject {
  return (typeof subject === "object" && subject !== null) || typeof subject === "function";
}

function diagnosticRangesOverlap(left: ExtensionDiagnosticRange, right: ExtensionDiagnosticRange): boolean {
  return left.start <= right.end && right.start <= left.end;
}

function getProviderResolveCacheKey(identity: ProviderIdentity, specifier: string, context: ProviderModuleContext): string {
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
  ].join("\0");
}

function renderProviderDeclarationModel(model: ProviderDeclarationModel): string {
  const lines = [
    `// @tsts-provider-module ${model.providerModuleId}`,
    `// @tsts-provider-specifier ${JSON.stringify(model.moduleSpecifier)}`,
  ];
  for (const exportDeclaration of model.exports) {
    lines.push(renderProviderExportDeclaration(exportDeclaration));
  }
  return `${lines.join("\n")}\n`;
}

function renderProviderExportDeclaration(declaration: ProviderExportDeclaration): string {
  const typeParameters = renderProviderTypeParameters(declaration.typeParameters ?? []);
  switch (declaration.kind) {
    case "class":
      return `export declare class ${declaration.name}${typeParameters} {\n${renderProviderMembers(declaration.members ?? [])}\n}`;
    case "interface":
      return `export interface ${declaration.name}${typeParameters} {\n${renderProviderMembers(declaration.members ?? [])}\n}`;
    case "function":
      return renderProviderSignatures(declaration.name, declaration.signatures ?? [])
        .map((signature) => `export declare function ${signature}`)
        .join("\n");
    case "type":
      return `export type ${declaration.name}${typeParameters} = ${renderProviderTypeExpression(declaration.type!)};`;
    case "value":
      return `export declare const ${declaration.name}: ${renderProviderTypeExpression(declaration.type!)};`;
    case "namespace":
      return `export declare namespace ${declaration.name} {\n${renderProviderMembers(declaration.members ?? [])}\n}`;
    case "enum":
      return `export declare enum ${declaration.name} {\n${(declaration.members ?? []).map((member) => `  ${member.name},`).join("\n")}\n}`;
    case "opaque":
      return `export declare const ${declaration.name}: unique symbol;`;
  }
}

function renderProviderMembers(members: readonly ProviderMemberDeclaration[]): string {
  return members.map((member) => `  ${renderProviderMember(member)}`).join("\n");
}

function renderProviderMember(member: ProviderMemberDeclaration): string {
  const staticPrefix = member.static === true ? "static " : "";
  switch (member.kind) {
    case "constructor":
      return renderProviderSignatures("constructor", member.signatures ?? [{ id: member.id, parameters: [] }]).join("\n  ");
    case "method":
      return renderProviderSignatures(member.name, member.signatures ?? []).map((signature) => `${staticPrefix}${signature}`).join("\n  ");
    case "property":
    case "field":
      return `${staticPrefix}${member.name}: ${renderProviderTypeExpression(member.type!)};`;
    case "indexer": {
      const signature = member.signatures![0]!;
      const parameter = signature.parameters[0]!;
      return `[${renderProviderParameter(parameter)}]: ${renderProviderTypeExpression(signature.returnType!)};`;
    }
  }
}

function renderProviderSignatures(name: string, signatures: readonly ProviderSignatureDeclaration[]): readonly string[] {
  return signatures.map((signature) => {
    const typeParameters = renderProviderTypeParameters(signature.typeParameters ?? []);
    const parameters = signature.parameters.map(renderProviderParameter).join(", ");
    const returnType = name === "constructor" ? "" : `: ${renderProviderTypeExpression(signature.returnType ?? { kind: "void" })}`;
    return `${name}${typeParameters}(${parameters})${returnType};`;
  });
}

function renderProviderTypeParameters(typeParameters: readonly ProviderTypeParameterDeclaration[]): string {
  if (typeParameters.length === 0) {
    return "";
  }
  return `<${typeParameters.map((parameter) => {
    const constraints = parameter.constraints ?? [];
    return constraints.length === 0
      ? parameter.name
      : `${parameter.name} extends ${constraints.map(renderProviderTypeExpression).join(" & ")}`;
  }).join(", ")}>`;
}

function renderProviderParameter(parameter: ProviderParameterDeclaration): string {
  const restPrefix = parameter.rest === true ? "..." : "";
  const optionalSuffix = parameter.optional === true && parameter.rest !== true ? "?" : "";
  return `${restPrefix}${parameter.name}${optionalSuffix}: ${renderProviderTypeExpression(parameter.type)}`;
}

function renderProviderTypeExpression(type: ProviderTypeExpression): string {
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
      return renderProviderTypeExpression(type.sourceShape!);
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
  }
}

function renderSourcePrimitiveType(name: SourcePrimitiveKind): string {
  switch (name) {
    case "bool":
      return "boolean";
    case "char":
      return "string";
    default:
      return "number";
  }
}

function validateProviderIdentity(identity: ProviderIdentity, expectedKind: "binding" | "semantic"): ExtensionDiagnostic | undefined {
  const invalidFields: string[] = [];
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

function isExtensionDiagnostic(value: ProviderModuleResolution | ProviderDeclarationModel | ExtensionDiagnostic): value is ExtensionDiagnostic {
  return "extensionId" in value
    && typeof value.extensionId === "string"
    && typeof value.extensionCode === "string"
    && typeof value.numericCode === "number"
    && typeof value.category === "string"
    && typeof value.message === "string";
}

function isValidProviderModuleResolution(value: ProviderModuleResolution, specifier: string): boolean {
  return value.kind === "virtual"
    && value.moduleSpecifier === specifier
    && value.virtualFileName.length > 0
    && value.providerModuleId.length > 0;
}

function isValidProviderDeclarationModel(value: ProviderDeclarationModel, resolution: ProviderModuleResolution): boolean {
  return value.moduleSpecifier === resolution.moduleSpecifier
    && value.providerModuleId === resolution.providerModuleId
    && Array.isArray(value.exports)
    && value.exports.every(isValidProviderExportDeclaration);
}

function isValidProviderExportDeclaration(value: ProviderExportDeclaration): boolean {
  return value.id.length > 0
    && isIdentifierText(value.name)
    && hasRequiredProviderExportShape(value)
    && (value.type === undefined || isValidProviderTypeExpression(value.type))
    && (value.typeParameters ?? []).every(isValidProviderTypeParameterDeclaration)
    && (value.signatures ?? []).every(isValidProviderSignatureDeclaration)
    && (value.kind === "enum"
      ? (value.members ?? []).every(isValidProviderEnumMemberDeclaration)
      : (value.members ?? []).every(isValidProviderMemberDeclaration));
}

function hasRequiredProviderExportShape(value: ProviderExportDeclaration): boolean {
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

function isValidProviderMemberDeclaration(value: ProviderMemberDeclaration): boolean {
  return value.id.length > 0
    && (value.kind === "constructor" || isIdentifierText(value.name))
    && hasRequiredProviderMemberShape(value)
    && (value.type === undefined || isValidProviderTypeExpression(value.type))
    && (value.signatures ?? []).every(isValidProviderSignatureDeclaration);
}

function isValidProviderEnumMemberDeclaration(value: ProviderMemberDeclaration): boolean {
  return value.id.length > 0 && isIdentifierText(value.name);
}

function hasRequiredProviderMemberShape(value: ProviderMemberDeclaration): boolean {
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

function isValidProviderSignatureDeclaration(value: ProviderSignatureDeclaration): boolean {
  return value.id.length > 0
    && (value.name === undefined || isIdentifierText(value.name))
    && value.parameters.every(isValidProviderParameterDeclaration)
    && (value.returnType === undefined || isValidProviderTypeExpression(value.returnType))
    && (value.typeParameters ?? []).every(isValidProviderTypeParameterDeclaration);
}

function isValidProviderParameterDeclaration(value: ProviderParameterDeclaration): boolean {
  return isIdentifierText(value.name) && isValidProviderTypeExpression(value.type);
}

function isValidProviderTypeParameterDeclaration(value: ProviderTypeParameterDeclaration): boolean {
  return isIdentifierText(value.name) && (value.constraints ?? []).every(isValidProviderTypeExpression);
}

function isValidProviderTypeExpression(value: ProviderTypeExpression): boolean {
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
    case "opaque":
      return value.id.length > 0
        && value.sourceShape !== undefined
        && isValidProviderTypeExpression(value.sourceShape);
  }
}

function isIdentifierText(text: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(text);
}

function isKnownSourcePrimitive(name: SourcePrimitiveKind): boolean {
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
